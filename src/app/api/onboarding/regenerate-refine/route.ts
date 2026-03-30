import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requestRefineFromWorker } from "@/lib/ai/worker-client";
import { requireApiUser } from "@/lib/auth";
import { businessBriefDraftSchema } from "@/lib/onboarding/types";
import { recordPlatformEvent } from "@/lib/platform-events";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  siteId: z.string().uuid(),
  feedbackPrompt: z.string().min(8).max(2000),
  currentBrief: businessBriefDraftSchema.partial().optional(),
  currentSiteSummary: z.string().max(1200).optional(),
  sectionList: z.array(z.string()).max(12).optional(),
  productCount: z.number().int().min(0).max(1000).optional(),
  imageCount: z.number().int().min(0).max(5000).optional()
});

type RegenerationRefineResponse = {
  assistantSummary: string;
  followUpQuestion: string | null;
  refinedPrompt: string;
  provider: "llm" | "heuristic";
};

export async function POST(request: NextRequest) {
  const { user, supabase } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { siteId, feedbackPrompt, currentBrief, currentSiteSummary, sectionList, productCount, imageCount } = parsed.data;

  const { data: site } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", siteId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const workerAttempt = await requestRefineFromWorker({
    rawInput: feedbackPrompt,
    inputMode: "text",
    currentBrief: currentBrief ?? null,
    generationMode: "regenerate",
    regenerationContext: {
      currentSiteSummary: currentSiteSummary ?? null,
      feedbackPrompt,
      businessName: site.name,
      businessType: currentBrief?.business_type ?? null,
      sectionList: sectionList ?? null,
      productCount: productCount ?? null,
      imageCount: imageCount ?? null
    }
  });

  const normalized = normalizeRegenerationRefine(workerAttempt.ok ? workerAttempt.data : null, feedbackPrompt, currentBrief ?? null);

  try {
    await recordPlatformEvent(admin, {
      eventType: "onboarding.regenerate_refine.completed",
      userId: user.id,
      siteId,
      payload: {
        provider: normalized.provider,
        hasFollowUpQuestion: Boolean(normalized.followUpQuestion)
      }
    });
  } catch {
    // best effort
  }

  return NextResponse.json(normalized);
}

function normalizeRegenerationRefine(
  payload: unknown,
  feedbackPrompt: string,
  currentBrief: Partial<z.infer<typeof businessBriefDraftSchema>> | null
): RegenerationRefineResponse {
  if (payload && typeof payload === "object") {
    const candidate = payload as {
      assistantSummary?: unknown;
      followUpQuestion?: unknown;
      refinedPrompt?: unknown;
    };
    if (typeof candidate.assistantSummary === "string" && candidate.assistantSummary.trim()) {
      return {
        assistantSummary: candidate.assistantSummary.trim(),
        followUpQuestion:
          typeof candidate.followUpQuestion === "string" && candidate.followUpQuestion.trim() ? candidate.followUpQuestion.trim() : null,
        refinedPrompt:
          typeof candidate.refinedPrompt === "string" && candidate.refinedPrompt.trim() ? candidate.refinedPrompt.trim() : feedbackPrompt,
        provider: "llm"
      };
    }
  }

  return {
    assistantSummary: `Perfecto. Voy a conservar el contenido actual y enfocar la nueva propuesta en esto: ${feedbackPrompt.trim()}.`,
    followUpQuestion: buildFallbackFollowUpQuestion(feedbackPrompt, currentBrief?.business_type ?? null),
    refinedPrompt: feedbackPrompt.trim(),
    provider: "heuristic"
  };
}

function buildFallbackFollowUpQuestion(feedbackPrompt: string, businessType: z.infer<typeof businessBriefDraftSchema>["business_type"] | null) {
  const lower = feedbackPrompt.toLowerCase();
  if (!/(premium|editorial|minimal|moderno|oscuro|claro|elegante|audaz|comercial|sofisticad)/.test(lower)) {
    return "Antes de regenerar, ¿la quieres más premium, más comercial, más minimalista o más editorial?";
  }
  if (businessType === "commerce_lite" && !/(producto|catalog|catálogo|imagen|tienda)/.test(lower)) {
    return "¿Prefieres que destaque más el hero de marca o el catálogo y las imágenes de producto?";
  }
  return null;
}

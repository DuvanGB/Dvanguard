import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { startSiteGeneration } from "@/lib/ai/start-site-generation";
import { requireApiUser } from "@/lib/auth";
import { getRequestClientKey } from "@/lib/http";
import { buildPromptFromBrief } from "@/lib/onboarding/prompt-builder";
import { businessBriefDraftSchema, onboardingInputModeSchema } from "@/lib/onboarding/types";
import { recordPlatformEvent } from "@/lib/platform-events";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getTemplateById } from "@/lib/templates/catalog";
import { templateIds } from "@/lib/templates/types";
import { env } from "@/lib/env";

const bodySchema = z.object({
  siteId: z.string().uuid(),
  prompt: z.string().min(10).max(env.onboardingMaxInputChars).optional(),
  briefDraft: businessBriefDraftSchema.optional(),
  inputMode: onboardingInputModeSchema.optional(),
  templateId: z.enum(templateIds).optional(),
  recommendedTemplateId: z.enum(templateIds).optional(),
  refineConfidence: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string()).max(20).optional()
}).superRefine((value, ctx) => {
  if (!value.prompt && !value.briefDraft) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "prompt or briefDraft is required" });
  }
});

export async function POST(request: NextRequest) {
  const { user, supabase } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = enforceRateLimit({
    key: `ai:generate:${getRequestClientKey(request, user.id)}`,
    limit: 30,
    windowMs: 60_000
  });

  if (!rate.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { siteId, prompt, briefDraft, inputMode = "text", templateId, recommendedTemplateId, refineConfidence, warnings } = parsed.data;
  if (templateId && briefDraft) {
    const selectedTemplate = getTemplateById(templateId);
    if (!selectedTemplate || selectedTemplate.site_type !== briefDraft.business_type) {
      return NextResponse.json({ error: "Template no válida para el tipo de sitio seleccionado." }, { status: 400 });
    }
  }

  const promptToUse = briefDraft ? buildPromptFromBrief(briefDraft, { templateId }) : prompt!;
  const admin = getSupabaseAdminClient();

  if (templateId) {
    try {
      await recordPlatformEvent(admin, {
        eventType: "template.selected",
        userId: user.id,
        siteId,
        payload: {
          templateId,
          recommendedTemplateId: recommendedTemplateId ?? null,
          selectedRecommended: recommendedTemplateId ? recommendedTemplateId === templateId : null
        }
      });
    } catch {
      // best effort
    }
  }

  const result = await startSiteGeneration({
    supabase,
    admin,
    userId: user.id,
    siteId,
    prompt: promptToUse,
    briefDraft,
    inputMode,
    templateId,
    refineConfidence,
    warningsCount: warnings?.length ?? 0
  });

  if (result.ok) {
    return NextResponse.json(
      {
        ...result.data,
        generationMode: "hybrid_locked",
        seedApplied: true
      },
      { status: result.status }
    );
  }

  return NextResponse.json(result.data, { status: result.status });
}

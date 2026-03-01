import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getRequestClientKey } from "@/lib/http";
import { refineBusinessBrief } from "@/lib/onboarding/refine-brief";
import { onboardingInputModeSchema } from "@/lib/onboarding/types";
import { recordPlatformEvent } from "@/lib/platform-events";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  siteId: z.string().uuid(),
  rawInput: z.string().min(10).max(env.onboardingMaxInputChars),
  inputMode: onboardingInputModeSchema,
  voiceEvent: z.enum(["unsupported", "permission_denied"]).nullable().optional()
});

export async function POST(request: NextRequest) {
  const { user, supabase } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = enforceRateLimit({
    key: `onboarding:refine:${getRequestClientKey(request, user.id)}`,
    limit: 20,
    windowMs: 60_000
  });

  if (!rate.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { siteId, rawInput, inputMode, voiceEvent } = parsed.data;
  const admin = getSupabaseAdminClient();

  const { data: site } = await supabase.from("sites").select("id").eq("id", siteId).eq("owner_id", user.id).maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  try {
    await recordPlatformEvent(admin, {
      eventType: "onboarding.refine.started",
      userId: user.id,
      siteId,
      payload: {
        inputMode,
        inputLength: rawInput.length
      }
    });
  } catch {
    // best effort
  }

  if (voiceEvent) {
    try {
      await recordPlatformEvent(admin, {
        eventType: voiceEvent === "unsupported" ? "onboarding.voice.unsupported" : "onboarding.voice.permission_denied",
        userId: user.id,
        siteId,
        payload: {
          inputMode
        }
      });
    } catch {
      // best effort
    }
  }

  const refined = await refineBusinessBrief({ rawInput, inputMode });

  try {
    await recordPlatformEvent(admin, {
      eventType: "onboarding.refine.completed",
      userId: user.id,
      siteId,
      payload: {
        inputMode,
        confidence: refined.confidence,
        warningsCount: refined.warnings.length,
        provider: refined.provider
      }
    });
  } catch {
    // best effort
  }

  try {
    await recordPlatformEvent(admin, {
      eventType: "template.recommended",
      userId: user.id,
      siteId,
      payload: {
        recommendedTemplateId: refined.recommendedTemplateId,
        recommendedTemplateIds: refined.recommendedTemplateIds
      }
    });
  } catch {
    // best effort
  }

  return NextResponse.json({
    briefDraft: refined.briefDraft,
    confidence: refined.confidence,
    warnings: refined.warnings,
    recommendedTemplateId: refined.recommendedTemplateId,
    recommendedTemplateIds: refined.recommendedTemplateIds
  });
}

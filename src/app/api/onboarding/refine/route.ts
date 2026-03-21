import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getRequestClientKey } from "@/lib/http";
import { refineBusinessBrief } from "@/lib/onboarding/refine-brief";
import { businessBriefDraftSchema, onboardingInputModeSchema } from "@/lib/onboarding/types";
import { recordPlatformEvent } from "@/lib/platform-events";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  siteId: z.string().uuid(),
  rawInput: z.string().min(10).max(env.onboardingMaxInputChars),
  inputMode: onboardingInputModeSchema,
  currentBrief: businessBriefDraftSchema.partial().optional(),
  followUpAnswer: z.string().min(1).max(500).optional(),
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

  const { data: site } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", siteId)
    .eq("owner_id", user.id)
    .maybeSingle();
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

  const refined = await refineBusinessBrief({
    rawInput,
    inputMode,
    currentBrief: parsed.data.currentBrief ?? null,
    followUpAnswer: parsed.data.followUpAnswer ?? null
  });
  const briefDraft = site.name?.trim()
    ? { ...refined.briefDraft, business_name: site.name.trim() }
    : refined.briefDraft;

  try {
    await recordPlatformEvent(admin, {
      eventType: "onboarding.refine.completed",
      userId: user.id,
      siteId,
      payload: {
        inputMode,
        confidence: refined.confidence,
        completenessScore: refined.completenessScore,
        warningsCount: refined.warnings.length,
        provider: refined.provider,
        missingFields: refined.missingFields
      }
    });
  } catch {
    // best effort
  }

  return NextResponse.json({
    briefDraft,
    confidence: refined.confidence,
    completenessScore: refined.completenessScore,
    warnings: refined.warnings,
    provider: refined.provider,
    followUpQuestion: refined.followUpQuestion ?? null,
    missingFields: refined.missingFields
  });
}

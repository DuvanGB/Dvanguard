import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { startSiteGeneration } from "@/lib/ai/start-site-generation";
import { requireApiUser } from "@/lib/auth";
import { getRequestClientKey } from "@/lib/http";
import { buildPromptFromBrief } from "@/lib/onboarding/prompt-builder";
import { businessBriefDraftSchema, onboardingInputModeSchema } from "@/lib/onboarding/types";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  siteId: z.string().uuid(),
  inputMode: onboardingInputModeSchema,
  briefDraft: businessBriefDraftSchema,
  refineConfidence: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string()).max(20).optional()
});

export async function POST(request: NextRequest) {
  const { user, supabase } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = enforceRateLimit({
    key: `onboarding:generate:${getRequestClientKey(request, user.id)}`,
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

  const { siteId, inputMode, briefDraft, refineConfidence, warnings } = parsed.data;
  const prompt = buildPromptFromBrief(briefDraft);

  const result = await startSiteGeneration({
    supabase,
    admin: getSupabaseAdminClient(),
    userId: user.id,
    siteId,
    prompt,
    inputMode,
    refineConfidence,
    warningsCount: warnings?.length ?? 0
  });

  return NextResponse.json(result.data, { status: result.status });
}

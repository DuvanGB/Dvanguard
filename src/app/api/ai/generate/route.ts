import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { getUsageSnapshot, incrementAiGenerationUsage } from "@/lib/billing/usage";
import { executeSiteGenerationJob } from "@/lib/ai/process-site-generation";
import { getRequestClientKey } from "@/lib/http";
import { logError, logInfo } from "@/lib/logger";
import { recordPlatformEvent } from "@/lib/platform-events";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  siteId: z.string().uuid(),
  prompt: z.string().min(10).max(3000)
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

  const { siteId, prompt } = parsed.data;
  const admin = getSupabaseAdminClient();

  const { data: site } = await supabase
    .from("sites")
    .select("id, owner_id")
    .eq("id", siteId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const usage = await getUsageSnapshot(admin, user.id);
  if (usage.ai_generations_used >= usage.ai_generations_limit) {
    try {
      await recordPlatformEvent(admin, {
        eventType: "plan.limit_hit.ai",
        userId: user.id,
        siteId,
        payload: {
          plan: usage.plan,
          used: usage.ai_generations_used,
          limit: usage.ai_generations_limit
        }
      });
    } catch {
      // best effort event logging
    }

    return NextResponse.json(
      {
        error: "Has alcanzado el límite mensual de generaciones IA de tu plan.",
        plan: usage.plan,
        ai_generations_used: usage.ai_generations_used,
        ai_generations_limit: usage.ai_generations_limit
      },
      { status: 402 }
    );
  }

  const { data: job, error: jobError } = await supabase
    .from("ai_jobs")
    .insert({
      site_id: siteId,
      created_by: user.id,
      job_type: "site_generation",
      input_json: { prompt },
      status: "queued"
    })
    .select("id")
    .maybeSingle();

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? "Failed to create AI job" }, { status: 400 });
  }

  await supabase.from("ai_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", job.id);

  const result = await executeSiteGenerationJob({
    supabase,
    siteId,
    prompt,
    jobId: job.id,
    eventType: "site.generated"
  });

  if (!result.ok) {
    logError("ai_generation_failed", { jobId: job.id, siteId, error: result.error });
    return NextResponse.json({ jobId: job.id, status: "failed", error: result.error }, { status: 500 });
  }

  await incrementAiGenerationUsage(admin, user.id);

  logInfo("ai_generation_done", {
    jobId: job.id,
    siteId,
    source: result.source,
    latencyMs: result.latencyMs,
    fallbackReason: result.fallbackReason
  });

  return NextResponse.json({
    jobId: job.id,
    status: "done",
    versionId: result.versionId,
    source: result.source,
    latencyMs: result.latencyMs,
    fallbackReason: result.fallbackReason
  });
}

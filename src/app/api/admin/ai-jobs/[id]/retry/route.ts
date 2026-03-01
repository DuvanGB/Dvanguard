import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { executeSiteGenerationJob } from "@/lib/ai/process-site-generation";
import { getRequestClientKey } from "@/lib/http";
import { logError, logInfo } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAdminApiUser();

  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rate = enforceRateLimit({
    key: `admin:retry:${getRequestClientKey(request, auth.user.id)}`,
    limit: 10,
    windowMs: 60_000
  });

  if (!rate.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const admin = getSupabaseAdminClient();

  const { data: sourceJob, error: sourceError } = await admin
    .from("ai_jobs")
    .select("id, site_id, created_by, input_json, status, attempt")
    .eq("id", id)
    .maybeSingle();

  if (sourceError || !sourceJob) {
    return NextResponse.json({ error: "Source job not found" }, { status: 404 });
  }

  if (sourceJob.status !== "failed") {
    return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 400 });
  }

  const prompt = ((sourceJob.input_json ?? {}) as Record<string, unknown>).prompt;
  if (typeof prompt !== "string" || prompt.trim().length < 10) {
    return NextResponse.json({ error: "Source job prompt is invalid" }, { status: 400 });
  }

  const { data: retryJob, error: retryError } = await admin
    .from("ai_jobs")
    .insert({
      site_id: sourceJob.site_id,
      created_by: sourceJob.created_by,
      job_type: "site_generation",
      input_json: { prompt },
      status: "queued",
      retry_of_job_id: sourceJob.id,
      attempt: (sourceJob.attempt ?? 1) + 1
    })
    .select("id")
    .maybeSingle();

  if (retryError || !retryJob) {
    return NextResponse.json({ error: retryError?.message ?? "Failed to create retry job" }, { status: 400 });
  }

  await admin
    .from("ai_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", retryJob.id);

  const result = await executeSiteGenerationJob({
    supabase: admin,
    siteId: sourceJob.site_id,
    prompt,
    jobId: retryJob.id,
    eventType: "site.generation.retried",
    extraEventPayload: {
      retryOfJobId: sourceJob.id,
      requestedByAdminId: auth.user.id
    }
  });

  if (!result.ok) {
    logError("admin_retry_generation_failed", {
      retryJobId: retryJob.id,
      sourceJobId: sourceJob.id,
      siteId: sourceJob.site_id,
      error: result.error
    });

    return NextResponse.json(
      {
        status: "failed",
        retryJobId: retryJob.id,
        sourceJobId: sourceJob.id,
        error: result.error
      },
      { status: 500 }
    );
  }

  logInfo("admin_retry_generation_done", {
    retryJobId: retryJob.id,
    sourceJobId: sourceJob.id,
    siteId: sourceJob.site_id,
    versionId: result.versionId,
    source: result.source,
    latencyMs: result.latencyMs
  });

  return NextResponse.json({
    status: "done",
    retryJobId: retryJob.id,
    sourceJobId: sourceJob.id,
    versionId: result.versionId,
    source: result.source,
    latencyMs: result.latencyMs,
    fallbackReason: result.fallbackReason
  });
}

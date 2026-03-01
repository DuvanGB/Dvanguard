import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { generateSiteSpecFromPrompt } from "@/lib/ai/generate-site-spec";
import { getRequestClientKey } from "@/lib/http";
import { logError, logInfo } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildFallbackSiteSpec } from "@/lib/site-spec";

const bodySchema = z.object({
  siteId: z.string().uuid(),
  prompt: z.string().min(10).max(3000)
});

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
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

  const { data: site } = await supabase
    .from("sites")
    .select("id, owner_id")
    .eq("id", siteId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
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

  try {
    let generation: Awaited<ReturnType<typeof generateSiteSpecFromPrompt>>;
    let fallbackReason: string | null = null;

    try {
      generation = await Promise.race([
        generateSiteSpecFromPrompt(prompt),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), 18_000))
      ]);
    } catch (generationError) {
      fallbackReason = generationError instanceof Error ? generationError.message : "Unknown AI error";
      generation = { siteSpec: buildFallbackSiteSpec(prompt), source: "fallback" };
    }

    const { data: latestVersion } = await supabase
      .from("site_versions")
      .select("version")
      .eq("site_id", siteId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    const { data: version, error: versionError } = await supabase
      .from("site_versions")
      .insert({
        site_id: siteId,
        version: nextVersion,
        site_spec_json: generation.siteSpec,
        source: generation.source
      })
      .select("id")
      .maybeSingle();

    if (versionError || !version) {
      throw new Error(versionError?.message ?? "Failed to persist site version");
    }

    await supabase
      .from("sites")
      .update({
        current_version_id: version.id,
        site_type: generation.siteSpec.site_type
      })
      .eq("id", siteId);

    const latencyMs = Date.now() - startedAt;

    await supabase
      .from("ai_jobs")
      .update({
        status: "done",
        output_json: {
          versionId: version.id,
          source: generation.source,
          latencyMs,
          fallbackReason
        },
        completed_at: new Date().toISOString()
      })
      .eq("id", job.id);

    await supabase.from("events").insert({
      site_id: siteId,
      event_type: "site.generated",
      payload_json: { jobId: job.id, latencyMs, source: generation.source, fallbackReason }
    });

    logInfo("ai_generation_done", {
      jobId: job.id,
      siteId,
      source: generation.source,
      latencyMs,
      fallbackReason
    });

    return NextResponse.json({
      jobId: job.id,
      status: "done",
      versionId: version.id,
      source: generation.source,
      latencyMs,
      fallbackReason
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await supabase
      .from("ai_jobs")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", job.id);

    logError("ai_generation_failed", { jobId: job.id, siteId, error: message });
    return NextResponse.json({ jobId: job.id, status: "failed", error: message }, { status: 500 });
  }
}

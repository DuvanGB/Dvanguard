import type { SupabaseClient } from "@supabase/supabase-js";

import { executeSiteGenerationJob } from "@/lib/ai/process-site-generation";
import { getUsageSnapshot, incrementAiGenerationUsage } from "@/lib/billing/usage";
import { logError, logInfo } from "@/lib/logger";
import type { BusinessBriefDraft } from "@/lib/onboarding/types";
import { recordPlatformEvent } from "@/lib/platform-events";
import type { TemplateId } from "@/lib/templates/types";

type StartGenerationInput = {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  userId: string;
  siteId: string;
  prompt: string;
  briefDraft?: BusinessBriefDraft;
  inputMode: "text" | "voice";
  templateId?: TemplateId;
  refineConfidence?: number;
  warningsCount?: number;
};

type StartGenerationResult =
  | {
      ok: true;
      status: 200;
      data: {
        jobId: string;
        status: "done";
        versionId?: string;
        source?: string;
        latencyMs?: number;
        fallbackReason?: string | null;
      };
    }
  | {
      ok: false;
      status: 400 | 402 | 404 | 500;
      data: Record<string, unknown>;
    };

export async function startSiteGeneration(input: StartGenerationInput): Promise<StartGenerationResult> {
  const { supabase, admin, userId, siteId, prompt } = input;

  const { data: site } = await supabase
    .from("sites")
    .select("id, owner_id")
    .eq("id", siteId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!site) {
    return { ok: false, status: 404, data: { error: "Site not found" } };
  }

  const usage = await getUsageSnapshot(admin, userId);
  if (usage.ai_generations_used >= usage.ai_generations_limit) {
    try {
      await recordPlatformEvent(admin, {
        eventType: "plan.limit_hit.ai",
        userId,
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

    return {
      ok: false,
      status: 402,
      data: {
        error: "Has alcanzado el límite mensual de generaciones IA de tu plan.",
        plan: usage.plan,
        ai_generations_used: usage.ai_generations_used,
        ai_generations_limit: usage.ai_generations_limit
      }
    };
  }

  const { count: previousJobsCount } = await supabase
    .from("ai_jobs")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .eq("created_by", userId)
    .eq("job_type", "site_generation");

  const { data: job, error: jobError } = await supabase
    .from("ai_jobs")
    .insert({
      site_id: siteId,
      created_by: userId,
      job_type: "site_generation",
      input_json: {
        prompt,
        briefDraft: input.briefDraft ?? null,
        meta: {
          input_mode: input.inputMode,
          template_id: input.templateId ?? null,
          refine_confidence: input.refineConfidence ?? null,
          warnings_count: input.warningsCount ?? 0
        }
      },
      status: "queued"
    })
    .select("id")
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, status: 400, data: { error: jobError?.message ?? "Failed to create AI job" } };
  }

  await supabase.from("ai_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", job.id);

  const result = await executeSiteGenerationJob({
    supabase,
    siteId,
    prompt,
    jobId: job.id,
    eventType: "site.generated",
    templateId: input.templateId,
    briefDraft: input.briefDraft,
    extraEventPayload: {
      inputMode: input.inputMode,
      templateId: input.templateId ?? null,
      refineConfidence: input.refineConfidence ?? null,
      warningsCount: input.warningsCount ?? 0
    }
  });

  if (!result.ok) {
    logError("ai_generation_failed", { jobId: job.id, siteId, error: result.error });
    return { ok: false, status: 500, data: { jobId: job.id, status: "failed", error: result.error } };
  }

  await incrementAiGenerationUsage(admin, userId);

  try {
    await recordPlatformEvent(admin, {
      eventType: (previousJobsCount ?? 0) === 0 ? "site.generation.first_attempt_done" : "site.generation.regenerated",
      userId,
      siteId,
      payload: {
        jobId: job.id,
        inputMode: input.inputMode,
        templateId: input.templateId ?? null,
        refineConfidence: input.refineConfidence ?? null,
        warningsCount: input.warningsCount ?? 0
      }
    });
  } catch {
    // best effort event logging
  }

  logInfo("ai_generation_done", {
    jobId: job.id,
    siteId,
    source: result.source,
    latencyMs: result.latencyMs,
    fallbackReason: result.fallbackReason
  });

  return {
    ok: true,
    status: 200,
    data: {
      jobId: job.id,
      status: "done",
      versionId: result.versionId,
      source: result.source,
      latencyMs: result.latencyMs,
      fallbackReason: result.fallbackReason
    }
  };
}

export async function maybeRecordFirstResultAccepted(input: {
  admin: SupabaseClient;
  userId: string;
  siteId: string;
  action: "publish" | "manual_save";
}) {
  const { admin, siteId, userId, action } = input;

  const { data: existingAccepted } = await admin
    .from("platform_events")
    .select("id")
    .eq("site_id", siteId)
    .eq("user_id", userId)
    .eq("event_type", "site.first_result.accepted")
    .limit(1)
    .maybeSingle();

  if (existingAccepted) {
    return false;
  }

  const { data: firstGeneration } = await admin
    .from("ai_jobs")
    .select("id, created_at")
    .eq("site_id", siteId)
    .eq("created_by", userId)
    .eq("job_type", "site_generation")
    .eq("status", "done")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstGeneration) {
    return false;
  }

  const firstGenerationAt = new Date(firstGeneration.created_at);
  if (Number.isNaN(firstGenerationAt.getTime())) {
    return false;
  }

  if (Date.now() - firstGenerationAt.getTime() > 24 * 60 * 60 * 1000) {
    return false;
  }

  const { count: successfulGenerations } = await admin
    .from("ai_jobs")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .eq("created_by", userId)
    .eq("job_type", "site_generation")
    .eq("status", "done");

  if ((successfulGenerations ?? 0) !== 1) {
    return false;
  }

  await recordPlatformEvent(admin, {
    eventType: "site.first_result.accepted",
    userId,
    siteId,
    payload: {
      action,
      firstGenerationAt: firstGeneration.created_at
    }
  });

  const { data: currentVersion } = await admin
    .from("sites")
    .select("current_version_id")
    .eq("id", siteId)
    .maybeSingle();

  if (currentVersion?.current_version_id) {
    const { data: version } = await admin
      .from("site_versions")
      .select("site_spec_json")
      .eq("id", currentVersion.current_version_id)
      .maybeSingle();

    const schemaVersion = (version?.site_spec_json as { schema_version?: string } | null)?.schema_version;
    if (schemaVersion === "3.0") {
      await recordPlatformEvent(admin, {
        eventType: "site.v3.first_result.accepted",
        userId,
        siteId,
        payload: {
          action,
          firstGenerationAt: firstGeneration.created_at
        }
      });
    }
  }

  return true;
}

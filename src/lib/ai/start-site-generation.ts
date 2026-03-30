import type { SupabaseClient } from "@supabase/supabase-js";

import type { RegenerationContext } from "@/lib/ai/regeneration-context";
import { buildVisualSeedSpec } from "@/lib/ai/visual-generation";
import { runLocalVisualGenerationFallback } from "@/lib/ai/process-site-generation";
import { triggerVisualGenerationWorker } from "@/lib/ai/worker-client";
import { getUsageSnapshot } from "@/lib/billing/usage";
import { logError, logInfo } from "@/lib/logger";
import type { BusinessBriefDraft } from "@/lib/onboarding/types";
import { recordPlatformEvent } from "@/lib/platform-events";
import type { TemplateId } from "@/lib/templates/types";
import { env } from "@/lib/env";
import type { SiteSpecV3 } from "@/lib/site-spec-v3";

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
  generationMode?: "new" | "regenerate";
  currentSiteSpec?: SiteSpecV3;
  currentSiteSummary?: string;
  regenerationContext?: RegenerationContext;
};

type StartGenerationResult =
  | {
      ok: true;
      status: 202;
      data: {
        jobId: string;
        status: "queued";
        jobType: "visual_home_generation";
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
    .is("deleted_at", null)
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
    .in("job_type", ["site_generation", "visual_home_generation"]);

  const seedSpec = buildVisualSeedSpec({
    prompt,
    templateId: input.templateId,
    briefDraft: input.briefDraft,
    currentSiteSpec: input.generationMode === "regenerate" ? input.currentSiteSpec : undefined
  });

  const { data: job, error: jobError } = await supabase
    .from("ai_jobs")
    .insert({
      site_id: siteId,
      created_by: userId,
      job_type: "visual_home_generation",
      input_json: {
        prompt,
        briefDraft: input.briefDraft ?? null,
        currentSiteSpec: input.generationMode === "regenerate" ? input.currentSiteSpec ?? null : null,
        meta: {
          input_mode: input.inputMode,
          template_id: input.templateId ?? null,
          refine_confidence: input.refineConfidence ?? null,
          warnings_count: input.warningsCount ?? 0,
          generation_mode: input.generationMode ?? "new",
          current_site_summary: input.currentSiteSummary ?? null,
          regeneration_context: input.regenerationContext ?? null
        }
      },
      status: "queued",
      output_json: {
        stage: "brief_analysis",
        progressPercent: 8,
        message: "Analizando tu negocio",
        snapshot: seedSpec,
        fallbackUsed: false,
        source: "worker"
      }
    })
    .select("id")
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, status: 400, data: { error: jobError?.message ?? "Failed to create AI job" } };
  }

  const workerTrigger = await triggerVisualGenerationWorker({
    jobId: job.id,
    siteId,
    prompt,
    templateId: input.templateId,
    briefDraft: input.briefDraft,
    callbackBaseUrl: env.appUrl,
    currentSiteSummary: input.currentSiteSummary,
    regenerationContext: input.regenerationContext
  });

  if (!workerTrigger.ok) {
    logInfo("ai_generation_worker_fallback", {
      jobId: job.id,
      siteId,
      reason: workerTrigger.reason
    });

    void runLocalVisualGenerationFallback({
      supabase: admin,
      jobId: job.id
    }).catch((error) => {
      logError("ai_generation_local_fallback_failed", {
        jobId: job.id,
        siteId,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }

  return {
    ok: true,
    status: 202,
    data: {
      jobId: job.id,
      status: "queued",
      jobType: "visual_home_generation"
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
    if (schemaVersion === "3.0" || schemaVersion === "3.1") {
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

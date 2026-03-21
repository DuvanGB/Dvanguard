import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

import { incrementAiGenerationUsage } from "@/lib/billing/usage";
import { generateSiteSpecFromPrompt } from "@/lib/ai/generate-site-spec";
import {
  applyDesignPatchToSpec,
  buildHeuristicDesignPatch,
  buildVisualSeedSpec,
  type DesignPatch,
  type VisualGenerationProgressPayload,
  type VisualGenerationStage
} from "@/lib/ai/visual-generation";
import type { BusinessBriefDraft } from "@/lib/onboarding/types";
import { recordPlatformEvent } from "@/lib/platform-events";
import type { SiteSpecV3 } from "@/lib/site-spec-v3";
import type { TemplateId } from "@/lib/templates/types";

type ExecuteGenerationInput = {
  supabase: SupabaseClient;
  siteId: string;
  prompt: string;
  jobId: string;
  eventType: string;
  templateId?: TemplateId;
  briefDraft?: BusinessBriefDraft;
  extraEventPayload?: Record<string, unknown>;
};

type ExecuteGenerationResult = {
  ok: boolean;
  versionId?: string;
  source?: string;
  latencyMs?: number;
  fallbackReason?: string | null;
  error?: string;
};

type ApplyVisualProgressInput = {
  supabase: SupabaseClient;
  jobId: string;
  stage: VisualGenerationStage;
  progressPercent: number;
  message: string;
  designPatch?: DesignPatch;
  source?: "worker" | "fallback";
  fallbackUsed?: boolean;
  completed?: boolean;
  error?: string;
};

type JobInputJson = {
  prompt?: string;
  briefDraft?: BusinessBriefDraft | null;
  meta?: {
    template_id?: TemplateId | null;
    [key: string]: unknown;
  };
};

export async function executeSiteGenerationJob(input: ExecuteGenerationInput): Promise<ExecuteGenerationResult> {
  const startedAt = Date.now();

  try {
    let generation: Awaited<ReturnType<typeof generateSiteSpecFromPrompt>>;
    let fallbackReason: string | null = null;

    try {
      generation = await Promise.race([
        generateSiteSpecFromPrompt({
          prompt: input.prompt,
          templateId: input.templateId,
          briefDraft: input.briefDraft
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), 18_000))
      ]);
    } catch (generationError) {
      fallbackReason = generationError instanceof Error ? generationError.message : "Unknown AI error";
      const seed = buildVisualSeedSpec({
        prompt: input.prompt,
        templateId: input.templateId,
        briefDraft: input.briefDraft
      });
      generation = {
        siteSpec: applyDesignPatchToSpec(seed, buildHeuristicDesignPatch({
          prompt: input.prompt,
          templateId: input.templateId,
          briefDraft: input.briefDraft
        })),
        source: "seed",
        enhancementApplied: false
      };
    }

    const versionId = await persistFinalVersion(input.supabase, input.siteId, generation.siteSpec);
    const latencyMs = Date.now() - startedAt;

    await input.supabase
      .from("ai_jobs")
      .update({
        status: "done",
        output_json: {
          versionId,
          source: generation.source,
          generationMode: "hybrid_locked",
          enhancementApplied: generation.enhancementApplied,
          latencyMs,
          fallbackReason,
          snapshot: generation.siteSpec
        },
        completed_at: new Date().toISOString()
      })
      .eq("id", input.jobId);

    await input.supabase.from("events").insert({
      site_id: input.siteId,
      event_type: input.eventType,
      payload_json: {
        jobId: input.jobId,
        latencyMs,
        source: generation.source,
        generationMode: "hybrid_locked",
        enhancementApplied: generation.enhancementApplied,
        fallbackReason,
        ...(input.extraEventPayload ?? {})
      }
    });

    return {
      ok: true,
      versionId,
      source: generation.source,
      latencyMs,
      fallbackReason
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await input.supabase
      .from("ai_jobs")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", input.jobId);

    return { ok: false, error: message };
  }
}

export async function applyVisualGenerationProgress(input: ApplyVisualProgressInput) {
  const { supabase, jobId } = input;
  const { data: job, error } = await supabase
    .from("ai_jobs")
    .select("id, site_id, created_by, input_json, output_json, status, created_at")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job) {
    throw new Error("AI job not found");
  }

  if (input.error) {
    await supabase
      .from("ai_jobs")
      .update({
        status: "failed",
        error: input.error,
        completed_at: new Date().toISOString(),
        output_json: {
          ...((job.output_json as Record<string, unknown> | null) ?? {}),
          stage: input.stage,
          progressPercent: input.progressPercent,
          message: input.message,
          fallbackUsed: input.fallbackUsed ?? false,
          source: input.source ?? "fallback"
        }
      })
      .eq("id", jobId);
    return;
  }

  const jobInput = ((job.input_json as JobInputJson | null) ?? {}) as JobInputJson;
  const seedSpec = buildVisualSeedSpec({
    prompt: jobInput.prompt ?? "",
    templateId: jobInput.meta?.template_id ?? undefined,
    briefDraft: jobInput.briefDraft ?? undefined
  });
  const snapshot = applyDesignPatchToSpec(seedSpec, input.designPatch);
  const baseOutput = {
    ...((job.output_json as Record<string, unknown> | null) ?? {}),
    stage: input.stage,
    progressPercent: input.progressPercent,
    message: input.message,
    snapshot,
    fallbackUsed: input.fallbackUsed ?? false,
    source: input.source ?? "worker",
    designPatch: input.designPatch ?? null
  };

  if (input.completed) {
    const versionId = await persistFinalVersion(supabase, job.site_id, snapshot);
    await incrementAiGenerationUsage(supabase, job.created_by);
    await supabase
      .from("ai_jobs")
      .update({
        status: "done",
        output_json: {
          ...baseOutput,
          versionId,
          latencyMs: computeLatencyMs(job.output_json, job as { created_at?: string }),
          generationMode: "visual_progressive"
        },
        completed_at: new Date().toISOString()
      })
      .eq("id", jobId);

    const { count: successfulGenerations } = await supabase
      .from("ai_jobs")
      .select("id", { count: "exact", head: true })
      .eq("site_id", job.site_id)
      .eq("created_by", job.created_by)
      .in("job_type", ["site_generation", "visual_home_generation"])
      .eq("status", "done");

    try {
      await recordPlatformEvent(supabase, {
        eventType: (successfulGenerations ?? 0) <= 1 ? "site.generation.first_attempt_done" : "site.generation.regenerated",
        userId: job.created_by,
        siteId: job.site_id,
        payload: {
          jobId,
          source: input.source ?? "worker",
          fallbackUsed: input.fallbackUsed ?? false,
          progressPercent: input.progressPercent
        }
      });
    } catch {
      // best effort
    }
    return;
  }

  await supabase
    .from("ai_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      output_json: baseOutput
    })
    .eq("id", jobId);
}

export async function runLocalVisualGenerationFallback(input: {
  supabase: SupabaseClient;
  jobId: string;
}) {
  const { data: job } = await input.supabase
    .from("ai_jobs")
    .select("id, input_json")
    .eq("id", input.jobId)
    .maybeSingle();

  if (!job) {
    return;
  }

  const jobInput = ((job.input_json as JobInputJson | null) ?? {}) as JobInputJson;
  const designPatch = buildHeuristicDesignPatch({
    prompt: jobInput.prompt ?? "",
    templateId: jobInput.meta?.template_id ?? undefined,
    briefDraft: jobInput.briefDraft ?? undefined
  });

  const stages: Array<Omit<VisualGenerationProgressPayload, "source" | "fallbackUsed" | "completed"> & { completed?: boolean }> = [
    {
      stage: "brief_analysis",
      progressPercent: 12,
      message: "Analizando tu negocio"
    },
    {
      stage: "visual_direction",
      progressPercent: 34,
      message: "Definiendo dirección visual",
      designPatch: {
        visualDirection: designPatch.visualDirection,
        templateFamily: designPatch.templateFamily,
        themePatch: designPatch.themePatch,
        sectionHeightPatch: designPatch.sectionHeightPatch
      }
    },
    {
      stage: "layout_seed",
      progressPercent: 62,
      message: "Armando layout inicial",
      designPatch: {
        ...designPatch,
        blockPatches: (designPatch.blockPatches ?? []).filter((patch) =>
          ["headline", "subheadline", "hero-image", "hero-bg", "hero-overlay"].some((value) => patch.matchId.includes(value))
        )
      }
    },
    {
      stage: "content_polish",
      progressPercent: 84,
      message: "Aplicando contenido y estilo",
      designPatch
    },
    {
      stage: "finalizing",
      progressPercent: 100,
      message: "Preparando preview editable",
      designPatch,
      completed: true
    }
  ];

  for (const stage of stages) {
    await applyVisualGenerationProgress({
      supabase: input.supabase,
      jobId: input.jobId,
      stage: stage.stage,
      progressPercent: stage.progressPercent,
      message: stage.message,
      designPatch: stage.designPatch,
      source: "fallback",
      fallbackUsed: true,
      completed: stage.completed
    });
    if (!stage.completed) {
      await wait(700);
    }
  }
}

async function persistFinalVersion(supabase: SupabaseClient, siteId: string, siteSpec: SiteSpecV3) {
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
      site_spec_json: siteSpec,
      source: "hybrid_generate",
      content_hash: createHash("sha256").update(JSON.stringify(siteSpec)).digest("hex")
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
      site_type: siteSpec.site_type
    })
    .eq("id", siteId);

  return version.id;
}

function computeLatencyMs(outputJson: unknown, job: { created_at?: string }) {
  const existing = (outputJson as { latencyMs?: unknown } | null)?.latencyMs;
  if (typeof existing === "number" && Number.isFinite(existing)) return existing;
  if (!job.created_at) return undefined;
  const startedAt = new Date(job.created_at).getTime();
  if (Number.isNaN(startedAt)) return undefined;
  return Date.now() - startedAt;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

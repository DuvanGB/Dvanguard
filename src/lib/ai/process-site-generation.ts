import type { SupabaseClient } from "@supabase/supabase-js";

import { generateSiteSpecFromPrompt } from "@/lib/ai/generate-site-spec";
import { buildFallbackSiteSpecV2 } from "@/lib/site-spec-any";
import type { TemplateId } from "@/lib/templates/types";

type ExecuteGenerationInput = {
  supabase: SupabaseClient;
  siteId: string;
  prompt: string;
  jobId: string;
  eventType: string;
  templateId?: TemplateId;
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

export async function executeSiteGenerationJob(input: ExecuteGenerationInput): Promise<ExecuteGenerationResult> {
  const startedAt = Date.now();

  try {
    let generation: Awaited<ReturnType<typeof generateSiteSpecFromPrompt>>;
    let fallbackReason: string | null = null;

    try {
      generation = await Promise.race([
        generateSiteSpecFromPrompt(input.prompt, { templateId: input.templateId }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), 18_000))
      ]);
    } catch (generationError) {
      fallbackReason = generationError instanceof Error ? generationError.message : "Unknown AI error";
      generation = { siteSpec: buildFallbackSiteSpecV2(input.prompt, { templateId: input.templateId }), source: "fallback" };
    }

    const { data: latestVersion } = await input.supabase
      .from("site_versions")
      .select("version")
      .eq("site_id", input.siteId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    const { data: version, error: versionError } = await input.supabase
      .from("site_versions")
      .insert({
        site_id: input.siteId,
        version: nextVersion,
        site_spec_json: generation.siteSpec,
        source: generation.source
      })
      .select("id")
      .maybeSingle();

    if (versionError || !version) {
      throw new Error(versionError?.message ?? "Failed to persist site version");
    }

    await input.supabase
      .from("sites")
      .update({
        current_version_id: version.id,
        site_type: generation.siteSpec.site_type
      })
      .eq("id", input.siteId);

    const latencyMs = Date.now() - startedAt;

    await input.supabase
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
      .eq("id", input.jobId);

    await input.supabase.from("events").insert({
      site_id: input.siteId,
      event_type: input.eventType,
      payload_json: {
        jobId: input.jobId,
        latencyMs,
        source: generation.source,
        fallbackReason,
        ...(input.extraEventPayload ?? {})
      }
    });

    return {
      ok: true,
      versionId: version.id,
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

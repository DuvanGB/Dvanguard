import { env } from "@/lib/env";
import type { RegenerationContext } from "@/lib/ai/regeneration-context";
import type { BusinessBriefDraft } from "@/lib/onboarding/types";
import type { TemplateId } from "@/lib/templates/types";

type TriggerVisualWorkerInput = {
  jobId: string;
  siteId: string;
  prompt: string;
  templateId?: TemplateId;
  briefDraft?: BusinessBriefDraft;
  callbackBaseUrl: string;
  currentSiteSummary?: string;
  regenerationContext?: RegenerationContext;
};

type TriggerRefineWorkerInput = {
  rawInput: string;
  inputMode: "text" | "voice";
  currentBrief?: Partial<BusinessBriefDraft> | null;
  followUpAnswer?: string | null;
  generationMode?: "new" | "regenerate";
  regenerationContext?: {
    currentSiteSummary?: string | null;
    feedbackPrompt?: string | null;
    businessName?: string | null;
    businessType?: BusinessBriefDraft["business_type"] | null;
    sectionList?: string[] | null;
    productCount?: number | null;
    imageCount?: number | null;
  } | null;
};

export async function triggerVisualGenerationWorker(input: TriggerVisualWorkerInput) {
  if (env.aiProvider !== "worker" || !env.aiWorkerBaseUrl || !env.aiWorkerSharedSecret) {
    return { ok: false as const, reason: "worker_unavailable" };
  }

  const response = await fetch(`${env.aiWorkerBaseUrl.replace(/\/$/, "")}/design/generate-home`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": env.aiWorkerSharedSecret
    },
    body: JSON.stringify({
      jobId: input.jobId,
      siteId: input.siteId,
      prompt: input.prompt,
      templateId: input.templateId ?? null,
      briefDraft: input.briefDraft ?? null,
      callbackBaseUrl: input.callbackBaseUrl,
      currentSiteSummary: input.currentSiteSummary ?? null,
      isRegeneration: input.regenerationContext?.isRegeneration ?? false,
      regenerationContext: input.regenerationContext ?? null
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false as const,
      reason: text || `worker_http_${response.status}`
    };
  }

  return { ok: true as const };
}

export async function requestRefineFromWorker(input: TriggerRefineWorkerInput) {
  if (env.aiProvider !== "worker" || !env.aiWorkerBaseUrl || !env.aiWorkerSharedSecret) {
    return { ok: false as const, reason: "worker_unavailable" };
  }

  const response = await fetch(`${env.aiWorkerBaseUrl.replace(/\/$/, "")}/refine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": env.aiWorkerSharedSecret
    },
    body: JSON.stringify({
      rawInput: input.rawInput,
      inputMode: input.inputMode,
      currentBrief: input.currentBrief ?? null,
      followUpAnswer: input.followUpAnswer ?? null,
      generationMode: input.generationMode ?? "new",
      regenerationContext: input.regenerationContext ?? null
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false as const,
      reason: text || `worker_http_${response.status}`
    };
  }

  const data = await response.json();
  return { ok: true as const, data };
}

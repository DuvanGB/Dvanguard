import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildRegenerationDiff,
  extractCurrentSiteContentForRegeneration,
  type RegenerationContext
} from "@/lib/ai/regeneration-context";
import { startSiteGeneration } from "@/lib/ai/start-site-generation";
import { summarizeSiteSpecForRegeneration } from "@/lib/ai/visual-generation";
import { requireApiUser } from "@/lib/auth";
import { getOwnedSiteWithCurrentSpec } from "@/lib/canvas/store";
import { getRequestClientKey } from "@/lib/http";
import { buildPromptFromBrief } from "@/lib/onboarding/prompt-builder";
import { businessBriefDraftSchema, onboardingInputModeSchema } from "@/lib/onboarding/types";
import { recordPlatformEvent } from "@/lib/platform-events";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getTemplateById } from "@/lib/templates/catalog";
import { templateIds } from "@/lib/templates/types";

const bodySchema = z.object({
  siteId: z.string().uuid(),
  inputMode: onboardingInputModeSchema,
  briefDraft: businessBriefDraftSchema,
  templateId: z.enum(templateIds).optional(),
  recommendedTemplateId: z.enum(templateIds).optional(),
  refineConfidence: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string()).max(20).optional(),
  generationMode: z.enum(["new", "regenerate"]).optional(),
  regenerationFeedback: z.string().max(500).optional()
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

  const {
    siteId,
    inputMode,
    briefDraft,
    templateId,
    recommendedTemplateId,
    refineConfidence,
    warnings,
    generationMode = "new",
    regenerationFeedback
  } = parsed.data;
  if (templateId) {
    const selectedTemplate = getTemplateById(templateId);
    if (!selectedTemplate || selectedTemplate.site_type !== briefDraft.business_type) {
      return NextResponse.json({ error: "Template no válida para el tipo de sitio seleccionado." }, { status: 400 });
    }
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, current_version_id")
    .eq("id", siteId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  if (briefDraft.business_name && briefDraft.business_name.trim() && briefDraft.business_name.trim() !== site.name) {
    await supabase.from("sites").update({ name: briefDraft.business_name.trim() }).eq("id", siteId);
  }

  const admin = getSupabaseAdminClient();
  const prompt = buildPromptFromBrief(briefDraft, { templateId });
  const siteContext =
    generationMode === "regenerate"
      ? await getOwnedSiteWithCurrentSpec({
          supabase,
          siteId,
          userId: user.id
        })
      : null;

  const { data: assetRows } =
    generationMode === "regenerate"
      ? await supabase.from("site_media_assets").select("public_url").eq("site_id", siteId).order("created_at", { ascending: false }).limit(24)
      : { data: [] as Array<{ public_url: string | null }> };
  const assetUrls = (assetRows ?? []).map((item) => item.public_url).filter((value): value is string => Boolean(value));

  const { data: versionRows } =
    generationMode === "regenerate"
      ? await supabase
          .from("site_versions")
          .select("id, version, site_spec_json")
          .eq("site_id", siteId)
          .order("version", { ascending: false })
          .limit(4)
      : { data: [] as Array<{ id: string; version: number; site_spec_json: unknown }> };

  const previousVersion =
    generationMode === "regenerate"
      ? (versionRows ?? []).find((version) => version.id !== site.current_version_id) ?? null
      : null;

  const analyticsSnapshot =
    generationMode === "regenerate"
      ? await supabase
          .from("site_analytics_events")
          .select("event_type")
          .eq("site_id", siteId)
          .gte("occurred_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      : { data: [] as Array<{ event_type: string }> };

  const previousJobs =
    generationMode === "regenerate"
      ? await supabase
          .from("ai_jobs")
          .select("input_json")
          .eq("site_id", siteId)
          .eq("created_by", user.id)
          .eq("job_type", "visual_home_generation")
          .eq("status", "done")
      : { data: [] as Array<{ input_json: { meta?: { generation_mode?: string | null } | null } | null }> };

  const currentSiteSummary =
    generationMode === "regenerate"
      ? summarizeSiteSpecForRegeneration({
          siteSpec: siteContext?.spec ?? null,
          assetUrls
        })
      : "";
  const regenerationContext: RegenerationContext | undefined =
    generationMode === "regenerate" && siteContext?.spec
      ? {
          isRegeneration: true,
          prompt: regenerationFeedback?.trim() || "Mejorar la propuesta visual respetando el contenido actual.",
          briefDraft,
          previousTheme: siteContext.spec.theme ?? null,
          currentSiteContent: extractCurrentSiteContentForRegeneration({
            siteSpec: siteContext.spec,
            assetUrls
          }),
          contentDiff: buildRegenerationDiff({
            currentSpec: siteContext.spec,
            previousSpec: (previousVersion?.site_spec_json as typeof siteContext.spec | null) ?? null,
            currentAssetUrls: assetUrls
          }),
          iterationNumber:
            ((previousJobs.data ?? []).filter((job) => job.input_json?.meta?.generation_mode === "regenerate").length || 0) + 1,
          designUpgradeObjective:
            "Haz esta iteración perceptiblemente más rica, más profesional y mejor organizada que la actual, sin perder contenido ni media.",
          currentSiteSummary,
          analyticsSnapshot: {
            visits: (analyticsSnapshot.data ?? []).filter((event) => event.event_type === "visit").length,
            whatsappClicks: (analyticsSnapshot.data ?? []).filter((event) => event.event_type === "whatsapp_click").length,
            ctaClicks: (analyticsSnapshot.data ?? []).filter((event) => event.event_type === "cta_click").length
          }
        }
      : undefined;
  const effectivePrompt =
    generationMode === "regenerate" && regenerationContext
      ? [
          prompt,
          regenerationFeedback?.trim() ? `Feedback del cliente: ${regenerationFeedback.trim()}` : null,
          currentSiteSummary,
          `Objetivo: ${regenerationContext.designUpgradeObjective}`
        ]
          .filter(Boolean)
          .join("\n\n")
      : prompt;

  if (templateId) {
    try {
      await recordPlatformEvent(admin, {
        eventType: "template.selected",
        userId: user.id,
        siteId,
        payload: {
          templateId,
          recommendedTemplateId: recommendedTemplateId ?? null,
          selectedRecommended: recommendedTemplateId ? recommendedTemplateId === templateId : null
        }
      });
    } catch {
      // best effort
    }
  }

  const result = await startSiteGeneration({
    supabase,
    admin,
    userId: user.id,
    siteId,
    prompt: effectivePrompt,
    briefDraft,
    inputMode,
    templateId,
    refineConfidence,
    warningsCount: warnings?.length ?? 0,
    generationMode,
    currentSiteSpec: generationMode === "regenerate" ? siteContext?.spec : undefined,
    currentSiteSummary,
    regenerationContext
  });

  if (result.ok) {
    return NextResponse.json(
      {
        ...result.data,
        generationMode: "hybrid_locked",
        seedApplied: true
      },
      { status: result.status }
    );
  }

  return NextResponse.json(result.data, { status: result.status });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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
  generationMode: z.enum(["new", "regenerate"]).optional()
});

export async function POST(request: NextRequest) {
  const { user, supabase } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rate = enforceRateLimit({
    key: `onboarding:generate:${getRequestClientKey(request, user.id)}`,
    limit: 20,
    windowMs: 60_000
  });

  if (!rate.allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 });
  }

  const { siteId, inputMode, briefDraft, templateId, recommendedTemplateId, refineConfidence, warnings, generationMode = "new" } = parsed.data;
  if (templateId) {
    const selectedTemplate = getTemplateById(templateId);
    if (!selectedTemplate || selectedTemplate.site_type !== briefDraft.business_type) {
      return NextResponse.json({ error: "Template no válida para el tipo de sitio seleccionado." }, { status: 400 });
    }
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", siteId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Sitio no encontrado" }, { status: 404 });
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

  const currentSiteSummary =
    generationMode === "regenerate"
      ? summarizeSiteSpecForRegeneration({
          siteSpec: siteContext?.spec ?? null,
          assetUrls: (assetRows ?? []).map((item) => item.public_url).filter((value): value is string => Boolean(value))
        })
      : "";
  const designUpgradeObjective =
    generationMode === "regenerate"
      ? "Haz que esta nueva iteración se sienta más premium, atractiva y organizada que la versión actual. Conserva el contenido y la media existente, pero mejora hero, jerarquía, composición, contraste, ritmo y sistema visual."
      : undefined;
  const effectivePrompt =
    generationMode === "regenerate" && currentSiteSummary
      ? `${prompt}\n\n${currentSiteSummary}\n\nObjetivo de mejora visual: ${designUpgradeObjective}`
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
    designUpgradeObjective,
    regenerationIntent: generationMode === "regenerate" ? "visual_improvement" : undefined
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

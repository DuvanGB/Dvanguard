import { getTemplateById, getTemplatesBySiteType } from "@/lib/templates/catalog";
import type { TemplateDefinition, TemplateId } from "@/lib/templates/types";
import type { BusinessBriefDraft } from "@/lib/onboarding/types";

export function recommendTemplateIds(input: {
  businessType: "informative" | "commerce_lite";
  stylePreset?: "ocean" | "sunset" | "mono";
  tone?: string;
}): TemplateId[] {
  const templates = getTemplatesBySiteType(input.businessType);
  const scored = templates
    .map((template) => ({
      template,
      score: scoreTemplate(template, input)
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.template.id);

  return scored.slice(0, 3);
}

function scoreTemplate(
  template: TemplateDefinition,
  input: { businessType: "informative" | "commerce_lite"; stylePreset?: "ocean" | "sunset" | "mono"; tone?: string }
) {
  let score = 0;
  if (template.site_type === input.businessType) score += 5;

  if (input.stylePreset === "mono" && (template.family === "clean" || template.family === "dark")) score += 3;
  if (input.stylePreset === "ocean" && (template.family === "shop" || template.family === "social")) score += 3;
  if (input.stylePreset === "sunset" && (template.family === "bold" || template.family === "trust")) score += 3;

  const tone = (input.tone ?? "").toLowerCase();
  if (tone.includes("premium") && (template.family === "dark" || template.family === "bold")) score += 2;
  if (tone.includes("cercano") && (template.family === "trust" || template.family === "social")) score += 2;
  if (tone.includes("moderno") && (template.family === "clean" || template.family === "shop")) score += 2;

  return score;
}

export function pickTemplateOrFallback(input: {
  templateId?: string | null;
  siteType: "informative" | "commerce_lite";
  brief?: BusinessBriefDraft;
}): TemplateId {
  if (input.templateId && isTemplateId(input.templateId)) {
    const selected = getTemplateById(input.templateId);
    if (selected && selected.site_type === input.siteType) {
      return selected.id;
    }
  }

  const recommended = recommendTemplateIds({
    businessType: input.siteType,
    stylePreset: input.brief?.style_preset,
    tone: input.brief?.tone
  });

  if (recommended.length) return recommended[0];
  return input.siteType === "commerce_lite" ? "shop-quick" : "starter-clean";
}

export function isTemplateId(value: string): value is TemplateId {
  return Boolean(getTemplateById(value as TemplateId));
}

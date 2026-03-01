import type { BusinessBriefDraft } from "@/lib/onboarding/types";

export function buildPromptFromBrief(brief: BusinessBriefDraft) {
  const sections = brief.section_preferences.join(", ");

  return [
    "Genera un SiteSpec v1.0 en es-LATAM para un sitio web orientado a conversión.",
    `Nombre del negocio: ${brief.business_name}.`,
    `Tipo de sitio: ${brief.business_type}.`,
    `Oferta principal: ${brief.offer_summary}.`,
    `Público objetivo: ${brief.target_audience}.`,
    `Tono de comunicación: ${brief.tone}.`,
    `CTA principal: ${brief.primary_cta}.`,
    `Secciones prioritarias: ${sections}.`,
    `Preset visual sugerido: ${brief.style_preset}.`,
    "Prioriza estructura clara, encabezados directos y llamado a WhatsApp cuando aplique."
  ].join(" ");
}

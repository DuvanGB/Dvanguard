import type { BusinessBriefDraft } from "@/lib/onboarding/types";
import type { TemplateId } from "@/lib/templates/types";

export function buildPromptFromBrief(brief: BusinessBriefDraft, options?: { templateId?: TemplateId }) {
  const sections = brief.section_preferences.join(", ");
  const templateHint = options?.templateId ? `Template obligatoria: ${options.templateId}.` : "";
  const whatsappPhone = brief.whatsapp_phone ? `Número WhatsApp: ${brief.whatsapp_phone}.` : "";
  const whatsappMessage = brief.whatsapp_message ? `Mensaje WhatsApp sugerido: ${brief.whatsapp_message}.` : "";

  return [
    "Genera contenido para un SiteSpec v3.0 en es-LATAM orientado a conversión.",
    `Nombre del negocio: ${brief.business_name}.`,
    `Tipo de sitio: ${brief.business_type}.`,
    `Oferta principal: ${brief.offer_summary}.`,
    `Público objetivo: ${brief.target_audience}.`,
    `Tono de comunicación: ${brief.tone}.`,
    `CTA principal: ${brief.primary_cta}.`,
    whatsappPhone,
    whatsappMessage,
    `Secciones prioritarias: ${sections}.`,
    `Preset visual sugerido: ${brief.style_preset}.`,
    templateHint,
    "Prioriza estructura clara, encabezados directos y llamado a WhatsApp cuando aplique."
  ].join(" ");
}

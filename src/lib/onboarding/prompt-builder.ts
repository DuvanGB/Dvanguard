import type { BusinessBriefDraft } from "@/lib/onboarding/types";
import type { TemplateId } from "@/lib/templates/types";

export function buildPromptFromBrief(brief: BusinessBriefDraft, options?: { templateId?: TemplateId }) {
  const templateHint = options?.templateId ? `Template obligatoria: ${options.templateId}.` : "";
  const whatsappPhone = brief.whatsapp_phone ? `Número WhatsApp: ${brief.whatsapp_phone}.` : "";
  const whatsappMessage = brief.whatsapp_message ? `Mensaje WhatsApp sugerido: ${brief.whatsapp_message}.` : "";
  const normalizedOfferSummary = normalizeOfferSummaryForPrompt(brief);

  return [
    "Genera contenido para un SiteSpec v3.0 en es-LATAM orientado a conversión.",
    `Nombre del negocio: ${brief.business_name}.`,
    `Tipo de sitio: ${brief.business_type}.`,
    `Oferta principal: ${normalizedOfferSummary}.`,
    `Público objetivo: ${brief.target_audience}.`,
    `Tono de comunicación: ${brief.tone}.`,
    `CTA principal: ${brief.primary_cta}.`,
    whatsappPhone,
    whatsappMessage,
    templateHint,
    brief.business_type === "commerce_lite"
      ? "Estructura esperada: hero, catálogo, testimonios y contacto."
      : "Estructura esperada: hero, testimonios y contacto.",
    "Prioriza estructura clara, encabezados directos y llamado a WhatsApp cuando aplique."
  ].join(" ");
}

function normalizeOfferSummaryForPrompt(brief: BusinessBriefDraft) {
  const compact = brief.offer_summary.trim().replace(/\s+/g, " ");
  if (compact && !looksLikeIntentPrompt(compact)) return compact;
  if (brief.business_type === "commerce_lite") {
    return `${brief.business_name} ofrece una propuesta comercial clara para ${brief.target_audience.toLowerCase()}, con productos bien organizados, valor visible y contacto directo para cerrar ventas.`;
  }
  return `${brief.business_name} presenta una propuesta clara para ${brief.target_audience.toLowerCase()}, con beneficios entendibles, confianza visual y un contacto directo para avanzar rápido.`;
}

function looksLikeIntentPrompt(value: string) {
  const lower = value.trim().toLowerCase();
  return /^(necesito|quiero|busco|me gustar[ií]a|deseo|crear|hacer|montar|armar)\b/.test(lower) ||
    /quiero una p[aá]gina|necesito una web|crear un negocio|crear una tienda|hacer una web/.test(lower);
}

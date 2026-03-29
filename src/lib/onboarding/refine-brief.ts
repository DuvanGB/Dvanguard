import { requestRefineFromWorker } from "@/lib/ai/worker-client";
import {
  businessBriefDraftSchema,
  heroSuggestionSchema,
  missingBriefFieldSchema,
  type BusinessBriefDraft,
  type HeroSuggestion,
  type MissingBriefField,
  type OnboardingInputMode,
  type RefineResponse
} from "@/lib/onboarding/types";

type RefineBriefInput = {
  rawInput: string;
  inputMode: OnboardingInputMode;
  currentBrief?: Partial<BusinessBriefDraft> | null;
  followUpAnswer?: string | null;
};

export async function refineBusinessBrief(input: RefineBriefInput): Promise<RefineResponse> {
  const normalizedInput = input.rawInput.trim();
  const workerAttempt = await requestRefineFromWorker({
    rawInput: normalizedInput,
    inputMode: input.inputMode,
    currentBrief: input.currentBrief ?? null,
    followUpAnswer: input.followUpAnswer ?? null
  });

  if (workerAttempt.ok) {
    const normalized = normalizeWorkerRefineResponse(workerAttempt.data, normalizedInput, input.currentBrief ?? null);
    if (normalized) {
      return normalized;
    }
  }

  return buildFallbackRefineResponse({
    rawInput: normalizedInput,
    currentBrief: input.currentBrief ?? null,
    followUpAnswer: input.followUpAnswer ?? null
  });
}

function normalizeWorkerRefineResponse(
  payload: unknown,
  rawInput: string,
  currentBrief?: Partial<BusinessBriefDraft> | null
): RefineResponse | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as {
    briefDraft?: unknown;
    confidence?: unknown;
    completenessScore?: unknown;
    warnings?: unknown;
    provider?: unknown;
    followUpQuestion?: unknown;
    missingFields?: unknown;
    heroSuggestion?: unknown;
    heroConfidence?: unknown;
  };

  const parsedBrief = businessBriefDraftSchema.safeParse(candidate.briefDraft);
  const mergedDraft = mergeCurrentBrief(
    parsedBrief.success ? parsedBrief.data : null,
    currentBrief,
    rawInput
  );
  const parsed = businessBriefDraftSchema.safeParse(mergedDraft);
  if (!parsed.success) return null;

  const missingFields = normalizeMissingFields(candidate.missingFields, parsed.data);
  const heroSuggestion = normalizeHeroSuggestion(candidate.heroSuggestion, parsed.data);
  const heroConfidence = heroSuggestion
    ? typeof candidate.heroConfidence === "number"
      ? clamp01(candidate.heroConfidence)
      : computeHeroConfidence(parsed.data, heroSuggestion, missingFields)
    : 0;
  const effectiveFollowUpQuestion =
    heroConfidence < 0.75
      ? buildHeroFollowUpQuestion(parsed.data, missingFields)
      : typeof candidate.followUpQuestion === "string" && candidate.followUpQuestion.trim()
        ? candidate.followUpQuestion.trim()
        : buildFollowUpQuestion(missingFields);
  return {
    briefDraft: parsed.data,
    confidence: typeof candidate.confidence === "number" ? clamp01(candidate.confidence) : 0.82,
    completenessScore:
      typeof candidate.completenessScore === "number"
        ? clampScore(candidate.completenessScore)
        : computeCompletenessScore(parsed.data, rawInput),
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings.filter((item): item is string => typeof item === "string") : [],
    provider: candidate.provider === "heuristic" ? "heuristic" : "llm",
    followUpQuestion: effectiveFollowUpQuestion,
    missingFields,
    heroSuggestion: heroConfidence >= 0.75 ? heroSuggestion : null,
    heroConfidence
  };
}

function buildFallbackRefineResponse(input: {
  rawInput: string;
  currentBrief?: Partial<BusinessBriefDraft> | null;
  followUpAnswer?: string | null;
}): RefineResponse {
  const briefDraft = mergeCurrentBrief(
    buildHeuristicBrief(input.rawInput, input.currentBrief ?? null, input.followUpAnswer ?? null),
    input.currentBrief ?? null,
    input.rawInput
  );
  const warnings = buildActionableWarnings(input.rawInput, briefDraft);
  const missingFields = collectMissingFields(briefDraft);
  const heroSuggestion = buildHeroSuggestion(briefDraft);
  const heroConfidence = computeHeroConfidence(briefDraft, heroSuggestion, missingFields);

  return {
    briefDraft,
    confidence: 0.6,
    completenessScore: computeCompletenessScore(briefDraft, input.rawInput),
    warnings,
    provider: "heuristic",
    followUpQuestion: heroConfidence < 0.75 ? buildHeroFollowUpQuestion(briefDraft, missingFields) : buildFollowUpQuestion(missingFields),
    missingFields,
    heroSuggestion: heroConfidence >= 0.75 ? heroSuggestion : null,
    heroConfidence
  };
}

function buildHeuristicBrief(
  rawInput: string,
  currentBrief?: Partial<BusinessBriefDraft> | null,
  followUpAnswer?: string | null
): BusinessBriefDraft {
  const mergedInput = [rawInput, followUpAnswer ?? ""].filter(Boolean).join(" ").trim();
  const lower = mergedInput.toLowerCase();
  const businessType =
    currentBrief?.business_type ??
    (/(tienda|catalog|catálogo|vender|venta|producto|stock|carrito)/i.test(mergedInput) ? "commerce_lite" : "informative");
  const suggestedOfferSummary = suggestOfferSummary({
    rawInput,
    businessName: currentBrief?.business_name?.trim() || inferBusinessName(rawInput),
    businessType,
    targetAudience: currentBrief?.target_audience?.trim() || inferAudience(lower)
  });
  const baseFallback: BusinessBriefDraft = {
    business_name: inferBusinessName(rawInput),
    business_type: /(tienda|catalog|catálogo|vender|venta|producto|stock|carrito)/i.test(rawInput) ? "commerce_lite" : "informative",
    offer_summary: suggestedOfferSummary,
    target_audience: inferAudience(rawInput.toLowerCase()),
    tone: inferTone(rawInput.toLowerCase()),
    primary_cta: suggestPrimaryCta({
      businessType,
      rawInput,
      offerSummary: suggestedOfferSummary,
      hasWhatsappPhone: Boolean(extractWhatsappPhone(rawInput))
    }),
    whatsapp_phone: extractWhatsappPhone(rawInput),
    whatsapp_message: undefined
  };
  const beforeAnswer = mergeCurrentBrief(baseFallback, currentBrief, rawInput);
  const missingBefore = collectMissingFields(beforeAnswer);
  const answer = followUpAnswer?.trim() ?? "";

  const base: BusinessBriefDraft = {
    business_name: currentBrief?.business_name?.trim() || inferBusinessName(rawInput),
    business_type: businessType,
    offer_summary:
      currentBrief?.offer_summary?.trim() ||
      suggestedOfferSummary,
    target_audience: currentBrief?.target_audience?.trim() || inferAudience(lower),
    tone: currentBrief?.tone?.trim() || inferTone(lower),
    primary_cta:
      currentBrief?.primary_cta?.trim() ||
      suggestPrimaryCta({
        businessType,
        rawInput: mergedInput || rawInput,
        offerSummary: currentBrief?.offer_summary?.trim() || suggestedOfferSummary,
        hasWhatsappPhone: Boolean(currentBrief?.whatsapp_phone || extractWhatsappPhone(mergedInput))
      }),
    whatsapp_phone: currentBrief?.whatsapp_phone,
    whatsapp_message: currentBrief?.whatsapp_message?.trim() || undefined
  };

  if (answer) {
    const firstMissing = missingBefore[0];
    if (firstMissing === "offer_summary" && !currentBrief?.offer_summary?.trim()) base.offer_summary = answer.slice(0, 600);
    if (firstMissing === "target_audience" && !currentBrief?.target_audience?.trim()) base.target_audience = answer.slice(0, 180);
    if (firstMissing === "business_type" && !currentBrief?.business_type) {
      base.business_type = /tienda|catalog|catálogo|producto|vender|venta|stock|carrito/i.test(answer) ? "commerce_lite" : "informative";
    }
    if (firstMissing === "whatsapp_phone" && !currentBrief?.whatsapp_phone) {
      const extracted = extractWhatsappPhone(answer);
      if (extracted) base.whatsapp_phone = extracted;
    }
  }

  const extractedPhone = extractWhatsappPhone(mergedInput);
  if (extractedPhone) {
    base.whatsapp_phone = extractedPhone;
  }

  base.primary_cta =
    currentBrief?.primary_cta?.trim() ||
    suggestPrimaryCta({
      businessType: base.business_type,
      rawInput: mergedInput || rawInput,
      offerSummary: base.offer_summary,
      hasWhatsappPhone: Boolean(base.whatsapp_phone)
    });
  if (!currentBrief?.whatsapp_message?.trim() && base.whatsapp_phone) {
    base.whatsapp_message = suggestWhatsappMessage({
      businessName: base.business_name,
      businessType: base.business_type,
      offerSummary: base.offer_summary,
      primaryCta: base.primary_cta
    });
  }

  return base;
}

function mergeCurrentBrief(
  nextBrief: BusinessBriefDraft | null,
  currentBrief: Partial<BusinessBriefDraft> | null | undefined,
  rawInput: string
): BusinessBriefDraft {
  const businessTypeFallback = /(tienda|catalog|catálogo|vender|venta|producto|stock|carrito)/i.test(rawInput) ? "commerce_lite" : "informative";
  const fallback = nextBrief ?? {
    business_name: inferBusinessName(rawInput),
    business_type: businessTypeFallback,
    offer_summary: suggestOfferSummary({
      rawInput,
      businessName: inferBusinessName(rawInput),
      businessType: businessTypeFallback,
      targetAudience: inferAudience(rawInput.toLowerCase())
    }),
    target_audience: inferAudience(rawInput.toLowerCase()),
    tone: inferTone(rawInput.toLowerCase()),
    primary_cta: suggestPrimaryCta({
      businessType: businessTypeFallback,
      rawInput,
      offerSummary: rawInput.trim(),
      hasWhatsappPhone: Boolean(extractWhatsappPhone(rawInput))
    }),
    whatsapp_phone: extractWhatsappPhone(rawInput),
    whatsapp_message: undefined
  };
  const merged = {
    business_name: nextBrief?.business_name?.trim() || currentBrief?.business_name?.trim() || fallback.business_name,
    business_type: nextBrief?.business_type || currentBrief?.business_type || fallback.business_type,
    offer_summary: nextBrief?.offer_summary?.trim() || currentBrief?.offer_summary?.trim() || fallback.offer_summary,
    target_audience: nextBrief?.target_audience?.trim() || currentBrief?.target_audience?.trim() || fallback.target_audience,
    tone: nextBrief?.tone?.trim() || currentBrief?.tone?.trim() || fallback.tone,
    primary_cta: nextBrief?.primary_cta?.trim() || currentBrief?.primary_cta?.trim() || fallback.primary_cta,
    whatsapp_phone: nextBrief?.whatsapp_phone || currentBrief?.whatsapp_phone || fallback.whatsapp_phone,
    whatsapp_message: nextBrief?.whatsapp_message?.trim() || currentBrief?.whatsapp_message?.trim() || fallback.whatsapp_message
  };

  if (!merged.primary_cta?.trim()) {
    merged.primary_cta = suggestPrimaryCta({
      businessType: merged.business_type,
      rawInput,
      offerSummary: merged.offer_summary,
      hasWhatsappPhone: Boolean(merged.whatsapp_phone)
    });
  }

  if (!merged.whatsapp_message?.trim() && merged.whatsapp_phone) {
    merged.whatsapp_message = suggestWhatsappMessage({
      businessName: merged.business_name,
      businessType: merged.business_type,
      offerSummary: merged.offer_summary,
      primaryCta: merged.primary_cta
    });
  }

  return merged;
}

function normalizeMissingFields(input: unknown, brief: BusinessBriefDraft): MissingBriefField[] {
  if (Array.isArray(input)) {
    const parsed = input
      .map((item) => missingBriefFieldSchema.safeParse(item))
      .filter((item): item is { success: true; data: MissingBriefField } => item.success)
      .map((item) => item.data);
    if (parsed.length) return parsed;
  }

  return collectMissingFields(brief);
}

function collectMissingFields(brief: BusinessBriefDraft): MissingBriefField[] {
  const missing: MissingBriefField[] = [];
  if (!brief.offer_summary.trim() || brief.offer_summary.trim().length < 24) missing.push("offer_summary");
  if (!brief.target_audience.trim() || brief.target_audience.trim().length < 8) missing.push("target_audience");
  if (!brief.business_type) missing.push("business_type");
  return missing;
}

function buildActionableWarnings(rawInput: string, brief: BusinessBriefDraft) {
  const lower = rawInput.toLowerCase();
  const warnings: string[] = [];

  if (brief.offer_summary.trim().length < 30) {
    warnings.push("Aún falta explicar mejor qué vendes o qué ofreces exactamente.");
  }
  if (brief.target_audience.trim().length < 10) {
    warnings.push("Falta dejar más claro para quién está pensada la página.");
  }
  if (!containsValueProposition(lower) && brief.offer_summary.trim().length < 80) {
    warnings.push("Conviene mencionar por qué te deberían elegir frente a otras opciones.");
  }
  if (!containsLocationInfo(lower)) {
    warnings.push("Si tu negocio depende de ubicación, añade ciudad o zona para personalizar mejor la propuesta.");
  }

  return warnings;
}

function computeCompletenessScore(brief: BusinessBriefDraft, rawInput: string) {
  let score = 0;
  const lower = rawInput.toLowerCase();

  if (rawInput.length >= 40) score += 15;
  if (brief.offer_summary.trim().length >= 40) score += 25;
  if (brief.target_audience.trim().length >= 8) score += 20;
  if (brief.primary_cta.trim().length >= 4) score += 15;
  if (containsLocationInfo(lower)) score += 10;
  if (containsValueProposition(lower) || brief.offer_summary.trim().length >= 90) score += 15;

  return clampScore(score);
}

function buildFollowUpQuestion(missingFields: MissingBriefField[]) {
  const first = missingFields[0];
  if (!first) return null;

  return {
    offer_summary: "Cuéntame en una frase clara qué ofreces y qué hace diferente tu negocio.",
    target_audience: "¿Para quién está pensado tu producto o servicio?",
    whatsapp_phone: "Si quieres activar contacto por WhatsApp, compárteme el número con indicativo de país.",
    business_type: "¿Tu página será más de catálogo/venta o más informativa/presentación del negocio?"
  }[first];
}

function suggestOfferSummary(input: {
  rawInput: string;
  businessName: string;
  businessType: BusinessBriefDraft["business_type"];
  targetAudience: string;
}) {
  const trimmed = input.rawInput.trim();
  if (trimmed.length >= 36) {
    const compact = trimmed.replace(/\s+/g, " ").trim();
    return compact.length > 220 ? `${compact.slice(0, 217)}...` : compact;
  }

  if (input.businessType === "commerce_lite") {
    return `${input.businessName} ofrece productos pensados para ${input.targetAudience.toLowerCase()}, con una experiencia rápida y clara para consultar catálogo y comprar por WhatsApp.`;
  }

  return `${input.businessName} presenta su oferta principal para ${input.targetAudience.toLowerCase()}, con una propuesta clara para generar confianza y facilitar el contacto.`;
}

function suggestPrimaryCta(input: {
  businessType: BusinessBriefDraft["business_type"];
  rawInput: string;
  offerSummary: string;
  hasWhatsappPhone: boolean;
}) {
  const lower = `${input.rawInput} ${input.offerSummary}`.toLowerCase();
  if (input.businessType === "commerce_lite") {
    if (input.hasWhatsappPhone) {
      if (/cat[aá]logo|catalog/.test(lower)) return "Pedir catálogo por WhatsApp";
      if (/precio|cotiz|valor|presupuesto/.test(lower)) return "Cotizar por WhatsApp";
      return "Comprar por WhatsApp";
    }
    if (/cat[aá]logo|catalog/.test(lower)) return "Ver catálogo";
    return "Conocer productos";
  }

  if (input.hasWhatsappPhone) {
    if (/agenda|cita|consulta|asesor/i.test(lower)) return "Agendar por WhatsApp";
    return "Hablar por WhatsApp";
  }
  if (/agenda|cita|consulta|asesor/i.test(lower)) return "Agendar asesoría";
  return "Solicitar información";
}

function suggestWhatsappMessage(input: {
  businessName: string;
  businessType: BusinessBriefDraft["business_type"];
  offerSummary: string;
  primaryCta: string;
}) {
  const lower = `${input.offerSummary} ${input.primaryCta}`.toLowerCase();
  if (input.businessType === "commerce_lite") {
    if (/cotiz|precio|valor/.test(lower)) {
      return `Hola, vi la página de ${input.businessName} y quiero cotizar uno de sus productos.`;
    }
    if (/cat[aá]logo|catalog/.test(lower)) {
      return `Hola, vi la página de ${input.businessName} y quiero ver el catálogo completo.`;
    }
    return `Hola, vi la página de ${input.businessName} y quiero conocer disponibilidad y precios.`;
  }

  if (/agenda|cita|consulta|asesor/.test(lower)) {
    return `Hola, vi la página de ${input.businessName} y quiero agendar una asesoría.`;
  }
  return `Hola, vi la página de ${input.businessName} y quiero recibir más información.`;
}

function inferBusinessName(rawInput: string) {
  const trimmed = rawInput.trim();
  if (!trimmed) return "Tu negocio";

  const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim() ?? trimmed;
  const compact = firstSentence.replace(/\s+/g, " ");
  const normalized = compact.length > 80 ? compact.slice(0, 80) : compact;
  return normalized.length < 2 ? "Tu negocio" : normalized;
}

function inferAudience(lower: string) {
  if (lower.includes("empresa") || lower.includes("b2b")) return "Empresas y clientes corporativos";
  if (lower.includes("mujer")) return "Mujeres interesadas en la oferta";
  if (lower.includes("deport")) return "Personas activas y deportistas";
  if (lower.includes("niñ") || lower.includes("familia")) return "Familias y hogares";
  return "Clientes potenciales en redes y WhatsApp";
}

function inferTone(lower: string) {
  if (lower.includes("moderno")) return "Moderno y directo";
  if (lower.includes("formal") || lower.includes("corporativo")) return "Profesional y confiable";
  if (lower.includes("premium") || lower.includes("elegante")) return "Premium y sofisticado";
  return "Cercano y claro";
}

function containsLocationInfo(lower: string) {
  return lower.includes("bogotá") || lower.includes("medellín") || lower.includes("cali") || lower.includes("cdmx") || lower.includes("ciudad") || lower.includes("barrio") || lower.includes("colombia") || lower.includes("méxico") || lower.includes("perú") || lower.includes("chile");
}

function containsValueProposition(lower: string) {
  return lower.includes("rápido") || lower.includes("garant") || lower.includes("calidad") || lower.includes("a domicilio") || lower.includes("personalizado") || lower.includes("24/7") || lower.includes("únic") || lower.includes("especial");
}

function extractWhatsappPhone(input: string) {
  const match = input.match(/\+\d{8,15}/);
  return match?.[0];
}

function normalizeHeroSuggestion(input: unknown, brief: BusinessBriefDraft): HeroSuggestion | null {
  const parsed = heroSuggestionSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  return buildHeroSuggestion(brief);
}

function buildHeroSuggestion(brief: BusinessBriefDraft): HeroSuggestion {
  const audience = brief.target_audience.trim();
  const offer = brief.offer_summary.trim();
  const cta = brief.primary_cta.trim();
  const opening =
    brief.business_type === "commerce_lite"
      ? `Descubre ${brief.business_name}`
      : `${brief.business_name}: ${offer.split(/[,.]/)[0]?.trim() ?? "tu propuesta"}`;

  return {
    headline: opening.length > 78 ? opening.slice(0, 78) : opening,
    subheadline:
      offer.length > 150
        ? offer.slice(0, 147).trimEnd() + "..."
        : `${offer}${offer.endsWith(".") ? "" : "."} Pensado para ${audience.toLowerCase()}.`,
    primary_cta: cta,
    hero_direction:
      brief.business_type === "commerce_lite"
        ? "Hero con foco en producto, beneficio inmediato y CTA de contacto visible."
        : "Hero de credibilidad con propuesta clara, soporte visual limpio y CTA principal único."
  };
}

function computeHeroConfidence(brief: BusinessBriefDraft, hero: HeroSuggestion | null, missingFields: MissingBriefField[]) {
  if (!hero) return 0.4;
  let score = 0.58;
  if (brief.offer_summary.trim().length >= 60) score += 0.12;
  if (brief.target_audience.trim().length >= 20) score += 0.08;
  if (brief.primary_cta.trim().length >= 4) score += 0.06;
  if (brief.business_name.trim().length >= 3) score += 0.05;
  if (brief.whatsapp_phone) score += 0.03;
  if (!missingFields.includes("offer_summary")) score += 0.04;
  if (!missingFields.includes("target_audience")) score += 0.04;
  return clamp01(score);
}

function buildHeroFollowUpQuestion(brief: BusinessBriefDraft, missingFields: MissingBriefField[]) {
  if (missingFields.includes("offer_summary")) {
    return "Para proponer un hero más fuerte necesito entender mejor tu oferta. ¿Qué vendes o qué servicio das y cuál es el resultado principal para el cliente?";
  }

  if (missingFields.includes("target_audience")) {
    return "Antes de cerrar el hero, cuéntame mejor para quién es tu oferta. ¿Qué tipo de cliente quieres atraer primero?";
  }

  return `Ya tenemos base del brief, pero todavía no tengo suficiente confianza para proponerte un hero fuerte para ${brief.business_name}. Cuéntame en una frase qué promesa principal quieres que vea la gente apenas entra a la página.`;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

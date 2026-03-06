import { env } from "@/lib/env";
import {
  businessBriefDraftSchema,
  type BusinessBriefDraft,
  type OnboardingInputMode,
  type RefineResponse
} from "@/lib/onboarding/types";
import { pickTemplateOrFallback, recommendTemplateIds } from "@/lib/templates/selector";

type RefineBriefInput = {
  rawInput: string;
  inputMode: OnboardingInputMode;
};

export async function refineBusinessBrief(input: RefineBriefInput): Promise<RefineResponse> {
  const normalizedInput = input.rawInput.trim();
  const warnings: string[] = buildActionableWarnings(normalizedInput);

  if (normalizedInput.length < 30) {
    warnings.push("La descripción es corta; considera agregar oferta, público y estilo para mayor precisión.");
  }

  if (env.onboardingRefineProvider === "heuristic") {
    const briefDraft = buildHeuristicBrief(normalizedInput);
    const recommendedTemplateIds = recommendTemplateIds({
      businessType: briefDraft.business_type,
      stylePreset: briefDraft.style_preset,
      tone: briefDraft.tone
    });
    const recommendedTemplateId =
      recommendedTemplateIds[0] ??
      pickTemplateOrFallback({
        siteType: briefDraft.business_type,
        brief: briefDraft
      });
    return {
      briefDraft,
      confidence: 0.55,
      completenessScore: computeCompletenessScore(briefDraft, normalizedInput),
      warnings,
      provider: "heuristic",
      recommendedTemplateIds,
      recommendedTemplateId
    };
  }

  try {
    const llmResponse = await callRefineLLM(normalizedInput, input.inputMode);
    const parsed = safeParseJson(llmResponse);
    const validated = businessBriefDraftSchema.safeParse(parsed);

    if (validated.success) {
      const recommendedTemplateIds = recommendTemplateIds({
        businessType: validated.data.business_type,
        stylePreset: validated.data.style_preset,
        tone: validated.data.tone
      });
      const recommendedTemplateId =
        recommendedTemplateIds[0] ??
        pickTemplateOrFallback({
          siteType: validated.data.business_type,
          brief: validated.data
        });
      return {
        briefDraft: validated.data,
        confidence: 0.8,
        completenessScore: computeCompletenessScore(validated.data, normalizedInput),
        warnings,
        provider: "llm",
        recommendedTemplateIds,
        recommendedTemplateId
      };
    }

    warnings.push("Se aplicó refinamiento heurístico por respuesta IA inválida.");
  } catch (error) {
    warnings.push(`Se aplicó refinamiento heurístico por timeout/error de IA (${humanizeLlmError(error)}).`);
  }

  const briefDraft = buildHeuristicBrief(normalizedInput);
  const recommendedTemplateIds = recommendTemplateIds({
    businessType: briefDraft.business_type,
    stylePreset: briefDraft.style_preset,
    tone: briefDraft.tone
  });
  const recommendedTemplateId =
    recommendedTemplateIds[0] ??
    pickTemplateOrFallback({
      siteType: briefDraft.business_type,
      brief: briefDraft
    });

  return {
    briefDraft,
    confidence: 0.55,
    completenessScore: computeCompletenessScore(briefDraft, normalizedInput),
    warnings,
    provider: "heuristic",
    recommendedTemplateIds,
    recommendedTemplateId
  };
}

async function callRefineLLM(rawInput: string, inputMode: OnboardingInputMode) {
  if (env.aiProvider === "mock" || !env.aiBaseUrl) {
    throw new Error("LLM refine unavailable");
  }

  const response = await fetch(env.aiBaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: env.aiApiKey ? `Bearer ${env.aiApiKey}` : ""
    },
    body: JSON.stringify({
      model: env.aiModel,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Extrae y devuelve SOLO JSON valido para BusinessBriefDraft. Sin markdown, sin comentarios, sin texto adicional."
        },
        {
          role: "user",
          content: `Modo de entrada: ${inputMode}. Descripción del negocio: ${rawInput}`
        }
      ]
    })
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(`LLM request failed: ${response.status}${responseText ? ` | ${responseText.slice(0, 220)}` : ""}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    output_text?: string;
  };

  const content = data.choices?.[0]?.message?.content ?? data.output_text;
  if (!content) {
    throw new Error("LLM returned empty content");
  }

  return content;
}

function humanizeLlmError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");

  if (rawMessage.includes("401")) return "401 no autorizado (API key inválida o sin permisos)";
  if (rawMessage.includes("429")) return "429 límite/cuota excedida";
  if (rawMessage.includes("404")) return "404 endpoint/modelo no disponible";
  if (rawMessage.includes("400")) return "400 solicitud inválida (modelo o payload)";
  if (rawMessage.includes("timeout")) return "timeout";
  if (rawMessage.includes("mock")) return "provider en modo mock";
  if (rawMessage.includes("LLM refine unavailable")) return "LLM no disponible por configuración";

  return "error de conexión o proveedor";
}

function safeParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    const cleaned = input.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned);
  }
}

function buildHeuristicBrief(rawInput: string): BusinessBriefDraft {
  const lower = rawInput.toLowerCase();

  const businessType: BusinessBriefDraft["business_type"] =
    lower.includes("tienda") || lower.includes("catalog") || lower.includes("catálogo") || lower.includes("vender")
      ? "commerce_lite"
      : "informative";

  const stylePreset: BusinessBriefDraft["style_preset"] = lower.includes("moderno")
    ? "ocean"
    : lower.includes("premium") || lower.includes("elegante")
      ? "sunset"
      : "mono";

  const sectionPreferences =
    businessType === "commerce_lite"
      ? (["hero", "catalog", "testimonials", "contact"] as const)
      : (["hero", "testimonials", "contact"] as const);

  const businessName = inferBusinessName(rawInput);
  const offerSummary = rawInput.trim().length >= 12 ? rawInput.slice(0, 600) : `${rawInput.trim()} Servicios para clientes locales.`;

  return {
    business_name: businessName,
    business_type: businessType,
    offer_summary: offerSummary,
    target_audience: inferAudience(lower),
    tone: inferTone(lower),
    primary_cta: "WhatsApp",
    section_preferences: [...sectionPreferences],
    style_preset: stylePreset
  };
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

function buildActionableWarnings(rawInput: string) {
  const lower = rawInput.toLowerCase();
  const warnings: string[] = [];

  if (!containsPriceInfo(lower)) {
    warnings.push("Falta rango de precios. Añádelo para mejorar propuestas de catálogo y CTA.");
  }

  if (!containsLocationInfo(lower)) {
    warnings.push("Falta ubicación/ciudad. Añádela para personalizar mensajes de confianza local.");
  }

  if (!containsAudienceInfo(lower)) {
    warnings.push("Falta público objetivo explícito. Añade para ajustar tono y secciones.");
  }

  if (!containsValueProposition(lower)) {
    warnings.push("Falta beneficio principal diferencial. Explica por qué te deberían elegir.");
  }

  return warnings;
}

function computeCompletenessScore(
  brief: {
    offer_summary: string;
    target_audience: string;
    tone: string;
    section_preferences: string[];
  },
  rawInput: string
) {
  let score = 0;
  const lower = rawInput.toLowerCase();

  if (rawInput.length >= 40) score += 20;
  if (brief.offer_summary.trim().length >= 40) score += 20;
  if (brief.target_audience.trim().length >= 8) score += 15;
  if (brief.tone.trim().length >= 4) score += 10;
  if (brief.section_preferences.length >= 3) score += 10;
  if (containsPriceInfo(lower)) score += 10;
  if (containsLocationInfo(lower)) score += 10;
  if (containsValueProposition(lower)) score += 5;

  return Math.max(0, Math.min(100, score));
}

function containsPriceInfo(lower: string) {
  return /\$\s?\d+/.test(lower) || /\d+\s?(usd|cop|mxn|soles|pesos|euros)/.test(lower) || lower.includes("precio");
}

function containsLocationInfo(lower: string) {
  return lower.includes("bogotá") || lower.includes("medellín") || lower.includes("cali") || lower.includes("cdmx") || lower.includes("ciudad") || lower.includes("barrio") || lower.includes("colombia") || lower.includes("méxico") || lower.includes("perú") || lower.includes("chile");
}

function containsAudienceInfo(lower: string) {
  return lower.includes("para ") || lower.includes("clientes") || lower.includes("emprendedores") || lower.includes("familias") || lower.includes("jóvenes") || lower.includes("mujeres") || lower.includes("hombres");
}

function containsValueProposition(lower: string) {
  return lower.includes("rápido") || lower.includes("garant") || lower.includes("calidad") || lower.includes("a domicilio") || lower.includes("personalizado") || lower.includes("24/7");
}

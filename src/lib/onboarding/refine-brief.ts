import { env } from "@/lib/env";
import {
  businessBriefDraftSchema,
  type OnboardingInputMode,
  type RefineResponse
} from "@/lib/onboarding/types";

type RefineBriefInput = {
  rawInput: string;
  inputMode: OnboardingInputMode;
};

export async function refineBusinessBrief(input: RefineBriefInput): Promise<RefineResponse> {
  const normalizedInput = input.rawInput.trim();
  const warnings: string[] = [];

  if (normalizedInput.length < 30) {
    warnings.push("La descripción es corta; considera agregar oferta, público y estilo para mayor precisión.");
  }

  if (env.onboardingRefineProvider === "heuristic") {
    return {
      briefDraft: buildHeuristicBrief(normalizedInput),
      confidence: 0.55,
      warnings,
      provider: "heuristic"
    };
  }

  try {
    const llmResponse = await callRefineLLM(normalizedInput, input.inputMode);
    const parsed = safeParseJson(llmResponse);
    const validated = businessBriefDraftSchema.safeParse(parsed);

    if (validated.success) {
      return {
        briefDraft: validated.data,
        confidence: 0.8,
        warnings,
        provider: "llm"
      };
    }

    warnings.push("Se aplicó refinamiento heurístico por respuesta IA inválida.");
  } catch {
    warnings.push("Se aplicó refinamiento heurístico por timeout/error de IA.");
  }

  return {
    briefDraft: buildHeuristicBrief(normalizedInput),
    confidence: 0.55,
    warnings,
    provider: "heuristic"
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
    throw new Error(`LLM request failed: ${response.status}`);
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

function safeParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    const cleaned = input.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned);
  }
}

function buildHeuristicBrief(rawInput: string) {
  const lower = rawInput.toLowerCase();

  const businessType =
    lower.includes("tienda") || lower.includes("catalog") || lower.includes("catálogo") || lower.includes("vender")
      ? "commerce_lite"
      : "informative";

  const stylePreset = lower.includes("moderno")
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

import { env } from "@/lib/env";
import { buildFallbackSiteSpecV2, parseAnySiteSpec } from "@/lib/site-spec-any";
import type { SiteSpecV2 } from "@/lib/site-spec-v2";
import type { TemplateId } from "@/lib/templates/types";

type GenerationResult = {
  siteSpec: SiteSpecV2;
  source: "llm" | "fallback";
  rawText?: string;
};

export async function generateSiteSpecFromPrompt(prompt: string, options?: { templateId?: TemplateId }): Promise<GenerationResult> {
  if (env.aiProvider === "mock" || !env.aiBaseUrl) {
    return { siteSpec: buildFallbackSiteSpecV2(prompt, { templateId: options?.templateId }), source: "fallback" };
  }

  const llmText = await callLLM(prompt, options);

  const parsedJson = safeParseJson(llmText);
  const validated = parseAnySiteSpec(parsedJson, { preferredTemplateId: options?.templateId ?? null });
  if (validated.success) {
    return { siteSpec: validated.data, source: "llm", rawText: llmText };
  }

  // Repair step with stricter instruction
  const repairedText = await callLLM(
    `Devuelve EXCLUSIVAMENTE JSON valido acorde al schema SiteSpec v2.0. Entrada de negocio: ${prompt}`,
    options
  );
  const repairedJson = safeParseJson(repairedText);
  const repairedValidated = parseAnySiteSpec(repairedJson, { preferredTemplateId: options?.templateId ?? null });

  if (repairedValidated.success) {
    return { siteSpec: repairedValidated.data, source: "llm", rawText: repairedText };
  }

  return {
    siteSpec: buildFallbackSiteSpecV2(prompt, { templateId: options?.templateId }),
    source: "fallback",
    rawText: repairedText
  };
}

async function callLLM(prompt: string, options?: { templateId?: TemplateId }) {
  const templateHint = options?.templateId ? `Template preferida: ${options.templateId}.` : "";
  const response = await fetch(env.aiBaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: env.aiApiKey ? `Bearer ${env.aiApiKey}` : ""
    },
    body: JSON.stringify({
      model: env.aiModel,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Eres un generador de configuraciones de sitios web. Responde SOLO JSON válido para SiteSpec v2.0 sin markdown ni texto adicional."
        },
        {
          role: "user",
          content: `Negocio: ${prompt}. ${templateHint}`
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

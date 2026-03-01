import { env } from "@/lib/env";
import { buildFallbackSiteSpec, parseSiteSpec, type SiteSpec } from "@/lib/site-spec";

type GenerationResult = {
  siteSpec: SiteSpec;
  source: "llm" | "fallback";
  rawText?: string;
};

export async function generateSiteSpecFromPrompt(prompt: string): Promise<GenerationResult> {
  if (env.aiProvider === "mock" || !env.aiBaseUrl) {
    return { siteSpec: buildFallbackSiteSpec(prompt), source: "fallback" };
  }

  const llmText = await callLLM(prompt);

  const parsedJson = safeParseJson(llmText);
  const validated = parseSiteSpec(parsedJson);
  if (validated.success) {
    return { siteSpec: validated.data, source: "llm", rawText: llmText };
  }

  // Repair step with stricter instruction
  const repairedText = await callLLM(
    `Devuelve EXCLUSIVAMENTE JSON valido acorde al schema SiteSpec v1.0. Entrada de negocio: ${prompt}`
  );
  const repairedJson = safeParseJson(repairedText);
  const repairedValidated = parseSiteSpec(repairedJson);

  if (repairedValidated.success) {
    return { siteSpec: repairedValidated.data, source: "llm", rawText: repairedText };
  }

  return { siteSpec: buildFallbackSiteSpec(prompt), source: "fallback", rawText: repairedText };
}

async function callLLM(prompt: string) {
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
            "Eres un generador de configuraciones de sitios web. Responde SOLO JSON válido para SiteSpec v1.0 sin markdown ni texto adicional."
        },
        {
          role: "user",
          content: `Negocio: ${prompt}`
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

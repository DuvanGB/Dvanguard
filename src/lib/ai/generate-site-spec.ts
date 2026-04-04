import { env } from "@/lib/env";
import { buildFallbackSiteSpecV3, buildSiteSpecV3FromBrief, parseSiteSpecV3, type SiteSpecV3 } from "@/lib/site-spec-v3";
import type { TemplateId } from "@/lib/templates/types";
import type { BusinessBriefDraft } from "@/lib/onboarding/types";

type GenerationResult = {
  siteSpec: SiteSpecV3;
  source: "llm" | "seed";
  rawText?: string;
  enhancementApplied: boolean;
};

type EnhancementPayload = {
  hero_subheadline?: string;
  catalog_title?: string;
  catalog_items?: Array<{ name?: string; description?: string; price?: string }>;
  testimonials?: string[];
  contact_description?: string;
};

function extractProductCountFromText(text: string): number | undefined {
  const match = text.match(/(\d+)\s*(?:productos?|servicios?|items?|artículos?)/i);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1 && n <= 30) return n;
  }
  return undefined;
}

export async function generateSiteSpecFromPrompt(input: {
  prompt: string;
  templateId?: TemplateId;
  briefDraft?: BusinessBriefDraft;
  productCount?: number;
}): Promise<GenerationResult> {
  const seedSpec = buildSeedSpec(input);
  const effectiveProductCount = input.productCount
    ?? extractProductCountFromText(input.briefDraft?.offer_summary ?? "")
    ?? extractProductCountFromText(input.prompt);

  if (env.aiProvider === "mock" || !env.aiBaseUrl || !env.aiModel) {
    return { siteSpec: seedSpec, source: "seed", enhancementApplied: false };
  }

  try {
    const llmText = await callLLMForEnhancement(input.prompt, seedSpec.template.id, effectiveProductCount);
    const parsed = safeParseJson(llmText);
    const enhanced = applyEnhancements(seedSpec, parsed);
    const validated = parseSiteSpecV3(enhanced);

    if (validated.success) {
      return {
        siteSpec: validated.data,
        source: "llm",
        rawText: llmText,
        enhancementApplied: true
      };
    }
  } catch {
    // Fallback to deterministic seed spec.
  }

  return { siteSpec: seedSpec, source: "seed", enhancementApplied: false };
}

function buildSeedSpec(input: { prompt: string; templateId?: TemplateId; briefDraft?: BusinessBriefDraft; productCount?: number }) {
  const { briefDraft } = input;
  const productCount = input.productCount
    ?? extractProductCountFromText(briefDraft?.offer_summary ?? "")
    ?? extractProductCountFromText(input.prompt);

  if (briefDraft) {
    return buildSiteSpecV3FromBrief({
      siteType: briefDraft.business_type,
      templateId: input.templateId,
      businessName: briefDraft.business_name,
      offerSummary: briefDraft.offer_summary,
      targetAudience: briefDraft.target_audience,
      tone: briefDraft.tone,
      ctaLabel: briefDraft.primary_cta,
      whatsappPhone: briefDraft.whatsapp_phone,
      whatsappMessage: briefDraft.whatsapp_message,
      productCount
    });
  }

  return buildFallbackSiteSpecV3(input.prompt, { templateId: input.templateId });
}

async function callLLMForEnhancement(prompt: string, templateId: TemplateId, productCount?: number) {
  const maxItems = Math.min(productCount ?? 3, 30);
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
            "Eres un asistente de copy para sitios web. Devuelve SOLO JSON válido con mejoras de texto. No envíes markdown."
        },
        {
          role: "user",
          content: [
            "Devuelve un JSON con campos opcionales:",
            `hero_subheadline, catalog_title, catalog_items (max ${maxItems}), testimonials (max 3), contact_description.`,
            "Cada catalog_item tiene: name, description, price.",
            "No inventes estructura HTML ni SiteSpec completo.",
            `Template elegida: ${templateId}.`,
            `Brief del negocio: ${prompt}`
          ].join(" ")
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

function applyEnhancements(seedSpec: SiteSpecV3, parsed: unknown): SiteSpecV3 {
  const payload = parsed as EnhancementPayload;
  const spec = structuredClone(seedSpec);
  const home = spec.pages[0];
  if (!home) return seedSpec;

  const hero = home.sections.find((section) => section.type === "hero");
  const catalog = home.sections.find((section) => section.type === "catalog");
  const testimonials = home.sections.find((section) => section.type === "testimonials");
  const contact = home.sections.find((section) => section.type === "contact");

  if (hero && payload.hero_subheadline) {
    const block = hero.blocks.find((item) => item.type === "text" && item.id.includes("subheadline"));
    if (block && block.type === "text") {
      block.content.text = payload.hero_subheadline.slice(0, 400);
    }
  }

  if (catalog && payload.catalog_title) {
    const block = catalog.blocks.find((item) => item.type === "text" && item.id.includes("title"));
    if (block && block.type === "text") {
      block.content.text = payload.catalog_title.slice(0, 120);
    }
  }

  if (catalog && Array.isArray(payload.catalog_items)) {
    const productBlocks = catalog.blocks.filter((block) => block.type === "product");
    if (productBlocks.length) {
      payload.catalog_items.slice(0, productBlocks.length).forEach((item, index) => {
        const block = productBlocks[index];
        if (!block || block.type !== "product") return;
        if (item.name) block.content.name = item.name.slice(0, 120);
        if (item.description) block.content.description = item.description.slice(0, 220);
        if (item.price) {
          const numeric = Number(item.price.replace(/[^\d.]/g, ""));
          block.content.price = Number.isFinite(numeric) ? numeric : block.content.price;
        }
      });
    } else {
      const textProducts = catalog.blocks.filter((b) => b.type === "text" && /name-\d+$/.test(b.id));
      const maxText = Math.max(textProducts.length, 3);
      payload.catalog_items.slice(0, maxText).forEach((item, index) => {
        const name = catalog.blocks.find((block) => block.type === "text" && block.id.endsWith(`name-${index + 1}`));
        const desc = catalog.blocks.find((block) => block.type === "text" && block.id.endsWith(`desc-${index + 1}`));
        const price = catalog.blocks.find((block) => block.type === "text" && block.id.endsWith(`price-${index + 1}`));

        if (name && name.type === "text" && item.name) {
          name.content.text = item.name.slice(0, 120);
        }
        if (desc && desc.type === "text" && item.description) {
          desc.content.text = item.description.slice(0, 220);
        }
        if (price && price.type === "text" && item.price) {
          price.content.text = item.price.slice(0, 40);
        }
      });
    }
  }

  if (testimonials && Array.isArray(payload.testimonials)) {
    payload.testimonials.slice(0, 3).forEach((quote, index) => {
      const block = testimonials.blocks.find((item) => item.type === "text" && item.id.endsWith(`quote-${index + 1}`));
      if (block && block.type === "text" && quote) {
        block.content.text = quote.slice(0, 280);
      }
    });
  }

  if (contact && payload.contact_description) {
    const block = contact.blocks.find((item) => item.type === "text" && item.id.includes("description"));
    if (block && block.type === "text") {
      block.content.text = payload.contact_description.slice(0, 280);
    }
  }

  return spec;
}

function safeParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    const cleaned = input.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned);
  }
}

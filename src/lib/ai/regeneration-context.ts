import type { BusinessBriefDraft } from "@/lib/onboarding/types";
import type { SiteSectionV3, SiteSpecV3 } from "@/lib/site-spec-v3";
import { normalizeWhatsappPhone } from "@/lib/whatsapp";

export type RegenerationProductSummary = {
  name: string;
  description: string;
  hasImage: boolean;
};

export type RegenerationTestimonialSummary = {
  quote: string;
  author: string | null;
};

export type RegenerationCurrentSiteContent = {
  headline: string;
  subheadline: string;
  products: RegenerationProductSummary[];
  testimonials: RegenerationTestimonialSummary[];
  sectionsPresent: SiteSectionV3["type"][];
  sectionVariants: Partial<Record<SiteSectionV3["type"], SiteSectionV3["variant"]>>;
  imageCount: number;
  ctaLabel: string | null;
  whatsappConfigured: boolean;
};

export type RegenerationContentDiff = {
  addedSections: SiteSectionV3["type"][];
  removedSections: SiteSectionV3["type"][];
  addedProducts: string[];
  removedProducts: string[];
  headlineChanged: boolean;
  subheadlineChanged: boolean;
  imageCountDelta: number;
  testimonialCountDelta: number;
};

export type RegenerationContext = {
  isRegeneration: true;
  prompt: string;
  briefDraft: BusinessBriefDraft;
  previousTheme: SiteSpecV3["theme"] | null;
  currentSiteContent: RegenerationCurrentSiteContent;
  contentDiff: RegenerationContentDiff;
  iterationNumber: number;
  designUpgradeObjective: string;
  currentSiteSummary?: string | null;
  analyticsSnapshot?: {
    visits: number;
    whatsappClicks: number;
    ctaClicks: number;
  } | null;
};

export function extractCurrentSiteContentForRegeneration(input: {
  siteSpec?: SiteSpecV3 | null;
  assetUrls?: string[] | null;
}): RegenerationCurrentSiteContent {
  const siteSpec = input.siteSpec;
  const fallback: RegenerationCurrentSiteContent = {
    headline: "",
    subheadline: "",
    products: [],
    testimonials: [],
    sectionsPresent: [],
    sectionVariants: {},
    imageCount: input.assetUrls?.length ?? 0,
    ctaLabel: null,
    whatsappConfigured: false
  };

  if (!siteSpec) return fallback;

  const home = siteSpec.pages.find((page) => page.slug === "/") ?? siteSpec.pages[0];
  if (!home) return fallback;

  const sectionsPresent = home.sections.filter((section) => section.enabled).map((section) => section.type);
  const sectionVariants = home.sections.reduce<RegenerationCurrentSiteContent["sectionVariants"]>((acc, section) => {
    if (section.enabled) acc[section.type] = section.variant;
    return acc;
  }, {});

  const heroSection = home.sections.find((section) => section.type === "hero");
  const heroTextBlocks = heroSection?.blocks.filter((block) => block.type === "text") ?? [];
  const headlineBlock =
    heroTextBlocks.find((block) => /headline/i.test(block.id) && !/subheadline/i.test(block.id)) ?? heroTextBlocks[0];
  const subheadlineBlock =
    heroTextBlocks.find((block) => /subheadline/i.test(block.id)) ??
    heroTextBlocks.find((block) => block.id !== headlineBlock?.id);

  const catalogSection = home.sections.find((section) => section.type === "catalog");
  const productBlocks = catalogSection?.blocks.filter((block) => block.type === "product") ?? [];
  const products = productBlocks.map((block) => ({
    name: block.content.name.trim(),
    description: block.content.description?.trim() ?? "",
    hasImage: Boolean(block.content.image_url)
  }));

  const testimonialsSection = home.sections.find((section) => section.type === "testimonials");
  const quoteBlocks =
    testimonialsSection?.blocks.filter(
      (block): block is Extract<(typeof testimonialsSection.blocks)[number], { type: "text" }> =>
        block.type === "text" && /quote/i.test(block.id) && block.content.text.trim().length > 0
    ) ?? [];
  const authorBlocks =
    testimonialsSection?.blocks.filter(
      (block): block is Extract<(typeof testimonialsSection.blocks)[number], { type: "text" }> =>
        block.type === "text" && /author|name/i.test(block.id) && !/quote/i.test(block.id) && block.content.text.trim().length > 0
    ) ?? [];
  const testimonials = quoteBlocks.map((block, index) => ({
    quote: block.content.text.trim(),
    author: authorBlocks[index]?.type === "text" ? authorBlocks[index].content.text.trim() || null : null
  }));

  const buttonBlocks = home.sections.flatMap((section) => section.blocks.filter((block) => block.type === "button"));
  const siteImageUrls = new Set<string>();
  for (const section of home.sections) {
    for (const block of section.blocks) {
      if (block.type === "image" && block.content.url) siteImageUrls.add(block.content.url);
      if (block.type === "product" && block.content.image_url) siteImageUrls.add(block.content.image_url);
    }
  }
  for (const assetUrl of input.assetUrls ?? []) {
    if (assetUrl) siteImageUrls.add(assetUrl);
  }

  return {
    headline: headlineBlock?.type === "text" ? headlineBlock.content.text.trim() : "",
    subheadline: subheadlineBlock?.type === "text" ? subheadlineBlock.content.text.trim() : "",
    products,
    testimonials,
    sectionsPresent,
    sectionVariants,
    imageCount: siteImageUrls.size,
    ctaLabel: buttonBlocks[0]?.type === "button" ? buttonBlocks[0].content.label.trim() : siteSpec.integrations.whatsapp?.cta_label ?? null,
    whatsappConfigured: Boolean(siteSpec.integrations.whatsapp?.enabled && siteSpec.integrations.whatsapp?.phone)
  };
}

export function buildRegenerationDiff(input: {
  currentSpec?: SiteSpecV3 | null;
  previousSpec?: SiteSpecV3 | null;
  currentAssetUrls?: string[] | null;
  previousAssetUrls?: string[] | null;
}): RegenerationContentDiff {
  const currentContent = extractCurrentSiteContentForRegeneration({
    siteSpec: input.currentSpec,
    assetUrls: input.currentAssetUrls
  });
  const previousContent = extractCurrentSiteContentForRegeneration({
    siteSpec: input.previousSpec,
    assetUrls: input.previousAssetUrls
  });

  const previousSections = new Set(previousContent.sectionsPresent);
  const currentSections = new Set(currentContent.sectionsPresent);
  const previousProducts = new Set(previousContent.products.map((product) => normalizeName(product.name)));
  const currentProducts = new Set(currentContent.products.map((product) => normalizeName(product.name)));

  return {
    addedSections: currentContent.sectionsPresent.filter((section) => !previousSections.has(section)),
    removedSections: previousContent.sectionsPresent.filter((section) => !currentSections.has(section)),
    addedProducts: currentContent.products.map((product) => product.name).filter((name) => !previousProducts.has(normalizeName(name))),
    removedProducts: previousContent.products.map((product) => product.name).filter((name) => !currentProducts.has(normalizeName(name))),
    headlineChanged: normalizeText(currentContent.headline) !== normalizeText(previousContent.headline),
    subheadlineChanged: normalizeText(currentContent.subheadline) !== normalizeText(previousContent.subheadline),
    imageCountDelta: currentContent.imageCount - previousContent.imageCount,
    testimonialCountDelta: currentContent.testimonials.length - previousContent.testimonials.length
  };
}

export function buildRegenerationBriefBase(siteSpec: SiteSpecV3, siteName?: string) {
  const currentContent = extractCurrentSiteContentForRegeneration({ siteSpec });
  const businessName = siteName?.trim() || currentContent.headline || "Mi negocio";
  const offerSummary = inferMinimalOfferSummary(siteSpec, currentContent, businessName);
  const targetAudience =
    siteSpec.site_type === "commerce_lite"
      ? "Clientes interesados en comprar online o por WhatsApp."
      : "Clientes potenciales que buscan información y contacto.";
  const primaryCta =
    currentContent.ctaLabel ||
    siteSpec.integrations.whatsapp?.cta_label ||
    (siteSpec.site_type === "commerce_lite" ? "Comprar por WhatsApp" : "Solicitar información");

  return {
    rawInput: [
      businessName,
      siteSpec.site_type === "commerce_lite" ? "Rediseño de sitio comercial con catálogo." : "Rediseño de sitio informativo.",
      currentContent.whatsappConfigured ? "El sitio ya cuenta con contacto por WhatsApp." : null
    ]
      .filter(Boolean)
      .join(" "),
    briefDraft: {
      business_name: businessName,
      business_type: siteSpec.site_type,
      offer_summary: offerSummary,
      target_audience: targetAudience,
      tone: inferToneFromTheme(siteSpec),
      primary_cta: primaryCta,
      whatsapp_phone: normalizeWhatsappPhone(siteSpec.integrations.whatsapp?.phone),
      whatsapp_message: siteSpec.integrations.whatsapp?.message
    } satisfies BusinessBriefDraft
  };
}

export function buildRegenerationSummaryLine(input: {
  businessName: string;
  siteType: SiteSpecV3["site_type"];
  currentSiteContent: RegenerationCurrentSiteContent;
}) {
  const bits = [
    input.businessName,
    input.siteType === "commerce_lite" ? `${input.currentSiteContent.products.length} productos` : null,
    `${input.currentSiteContent.imageCount} imágenes`,
    `${input.currentSiteContent.sectionsPresent.length} secciones`,
    input.currentSiteContent.whatsappConfigured ? "WhatsApp activo" : null
  ].filter(Boolean);

  return bits.join(" · ");
}

function inferMinimalOfferSummary(
  siteSpec: SiteSpecV3,
  currentContent: RegenerationCurrentSiteContent,
  businessName: string
) {
  const candidate = [currentContent.subheadline, currentContent.headline]
    .map((item) => item.trim())
    .find((item) => item && isUsableOfferSummary(item));
  if (candidate) {
    return candidate.length > 220 ? `${candidate.slice(0, 217).trimEnd()}...` : candidate;
  }

  if (siteSpec.site_type === "commerce_lite") {
    return `${businessName} ofrece una propuesta comercial clara para mostrar productos, destacar beneficios y facilitar compras por WhatsApp.`;
  }

  return `${businessName} presenta su oferta principal con una estructura clara para generar confianza y facilitar el contacto.`;
}

function inferToneFromTheme(siteSpec: SiteSpecV3) {
  const headingFont = siteSpec.theme.typography.heading_font;
  if (headingFont === "Cormorant Garamond" || headingFont === "Playfair Display") return "Premium y editorial";
  if (headingFont === "Syne" || headingFont === "Space Grotesk") return "Moderno y directo";
  if (headingFont === "DM Serif Display") return "Cálido y confiable";
  if (headingFont === "Bebas Neue") return "Enérgico y comercial";
  return "Profesional y claro";
}

function isUsableOfferSummary(value: string) {
  const normalized = normalizeText(value);
  if (!normalized || normalized.length < 24) return false;
  if (/^necesito\b|^quiero\b|^crear\b|^hacer\b/.test(normalized)) return false;
  if (/producto estrella|producto 2|producto 3/.test(normalized)) return false;
  return true;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeName(value: string) {
  return normalizeText(value).replace(/[^\p{L}\p{N}\s]/gu, "");
}

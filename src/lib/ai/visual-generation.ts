import { z } from "zod";

import {
  fontFamilies,
  type CanvasBlock,
  type CanvasLayoutRect,
  type SiteSectionV3,
  type SiteSpecV3,
  parseSiteSpecV3
} from "@/lib/site-spec-v3";
import type { BusinessBriefDraft } from "@/lib/onboarding/types";
import { buildSiteSpecV3FromBrief } from "@/lib/site-spec-v3";
import type { HeaderVariant, TemplateId } from "@/lib/templates/types";

export const visualGenerationStages = [
  "brief_analysis",
  "visual_direction",
  "layout_seed",
  "content_polish",
  "finalizing"
] as const;

export type VisualGenerationStage = (typeof visualGenerationStages)[number];
const STRUCTURAL_TRAILING_SECTIONS: Array<SiteSectionV3["type"]> = ["testimonials", "contact"];

const sectionTypeSchema = z.enum(["hero", "catalog", "testimonials", "contact"]);
const blockRectSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(1).max(100),
  h: z.number().min(1).max(100),
  z: z.number().int().min(0).max(999)
});
const sectionHeightRatioSchema = z.object({
  desktop: z.number().min(0.2).max(3),
  mobile: z.number().min(0.2).max(3)
});

const themePatchSchema = z.object({
  primary: z.string().optional(),
  secondary: z.string().optional(),
  background: z.string().optional(),
  font_heading: z.string().optional(),
  font_body: z.string().optional(),
  radius: z.enum(["sm", "md", "lg"]).optional()
});

const blockCompositionSchema = z.object({
  matchId: z.string().min(1).max(120),
  visible: z.boolean().optional(),
  layout: z.object({
    desktop: blockRectSchema.optional(),
    mobile: blockRectSchema.optional()
  }),
  style: z
    .object({
      fontSize: z.number().optional(),
      fontWeight: z.number().optional(),
      fontFamily: z.string().optional(),
      color: z.string().optional(),
      bgColor: z.string().optional(),
      radius: z.number().optional(),
      borderColor: z.string().optional(),
      borderWidth: z.number().optional(),
      opacity: z.number().optional(),
      textAlign: z.enum(["left", "center", "right"]).optional()
    })
    .partial()
    .optional(),
  content: z
    .object({
      text: z.string().optional(),
      label: z.string().optional(),
      url: z.string().optional(),
      alt: z.string().optional(),
      fit: z.enum(["cover", "contain"]).optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.number().optional()
    })
    .partial()
    .optional()
});

const sectionCompositionSchema = z.object({
  type: sectionTypeSchema,
  variant: z.enum([
    "centered",
    "split",
    "image-left",
    "grid",
    "cards",
    "list",
    "minimal",
    "spotlight",
    "simple",
    "highlight",
    "compact"
  ]),
  height_ratio: sectionHeightRatioSchema,
  blocks: z.array(blockCompositionSchema).min(1).max(40)
});

export const layoutProposalSchema = z.object({
  design_direction: z.object({
    name: z.string().min(1).max(120),
    description: z.string().min(1).max(400)
  }),
  header_variant: z.enum(["none", "hamburger-side", "hamburger-overlay", "top-bar"]),
  section_order: z.array(sectionTypeSchema).min(1).max(4),
  section_compositions: z.array(sectionCompositionSchema).min(1).max(4),
  theme_direction: themePatchSchema.partial().optional()
});

export type LayoutProposal = z.infer<typeof layoutProposalSchema>;
export type SectionComposition = z.infer<typeof sectionCompositionSchema>;
export type BlockComposition = z.infer<typeof blockCompositionSchema>;

const designPatchSchema = z.object({
  visualDirection: z
    .object({
      name: z.string().min(1).max(120),
      description: z.string().min(1).max(400),
      headerVariant: z.enum(["none", "hamburger-side", "hamburger-overlay", "top-bar"]).optional()
    })
    .optional(),
  templateFamily: z.string().min(1).max(80).optional(),
  themePatch: themePatchSchema.partial().optional(),
  sectionOrder: z.array(sectionTypeSchema).optional(),
  sectionVariants: z
    .object({
      hero: sectionCompositionSchema.shape.variant.optional(),
      catalog: sectionCompositionSchema.shape.variant.optional(),
      testimonials: sectionCompositionSchema.shape.variant.optional(),
      contact: sectionCompositionSchema.shape.variant.optional()
    })
    .partial()
    .optional(),
  sectionHeightPatch: z
    .object({
      hero: sectionHeightRatioSchema.optional(),
      catalog: sectionHeightRatioSchema.optional(),
      testimonials: sectionHeightRatioSchema.optional(),
      contact: sectionHeightRatioSchema.optional()
    })
    .partial()
    .optional(),
  blockPatches: z.array(blockCompositionSchema.extend({ sectionType: sectionTypeSchema })).optional()
});

export type DesignPatch = z.infer<typeof designPatchSchema>;

export const visualGenerationProgressSchema = z.object({
  stage: z.enum(visualGenerationStages),
  progressPercent: z.number().min(0).max(100),
  message: z.string().min(1).max(200),
  layoutProposal: layoutProposalSchema.optional(),
  designPatch: designPatchSchema.optional(),
  source: z.enum(["worker", "fallback"]).default("worker"),
  fallbackUsed: z.boolean().default(false),
  completed: z.boolean().default(false),
  error: z.string().max(400).optional()
});

export type VisualGenerationProgressPayload = z.infer<typeof visualGenerationProgressSchema>;

export function buildVisualSeedSpec(input: {
  prompt: string;
  templateId?: TemplateId;
  briefDraft?: BusinessBriefDraft;
}): SiteSpecV3 {
  if (input.templateId && input.briefDraft) {
    return buildTemplateAlternativeSpec({
      briefDraft: input.briefDraft,
      templateId: input.templateId
    });
  }

  return buildNeutralProposalSeed(input);
}

export function buildTemplateAlternativeSpec(input: {
  briefDraft: BusinessBriefDraft;
  templateId: TemplateId;
}): SiteSpecV3 {
  return buildSiteSpecV3FromBrief({
    siteType: input.briefDraft.business_type,
    templateId: input.templateId,
    businessName: input.briefDraft.business_name,
    offerSummary: input.briefDraft.offer_summary,
    targetAudience: input.briefDraft.target_audience,
    tone: input.briefDraft.tone,
    ctaLabel: input.briefDraft.primary_cta,
    whatsappPhone: input.briefDraft.whatsapp_phone,
    whatsappMessage: input.briefDraft.whatsapp_message,
    sectionPreferences: input.briefDraft.section_preferences
  });
}

export function applyDesignPatchToSpec(seedSpec: SiteSpecV3, patch?: DesignPatch | null): SiteSpecV3 {
  if (!patch) return seedSpec;

  const next = structuredClone(seedSpec);
  if (patch.themePatch) {
    next.theme = {
      ...next.theme,
      ...normalizeThemePatch(patch.themePatch)
    };
  }

  if (patch.visualDirection?.headerVariant) {
    next.header = {
      ...next.header,
      variant: patch.visualDirection.headerVariant
    };
  }

  const home = next.pages.find((page) => page.slug === "/") ?? next.pages[0];
  if (!home) return seedSpec;

  if (patch.sectionOrder?.length) {
    const desired = patch.sectionOrder;
    const sorted = [...home.sections].sort((a, b) => {
      const aIndex = desired.indexOf(a.type);
      const bIndex = desired.indexOf(b.type);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });
    home.sections = sorted;
  }

  for (const section of home.sections) {
    const nextVariant = patch.sectionVariants?.[section.type];
    if (nextVariant) {
      section.variant = nextVariant;
    }
    const ratioPatch = patch.sectionHeightPatch?.[section.type];
    if (ratioPatch) {
      section.height_ratio = ratioPatch;
    }
  }

  for (const blockPatch of patch.blockPatches ?? []) {
    const section = home.sections.find((item) => item.type === blockPatch.sectionType);
    if (!section) continue;
    const block = section.blocks.find((item) => item.id.includes(blockPatch.matchId));
    if (!block) continue;

    if (typeof blockPatch.visible === "boolean") {
      block.visible = blockPatch.visible;
    }
    if (blockPatch.layout.desktop) {
      block.layout.desktop = mergeRect(block.layout.desktop, blockPatch.layout.desktop);
    }
    if (blockPatch.layout.mobile) {
      block.layout.mobile = mergeRect(block.layout.mobile ?? block.layout.desktop, blockPatch.layout.mobile);
    }
    if (blockPatch.style) {
      block.style = {
        ...block.style,
        ...normalizeBlockStylePatch(blockPatch.style)
      };
    }
    if (blockPatch.content) {
      applyBlockContentPatch(block, blockPatch.content);
    }
  }

  if (next.header) {
    next.header.links = home.sections.filter((section) => section.enabled).map((section) => ({
      label: sectionLabel(section.type),
      href: `#${section.id}`
    }));
  }

  const parsed = parseSiteSpecV3(next);
  return parsed.success ? parsed.data : seedSpec;
}

export function compileLayoutProposalToDesignPatch(proposal: LayoutProposal): DesignPatch {
  const normalizedSectionOrder = enforceDefaultSectionOrder(proposal.section_order);
  return {
    visualDirection: {
      name: proposal.design_direction.name,
      description: proposal.design_direction.description,
      headerVariant: proposal.header_variant
    },
    themePatch: proposal.theme_direction,
    sectionOrder: normalizedSectionOrder,
    sectionVariants: proposal.section_compositions.reduce<NonNullable<DesignPatch["sectionVariants"]>>((acc, section) => {
      acc[section.type] = section.variant;
      return acc;
    }, {}),
    sectionHeightPatch: proposal.section_compositions.reduce<NonNullable<DesignPatch["sectionHeightPatch"]>>((acc, section) => {
      acc[section.type] = section.height_ratio;
      return acc;
    }, {}),
    blockPatches: proposal.section_compositions.flatMap((section) =>
      section.blocks.map((block) => ({
        sectionType: section.type,
        ...block
      }))
    )
  };
}

export function buildHeuristicLayoutProposal(input: {
  prompt: string;
  briefDraft?: BusinessBriefDraft;
}): LayoutProposal {
  const brief = input.briefDraft;
  const prompt = input.prompt.toLowerCase();
  const seed = hashString(
    [brief?.business_name ?? "", brief?.offer_summary ?? "", brief?.tone ?? "", brief?.target_audience ?? "", prompt].join("|")
  );
  const siteType = brief?.business_type ?? inferSiteType(prompt);
  const stylePreset = brief?.style_preset ?? inferStylePreset(prompt);
  const premium = /premium|lujo|exclusiv|editorial|atelier|streetwear/i.test(prompt);
  const fashion = /moda|ropa|zapato|sneaker|boutique|fashion/i.test(prompt);
  const sport = /deport|fitness|gym|gimnas|running/i.test(prompt);
  const tech = /tech|software|digital|app|saas|tecnolog/i.test(prompt);
  const health = /salud|clinica|wellness|spa|medic/i.test(prompt);
  const sectionOrder =
    siteType === "commerce_lite"
      ? (["hero", "catalog", "testimonials", "contact"] as SiteSectionV3["type"][])
      : (brief?.section_preferences?.length
          ? normalizeSectionOrder(brief.section_preferences)
          : (["hero", "catalog", "testimonials", "contact"] as SiteSectionV3["type"][]));
  const normalizedSectionOrder = enforceDefaultSectionOrder(sectionOrder);

  const themeDirection = themeFromStyle(stylePreset, { premium, tech, health, fashion, sport });
  const hero = pickBuilder(
    siteType === "commerce_lite"
      ? fashion || premium
        ? [heroFullBleedBrand, heroCompactSale, heroEditorial]
        : tech
          ? [heroSplitTech, heroCompactSale, heroCenteredClean]
          : sport
            ? [heroCompactSale, heroSplitService, heroCenteredClean]
            : [heroSplitService, heroCompactSale, heroCenteredClean]
      : tech
        ? [heroSplitTech, heroCenteredClean, heroSplitService]
        : health
          ? [heroStackedSoft, heroCenteredClean, heroSplitService]
          : [heroCenteredClean, heroSplitService, heroImageLead],
    seed + 1
  )(brief, themeDirection);

  const catalog = pickBuilder(
    siteType === "commerce_lite"
      ? fashion || premium
        ? [catalogFeaturedCommerce, catalogFeaturedTopCommerce, catalogMosaicCommerce]
        : tech
          ? [catalogMosaicCommerce, catalogFeaturedTopCommerce, catalogGridCommerce]
          : [catalogGridCommerce, catalogFeaturedTopCommerce, catalogMosaicCommerce]
      : tech
        ? [catalogStripInformative, catalogServiceFocusInformative, catalogCardsInformative]
        : [catalogCardsInformative, catalogServiceFocusInformative, catalogStripInformative],
    seed + 7
  )(themeDirection);

  const testimonials = pickBuilder(
    premium || fashion
      ? [testimonialsBand, testimonialsQuoteColumn, testimonialsWall]
      : health
        ? [testimonialsSpotlight, testimonialsWall, testimonialsQuoteColumn]
        : [testimonialsWall, testimonialsQuoteColumn, testimonialsSpotlight],
    seed + 13
  )(themeDirection);

  const contact = pickBuilder(
    premium || fashion
      ? [contactBand, contactCardCta, contactSplit]
      : tech
        ? [contactSplit, contactCardCta, contactMinimal]
        : [contactMinimal, contactCardCta, contactSplit],
    seed + 19
  )(themeDirection);

  const sections = [hero, catalog, testimonials, contact]
    .filter((section) => normalizedSectionOrder.includes(section.type))
    .sort((a, b) => normalizedSectionOrder.indexOf(a.type) - normalizedSectionOrder.indexOf(b.type));

  return {
    design_direction: {
      name: premium
        ? "Editorial premium"
        : fashion
          ? "Marca visual"
          : sport
            ? "Energía comercial"
        : tech
          ? "Lanzamiento moderno"
          : health
            ? "Confianza serena"
            : "Conversión clara",
      description: premium
        ? "Hero dominante, alto contraste y composición de marca."
        : fashion
          ? "Composición de marca con foco visual en producto y estilo."
          : sport
            ? "Jerarquía activa con lectura rápida y bloques de venta."
        : tech
          ? "Ritmo visual moderno con bloques bien jerarquizados."
          : health
            ? "Estructura limpia con señales de confianza y cercanía."
            : "Propuesta directa con CTA y lectura rápida."
    },
    header_variant: premium || fashion ? "top-bar" : siteType === "commerce_lite" ? "hamburger-overlay" : "none",
    section_order: normalizedSectionOrder,
    section_compositions: sections,
    theme_direction: themeDirection
  };
}

export function buildHeuristicDesignPatch(input: {
  prompt: string;
  templateId?: TemplateId;
  briefDraft?: BusinessBriefDraft;
}): DesignPatch {
  return compileLayoutProposalToDesignPatch(
    buildHeuristicLayoutProposal({
      prompt: input.prompt,
      briefDraft: input.briefDraft
    })
  );
}

function buildNeutralProposalSeed(input: {
  prompt: string;
  briefDraft?: BusinessBriefDraft;
}): SiteSpecV3 {
  const brief = input.briefDraft;
  const siteType = brief?.business_type ?? inferSiteType(input.prompt.toLowerCase());
  const businessName = brief?.business_name?.trim() || input.prompt.slice(0, 80) || "Tu negocio";
  const offerSummary = brief?.offer_summary?.trim() || "Presentación principal del negocio.";
  const targetAudience = brief?.target_audience?.trim() || "Clientes potenciales en redes y WhatsApp";
  const theme = themeFromStyle(brief?.style_preset ?? inferStylePreset(input.prompt), {});
  const sectionOrder = brief?.section_preferences?.length
    ? normalizeSectionOrder(brief.section_preferences)
    : siteType === "commerce_lite"
      ? (["hero", "catalog", "testimonials", "contact"] as SiteSectionV3["type"][])
      : (["hero", "catalog", "testimonials", "contact"] as SiteSectionV3["type"][]);
  const normalizedSectionOrder = enforceDefaultSectionOrder(sectionOrder);

  const sections = normalizedSectionOrder.map((type, index) => buildSeedSection({
    type,
    index,
    siteType,
    businessName,
    offerSummary,
    targetAudience
  }));

  return {
    schema_version: "3.0",
    site_type: siteType,
    locale: "es-LATAM",
    template: {
      id: siteType === "commerce_lite" ? "shop-quick" : "starter-clean",
      family: siteType === "commerce_lite" ? "shop" : "clean"
    },
    theme,
    header: {
      variant: "none",
      brand: businessName,
      links: sections.map((section) => ({
        label: sectionLabel(section.type),
        href: `#${section.id}`
      }))
    },
    pages: [
      {
        id: "home",
        slug: "/",
        title: `${businessName} | Inicio`,
        sections
      }
    ],
    integrations: {
      whatsapp: {
        enabled: Boolean(brief?.whatsapp_phone),
        phone: normalizeWhatsappPhone(brief?.whatsapp_phone),
        cta_label: brief?.primary_cta ?? "WhatsApp",
        message: brief?.whatsapp_message?.trim() || undefined
      }
    }
  };
}

function buildSeedSection(input: {
  type: SiteSectionV3["type"];
  index: number;
  siteType: SiteSpecV3["site_type"];
  businessName: string;
  offerSummary: string;
  targetAudience: string;
}): SiteSectionV3 {
  const id = `${input.type}-${input.index + 1}`;

  if (input.type === "hero") {
    return {
      id,
      type: "hero",
      enabled: true,
      variant: "split",
      height_ratio: { desktop: 0.62, mobile: 1.18 },
      blocks: [
        imageBlock(`${id}-hero-bg`, true, rect(0, 0, 100, 100, 1), rect(0, 0, 100, 100, 1), {}, { fit: "cover", alt: input.businessName }),
        shapeBlock(`${id}-hero-overlay`, false, rect(0, 0, 100, 100, 2), rect(0, 0, 100, 100, 2), {
          bgColor: "#0f172a",
          opacity: 0.38
        }),
        textBlock(`${id}-headline`, input.businessName, rect(8, 14, 48, 16, 3), rect(8, 14, 84, 16, 3), {
          fontSize: 50,
          fontWeight: 700
        }),
        textBlock(
          `${id}-subheadline`,
          `${input.offerSummary} Para ${input.targetAudience.toLowerCase()}.`,
          rect(8, 34, 50, 12, 3),
          rect(8, 32, 84, 12, 3),
          {
            fontSize: 18,
            color: "#475569"
          }
        ),
        imageBlock(`${id}-hero-image`, true, rect(58, 12, 32, 58, 1), rect(8, 58, 84, 24, 1), { radius: 18 }, { fit: "cover", alt: input.businessName })
      ]
    };
  }

  if (input.type === "catalog") {
    if (input.siteType === "commerce_lite") {
      return {
        id,
        type: "catalog",
        enabled: true,
        variant: "grid",
        height_ratio: { desktop: 0.7, mobile: 1.75 },
        blocks: [
          textBlock(`${id}-title`, "Catálogo destacado", rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), {
            fontSize: 34,
            fontWeight: 700
          }),
          productBlock(`${id}-product-1`, "Producto estrella", rect(8, 22, 26, 62, 1), rect(8, 18, 84, 22, 1)),
          productBlock(`${id}-product-2`, "Producto 2", rect(38, 22, 26, 62, 1), rect(8, 44, 84, 22, 1)),
          productBlock(`${id}-product-3`, "Producto 3", rect(68, 22, 26, 62, 1), rect(8, 70, 84, 22, 1))
        ]
      };
    }

    return {
      id,
      type: "catalog",
      enabled: true,
      variant: "cards",
      height_ratio: { desktop: 0.6, mobile: 1.4 },
      blocks: [
        textBlock(`${id}-title`, "Servicios principales", rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), {
          fontSize: 34,
          fontWeight: 700
        }),
        containerBlock(`${id}-card-1`, rect(8, 22, 26, 56, 1), rect(8, 18, 84, 24, 1)),
        imageBlock(`${id}-image-1`, true, rect(10, 24, 22, 20, 2), rect(12, 20, 76, 10, 2), { radius: 14 }, { fit: "cover" }),
        textBlock(`${id}-name-1`, "Servicio 1", rect(10, 48, 18, 6, 3), rect(12, 32, 70, 5, 3), { fontSize: 20, fontWeight: 700 }),
        textBlock(`${id}-desc-1`, input.offerSummary, rect(10, 56, 20, 12, 3), rect(12, 40, 70, 8, 3), { fontSize: 14, color: "#475569" }),
        containerBlock(`${id}-card-2`, rect(38, 22, 26, 56, 1), rect(8, 46, 84, 24, 1)),
        imageBlock(`${id}-image-2`, true, rect(40, 24, 22, 20, 2), rect(12, 48, 76, 10, 2), { radius: 14 }, { fit: "cover" }),
        textBlock(`${id}-name-2`, "Servicio 2", rect(40, 48, 18, 6, 3), rect(12, 60, 70, 5, 3), { fontSize: 20, fontWeight: 700 }),
        textBlock(`${id}-desc-2`, "Descripción breve del beneficio principal.", rect(40, 56, 20, 12, 3), rect(12, 68, 70, 8, 3), {
          fontSize: 14,
          color: "#475569"
        }),
        containerBlock(`${id}-card-3`, rect(68, 22, 26, 56, 1), rect(8, 74, 84, 24, 1)),
        imageBlock(`${id}-image-3`, true, rect(70, 24, 22, 20, 2), rect(12, 76, 76, 10, 2), { radius: 14 }, { fit: "cover" }),
        textBlock(`${id}-name-3`, "Servicio 3", rect(70, 48, 18, 6, 3), rect(12, 88, 70, 5, 3), { fontSize: 20, fontWeight: 700 }),
        textBlock(`${id}-desc-3`, "Descripción breve del servicio o solución.", rect(70, 56, 20, 12, 3), rect(12, 94, 70, 4, 3), {
          fontSize: 14,
          color: "#475569"
        })
      ]
    };
  }

  if (input.type === "testimonials") {
    return {
      id,
      type: "testimonials",
      enabled: true,
      variant: "cards",
      height_ratio: { desktop: 0.3, mobile: 0.88 },
      blocks: [
        textBlock(`${id}-title`, "Clientes que confían en nosotros", rect(8, 10, 58, 10, 2), rect(8, 6, 84, 10, 2), {
          fontSize: 32,
          fontWeight: 700
        }),
        textBlock(`${id}-quote-1`, "La experiencia fue rápida y muy clara desde el primer contacto.", rect(8, 30, 26, 18, 2), rect(8, 20, 84, 16, 2), cardQuoteStyle()),
        textBlock(`${id}-quote-2`, "Excelente atención por WhatsApp y respuesta en pocos minutos.", rect(38, 30, 26, 18, 2), rect(8, 40, 84, 16, 2), cardQuoteStyle()),
        textBlock(`${id}-quote-3`, "Se siente profesional y fácil de usar para nuestros clientes.", rect(68, 30, 26, 18, 2), rect(8, 60, 84, 16, 2), cardQuoteStyle())
      ]
    };
  }

  return {
    id,
    type: "contact",
    enabled: true,
    variant: "simple",
    height_ratio: { desktop: 0.24, mobile: 0.72 },
    blocks: [
      textBlock(`${id}-title`, "Contáctanos", rect(8, 18, 34, 10, 2), rect(8, 12, 84, 10, 2), {
        fontSize: 32,
        fontWeight: 700
      }),
      textBlock(`${id}-description`, "Escríbenos y recibe una respuesta clara y rápida.", rect(8, 34, 42, 10, 2), rect(8, 28, 84, 10, 2), {
        fontSize: 17,
        color: "#475569"
      }),
      buttonBlock(`${id}-contact-cta`, "WhatsApp", rect(8, 52, 18, 12, 3), rect(8, 48, 42, 12, 3))
    ]
  };
}

function heroEditorial(brief: BusinessBriefDraft | undefined, theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "hero",
    variant: "split",
    height_ratio: { desktop: 0.82, mobile: 1.32 },
    blocks: [
      compose("hero-bg", true, rect(0, 0, 100, 100, 1), rect(0, 0, 100, 100, 1), undefined, { fit: "cover" }),
      compose("hero-overlay", true, rect(0, 0, 100, 100, 2), rect(0, 0, 100, 100, 2), { bgColor: "#09090b", opacity: 0.52 }),
      compose("headline", true, rect(6, 14, 54, 22, 3), rect(8, 14, 84, 18, 3), {
        fontSize: 64,
        fontWeight: 700,
        color: "#f8fafc"
      }, { text: brief?.business_name }),
      compose("subheadline", true, rect(6, 40, 38, 12, 3), rect(8, 36, 84, 12, 3), { fontSize: 19, color: "#d4d4d8" }, { text: buildHeroSubtitle(brief) }),
      compose("hero-image", true, rect(58, 10, 34, 72, 2), rect(8, 58, 84, 28, 2), { radius: 0 }, { fit: "cover" })
    ]
  };
}

function heroSplitTech(brief: BusinessBriefDraft | undefined, theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "hero",
    variant: "split",
    height_ratio: { desktop: 0.68, mobile: 1.18 },
    blocks: [
      compose("hero-bg", false, rect(0, 0, 100, 100, 1), rect(0, 0, 100, 100, 1)),
      compose("hero-overlay", false, rect(0, 0, 100, 100, 2), rect(0, 0, 100, 100, 2)),
      compose("headline", true, rect(8, 16, 46, 16, 3), rect(8, 14, 84, 16, 3), {
        fontSize: 54,
        fontWeight: 700,
        color: theme.primary ?? "#082f49"
      }, { text: brief?.business_name }),
      compose("subheadline", true, rect(8, 36, 42, 12, 3), rect(8, 32, 84, 12, 3), { fontSize: 18, color: "#334155" }, { text: buildHeroSubtitle(brief) }),
      compose("hero-image", true, rect(58, 16, 30, 52, 2), rect(12, 58, 76, 22, 2), { radius: 22 }, { fit: "cover" })
    ]
  };
}

function heroStackedSoft(brief: BusinessBriefDraft | undefined, theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "hero",
    variant: "centered",
    height_ratio: { desktop: 0.64, mobile: 1.2 },
    blocks: [
      compose("hero-bg", false, rect(0, 0, 100, 100, 1), rect(0, 0, 100, 100, 1)),
      compose("hero-overlay", false, rect(0, 0, 100, 100, 2), rect(0, 0, 100, 100, 2)),
      compose("headline", true, rect(18, 12, 64, 16, 3), rect(8, 12, 84, 16, 3), {
        fontSize: 52,
        fontWeight: 700,
        textAlign: "center",
        color: theme.primary ?? "#0f172a"
      }, { text: brief?.business_name }),
      compose("subheadline", true, rect(20, 32, 60, 12, 3), rect(8, 30, 84, 12, 3), {
        fontSize: 18,
        textAlign: "center",
        color: "#475569"
      }, { text: buildHeroSubtitle(brief) }),
      compose("hero-image", true, rect(22, 54, 56, 28, 2), rect(10, 54, 80, 24, 2), { radius: 22 }, { fit: "cover" })
    ]
  };
}

function heroSplitService(brief: BusinessBriefDraft | undefined, theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "hero",
    variant: "image-left",
    height_ratio: { desktop: 0.6, mobile: 1.16 },
    blocks: [
      compose("hero-bg", false, rect(0, 0, 100, 100, 1), rect(0, 0, 100, 100, 1)),
      compose("hero-overlay", false, rect(0, 0, 100, 100, 2), rect(0, 0, 100, 100, 2)),
      compose("hero-image", true, rect(8, 16, 32, 52, 1), rect(14, 56, 72, 24, 1), { radius: 18 }, { fit: "cover" }),
      compose("headline", true, rect(48, 16, 42, 14, 3), rect(8, 14, 84, 16, 3), {
        fontSize: 48,
        fontWeight: 700
      }, { text: brief?.business_name }),
      compose("subheadline", true, rect(48, 34, 38, 12, 3), rect(8, 32, 84, 12, 3), { fontSize: 18, color: "#475569" }, { text: buildHeroSubtitle(brief) })
    ]
  };
}

function heroFullBleedBrand(brief: BusinessBriefDraft | undefined, theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "hero",
    variant: "split",
    height_ratio: { desktop: 0.88, mobile: 1.36 },
    blocks: [
      compose("hero-bg", true, rect(0, 0, 100, 100, 1), rect(0, 0, 100, 100, 1), undefined, { fit: "cover" }),
      compose("hero-overlay", true, rect(0, 0, 100, 100, 2), rect(0, 0, 100, 100, 2), { bgColor: theme.primary ?? "#0f172a", opacity: 0.28 }),
      compose("headline", true, rect(7, 18, 46, 18, 3), rect(8, 14, 84, 16, 3), { fontSize: 60, fontWeight: 700, color: "#ffffff" }, {
        text: brief?.business_name
      }),
      compose("subheadline", true, rect(7, 40, 34, 12, 3), rect(8, 32, 84, 12, 3), { fontSize: 18, color: "#e2e8f0" }, {
        text: buildHeroSubtitle(brief)
      }),
      compose("hero-image", true, rect(56, 12, 36, 70, 2), rect(8, 56, 84, 28, 2), { radius: 20 }, { fit: "cover" })
    ]
  };
}

function heroCompactSale(brief: BusinessBriefDraft | undefined, theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "hero",
    variant: "centered",
    height_ratio: { desktop: 0.56, mobile: 1.02 },
    blocks: [
      compose("headline", true, rect(10, 16, 42, 14, 3), rect(8, 12, 84, 16, 3), { fontSize: 50, fontWeight: 700, color: theme.primary ?? "#0f172a" }, {
        text: brief?.business_name
      }),
      compose("subheadline", true, rect(10, 34, 38, 10, 3), rect(8, 30, 84, 12, 3), { fontSize: 17, color: "#475569" }, {
        text: buildHeroSubtitle(brief)
      }),
      compose("hero-image", true, rect(58, 16, 28, 46, 2), rect(18, 58, 64, 20, 2), { radius: 18 }, { fit: "cover" })
    ]
  };
}

function heroCenteredClean(brief: BusinessBriefDraft | undefined, theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "hero",
    variant: "centered",
    height_ratio: { desktop: 0.58, mobile: 1.08 },
    blocks: [
      compose("headline", true, rect(14, 16, 72, 14, 3), rect(8, 14, 84, 16, 3), {
        fontSize: 50,
        fontWeight: 700,
        textAlign: "center",
        color: theme.primary ?? "#0f172a"
      }, { text: brief?.business_name }),
      compose("subheadline", true, rect(18, 34, 64, 10, 3), rect(8, 32, 84, 12, 3), {
        fontSize: 17,
        textAlign: "center",
        color: "#475569"
      }, { text: buildHeroSubtitle(brief) }),
      compose("hero-image", true, rect(30, 52, 40, 24, 2), rect(14, 56, 72, 20, 2), { radius: 22 }, { fit: "cover" })
    ]
  };
}

function heroImageLead(brief: BusinessBriefDraft | undefined, theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "hero",
    variant: "image-left",
    height_ratio: { desktop: 0.64, mobile: 1.14 },
    blocks: [
      compose("hero-image", true, rect(8, 14, 38, 58, 1), rect(12, 54, 76, 24, 1), { radius: 20 }, { fit: "cover" }),
      compose("headline", true, rect(52, 18, 36, 14, 3), rect(8, 14, 84, 16, 3), { fontSize: 46, fontWeight: 700, color: theme.primary ?? "#0f172a" }, {
        text: brief?.business_name
      }),
      compose("subheadline", true, rect(52, 36, 32, 12, 3), rect(8, 32, 84, 12, 3), { fontSize: 17, color: "#475569" }, {
        text: buildHeroSubtitle(brief)
      })
    ]
  };
}

function catalogGridCommerce(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "catalog",
    variant: "grid",
    height_ratio: { desktop: 0.68, mobile: 1.75 },
    blocks: [
      compose("title", true, rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 38, fontWeight: 700, color: theme.primary ?? "#0f172a" }),
      compose("product-1", true, rect(8, 22, 26, 62, 1), rect(8, 18, 84, 22, 1)),
      compose("product-2", true, rect(38, 22, 26, 62, 1), rect(8, 44, 84, 22, 1)),
      compose("product-3", true, rect(68, 22, 26, 62, 1), rect(8, 70, 84, 22, 1))
    ]
  };
}

function catalogMosaicCommerce(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "catalog",
    variant: "grid",
    height_ratio: { desktop: 0.72, mobile: 1.86 },
    blocks: [
      compose("title", true, rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 38, fontWeight: 700, color: theme.primary ?? "#0f172a" }),
      compose("product-1", true, rect(8, 22, 38, 62, 1), rect(8, 18, 84, 22, 1)),
      compose("product-2", true, rect(50, 22, 42, 28, 1), rect(8, 44, 84, 22, 1)),
      compose("product-3", true, rect(50, 54, 42, 30, 1), rect(8, 70, 84, 22, 1))
    ]
  };
}

function catalogFeaturedCommerce(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "catalog",
    variant: "list",
    height_ratio: { desktop: 0.76, mobile: 1.82 },
    blocks: [
      compose("title", true, rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 40, fontWeight: 700, color: theme.primary ?? "#0f172a" }),
      compose("product-1", true, rect(8, 22, 56, 62, 1), rect(8, 18, 84, 22, 1)),
      compose("product-2", true, rect(68, 22, 24, 28, 1), rect(8, 44, 84, 22, 1)),
      compose("product-3", true, rect(68, 54, 24, 30, 1), rect(8, 70, 84, 22, 1))
    ]
  };
}

function catalogFeaturedTopCommerce(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "catalog",
    variant: "list",
    height_ratio: { desktop: 0.74, mobile: 1.8 },
    blocks: [
      compose("title", true, rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 40, fontWeight: 700, color: theme.primary ?? "#0f172a" }),
      compose("product-1", true, rect(8, 22, 84, 30, 1), rect(8, 18, 84, 22, 1)),
      compose("product-2", true, rect(8, 58, 40, 24, 1), rect(8, 46, 84, 22, 1)),
      compose("product-3", true, rect(52, 58, 40, 24, 1), rect(8, 72, 84, 22, 1))
    ]
  };
}

function catalogCardsInformative(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "catalog",
    variant: "cards",
    height_ratio: { desktop: 0.6, mobile: 1.38 },
    blocks: [
      compose("title", true, rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 36, fontWeight: 700, color: theme.primary ?? "#0f172a" }),
      compose("card-1", true, rect(8, 22, 26, 56, 1), rect(8, 18, 84, 24, 1)),
      compose("image-1", true, rect(10, 24, 22, 20, 2), rect(12, 20, 76, 10, 2), { radius: 14 }, { fit: "cover" }),
      compose("name-1", true, rect(10, 48, 18, 6, 3), rect(12, 32, 70, 5, 3), { fontSize: 20, fontWeight: 700 }),
      compose("desc-1", true, rect(10, 56, 20, 12, 3), rect(12, 40, 70, 8, 3), { fontSize: 14, color: "#475569" }),
      compose("card-2", true, rect(38, 22, 26, 56, 1), rect(8, 46, 84, 24, 1)),
      compose("image-2", true, rect(40, 24, 22, 20, 2), rect(12, 48, 76, 10, 2), { radius: 14 }, { fit: "cover" }),
      compose("name-2", true, rect(40, 48, 18, 6, 3), rect(12, 60, 70, 5, 3), { fontSize: 20, fontWeight: 700 }),
      compose("desc-2", true, rect(40, 56, 20, 12, 3), rect(12, 68, 70, 8, 3), { fontSize: 14, color: "#475569" }),
      compose("card-3", true, rect(68, 22, 26, 56, 1), rect(8, 74, 84, 24, 1)),
      compose("image-3", true, rect(70, 24, 22, 20, 2), rect(12, 76, 76, 10, 2), { radius: 14 }, { fit: "cover" }),
      compose("name-3", true, rect(70, 48, 18, 6, 3), rect(12, 88, 70, 5, 3), { fontSize: 20, fontWeight: 700 }),
      compose("desc-3", true, rect(70, 56, 20, 12, 3), rect(12, 94, 70, 4, 3), { fontSize: 14, color: "#475569" })
    ]
  };
}

function catalogStripInformative(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "catalog",
    variant: "list",
    height_ratio: { desktop: 0.5, mobile: 1.26 },
    blocks: [
      compose("title", true, rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 36, fontWeight: 700, color: theme.primary ?? "#0f172a" }),
      compose("card-1", true, rect(8, 24, 84, 14, 1), rect(8, 18, 84, 18, 1)),
      compose("name-1", true, rect(12, 28, 30, 4, 2), rect(12, 22, 70, 5, 2), { fontSize: 18, fontWeight: 700 }),
      compose("desc-1", true, rect(12, 33, 54, 4, 2), rect(12, 28, 70, 5, 2), { fontSize: 14, color: "#475569" }),
      compose("card-2", true, rect(8, 44, 84, 14, 1), rect(8, 42, 84, 18, 1)),
      compose("name-2", true, rect(12, 48, 30, 4, 2), rect(12, 46, 70, 5, 2), { fontSize: 18, fontWeight: 700 }),
      compose("desc-2", true, rect(12, 53, 54, 4, 2), rect(12, 52, 70, 5, 2), { fontSize: 14, color: "#475569" }),
      compose("card-3", true, rect(8, 64, 84, 14, 1), rect(8, 66, 84, 18, 1)),
      compose("name-3", true, rect(12, 68, 30, 4, 2), rect(12, 70, 70, 5, 2), { fontSize: 18, fontWeight: 700 }),
      compose("desc-3", true, rect(12, 73, 54, 4, 2), rect(12, 76, 70, 5, 2), { fontSize: 14, color: "#475569" })
    ]
  };
}

function catalogServiceFocusInformative(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "catalog",
    variant: "cards",
    height_ratio: { desktop: 0.56, mobile: 1.3 },
    blocks: [
      compose("title", true, rect(8, 8, 54, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 36, fontWeight: 700, color: theme.primary ?? "#0f172a" }),
      compose("card-1", true, rect(8, 24, 40, 52, 1), rect(8, 18, 84, 22, 1)),
      compose("name-1", true, rect(12, 30, 28, 6, 2), rect(12, 22, 70, 5, 2), { fontSize: 22, fontWeight: 700 }),
      compose("desc-1", true, rect(12, 40, 24, 12, 2), rect(12, 30, 70, 8, 2), { fontSize: 14, color: "#475569" }),
      compose("card-2", true, rect(54, 24, 38, 22, 1), rect(8, 46, 84, 18, 1)),
      compose("name-2", true, rect(58, 30, 24, 5, 2), rect(12, 50, 70, 5, 2), { fontSize: 18, fontWeight: 700 }),
      compose("desc-2", true, rect(58, 38, 24, 6, 2), rect(12, 56, 70, 6, 2), { fontSize: 14, color: "#475569" }),
      compose("card-3", true, rect(54, 54, 38, 22, 1), rect(8, 68, 84, 18, 1)),
      compose("name-3", true, rect(58, 60, 24, 5, 2), rect(12, 72, 70, 5, 2), { fontSize: 18, fontWeight: 700 }),
      compose("desc-3", true, rect(58, 68, 24, 6, 2), rect(12, 78, 70, 6, 2), { fontSize: 14, color: "#475569" })
    ]
  };
}

function testimonialsWall(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "testimonials",
    variant: "cards",
    height_ratio: { desktop: 0.3, mobile: 0.88 },
    blocks: [
      compose("title", true, rect(8, 10, 58, 10, 2), rect(8, 6, 84, 10, 2), { fontSize: 32, fontWeight: 700 }),
      compose("quote-1", true, rect(8, 30, 26, 18, 2), rect(8, 20, 84, 16, 2), cardQuoteStyle()),
      compose("quote-2", true, rect(38, 30, 26, 18, 2), rect(8, 40, 84, 16, 2), cardQuoteStyle()),
      compose("quote-3", true, rect(68, 30, 26, 18, 2), rect(8, 60, 84, 16, 2), cardQuoteStyle())
    ]
  };
}

function testimonialsSpotlight(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "testimonials",
    variant: "spotlight",
    height_ratio: { desktop: 0.34, mobile: 0.98 },
    blocks: [
      compose("title", true, rect(8, 10, 58, 10, 2), rect(8, 6, 84, 10, 2), { fontSize: 32, fontWeight: 700 }),
      compose("quote-1", true, rect(8, 28, 44, 28, 2), rect(8, 20, 84, 20, 2), cardQuoteStyle(17)),
      compose("quote-2", true, rect(56, 28, 36, 12, 2), rect(8, 46, 84, 14, 2), cardQuoteStyle(15)),
      compose("quote-3", true, rect(56, 44, 36, 12, 2), rect(8, 64, 84, 14, 2), cardQuoteStyle(15))
    ]
  };
}

function testimonialsBand(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "testimonials",
    variant: "minimal",
    height_ratio: { desktop: 0.24, mobile: 0.72 },
    blocks: [
      compose("title", true, rect(8, 12, 38, 10, 2), rect(8, 8, 84, 10, 2), { fontSize: 30, fontWeight: 700, color: theme.primary ?? "#f8fafc" }),
      compose("quote-1", true, rect(8, 38, 84, 10, 2), rect(8, 34, 84, 14, 2), { fontSize: 19, color: "#52525b" })
    ]
  };
}

function testimonialsQuoteColumn(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "testimonials",
    variant: "minimal",
    height_ratio: { desktop: 0.32, mobile: 0.9 },
    blocks: [
      compose("title", true, rect(8, 10, 44, 10, 2), rect(8, 6, 84, 10, 2), { fontSize: 30, fontWeight: 700 }),
      compose("quote-1", true, rect(8, 30, 40, 26, 2), rect(8, 20, 84, 18, 2), cardQuoteStyle(17)),
      compose("quote-2", true, rect(54, 24, 36, 14, 2), rect(8, 44, 84, 14, 2), cardQuoteStyle(15)),
      compose("quote-3", true, rect(54, 42, 36, 14, 2), rect(8, 62, 84, 14, 2), cardQuoteStyle(15))
    ]
  };
}

function contactMinimal(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "contact",
    variant: "simple",
    height_ratio: { desktop: 0.24, mobile: 0.72 },
    blocks: [
      compose("title", true, rect(8, 18, 34, 10, 2), rect(8, 12, 84, 10, 2), { fontSize: 32, fontWeight: 700 }),
      compose("description", true, rect(8, 34, 42, 10, 2), rect(8, 28, 84, 10, 2), { fontSize: 17, color: "#475569" }),
      compose("contact-cta", true, rect(8, 52, 18, 12, 3), rect(8, 48, 42, 12, 3), undefined, { label: "WhatsApp" })
    ]
  };
}

function contactSplit(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "contact",
    variant: "highlight",
    height_ratio: { desktop: 0.28, mobile: 0.82 },
    blocks: [
      compose("title", true, rect(8, 18, 28, 10, 2), rect(8, 12, 84, 10, 2), { fontSize: 34, fontWeight: 700 }),
      compose("description", true, rect(42, 18, 30, 12, 2), rect(8, 28, 84, 10, 2), { fontSize: 17, color: "#475569" }),
      compose("contact-cta", true, rect(8, 52, 22, 12, 3), rect(8, 50, 50, 12, 3), undefined, { label: "Hablar ahora" })
    ]
  };
}

function contactBand(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "contact",
    variant: "compact",
    height_ratio: { desktop: 0.2, mobile: 0.62 },
    blocks: [
      compose("title", true, rect(8, 24, 22, 10, 2), rect(8, 14, 84, 10, 2), { fontSize: 30, fontWeight: 700, color: theme.primary ?? "#f8fafc" }),
      compose("description", true, rect(34, 24, 34, 10, 2), rect(8, 30, 84, 10, 2), { fontSize: 17, color: "#a1a1aa" }),
      compose("contact-cta", true, rect(72, 22, 18, 14, 3), rect(8, 46, 52, 12, 3), undefined, { label: "Escribir" })
    ]
  };
}

function contactCardCta(theme: Partial<SiteSpecV3["theme"]>): SectionComposition {
  return {
    type: "contact",
    variant: "highlight",
    height_ratio: { desktop: 0.26, mobile: 0.78 },
    blocks: [
      compose("title", true, rect(10, 20, 26, 10, 2), rect(8, 12, 84, 10, 2), { fontSize: 32, fontWeight: 700, color: theme.primary ?? "#0f172a" }),
      compose("description", true, rect(10, 36, 34, 10, 2), rect(8, 28, 84, 10, 2), { fontSize: 16, color: "#475569" }),
      compose("contact-cta", true, rect(10, 54, 22, 12, 3), rect(8, 48, 50, 12, 3), undefined, { label: "Contactar" })
    ]
  };
}

function themeFromStyle(
  stylePreset: BusinessBriefDraft["style_preset"],
  flags: { premium?: boolean; tech?: boolean; health?: boolean; fashion?: boolean; sport?: boolean }
): SiteSpecV3["theme"] {
  if (stylePreset === "mono") {
    return {
      primary: "#f8fafc",
      secondary: "#f97316",
      background: "#09090b",
      font_heading: "Space Grotesk",
      font_body: "Manrope",
      radius: "sm"
    };
  }
  if (stylePreset === "sunset" || flags.health || flags.fashion) {
    return {
      primary: "#0f172a",
      secondary: "#ea580c",
      background: "#fff7ed",
      font_heading: "Montserrat",
      font_body: "Open Sans",
      radius: "md"
    };
  }
  return {
    primary: "#082f49",
    secondary: "#0ea5e9",
    background: "#f4fbff",
    font_heading: "Space Grotesk",
    font_body: "Manrope",
    radius: "md"
  };
}

function normalizeThemePatch(patch: NonNullable<DesignPatch["themePatch"]>) {
  const next: Partial<SiteSpecV3["theme"]> = {
    primary: patch.primary,
    secondary: patch.secondary,
    background: patch.background,
    radius: patch.radius
  };
  if (patch.font_heading && fontFamilies.includes(patch.font_heading as (typeof fontFamilies)[number])) {
    next.font_heading = patch.font_heading as SiteSpecV3["theme"]["font_heading"];
  }
  if (patch.font_body && fontFamilies.includes(patch.font_body as (typeof fontFamilies)[number])) {
    next.font_body = patch.font_body as SiteSpecV3["theme"]["font_body"];
  }
  return next;
}

function normalizeBlockStylePatch(
  patch: NonNullable<NonNullable<DesignPatch["blockPatches"]>[number]["style"]>
) {
  const next: Partial<CanvasBlock["style"]> = {
    fontSize: patch.fontSize,
    fontWeight: patch.fontWeight,
    color: patch.color,
    bgColor: patch.bgColor,
    radius: patch.radius,
    borderColor: patch.borderColor,
    borderWidth: patch.borderWidth,
    opacity: patch.opacity,
    textAlign: patch.textAlign
  };
  if (patch.fontFamily && fontFamilies.includes(patch.fontFamily as (typeof fontFamilies)[number])) {
    next.fontFamily = patch.fontFamily as CanvasBlock["style"]["fontFamily"];
  }
  return next;
}

function applyBlockContentPatch(block: CanvasBlock, patch: BlockComposition["content"]) {
  if (!patch) return;
  if (block.type === "text" && patch.text !== undefined) {
    block.content.text = patch.text.slice(0, 1200);
    return;
  }
  if (block.type === "button" && patch.label !== undefined) {
    block.content.label = patch.label.slice(0, 120);
    return;
  }
  if (block.type === "image") {
    if (patch.url !== undefined) block.content.url = patch.url;
    if (patch.alt !== undefined) block.content.alt = patch.alt;
    if (patch.fit !== undefined) block.content.fit = patch.fit;
    return;
  }
  if (block.type === "product") {
    if (patch.name !== undefined) block.content.name = patch.name.slice(0, 120);
    if (patch.description !== undefined) block.content.description = patch.description.slice(0, 220);
    if (patch.price !== undefined) block.content.price = patch.price;
  }
}

function mergeRect(base: CanvasLayoutRect, patch: Partial<CanvasLayoutRect>): CanvasLayoutRect {
  return {
    x: patch.x ?? base.x,
    y: patch.y ?? base.y,
    w: patch.w ?? base.w,
    h: patch.h ?? base.h,
    z: patch.z ?? base.z
  };
}

function compose(
  matchId: string,
  visible: boolean,
  desktop: CanvasLayoutRect,
  mobile: CanvasLayoutRect,
  style?: BlockComposition["style"],
  content?: BlockComposition["content"]
): BlockComposition {
  return {
    matchId,
    visible,
    layout: { desktop, mobile },
    style,
    content
  };
}

function rect(x: number, y: number, w: number, h: number, z: number): CanvasLayoutRect {
  return { x, y, w, h, z };
}

function textBlock(
  id: string,
  text: string,
  desktop: CanvasLayoutRect,
  mobile: CanvasLayoutRect,
  style?: Partial<CanvasBlock["style"]>
): Extract<CanvasBlock, { type: "text" }> {
  return { id, type: "text", visible: true, layout: { desktop, mobile }, style: style ?? {}, content: { text } };
}

function imageBlock(
  id: string,
  visible: boolean,
  desktop: CanvasLayoutRect,
  mobile: CanvasLayoutRect,
  style?: Partial<CanvasBlock["style"]>,
  content?: Partial<Extract<CanvasBlock, { type: "image" }>["content"]>
): Extract<CanvasBlock, { type: "image" }> {
  return {
    id,
    type: "image",
    visible,
    layout: { desktop, mobile },
    style: style ?? {},
    content: {
      url: content?.url,
      alt: content?.alt,
      fit: content?.fit ?? "cover"
    }
  };
}

function shapeBlock(
  id: string,
  visible: boolean,
  desktop: CanvasLayoutRect,
  mobile: CanvasLayoutRect,
  style?: Partial<CanvasBlock["style"]>
): Extract<CanvasBlock, { type: "shape" }> {
  return {
    id,
    type: "shape",
    visible,
    layout: { desktop, mobile },
    style: style ?? {},
    content: { shape: "rect" }
  };
}

function productBlock(
  id: string,
  name: string,
  desktop: CanvasLayoutRect,
  mobile: CanvasLayoutRect
): Extract<CanvasBlock, { type: "product" }> {
  return {
    id,
    type: "product",
    visible: true,
    layout: { desktop, mobile },
    style: { bgColor: "#ffffff", borderColor: "#dbe3ee", borderWidth: 1, radius: 16 },
    content: {
      name,
      price: 120000,
      currency: "COP",
      description: "Descripción breve del producto."
    }
  };
}

function containerBlock(id: string, desktop: CanvasLayoutRect, mobile: CanvasLayoutRect): Extract<CanvasBlock, { type: "container" }> {
  return {
    id,
    type: "container",
    visible: true,
    layout: { desktop, mobile },
    style: { bgColor: "#ffffff", borderColor: "#dbe3ee", borderWidth: 1, radius: 16 },
    content: {}
  };
}

function buttonBlock(id: string, label: string, desktop: CanvasLayoutRect, mobile: CanvasLayoutRect): Extract<CanvasBlock, { type: "button" }> {
  return {
    id,
    type: "button",
    visible: true,
    layout: { desktop, mobile },
    style: { bgColor: "#0c4a6e", color: "#ffffff", radius: 14, fontWeight: 700, textAlign: "center" },
    content: { label, action: "whatsapp" }
  };
}

function inferSiteType(prompt: string): SiteSpecV3["site_type"] {
  return /tienda|catalog|catálogo|producto|vender|venta|stock/i.test(prompt) ? "commerce_lite" : "informative";
}

function inferStylePreset(prompt: string): BusinessBriefDraft["style_preset"] {
  if (/premium|elegante|lujo/i.test(prompt)) return "sunset";
  if (/tech|digital|moderno|software|app|deport|fitness/i.test(prompt)) return "ocean";
  if (/salud|clinica|wellness|spa|medic|moda|ropa|zapato|sneaker/i.test(prompt)) return "sunset";
  return "ocean";
}

function buildHeroSubtitle(brief?: BusinessBriefDraft) {
  if (!brief) return "Propuesta clara, visual y lista para convertir.";
  return `${brief.offer_summary} Para ${brief.target_audience.toLowerCase()}.`.slice(0, 220);
}

function normalizeSectionOrder(preferences: BusinessBriefDraft["section_preferences"]) {
  const ordered = preferences.filter((value, index, list) => list.indexOf(value) === index);
  if (!ordered.includes("hero")) ordered.unshift("hero");
  return enforceDefaultSectionOrder(ordered);
}

function enforceDefaultSectionOrder(order: SiteSectionV3["type"][]) {
  const unique = order.filter((value, index, list) => list.indexOf(value) === index);
  const leading = unique.filter((section) => !STRUCTURAL_TRAILING_SECTIONS.includes(section));
  const trailing = STRUCTURAL_TRAILING_SECTIONS.filter((section) => unique.includes(section));
  return [...leading, ...trailing];
}

function normalizeWhatsappPhone(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  if (!/^\+\d{8,15}$/.test(normalized)) return undefined;
  return normalized.replace(/\D/g, "");
}

function cardQuoteStyle(fontSize = 16): Partial<CanvasBlock["style"]> {
  return {
    fontSize,
    bgColor: "#ffffff",
    radius: 14,
    borderColor: "#dbe3ee",
    borderWidth: 1,
    color: "#334155"
  };
}

function pickBuilder<TArgs extends unknown[], TResult>(builders: Array<(...args: TArgs) => TResult>, seed: number) {
  return builders[Math.abs(seed) % builders.length];
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function sectionLabel(sectionType: SiteSectionV3["type"]) {
  return {
    hero: "Inicio",
    catalog: "Catálogo",
    testimonials: "Testimonios",
    contact: "Contacto"
  }[sectionType];
}

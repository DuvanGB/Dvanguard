import { z } from "zod";

import type { BusinessBriefDraft } from "@/lib/onboarding/types";
import { getTemplateById } from "@/lib/templates/catalog";
import { pickTemplateOrFallback } from "@/lib/templates/selector";
import { normalizeWhatsappPhone as normalizeWhatsappPhoneValue } from "@/lib/whatsapp";
import {
  templateIds,
  type HeaderVariant,
  type TemplateBlockBlueprint,
  type TemplateDefinition,
  type TemplateId,
  type TemplateLayoutBlueprint
} from "@/lib/templates/types";

const colorToken = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Color must be a HEX value");

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().url().optional()
);

export const CANVAS_BASE_WIDTH = {
  desktop: 1120,
  mobile: 390
} as const;

const canvasRectSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(1).max(100),
  h: z.number().min(1).max(100),
  z: z.number().int().min(0).max(999)
});

const blockLayoutSchema = z.object({
  desktop: canvasRectSchema,
  mobile: canvasRectSchema.optional()
});

const sectionHeightRatioSchema = z.object({
  desktop: z.number().min(0.2).max(3),
  mobile: z.number().min(0.2).max(3)
});

export const fontFamilies = [
  "Playfair Display",
  "Lato",
  "Space Grotesk",
  "Inter",
  "Cormorant Garamond",
  "Mulish",
  "Outfit",
  "DM Sans",
  "Syne",
  "Manrope",
  "Bebas Neue",
  "DM Serif Display",
  "Poppins",
  "Montserrat",
  "Nunito",
  "Source Sans Pro",
  "Oswald",
  "Open Sans"
] as const;

const legacyThemeSchema = z.object({
  primary: colorToken,
  secondary: colorToken,
  background: colorToken,
  font_heading: z.string().min(1),
  font_body: z.string().min(1),
  radius: z.enum(["sm", "md", "lg"])
});

const visualThemeSchema = z.object({
  palette: z.object({
    background: colorToken,
    surface: colorToken,
    border: colorToken,
    primary: colorToken,
    accent: colorToken,
    text_primary: colorToken,
    text_muted: colorToken
  }),
  typography: z.object({
    heading_font: z.enum(fontFamilies),
    body_font: z.enum(fontFamilies),
    scale: z.enum(["compact", "balanced", "editorial"]),
    heading_weight: z.number().int().min(300).max(900),
    letter_spacing: z.enum(["tight", "normal", "wide"])
  }),
  style_tokens: z.object({
    spacing_scale: z.enum(["tight", "comfortable", "spacious"]),
    border_style: z.enum(["none", "subtle", "strong"]),
    section_rhythm: z.enum(["flat", "alternating", "layered"]),
    hero_treatment: z.enum([
      "fullbleed-dark",
      "fullbleed-light",
      "split-asymmetric",
      "centered-cinematic",
      "editorial-overlap"
    ]),
    image_treatment: z.enum(["raw", "rounded-sm", "rounded-lg", "masked-organic"])
  }),
  cta: z.object({
    variant: z.enum(["filled", "ghost", "pill", "underline"]),
    size: z.enum(["sm", "md", "lg"]),
    uppercase: z.boolean()
  })
});

const blockStyleSchema = z.object({
  fontSize: z.number().min(10).max(120).optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  fontFamily: z.enum(fontFamilies).optional(),
  color: colorToken.optional(),
  bgColor: colorToken.optional(),
  radius: z.number().min(0).max(200).optional(),
  borderColor: colorToken.optional(),
  borderWidth: z.number().min(0).max(12).optional(),
  opacity: z.number().min(0.1).max(1).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional()
});

const blockBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  visible: z.boolean().default(true),
  layout: blockLayoutSchema,
  style: blockStyleSchema.default({})
});

type BlockStyle = z.infer<typeof blockStyleSchema>;

function normalizeTemplateStyle(style?: TemplateBlockBlueprint["style"]): BlockStyle {
  if (!style) return {};
  const normalized: BlockStyle = {
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    color: style.color,
    bgColor: style.bgColor,
    radius: style.radius,
    borderColor: style.borderColor,
    borderWidth: style.borderWidth,
    opacity: style.opacity,
    textAlign: style.textAlign
  };
  if (style.fontFamily && fontFamilies.includes(style.fontFamily as (typeof fontFamilies)[number])) {
    normalized.fontFamily = style.fontFamily as (typeof fontFamilies)[number];
  }
  return normalized;
}

const textBlockSchema = blockBaseSchema.extend({
  type: z.literal("text"),
  content: z.object({
    text: z.string().min(1).max(1200)
  })
});

const imageBlockSchema = blockBaseSchema.extend({
  type: z.literal("image"),
  content: z.object({
    url: optionalUrl,
    alt: z.string().max(180).optional(),
    fit: z.enum(["cover", "contain"]).optional()
  })
});

const buttonBlockSchema = blockBaseSchema.extend({
  type: z.literal("button"),
  content: z.object({
    label: z.string().min(1).max(120),
    href: z.string().max(1024).optional(),
    action: z.enum(["whatsapp", "link"]).default("whatsapp")
  })
});

const productBlockSchema = blockBaseSchema.extend({
  type: z.literal("product"),
  content: z.object({
    name: z.string().min(1).max(120),
    price: z.number().min(0).optional(),
    currency: z.string().min(1).max(8).optional(),
    image_url: optionalUrl,
    sku: z.string().max(40).optional(),
    description: z.string().max(300).optional()
  })
});

const shapeBlockSchema = blockBaseSchema.extend({
  type: z.literal("shape"),
  content: z.object({
    shape: z.enum(["rect", "pill", "circle"]).default("rect")
  })
});

const containerBlockSchema = blockBaseSchema.extend({
  type: z.literal("container"),
  content: z.object({
    title: z.string().max(120).optional()
  })
});

export const canvasBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  imageBlockSchema,
  buttonBlockSchema,
  productBlockSchema,
  shapeBlockSchema,
  containerBlockSchema
]);

const sectionVariantSchema = z.enum([
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
]);

const sectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["hero", "catalog", "testimonials", "contact"]),
  enabled: z.boolean().default(true),
  variant: sectionVariantSchema,
  height_ratio: sectionHeightRatioSchema,
  blocks: z.array(canvasBlockSchema).min(1).max(120)
});

const pageSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1).max(140),
  sections: z.array(sectionSchema).min(1).max(20)
});

const headerVariantSchema = z.enum(["none", "hamburger-side", "hamburger-overlay", "top-bar"]);

const headerSchema = z
  .object({
    variant: headerVariantSchema,
    brand: z.string().max(140).optional(),
    links: z
      .array(
        z.object({
          label: z.string().min(1).max(80),
          href: z.string().min(1).max(200)
        })
      )
      .optional()
  })
  .optional();

export const siteSpecV3Schema = z.object({
  schema_version: z.literal("3.1"),
  site_type: z.enum(["informative", "commerce_lite"]),
  locale: z.literal("es-LATAM"),
  template: z.object({
    id: z.enum(templateIds),
    family: z.enum(["clean", "bold", "trust", "shop", "social", "dark"])
  }),
  theme: visualThemeSchema,
  pages: z.array(pageSchema).min(1),
  header: headerSchema,
  integrations: z.object({
    whatsapp: z
      .object({
        enabled: z.boolean(),
        phone: z.string().optional(),
        cta_label: z.string().optional(),
        message: z.string().optional()
      })
      .optional()
  })
});

const percentLegacySiteSpecV3Schema = z.object({
  schema_version: z.literal("3.0"),
  site_type: z.enum(["informative", "commerce_lite"]),
  locale: z.literal("es-LATAM"),
  template: z.object({
    id: z.enum(templateIds),
    family: z.enum(["clean", "bold", "trust", "shop", "social", "dark"])
  }),
  theme: legacyThemeSchema,
  pages: z.array(pageSchema).min(1),
  header: headerSchema,
  integrations: z.object({
    whatsapp: z
      .object({
        enabled: z.boolean(),
        phone: z.string().optional(),
        cta_label: z.string().optional(),
        message: z.string().optional()
      })
      .optional()
  })
});

const legacyCanvasRectSchema = z.object({
  x: z.number().min(0).max(3000),
  y: z.number().min(0).max(3000),
  w: z.number().min(40).max(3000),
  h: z.number().min(24).max(3000),
  z: z.number().int().min(0).max(999)
});

const legacyBlockLayoutSchema = z.object({
  desktop: legacyCanvasRectSchema,
  mobile: legacyCanvasRectSchema.optional()
});

const legacyBlockBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  visible: z.boolean().default(true),
  layout: legacyBlockLayoutSchema,
  style: blockStyleSchema.default({})
});

const legacyTextBlockSchema = legacyBlockBaseSchema.extend({
  type: z.literal("text"),
  content: z.object({
    text: z.string().min(1).max(1200)
  })
});

const legacyImageBlockSchema = legacyBlockBaseSchema.extend({
  type: z.literal("image"),
  content: z.object({
    url: optionalUrl,
    alt: z.string().max(180).optional(),
    fit: z.enum(["cover", "contain"]).optional()
  })
});

const legacyButtonBlockSchema = legacyBlockBaseSchema.extend({
  type: z.literal("button"),
  content: z.object({
    label: z.string().min(1).max(120),
    href: z.string().max(1024).optional(),
    action: z.enum(["whatsapp", "link"]).default("whatsapp")
  })
});

const legacyProductBlockSchema = legacyBlockBaseSchema.extend({
  type: z.literal("product"),
  content: z.object({
    name: z.string().min(1).max(120),
    price: z.number().min(0).optional(),
    currency: z.string().min(1).max(8).optional(),
    image_url: optionalUrl,
    sku: z.string().max(40).optional(),
    description: z.string().max(300).optional()
  })
});

const legacyShapeBlockSchema = legacyBlockBaseSchema.extend({
  type: z.literal("shape"),
  content: z.object({
    shape: z.enum(["rect", "pill", "circle"]).default("rect")
  })
});

const legacyContainerBlockSchema = legacyBlockBaseSchema.extend({
  type: z.literal("container"),
  content: z.object({
    title: z.string().max(120).optional()
  })
});

const legacyCanvasBlockSchema = z.discriminatedUnion("type", [
  legacyTextBlockSchema,
  legacyImageBlockSchema,
  legacyButtonBlockSchema,
  legacyProductBlockSchema,
  legacyShapeBlockSchema,
  legacyContainerBlockSchema
]);

const legacySectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["hero", "catalog", "testimonials", "contact"]),
  enabled: z.boolean().default(true),
  variant: sectionVariantSchema,
  height: z.object({
    desktop: z.number().min(260).max(1800),
    mobile: z.number().min(220).max(2200)
  }),
  blocks: z.array(legacyCanvasBlockSchema).min(1).max(120)
});

const legacyPageSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1).max(140),
  sections: z.array(legacySectionSchema).min(1).max(20)
});

const legacySiteSpecV3Schema = z.object({
  schema_version: z.literal("3.0"),
  site_type: z.enum(["informative", "commerce_lite"]),
  locale: z.literal("es-LATAM"),
  template: z.object({
    id: z.enum(templateIds),
    family: z.enum(["clean", "bold", "trust", "shop", "social", "dark"])
  }),
  theme: legacyThemeSchema,
  pages: z.array(legacyPageSchema).min(1),
  header: headerSchema,
  integrations: z.object({
    whatsapp: z
      .object({
        enabled: z.boolean(),
        phone: z.string().optional(),
        cta_label: z.string().optional(),
        message: z.string().optional()
      })
      .optional()
  })
});

export type CanvasLayoutRect = z.infer<typeof canvasRectSchema>;
export type CanvasBlock = z.infer<typeof canvasBlockSchema>;
export type SiteSpecV3 = z.infer<typeof siteSpecV3Schema>;
export type SiteSectionV3 = SiteSpecV3["pages"][number]["sections"][number];
export type SiteThemeV31 = SiteSpecV3["theme"];
type LegacyTheme = z.infer<typeof legacyThemeSchema>;

const LEGACY_FONT_MAP: Record<string, (typeof fontFamilies)[number]> = {
  Poppins: "Outfit",
  Montserrat: "Space Grotesk",
  Nunito: "DM Sans",
  "Source Sans Pro": "DM Sans",
  Oswald: "Bebas Neue",
  "Open Sans": "DM Sans"
};

export function isSupportedFontFamily(value?: string | null): value is (typeof fontFamilies)[number] {
  return Boolean(value && fontFamilies.includes(value as (typeof fontFamilies)[number]));
}

export function normalizeFontFamilyToken(
  value: string | undefined | null,
  fallback: "heading" | "body" = "body"
): (typeof fontFamilies)[number] {
  if (isSupportedFontFamily(value)) {
    return value;
  }
  const mapped = value ? LEGACY_FONT_MAP[value] : undefined;
  if (mapped) {
    return mapped;
  }
  return fallback === "heading" ? "Outfit" : "DM Sans";
}

export function deriveVisualThemeFromLegacy(theme: LegacyTheme): SiteThemeV31 {
  const headingFont = normalizeFontFamilyToken(theme.font_heading, "heading");
  const bodyFont = normalizeFontFamilyToken(theme.font_body, "body");
  const darkBackground = isDarkColor(theme.background);
  const heroTreatment: SiteThemeV31["style_tokens"]["hero_treatment"] = darkBackground
    ? "fullbleed-dark"
    : headingFont === "Playfair Display" || headingFont === "Cormorant Garamond"
      ? "editorial-overlap"
      : "split-asymmetric";
  return {
    palette: {
      background: theme.background,
      surface: darkBackground ? mixHex(theme.background, "#ffffff", 0.06) : "#ffffff",
      border: darkBackground ? mixHex(theme.background, "#ffffff", 0.14) : mixHex(theme.secondary, "#ffffff", 0.72),
      primary: theme.primary,
      accent: theme.secondary,
      text_primary: darkBackground ? "#f8fafc" : theme.primary,
      text_muted: darkBackground ? "#cbd5e1" : mixHex(theme.primary, "#94a3b8", 0.45)
    },
    typography: {
      heading_font: headingFont,
      body_font: bodyFont,
      scale: headingFont === "Playfair Display" || headingFont === "Cormorant Garamond" ? "editorial" : "balanced",
      heading_weight: headingFont === "Cormorant Garamond" ? 400 : 700,
      letter_spacing: headingFont === "Bebas Neue" ? "wide" : headingFont === "Space Grotesk" ? "tight" : "normal"
    },
    style_tokens: {
      spacing_scale: theme.radius === "lg" ? "spacious" : theme.radius === "sm" ? "tight" : "comfortable",
      border_style: theme.radius === "sm" ? "strong" : "subtle",
      section_rhythm: darkBackground ? "layered" : "alternating",
      hero_treatment: heroTreatment,
      image_treatment: theme.radius === "lg" ? "rounded-lg" : theme.radius === "sm" ? "raw" : "rounded-sm"
    },
    cta: {
      variant: theme.radius === "lg" ? "pill" : "filled",
      size: "md",
      uppercase: headingFont === "Bebas Neue"
    }
  };
}

export function getEditableThemeSnapshot(theme: SiteThemeV31) {
  return {
    primary: theme.palette.primary,
    secondary: theme.palette.accent,
    background: theme.palette.background,
    font_heading: theme.typography.heading_font,
    font_body: theme.typography.body_font,
    radius:
      theme.style_tokens.image_treatment === "rounded-lg"
        ? ("lg" as const)
        : theme.style_tokens.image_treatment === "raw"
          ? ("sm" as const)
          : ("md" as const)
  };
}

export function applyEditableThemePatch(
  theme: SiteThemeV31,
  patch: Partial<ReturnType<typeof getEditableThemeSnapshot>>
): SiteThemeV31 {
  const next = structuredClone(theme);
  if (patch.primary) {
    next.palette.primary = patch.primary;
    next.palette.text_primary = isDarkColor(next.palette.background) ? next.palette.text_primary : patch.primary;
  }
  if (patch.secondary) {
    next.palette.accent = patch.secondary;
  }
  if (patch.background) {
    next.palette.background = patch.background;
    next.palette.surface = isDarkColor(patch.background) ? mixHex(patch.background, "#ffffff", 0.06) : "#ffffff";
    next.palette.border = isDarkColor(patch.background) ? mixHex(patch.background, "#ffffff", 0.14) : mixHex(next.palette.accent, "#ffffff", 0.72);
    next.palette.text_primary = isDarkColor(patch.background) ? "#f8fafc" : next.palette.primary;
    next.palette.text_muted = isDarkColor(patch.background) ? "#cbd5e1" : mixHex(next.palette.primary, "#94a3b8", 0.45);
    next.style_tokens.hero_treatment = isDarkColor(patch.background) ? "fullbleed-dark" : next.style_tokens.hero_treatment === "fullbleed-dark" ? "fullbleed-light" : next.style_tokens.hero_treatment;
  }
  if (patch.font_heading) {
    next.typography.heading_font = normalizeFontFamilyToken(patch.font_heading, "heading");
  }
  if (patch.font_body) {
    next.typography.body_font = normalizeFontFamilyToken(patch.font_body, "body");
  }
  if (patch.radius) {
    next.style_tokens.image_treatment = patch.radius === "lg" ? "rounded-lg" : patch.radius === "sm" ? "raw" : "rounded-sm";
    next.cta.variant = patch.radius === "lg" ? "pill" : next.cta.variant === "pill" ? "filled" : next.cta.variant;
  }
  return next;
}

export function parseSiteSpecV3(input: unknown) {
  const parsed = siteSpecV3Schema.safeParse(input);
  if (parsed.success) {
    return {
      success: true as const,
      data: stabilizeSiteSpecForMobile(parsed.data)
    };
  }

  const percentLegacyParsed = percentLegacySiteSpecV3Schema.safeParse(input);
  if (percentLegacyParsed.success) {
    return {
      success: true as const,
      data: stabilizeSiteSpecForMobile(upgradePercentLegacySpec(percentLegacyParsed.data))
    };
  }

  const legacyParsed = legacySiteSpecV3Schema.safeParse(input);
  if (!legacyParsed.success) {
    return parsed;
  }

  return {
    success: true as const,
    data: stabilizeSiteSpecForMobile(convertLegacySpecToPercent(legacyParsed.data))
  };
}

export function normalizeSiteSpecV3(input: unknown) {
  const parsed = siteSpecV3Schema.safeParse(input);
  if (parsed.success) {
    return { spec: stabilizeSiteSpecForMobile(parsed.data), migrated: false };
  }
  const percentLegacyParsed = percentLegacySiteSpecV3Schema.safeParse(input);
  if (percentLegacyParsed.success) {
    return { spec: stabilizeSiteSpecForMobile(upgradePercentLegacySpec(percentLegacyParsed.data)), migrated: true };
  }
  const legacyParsed = legacySiteSpecV3Schema.safeParse(input);
  if (legacyParsed.success) {
    return { spec: stabilizeSiteSpecForMobile(convertLegacySpecToPercent(legacyParsed.data)), migrated: true };
  }
  return null;
}

type LegacySiteSpecV3 = z.infer<typeof legacySiteSpecV3Schema>;
type PercentLegacySiteSpecV3 = z.infer<typeof percentLegacySiteSpecV3Schema>;
type LegacySection = LegacySiteSpecV3["pages"][number]["sections"][number];
type LegacyCanvasLayoutRect = z.infer<typeof legacyCanvasRectSchema>;
type LegacyCanvasBlock = z.infer<typeof legacyCanvasBlockSchema>;

function convertLegacySpecToPercent(spec: LegacySiteSpecV3): SiteSpecV3 {
  const pages = spec.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      const desktopHeight = section.height.desktop;
      const mobileHeight = section.height.mobile;
      const desktopRatio = toRatio(desktopHeight, CANVAS_BASE_WIDTH.desktop);
      const mobileRatio = toRatio(mobileHeight, CANVAS_BASE_WIDTH.mobile);

      const blocks = section.blocks.map((block) => ({
        ...block,
        layout: {
          desktop: rectPxToPercent(block.layout.desktop, CANVAS_BASE_WIDTH.desktop, desktopHeight),
          mobile: block.layout.mobile
            ? rectPxToPercent(block.layout.mobile, CANVAS_BASE_WIDTH.mobile, mobileHeight)
            : undefined
        }
      }));

      return {
        id: section.id,
        type: section.type,
        enabled: section.enabled,
        variant: section.variant,
        height_ratio: {
          desktop: desktopRatio,
          mobile: mobileRatio
        },
        blocks
      };
    })
  }));

  return {
    schema_version: "3.1",
    site_type: spec.site_type,
    locale: spec.locale,
    template: spec.template,
    theme: deriveVisualThemeFromLegacy(spec.theme),
    header: spec.header,
    pages,
    integrations: spec.integrations
  };
}

function upgradePercentLegacySpec(spec: PercentLegacySiteSpecV3): SiteSpecV3 {
  return {
    schema_version: "3.1",
    site_type: spec.site_type,
    locale: spec.locale,
    template: spec.template,
    theme: deriveVisualThemeFromLegacy(spec.theme),
    header: spec.header,
    pages: spec.pages,
    integrations: spec.integrations
  };
}

function toRatio(height: number, width: number) {
  if (!width) return 1;
  return round(height / width, 4);
}

function rectPxToPercent(rect: { x: number; y: number; w: number; h: number; z: number }, width: number, height: number): CanvasLayoutRect {
  return {
    x: clampPercent((rect.x / width) * 100),
    y: clampPercent((rect.y / height) * 100),
    w: clampPercent((rect.w / width) * 100),
    h: clampPercent((rect.h / height) * 100),
    z: rect.z
  };
}

function rectPercentToPx(rect: CanvasLayoutRect, width: number, height: number) {
  return {
    x: (rect.x / 100) * width,
    y: (rect.y / 100) * height,
    w: (rect.w / 100) * width,
    h: (rect.h / 100) * height,
    z: rect.z
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, round(value, 4)));
}

function round(value: number, decimals = 3) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function buildHeaderLinks(sections: SiteSectionV3[]) {
  const labels: Record<SiteSectionV3["type"], string> = {
    hero: "Inicio",
    catalog: "Catálogo",
    testimonials: "Testimonios",
    contact: "Contacto"
  };

  return sections.filter((section) => section.enabled).map((section) => ({
    label: labels[section.type] ?? section.type,
    href: `#${section.id}`
  }));
}

function buildDefaultHeaderVariant(template: TemplateDefinition): HeaderVariant {
  return template.default_header_variant ?? "none";
}

function getProductBaseLabels(siteType: "informative" | "commerce_lite") {
  if (siteType === "commerce_lite") {
    return ["Producto estrella", "Producto recomendado", "Producto popular"];
  }
  return ["Servicio principal", "Servicio complementario", "Servicio premium"];
}

function getProductDescriptions(offerSummary: string, tone: string) {
  return [
    offerSummary,
    "Ideal para clientes que buscan resultados rápidos.",
    `Atención ${tone.toLowerCase()} con soporte por WhatsApp.`
  ];
}

function getTestimonialQuotes() {
  return [
    "La experiencia fue rápida y muy clara desde el primer contacto.",
    "Excelente atención por WhatsApp y respuesta en pocos minutos.",
    "Se siente profesional y fácil de usar para nuestros clientes."
  ];
}

function placeholderImage(label: string, size = "1200x800") {
  return `https://placehold.co/${size}?text=${encodeURIComponent(label)}`;
}

function resolveTextForBlock(input: {
  sectionType: SiteSectionV3["type"];
  blockId: string;
  businessName: string;
  offerSummary: string;
  targetAudience: string;
  tone: string;
  siteType: "informative" | "commerce_lite";
}) {
  const { sectionType, blockId, businessName, offerSummary, targetAudience, tone, siteType } = input;
  const productLabels = getProductBaseLabels(siteType);
  const productDescriptions = getProductDescriptions(offerSummary, tone);
  const quotes = getTestimonialQuotes();

  if (sectionType === "hero") {
    if (blockId.includes("headline")) return businessName;
    if (blockId.includes("subheadline")) {
      return `${offerSummary} Para ${targetAudience.toLowerCase()}.`;
    }
    if (blockId.includes("eyebrow")) return "Nuevo";
  }

  if (sectionType === "catalog") {
    if (blockId.includes("title")) return siteType === "commerce_lite" ? "Catálogo destacado" : "Servicios principales";
    const nameMatch = blockId.match(/name-(\d+)/);
    if (nameMatch) return productLabels[Number(nameMatch[1]) - 1] ?? productLabels[0];
    const descMatch = blockId.match(/desc-(\d+)/);
    if (descMatch) return productDescriptions[Number(descMatch[1]) - 1] ?? productDescriptions[0];
  }

  if (sectionType === "testimonials") {
    if (blockId.includes("title")) return "Clientes que confían en nosotros";
    const quoteMatch = blockId.match(/quote-(\d+)/);
    if (quoteMatch) return quotes[Number(quoteMatch[1]) - 1] ?? quotes[0];
  }

  if (sectionType === "contact") {
    if (blockId.includes("title")) return "Contáctanos";
    if (blockId.includes("description")) return `Escríbenos y recibe una respuesta ${tone.toLowerCase()}.`;
  }

  return offerSummary;
}

function buildBlockFromBlueprint(input: {
  blueprint: TemplateBlockBlueprint;
  sectionId: string;
  sectionType: SiteSectionV3["type"];
  businessName: string;
  offerSummary: string;
  targetAudience: string;
  tone: string;
  ctaLabel: string;
  siteType: "informative" | "commerce_lite";
}): CanvasBlock {
  const { blueprint, sectionId, sectionType, businessName, offerSummary, targetAudience, tone, ctaLabel, siteType } = input;
  const blockId = `${sectionId}-${blueprint.id}`;
  const style = normalizeTemplateStyle(blueprint.style);

  if (blueprint.type === "text") {
    const text =
      blueprint.content?.text ??
      resolveTextForBlock({
        sectionType,
        blockId: blueprint.id,
        businessName,
        offerSummary,
        targetAudience,
        tone,
        siteType
      });
    return {
      id: blockId,
      type: "text",
      visible: true,
      layout: blueprint.layout,
      style,
      content: { text }
    };
  }

  if (blueprint.type === "button") {
    const label = blueprint.content?.label ?? ctaLabel;
    return {
      id: blockId,
      type: "button",
      visible: true,
      layout: blueprint.layout,
      style,
      content: {
        label,
        action: blueprint.content?.action ?? "whatsapp",
        href: blueprint.content?.href
      }
    };
  }

  if (blueprint.type === "image") {
    const isHero = sectionType === "hero" || blueprint.id.includes("hero");
    const label = isHero ? businessName : "Imagen";
    return {
      id: blockId,
      type: "image",
      visible: true,
      layout: blueprint.layout,
      style,
      content: {
        url: blueprint.content?.url ?? placeholderImage(label, isHero ? "1400x900" : "1000x700"),
        alt: blueprint.content?.alt ?? label,
        fit: blueprint.content?.fit
      }
    };
  }

  if (blueprint.type === "product") {
    const indexMatch = blueprint.id.match(/product-(\d+)/);
    const index = indexMatch ? Number(indexMatch[1]) - 1 : 0;
    const productLabels = getProductBaseLabels(siteType);
    const productDescriptions = getProductDescriptions(offerSummary, tone);
    const name = blueprint.content?.name ?? productLabels[index] ?? productLabels[0];
    const price =
      typeof blueprint.content?.price === "number"
        ? blueprint.content.price
        : typeof blueprint.content?.price === "string"
          ? Number(blueprint.content.price)
          : 120000 + index * 20000;
    return {
      id: blockId,
      type: "product",
      visible: true,
      layout: blueprint.layout,
      style,
      content: {
        name,
        description: blueprint.content?.description ?? productDescriptions[index] ?? productDescriptions[0],
        price: Number.isFinite(price) ? price : undefined,
        currency: blueprint.content?.currency ?? "COP",
        image_url: blueprint.content?.image_url ?? placeholderImage(name, "640x420"),
        sku: undefined
      }
    };
  }

  if (blueprint.type === "shape") {
    return {
      id: blockId,
      type: "shape",
      visible: true,
      layout: blueprint.layout,
      style,
      content: {
        shape: blueprint.content?.shape ?? "rect"
      }
    };
  }

  return {
    id: blockId,
    type: "container",
    visible: true,
    layout: blueprint.layout,
    style,
    content: {
      title: blueprint.content?.title
    }
  };
}

function buildSectionFromBlueprint(input: {
  sectionType: SiteSectionV3["type"];
  index: number;
  template: TemplateDefinition;
  blueprint: TemplateLayoutBlueprint;
  businessName: string;
  offerSummary: string;
  targetAudience: string;
  tone: string;
  ctaLabel: string;
  siteType: "informative" | "commerce_lite";
}): SiteSectionV3 {
  const {
    sectionType,
    index,
    template,
    blueprint,
    businessName,
    offerSummary,
    targetAudience,
    tone,
    ctaLabel,
    siteType
  } = input;
  const sectionId = `${sectionType}-${index + 1}`;
  const sectionBlueprint = blueprint[sectionType];

  return {
    id: sectionId,
    type: sectionType,
    enabled: true,
    variant: template.variants[sectionType] as SiteSectionV3["variant"],
    height_ratio: sectionBlueprint.height_ratio,
    blocks: sectionBlueprint.blocks.map((block) =>
      buildBlockFromBlueprint({
        blueprint: block,
        sectionId,
        sectionType,
        businessName,
        offerSummary,
        targetAudience,
        tone,
        ctaLabel,
        siteType
      })
    )
  };
}

export function buildSiteSpecV3FromBrief(input: {
  siteType: "informative" | "commerce_lite";
  templateId?: TemplateId;
  businessName: string;
  offerSummary?: string;
  targetAudience?: string;
  tone?: string;
  ctaLabel?: string;
  whatsappPhone?: string;
  whatsappMessage?: string;
}): SiteSpecV3 {
  const businessName = normalizeBusinessName(input.businessName);
  const templateId = pickTemplateOrFallback({
    templateId: input.templateId,
    siteType: input.siteType
  });
  const template = getTemplateById(templateId);

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const offerSummary = input.offerSummary?.trim() || `${businessName} ofrece una propuesta clara y confiable.`;
  const targetAudience = input.targetAudience?.trim() || "Clientes potenciales en redes sociales y WhatsApp";
  const tone = input.tone?.trim() || "Cercano, claro y orientado a conversión";
  const ctaLabel = input.ctaLabel?.trim() || "Escribir por WhatsApp";
  const whatsappPhone = normalizeWhatsappPhone(input.whatsappPhone);
  const whatsappMessage = input.whatsappMessage?.trim() || undefined;
  const sectionOrder = pickSectionOrder(template.section_order, input.siteType);

  const sections = sectionOrder.map((sectionType, index) =>
    buildSectionFromBlueprint({
      sectionType,
      index,
      template,
      blueprint: template.layout_blueprint,
      businessName,
      offerSummary,
      targetAudience,
      tone,
      ctaLabel,
      siteType: input.siteType
    })
  );

  const spec: SiteSpecV3 = {
    schema_version: "3.1",
    site_type: input.siteType,
    locale: "es-LATAM",
    template: {
      id: template.id,
      family: template.family
    },
    theme: deriveVisualThemeFromLegacy(template.theme),
    header: {
      variant: buildDefaultHeaderVariant(template),
      brand: businessName,
      links: buildHeaderLinks(sections)
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
        enabled: Boolean(whatsappPhone),
        phone: whatsappPhone ?? undefined,
        cta_label: ctaLabel,
        message: whatsappMessage
      }
    }
  };

  return stabilizeSiteSpecForMobile(spec);
}

export function buildFallbackSiteSpecV3(
  prompt: string,
  options?: { templateId?: TemplateId; siteType?: "informative" | "commerce_lite" }
): SiteSpecV3 {
  const promptText = prompt.trim();
  const inferredSiteType =
    options?.siteType ??
    (/(tienda|cat[aá]logo|producto|vender|venta|stock)/i.test(promptText) ? "commerce_lite" : "informative");

  return buildSiteSpecV3FromBrief({
    siteType: inferredSiteType,
    templateId: options?.templateId,
    businessName: promptText.slice(0, 80) || "Tu negocio",
    offerSummary: promptText || "Presentación principal del negocio.",
    targetAudience: "Clientes interesados en una solución rápida",
    tone: "Claro y directo",
    ctaLabel: "Hablar por WhatsApp"
  });
}

function normalizeWhatsappPhone(value?: string) {
  return normalizeWhatsappPhoneValue(value);
}

export function stabilizeSiteSpecForMobile(spec: SiteSpecV3): SiteSpecV3 {
  const next = structuredClone(spec);
  next.pages = next.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => stabilizeSectionForMobile(section))
  }));
  return next;
}

export function getViewportSectionHeightPx(
  section: SiteSectionV3,
  viewport: "desktop" | "mobile",
  width: number
) {
  const ratio = viewport === "mobile" ? section.height_ratio.mobile : section.height_ratio.desktop;
  const baseHeight =
    viewport === "mobile"
      ? Math.max(width * ratio, getMinimumSectionHeight(section.type))
      : Math.max(1, width * ratio);

  const contentBottom = section.blocks
    .filter((block) => block.visible)
    .reduce((maxBottom, block) => {
      const sourceRect = viewport === "mobile" && block.layout.mobile ? block.layout.mobile : block.layout.desktop;
      const rect = rectPercentToPx(sourceRect, width, baseHeight);
      const visualHeight =
        block.type === "text"
          ? getViewportTextHeightPx(block.content.text, block.style.fontSize, rect.w, rect.h)
          : block.type === "product"
            ? Math.max(rect.h, viewport === "mobile" ? 300 : 250)
            : block.type === "image"
              ? Math.max(rect.h, viewport === "mobile" ? 180 : rect.h)
              : rect.h;
      return Math.max(maxBottom, rect.y + visualHeight + 24);
    }, 0);

  return Math.max(baseHeight, contentBottom);
}

function stabilizeSectionForMobile(section: SiteSectionV3): SiteSectionV3 {
  const width = CANVAS_BASE_WIDTH.mobile;
  const padding = getMobileSectionPadding(section.type);
  const baseHeight = Math.max(width * section.height_ratio.mobile, getMinimumSectionHeight(section.type));
  const visibleBlocks = section.blocks.filter((block) => block.visible);
  const decorativeBlocks = visibleBlocks.filter(isDecorativeMobileBlock);
  const flowBlocks = visibleBlocks
    .filter((block) => !isDecorativeMobileBlock(block))
    .sort((left, right) => {
      const leftRect = left.layout.mobile ?? left.layout.desktop;
      const rightRect = right.layout.mobile ?? right.layout.desktop;
      if (leftRect.y !== rightRect.y) return leftRect.y - rightRect.y;
      return leftRect.z - rightRect.z;
    });

  const adjustedLayouts = new Map<string, CanvasLayoutRect>();
  let cursorY = getMobileSectionTop(section.type);

  for (const block of flowBlocks) {
    const sourceRect = block.layout.mobile ?? block.layout.desktop;
    const current = rectPercentToPx(sourceRect, width, baseHeight);
    const widthPx = getMobileBlockWidthPx(section.type, block, width, padding, current.w);
    const heightPx = getMobileBlockHeightPx(block, widthPx, current.h);
    const xPx = getMobileBlockX(section.type, block, width, padding, widthPx);

    adjustedLayouts.set(
      block.id,
      rectPxToPercent(
        {
          x: xPx,
          y: cursorY,
          w: widthPx,
          h: heightPx,
          z: sourceRect.z
        },
        width,
        baseHeight
      )
    );

    cursorY += heightPx + getMobileBlockGap(section.type, block.type);
  }

  const sectionHeight = Math.max(baseHeight, cursorY + padding);

  const blocks = section.blocks.map((block) => {
    const sourceRect = block.layout.mobile ?? block.layout.desktop;

    if (adjustedLayouts.has(block.id)) {
      return {
        ...block,
        layout: {
          ...block.layout,
          mobile: reprojectPercentRect(adjustedLayouts.get(block.id)!, baseHeight, sectionHeight)
        }
      };
    }

    const pxRect = rectPercentToPx(sourceRect, width, baseHeight);
    let nextPxRect = pxRect;

    if (isFullscreenDecorativeBlock(block)) {
      nextPxRect = {
        x: 0,
        y: 0,
        w: width,
        h: sectionHeight,
        z: sourceRect.z
      };
    } else {
      nextPxRect = clampPxRect(
        {
          ...pxRect,
          x: Math.max(0, Math.min(pxRect.x, width - pxRect.w)),
          y: Math.max(0, Math.min(pxRect.y, sectionHeight - pxRect.h))
        },
        width,
        sectionHeight
      );
    }

    return {
      ...block,
      layout: {
        ...block.layout,
        mobile: rectPxToPercent(nextPxRect, width, sectionHeight)
      }
    };
  });

  return {
    ...section,
    height_ratio: {
      ...section.height_ratio,
      mobile: clampRatio(sectionHeight / width)
    },
    blocks
  };
}

function getMobileSectionPadding(type: SiteSectionV3["type"]) {
  if (type === "hero") return 24;
  return 20;
}

function getMinimumSectionHeight(type: SiteSectionV3["type"]) {
  if (type === "hero") return 500;
  if (type === "catalog") return 540;
  if (type === "testimonials") return 440;
  return 360;
}

function getMobileSectionTop(type: SiteSectionV3["type"]) {
  if (type === "hero") return 44;
  if (type === "catalog") return 34;
  if (type === "testimonials") return 30;
  return 28;
}

function getMobileBlockGap(sectionType: SiteSectionV3["type"], blockType: CanvasBlock["type"]) {
  if (sectionType === "hero" && blockType === "button") return 22;
  if (blockType === "product") return 20;
  return 16;
}

function isDecorativeMobileBlock(block: CanvasBlock) {
  return block.type === "shape" || isFullscreenDecorativeBlock(block);
}

function isFullscreenDecorativeBlock(block: CanvasBlock) {
  return /(?:^|-)hero-(?:bg|overlay)(?:-|$)|(?:^|-)bg(?:-|$)|(?:^|-)overlay(?:-|$)/i.test(block.id);
}

function getMobileBlockWidthPx(
  sectionType: SiteSectionV3["type"],
  block: CanvasBlock,
  sectionWidth: number,
  padding: number,
  currentWidth: number
) {
  const fullWidth = Math.max(180, sectionWidth - padding * 2);

  if (block.type === "product" || block.type === "container") {
    return fullWidth;
  }

  if (block.type === "button") {
    return Math.min(fullWidth, Math.max(190, currentWidth));
  }

  if (block.type === "image") {
    if (sectionType === "hero") {
      return fullWidth;
    }
    return Math.min(fullWidth, Math.max(220, currentWidth));
  }

  if (block.type === "text") {
    if (sectionType === "hero") {
      return Math.min(fullWidth, Math.max(260, currentWidth));
    }
    return fullWidth;
  }

  return Math.min(fullWidth, Math.max(200, currentWidth));
}

function getMobileBlockX(
  sectionType: SiteSectionV3["type"],
  block: CanvasBlock,
  sectionWidth: number,
  padding: number,
  widthPx: number
) {
  const centered = Math.max(padding, (sectionWidth - widthPx) / 2);
  if (block.type === "text" || block.type === "button") {
    return sectionType === "hero" ? padding : centered;
  }
  return centered;
}

function getMobileBlockHeightPx(block: CanvasBlock, widthPx: number, fallbackHeightPx: number) {
  if (block.type === "text") {
    return getMobileTextHeightPx(block.content.text, block.style.fontSize, widthPx, fallbackHeightPx);
  }

  if (block.type === "button") {
    return Math.max(48, fallbackHeightPx);
  }

  if (block.type === "image") {
    return Math.max(180, fallbackHeightPx);
  }

  if (block.type === "product") {
    return Math.max(300, fallbackHeightPx);
  }

  if (block.type === "container") {
    return Math.max(180, fallbackHeightPx);
  }

  return Math.max(60, fallbackHeightPx);
}

function getMobileTextHeightPx(text: string, fontSize = 18, widthPx: number, fallbackHeightPx: number) {
  const usableWidth = Math.max(96, widthPx - 16);
  const avgCharWidth = Math.max(7, fontSize * 0.54);
  const charsPerLine = Math.max(8, Math.floor(usableWidth / avgCharWidth));
  const lineCount = String(text || "")
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(Math.max(1, line.length) / charsPerLine)), 0);
  return Math.max(fallbackHeightPx, lineCount * fontSize * 1.18 + 26);
}

function getViewportTextHeightPx(text: string, fontSize = 18, widthPx: number, fallbackHeightPx: number) {
  const usableWidth = Math.max(40, widthPx - 16);
  const avgCharWidth = Math.max(7, fontSize * 0.56);
  const charsPerLine = Math.max(6, Math.floor(usableWidth / avgCharWidth));
  const lineCount = String(text || "")
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(Math.max(1, line.length) / charsPerLine)), 0);
  return Math.max(fallbackHeightPx, lineCount * fontSize * 1.15 + 20);
}

function reprojectPercentRect(rect: CanvasLayoutRect, fromHeight: number, toHeight: number): CanvasLayoutRect {
  const pxRect = rectPercentToPx(rect, CANVAS_BASE_WIDTH.mobile, fromHeight);
  return rectPxToPercent(pxRect, CANVAS_BASE_WIDTH.mobile, toHeight);
}

function clampPxRect(
  rect: { x: number; y: number; w: number; h: number; z: number },
  maxWidth: number,
  maxHeight: number
) {
  return {
    ...rect,
    x: Math.max(0, Math.min(rect.x, Math.max(0, maxWidth - rect.w))),
    y: Math.max(0, Math.min(rect.y, Math.max(0, maxHeight - rect.h))),
    w: Math.max(48, Math.min(rect.w, maxWidth)),
    h: Math.max(32, Math.min(rect.h, maxHeight))
  };
}

function clampRatio(value: number) {
  return Math.max(0.2, Math.min(3, round(value, 4)));
}

function buildSection(input: {
  sectionType: "hero" | "catalog" | "testimonials" | "contact";
  index: number;
  businessName: string;
  offerSummary: string;
  targetAudience: string;
  tone: string;
  ctaLabel: string;
  siteType: "informative" | "commerce_lite";
  templateVariants: {
    hero: string;
    catalog: string;
    testimonials: string;
    contact: string;
  };
}): LegacySection {
  const id = `${input.sectionType}-${input.index + 1}`;

  if (input.sectionType === "hero") {
    return {
      id,
      type: "hero",
      enabled: true,
      variant: input.templateVariants.hero as SiteSectionV3["variant"],
      height: { desktop: 520, mobile: 540 },
      blocks: [
        textBlock({
          id: `${id}-headline`,
          text: input.businessName,
          desktop: rect(56, 72, 520, 80, 2),
          mobile: rect(24, 58, 320, 84, 2),
          style: { fontSize: 44, fontWeight: 700, color: "#0f172a" }
        }),
        textBlock({
          id: `${id}-subheadline`,
          text: `${input.offerSummary} Para ${input.targetAudience.toLowerCase()}.`,
          desktop: rect(56, 170, 560, 90, 2),
          mobile: rect(24, 152, 320, 92, 2),
          style: { fontSize: 19, color: "#334155" }
        }),
        imageBlock({
          id: `${id}-image`,
          url: `https://placehold.co/800x520?text=${encodeURIComponent(input.businessName)}`,
          alt: input.businessName,
          desktop: rect(640, 66, 430, 330, 1),
          mobile: rect(24, 330, 320, 180, 1),
          visible: input.templateVariants.hero !== "centered"
        })
      ]
    };
  }

  if (input.sectionType === "catalog") {
    return {
      id,
      type: "catalog",
      enabled: true,
      variant: input.templateVariants.catalog as SiteSectionV3["variant"],
      height: { desktop: 640, mobile: 930 },
      blocks: [
        textBlock({
          id: `${id}-title`,
          text: input.siteType === "commerce_lite" ? "Catálogo destacado" : "Servicios principales",
          desktop: rect(56, 42, 560, 64, 2),
          mobile: rect(24, 30, 320, 56, 2),
          style: { fontSize: 34, fontWeight: 700, color: "#0f172a" }
        }),
        ...buildCatalogCardBlocks(id, input.siteType, input.offerSummary, input.tone)
      ]
    };
  }

  if (input.sectionType === "testimonials") {
    return {
      id,
      type: "testimonials",
      enabled: true,
      variant: input.templateVariants.testimonials as SiteSectionV3["variant"],
      height: { desktop: 500, mobile: 700 },
      blocks: [
        textBlock({
          id: `${id}-title`,
          text: "Clientes que confían en nosotros",
          desktop: rect(56, 36, 600, 62, 2),
          mobile: rect(24, 26, 320, 54, 2),
          style: { fontSize: 32, fontWeight: 700, color: "#0f172a" }
        }),
        textBlock({
          id: `${id}-quote-1`,
          text: "La experiencia fue rápida y muy clara desde el primer contacto.",
          desktop: rect(56, 126, 320, 108, 2),
          mobile: rect(24, 106, 320, 112, 2),
          style: { fontSize: 18, color: "#334155", bgColor: "#ffffff", radius: 14, borderWidth: 1, borderColor: "#cbd5e1" }
        }),
        textBlock({
          id: `${id}-quote-2`,
          text: "Excelente atención por WhatsApp y respuesta en pocos minutos.",
          desktop: rect(404, 126, 320, 108, 2),
          mobile: rect(24, 236, 320, 112, 2),
          style: { fontSize: 18, color: "#334155", bgColor: "#ffffff", radius: 14, borderWidth: 1, borderColor: "#cbd5e1" }
        }),
        textBlock({
          id: `${id}-quote-3`,
          text: "Se siente profesional y fácil de usar para nuestros clientes.",
          desktop: rect(752, 126, 320, 108, 2),
          mobile: rect(24, 366, 320, 112, 2),
          style: { fontSize: 18, color: "#334155", bgColor: "#ffffff", radius: 14, borderWidth: 1, borderColor: "#cbd5e1" }
        })
      ]
    };
  }

  return {
    id,
    type: "contact",
    enabled: true,
    variant: input.templateVariants.contact as SiteSectionV3["variant"],
    height: { desktop: 360, mobile: 420 },
    blocks: [
      textBlock({
        id: `${id}-title`,
        text: "Contáctanos",
        desktop: rect(56, 48, 420, 62, 2),
        mobile: rect(24, 34, 320, 56, 2),
        style: { fontSize: 34, fontWeight: 700, color: "#0f172a" }
      }),
      textBlock({
        id: `${id}-description`,
        text: `Escríbenos y recibe una respuesta ${input.tone.toLowerCase()}.`,
        desktop: rect(56, 124, 560, 84, 2),
        mobile: rect(24, 102, 320, 86, 2),
        style: { fontSize: 19, color: "#334155" }
      }),
      buttonBlock({
        id: `${id}-whatsapp`,
        label: input.ctaLabel,
        action: "whatsapp",
        desktop: rect(56, 226, 260, 52, 3),
        mobile: rect(24, 210, 230, 50, 3),
        style: { bgColor: "#0c4a6e", color: "#ffffff", radius: 14, fontWeight: 700, fontSize: 17 }
      })
    ]
  };
}

function buildCatalogCardBlocks(
  sectionId: string,
  siteType: "informative" | "commerce_lite",
  offerSummary: string,
  tone: string
) {
  const labels =
    siteType === "commerce_lite"
      ? ["Producto estrella", "Producto recomendado", "Producto popular"]
      : ["Servicio principal", "Servicio complementario", "Servicio premium"];

  const descriptions = [
    offerSummary,
    "Ideal para clientes que buscan resultados rápidos.",
    `Atención ${tone.toLowerCase()} con soporte por WhatsApp.`
  ];

  const cards = [
    { x: 56, y: 132, w: 320, h: 420 },
    { x: 404, y: 132, w: 320, h: 420 },
    { x: 752, y: 132, w: 320, h: 420 }
  ];

  const mobileCards = [
    { x: 24, y: 110, w: 320, h: 240 },
    { x: 24, y: 368, w: 320, h: 240 },
    { x: 24, y: 626, w: 320, h: 240 }
  ];

  const blocks: LegacyCanvasBlock[] = [];

  cards.forEach((card, index) => {
    if (siteType === "commerce_lite") {
      blocks.push(
        productBlock({
          id: `${sectionId}-product-${index + 1}`,
          name: labels[index] ?? `Producto ${index + 1}`,
          description: descriptions[index] ?? "",
          price: 120_000 + index * 20_000,
          currency: "COP",
          imageUrl: `https://placehold.co/640x420?text=${encodeURIComponent(labels[index] ?? `Producto ${index + 1}`)}`,
          desktop: rect(card.x, card.y, card.w, card.h, 1),
          mobile: rect(mobileCards[index].x, mobileCards[index].y, mobileCards[index].w, mobileCards[index].h, 1)
        })
      );
      return;
    }

    blocks.push(
      containerBlock({
        id: `${sectionId}-card-${index + 1}`,
        desktop: rect(card.x, card.y, card.w, card.h, 1),
        mobile: rect(mobileCards[index].x, mobileCards[index].y, mobileCards[index].w, mobileCards[index].h, 1),
        style: { bgColor: "#ffffff", radius: 14, borderColor: "#cbd5e1", borderWidth: 1 }
      })
    );

    blocks.push(
      imageBlock({
        id: `${sectionId}-image-${index + 1}`,
        url: `https://placehold.co/640x420?text=${encodeURIComponent(labels[index] ?? `Item ${index + 1}`)}`,
        alt: labels[index],
        desktop: rect(card.x + 12, card.y + 12, card.w - 24, 210, 2),
        mobile: rect(mobileCards[index].x + 10, mobileCards[index].y + 10, mobileCards[index].w - 20, 120, 2)
      })
    );

    blocks.push(
      textBlock({
        id: `${sectionId}-name-${index + 1}`,
        text: labels[index] ?? `Item ${index + 1}`,
        desktop: rect(card.x + 16, card.y + 238, card.w - 32, 36, 3),
        mobile: rect(mobileCards[index].x + 12, mobileCards[index].y + 136, mobileCards[index].w - 24, 30, 3),
        style: { fontSize: 22, fontWeight: 700, color: "#0f172a" }
      })
    );

    blocks.push(
      textBlock({
        id: `${sectionId}-desc-${index + 1}`,
        text: descriptions[index] ?? "",
        desktop: rect(card.x + 16, card.y + 282, card.w - 32, 72, 3),
        mobile: rect(mobileCards[index].x + 12, mobileCards[index].y + 168, mobileCards[index].w - 24, 56, 3),
        style: { fontSize: 16, color: "#475569" }
      })
    );
  });

  return blocks;
}

function textBlock(input: {
  id: string;
  text: string;
  desktop: LegacyCanvasLayoutRect;
  mobile?: LegacyCanvasLayoutRect;
  visible?: boolean;
  style?: z.infer<typeof blockStyleSchema>;
}): LegacyCanvasBlock {
  return {
    id: input.id,
    type: "text",
    visible: input.visible ?? true,
    layout: { desktop: input.desktop, mobile: input.mobile },
    style: input.style ?? {},
    content: { text: input.text }
  };
}

function imageBlock(input: {
  id: string;
  url?: string;
  alt?: string;
  fit?: "cover" | "contain";
  desktop: LegacyCanvasLayoutRect;
  mobile?: LegacyCanvasLayoutRect;
  visible?: boolean;
  style?: z.infer<typeof blockStyleSchema>;
}): LegacyCanvasBlock {
  return {
    id: input.id,
    type: "image",
    visible: input.visible ?? true,
    layout: { desktop: input.desktop, mobile: input.mobile },
    style: input.style ?? { radius: 14 },
    content: { url: input.url, alt: input.alt, fit: input.fit }
  };
}

function buttonBlock(input: {
  id: string;
  label: string;
  action: "whatsapp" | "link";
  href?: string;
  desktop: LegacyCanvasLayoutRect;
  mobile?: LegacyCanvasLayoutRect;
  visible?: boolean;
  style?: z.infer<typeof blockStyleSchema>;
}): LegacyCanvasBlock {
  return {
    id: input.id,
    type: "button",
    visible: input.visible ?? true,
    layout: { desktop: input.desktop, mobile: input.mobile },
    style: input.style ?? {},
    content: {
      label: input.label,
      action: input.action,
      href: input.href
    }
  };
}

function productBlock(input: {
  id: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  desktop: LegacyCanvasLayoutRect;
  mobile?: LegacyCanvasLayoutRect;
  visible?: boolean;
  style?: z.infer<typeof blockStyleSchema>;
}): LegacyCanvasBlock {
  return {
    id: input.id,
    type: "product",
    visible: input.visible ?? true,
    layout: { desktop: input.desktop, mobile: input.mobile },
    style: input.style ?? { bgColor: "#ffffff", radius: 14, borderColor: "#cbd5e1", borderWidth: 1 },
    content: {
      name: input.name,
      description: input.description,
      price: input.price,
      currency: input.currency,
      image_url: input.imageUrl
    }
  };
}

function containerBlock(input: {
  id: string;
  desktop: LegacyCanvasLayoutRect;
  mobile?: LegacyCanvasLayoutRect;
  visible?: boolean;
  style?: z.infer<typeof blockStyleSchema>;
}): LegacyCanvasBlock {
  return {
    id: input.id,
    type: "container",
    visible: input.visible ?? true,
    layout: { desktop: input.desktop, mobile: input.mobile },
    style: input.style ?? {},
    content: {}
  };
}

function rect(x: number, y: number, w: number, h: number, z: number): LegacyCanvasLayoutRect {
  return { x, y, w, h, z };
}

function pickSectionOrder(
  templateOrder: Array<"hero" | "catalog" | "testimonials" | "contact">,
  siteType: "informative" | "commerce_lite"
) {
  const allowed = new Set(
    siteType === "commerce_lite"
      ? (["hero", "catalog", "testimonials", "contact"] as const)
      : (["hero", "testimonials", "contact"] as const)
  );
  const filtered = templateOrder.filter((section) => allowed.has(section));
  const fallback: Array<"hero" | "catalog" | "testimonials" | "contact"> =
    siteType === "commerce_lite" ? ["hero", "catalog", "testimonials", "contact"] : ["hero", "testimonials", "contact"];
  return filtered.length ? filtered : fallback;
}

function normalizeBusinessName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "Tu negocio";
  return normalized.length > 80 ? normalized.slice(0, 80) : normalized;
}

function isDarkColor(color: string) {
  const hex = color.replace("#", "");
  const normalized = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.46;
}

function mixHex(base: string, target: string, weight: number) {
  const safeWeight = Math.max(0, Math.min(1, weight));
  const from = expandHex(base);
  const to = expandHex(target);
  const mixed = [0, 2, 4]
    .map((index) => {
      const start = parseInt(from.slice(index, index + 2), 16);
      const end = parseInt(to.slice(index, index + 2), 16);
      const value = Math.round(start + (end - start) * safeWeight);
      return value.toString(16).padStart(2, "0");
    })
    .join("");
  return `#${mixed}`;
}

function expandHex(color: string) {
  const hex = color.replace("#", "");
  if (hex.length === 3) {
    return hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  return hex.padEnd(6, "0").slice(0, 6);
}

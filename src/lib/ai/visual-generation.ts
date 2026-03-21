import { z } from "zod";

import { buildFallbackSiteSpecV3, buildSiteSpecV3FromBrief, fontFamilies, parseSiteSpecV3, type CanvasBlock, type CanvasLayoutRect, type SiteSectionV3, type SiteSpecV3 } from "@/lib/site-spec-v3";
import type { BusinessBriefDraft } from "@/lib/onboarding/types";
import type { HeaderVariant, TemplateId } from "@/lib/templates/types";
import { getTemplateById } from "@/lib/templates/catalog";

export const visualGenerationStages = [
  "brief_analysis",
  "visual_direction",
  "layout_seed",
  "content_polish",
  "finalizing"
] as const;

export type VisualGenerationStage = (typeof visualGenerationStages)[number];

const blockPatchRectSchema = z.object({
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  w: z.number().min(1).max(100).optional(),
  h: z.number().min(1).max(100).optional(),
  z: z.number().int().min(0).max(999).optional()
});

const themePatchSchema = z.object({
  primary: z.string().optional(),
  secondary: z.string().optional(),
  background: z.string().optional(),
  font_heading: z.string().optional(),
  font_body: z.string().optional(),
  radius: z.enum(["sm", "md", "lg"]).optional()
});

const sectionHeightPatchSchema = z.object({
  desktop: z.number().min(0.2).max(3),
  mobile: z.number().min(0.2).max(3)
});

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
  sectionHeightPatch: z
    .object({
      hero: sectionHeightPatchSchema.optional(),
      catalog: sectionHeightPatchSchema.optional(),
      testimonials: sectionHeightPatchSchema.optional(),
      contact: sectionHeightPatchSchema.optional()
    })
    .partial()
    .optional(),
  blockPatches: z
    .array(
      z.object({
        sectionType: z.enum(["hero", "catalog", "testimonials", "contact"]),
        matchId: z.string().min(1).max(120),
        visible: z.boolean().optional(),
        layout: z
          .object({
            desktop: blockPatchRectSchema.optional(),
            mobile: blockPatchRectSchema.optional()
          })
          .optional(),
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
      })
    )
    .optional()
});

export type DesignPatch = z.infer<typeof designPatchSchema>;

export const visualGenerationProgressSchema = z.object({
  stage: z.enum(visualGenerationStages),
  progressPercent: z.number().min(0).max(100),
  message: z.string().min(1).max(200),
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
  if (input.briefDraft) {
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

  return buildFallbackSiteSpecV3(input.prompt, { templateId: input.templateId });
}

export function applyDesignPatchToSpec(seedSpec: SiteSpecV3, patch?: DesignPatch | null) {
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

  for (const section of home.sections) {
    const ratioPatch = patch.sectionHeightPatch?.[section.type];
    if (ratioPatch) {
      section.height_ratio = {
        desktop: ratioPatch.desktop,
        mobile: ratioPatch.mobile
      };
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

    if (blockPatch.layout?.desktop) {
      block.layout.desktop = mergeRect(block.layout.desktop, blockPatch.layout.desktop);
    }
    if (blockPatch.layout?.mobile) {
      block.layout.mobile = mergeRect(
        block.layout.mobile ?? block.layout.desktop,
        blockPatch.layout.mobile
      );
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
    next.header.links = home.sections
      .filter((section) => section.enabled)
      .map((section) => ({
        label: sectionLabel(section.type),
        href: `#${section.id}`
      }));
  }

  const parsed = parseSiteSpecV3(next);
  return parsed.success ? parsed.data : seedSpec;
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

function applyBlockContentPatch(
  block: CanvasBlock,
  patch: NonNullable<DesignPatch["blockPatches"]>[number]["content"]
) {
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

export function buildHeuristicDesignPatch(input: {
  prompt: string;
  templateId?: TemplateId;
  briefDraft?: BusinessBriefDraft;
}): DesignPatch {
  const prompt = input.prompt.toLowerCase();
  const brief = input.briefDraft;
  const tags = input.templateId ? getTemplateById(input.templateId)?.tags ?? [] : [];
  const darkPremium =
    prompt.includes("premium") ||
    prompt.includes("moda") ||
    prompt.includes("zapato") ||
    prompt.includes("street") ||
    tags.some((tag) => /premium|moda|street|sport|tecnolog/i.test(tag));
  const isCommerce = brief?.business_type === "commerce_lite" || /tienda|vender|producto|catalog/i.test(prompt);
  const stylePreset = brief?.style_preset ?? (darkPremium ? "mono" : "ocean");

  const themePatch =
    stylePreset === "mono"
      ? {
          primary: "#f8fafc",
          secondary: "#f97316",
          background: "#09090b",
          font_heading: "Space Grotesk",
          font_body: "Manrope",
          radius: "sm" as const
        }
      : stylePreset === "sunset"
        ? {
            primary: "#0f172a",
            secondary: "#ea580c",
            background: "#fff7ed",
            font_heading: "Montserrat",
            font_body: "Open Sans",
            radius: "md" as const
          }
        : {
            primary: "#082f49",
            secondary: "#0ea5e9",
            background: "#f4fbff",
            font_heading: "Space Grotesk",
            font_body: "Manrope",
            radius: "md" as const
          };

  const headerVariant: HeaderVariant = darkPremium ? "top-bar" : isCommerce ? "hamburger-overlay" : "none";
  const heroDesktopHeight = darkPremium ? 0.78 : isCommerce ? 0.66 : 0.58;
  const heroMobileHeight = darkPremium ? 1.25 : 1.15;

  const basePatch: DesignPatch = {
    visualDirection: {
      name: darkPremium ? "Editorial de alto contraste" : isCommerce ? "Comercial dinámica" : "Presentación limpia",
      description: darkPremium
        ? "Hero protagonista, contraste alto y navegación visible."
        : isCommerce
          ? "Jerarquía enfocada en conversión y catálogo temprano."
          : "Lectura rápida con bloques aireados y tono confiable.",
      headerVariant
    },
    templateFamily: darkPremium ? "editorial_dark" : isCommerce ? "tech_launch" : "minimal_service",
    themePatch,
    sectionHeightPatch: {
      hero: { desktop: heroDesktopHeight, mobile: heroMobileHeight },
      catalog: { desktop: isCommerce ? 0.68 : 0.48, mobile: isCommerce ? 1.75 : 1.2 },
      testimonials: { desktop: darkPremium ? 0.28 : 0.24, mobile: darkPremium ? 0.82 : 0.72 },
      contact: { desktop: 0.22, mobile: 0.68 }
    },
    blockPatches: [
      {
        sectionType: "hero",
        matchId: "headline",
        layout: {
          desktop: darkPremium ? { x: 6, y: 12, w: 54, h: 22, z: 3 } : { x: 8, y: 14, w: 48, h: 16, z: 3 },
          mobile: darkPremium ? { x: 8, y: 14, w: 82, h: 18, z: 3 } : { x: 8, y: 14, w: 84, h: 16, z: 3 }
        },
        style: {
          fontSize: darkPremium ? 60 : 46,
          fontWeight: 700,
          color: darkPremium ? "#f8fafc" : themePatch.primary,
          textAlign: "left"
        },
        content: {
          text: brief?.business_name || "Tu negocio"
        }
      },
      {
        sectionType: "hero",
        matchId: "subheadline",
        layout: {
          desktop: darkPremium ? { x: 6, y: 40, w: 42, h: 14, z: 3 } : { x: 8, y: 34, w: 50, h: 12, z: 3 },
          mobile: darkPremium ? { x: 8, y: 34, w: 84, h: 14, z: 3 } : { x: 8, y: 32, w: 84, h: 12, z: 3 }
        },
        style: {
          fontSize: darkPremium ? 19 : 17,
          color: darkPremium ? "#d4d4d8" : "#475569",
          textAlign: "left"
        },
        content: {
          text: buildHeroSubtitle(brief)
        }
      },
      {
        sectionType: "hero",
        matchId: "hero-image",
        visible: true,
        layout: {
          desktop: darkPremium ? { x: 56, y: 8, w: 38, h: 78, z: 1 } : { x: 56, y: 18, w: 34, h: 58, z: 1 },
          mobile: darkPremium ? { x: 8, y: 58, w: 84, h: 30, z: 1 } : { x: 10, y: 58, w: 80, h: 24, z: 1 }
        },
        style: {
          radius: darkPremium ? 0 : 18
        },
        content: {
          fit: "cover"
        }
      },
      {
        sectionType: "hero",
        matchId: "hero-bg",
        visible: darkPremium,
        content: {
          fit: "cover"
        }
      },
      {
        sectionType: "hero",
        matchId: "hero-overlay",
        visible: darkPremium,
        style: {
          bgColor: "#09090b",
          opacity: 0.46
        }
      },
      {
        sectionType: "catalog",
        matchId: "title",
        style: {
          fontSize: isCommerce ? 38 : 32,
          fontWeight: 700,
          color: themePatch.primary
        }
      }
    ]
  };

  return basePatch;
}

function buildHeroSubtitle(brief?: BusinessBriefDraft) {
  if (!brief) return "Propuesta clara, visual y lista para convertir.";
  return `${brief.offer_summary} Para ${brief.target_audience.toLowerCase()}.`.slice(0, 220);
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

function sectionLabel(sectionType: SiteSectionV3["type"]) {
  return {
    hero: "Inicio",
    catalog: "Catálogo",
    testimonials: "Testimonios",
    contact: "Contacto"
  }[sectionType];
}

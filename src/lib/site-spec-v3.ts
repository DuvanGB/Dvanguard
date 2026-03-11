import { z } from "zod";

import type { BusinessBriefDraft } from "@/lib/onboarding/types";
import { getTemplateById } from "@/lib/templates/catalog";
import { pickTemplateOrFallback } from "@/lib/templates/selector";
import { templateIds, type TemplateId } from "@/lib/templates/types";

const colorToken = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Color must be a HEX value");

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().url().optional()
);

const canvasRectSchema = z.object({
  x: z.number().min(0).max(3000),
  y: z.number().min(0).max(3000),
  w: z.number().min(40).max(3000),
  h: z.number().min(24).max(3000),
  z: z.number().int().min(0).max(999)
});

const blockLayoutSchema = z.object({
  desktop: canvasRectSchema,
  mobile: canvasRectSchema.optional()
});

export const fontFamilies = [
  "Manrope",
  "Space Grotesk",
  "Inter",
  "Poppins",
  "Montserrat",
  "Lato",
  "Nunito",
  "Source Sans Pro",
  "DM Sans",
  "Oswald",
  "Open Sans"
] as const;

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
    alt: z.string().max(180).optional()
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
  height: z.object({
    desktop: z.number().min(260).max(1800),
    mobile: z.number().min(220).max(2200)
  }),
  blocks: z.array(canvasBlockSchema).min(1).max(120)
});

const pageSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1).max(140),
  sections: z.array(sectionSchema).min(1).max(20)
});

export const siteSpecV3Schema = z.object({
  schema_version: z.literal("3.0"),
  site_type: z.enum(["informative", "commerce_lite"]),
  locale: z.literal("es-LATAM"),
  template: z.object({
    id: z.enum(templateIds),
    family: z.enum(["clean", "bold", "trust", "shop", "social", "dark"])
  }),
  theme: z.object({
    primary: colorToken,
    secondary: colorToken,
    background: colorToken,
    font_heading: z.string().min(1),
    font_body: z.string().min(1),
    radius: z.enum(["sm", "md", "lg"])
  }),
  pages: z.array(pageSchema).min(1),
  integrations: z.object({
    whatsapp: z
      .object({
        enabled: z.boolean(),
        phone: z.string().optional(),
        cta_label: z.string().optional()
      })
      .optional()
  })
});

export type CanvasLayoutRect = z.infer<typeof canvasRectSchema>;
export type CanvasBlock = z.infer<typeof canvasBlockSchema>;
export type SiteSpecV3 = z.infer<typeof siteSpecV3Schema>;
export type SiteSectionV3 = SiteSpecV3["pages"][number]["sections"][number];

export function parseSiteSpecV3(input: unknown) {
  return siteSpecV3Schema.safeParse(input);
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
  sectionPreferences?: BusinessBriefDraft["section_preferences"];
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
  const sectionOrder = pickSectionOrder(template.section_order, input.sectionPreferences);

  const sections = sectionOrder.map((sectionType, index) =>
    buildSection({
      sectionType,
      index,
      businessName,
      offerSummary,
      targetAudience,
      tone,
      ctaLabel,
      templateVariants: template.variants,
      siteType: input.siteType
    })
  );

  return {
    schema_version: "3.0" as const,
    site_type: input.siteType,
    locale: "es-LATAM" as const,
    template: {
      id: template.id,
      family: template.family
    },
    theme: template.theme,
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
        enabled: true,
        phone: input.whatsappPhone,
        cta_label: ctaLabel
      }
    }
  };
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
}): SiteSectionV3 {
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
        buttonBlock({
          id: `${id}-cta`,
          label: input.ctaLabel,
          action: "whatsapp",
          desktop: rect(56, 286, 240, 52, 3),
          mobile: rect(24, 262, 220, 50, 3),
          style: { bgColor: "#0c4a6e", color: "#ffffff", radius: 14, fontWeight: 700, fontSize: 17 }
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

  const blocks: CanvasBlock[] = [];

  cards.forEach((card, index) => {
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

    if (siteType === "commerce_lite") {
      blocks.push(
        textBlock({
          id: `${sectionId}-price-${index + 1}`,
          text: "$",
          desktop: rect(card.x + 16, card.y + 360, 64, 34, 3),
          mobile: rect(mobileCards[index].x + 12, mobileCards[index].y + 222, 60, 28, 3),
          style: { fontSize: 22, fontWeight: 700, color: "#0f172a" }
        })
      );
    }
  });

  return blocks;
}

function textBlock(input: {
  id: string;
  text: string;
  desktop: CanvasLayoutRect;
  mobile?: CanvasLayoutRect;
  visible?: boolean;
  style?: z.infer<typeof blockStyleSchema>;
}): CanvasBlock {
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
  desktop: CanvasLayoutRect;
  mobile?: CanvasLayoutRect;
  visible?: boolean;
  style?: z.infer<typeof blockStyleSchema>;
}): CanvasBlock {
  return {
    id: input.id,
    type: "image",
    visible: input.visible ?? true,
    layout: { desktop: input.desktop, mobile: input.mobile },
    style: input.style ?? { radius: 14 },
    content: { url: input.url, alt: input.alt }
  };
}

function buttonBlock(input: {
  id: string;
  label: string;
  action: "whatsapp" | "link";
  href?: string;
  desktop: CanvasLayoutRect;
  mobile?: CanvasLayoutRect;
  visible?: boolean;
  style?: z.infer<typeof blockStyleSchema>;
}): CanvasBlock {
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

function containerBlock(input: {
  id: string;
  desktop: CanvasLayoutRect;
  mobile?: CanvasLayoutRect;
  visible?: boolean;
  style?: z.infer<typeof blockStyleSchema>;
}): CanvasBlock {
  return {
    id: input.id,
    type: "container",
    visible: input.visible ?? true,
    layout: { desktop: input.desktop, mobile: input.mobile },
    style: input.style ?? {},
    content: {}
  };
}

function rect(x: number, y: number, w: number, h: number, z: number): CanvasLayoutRect {
  return { x, y, w, h, z };
}

function pickSectionOrder(
  templateOrder: Array<"hero" | "catalog" | "testimonials" | "contact">,
  preferences?: BusinessBriefDraft["section_preferences"]
) {
  if (!preferences?.length) return templateOrder;

  const preferredSet = new Set(preferences);
  const filtered = templateOrder.filter((section) => preferredSet.has(section));

  if (!filtered.includes("hero")) filtered.unshift("hero");
  if (!filtered.includes("contact")) filtered.push("contact");

  return filtered;
}

function normalizeBusinessName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "Tu negocio";
  return normalized.length > 80 ? normalized.slice(0, 80) : normalized;
}

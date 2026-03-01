import { z } from "zod";

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

const heroVariantSchema = z.enum(["centered", "split", "image-left"]);
const catalogVariantSchema = z.enum(["grid", "cards", "list"]);
const testimonialsVariantSchema = z.enum(["cards", "minimal", "spotlight"]);
const contactVariantSchema = z.enum(["simple", "highlight", "compact"]);

const catalogItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(300),
  price: z.string().max(60).optional(),
  image_url: optionalUrl
});

const testimonialItemSchema = z.object({
  id: z.string().min(1),
  quote: z.string().min(1).max(300),
  author: z.string().min(1).max(120),
  role: z.string().max(120).optional()
});

const heroSectionSchema = z.object({
  id: z.string().min(1),
  type: z.literal("hero"),
  enabled: z.boolean().default(true),
  variant: heroVariantSchema,
  props: z.object({
    headline: z.string().min(1).max(120),
    subheadline: z.string().min(1).max(240),
    cta_label: z.string().min(1).max(80),
    image_url: optionalUrl
  })
});

const catalogSectionSchema = z.object({
  id: z.string().min(1),
  type: z.literal("catalog"),
  enabled: z.boolean().default(true),
  variant: catalogVariantSchema,
  props: z.object({
    title: z.string().min(1).max(120),
    items: z.array(catalogItemSchema).min(1).max(8)
  })
});

const testimonialsSectionSchema = z.object({
  id: z.string().min(1),
  type: z.literal("testimonials"),
  enabled: z.boolean().default(true),
  variant: testimonialsVariantSchema,
  props: z.object({
    title: z.string().min(1).max(120),
    items: z.array(testimonialItemSchema).min(1).max(6)
  })
});

const contactSectionSchema = z.object({
  id: z.string().min(1),
  type: z.literal("contact"),
  enabled: z.boolean().default(true),
  variant: contactVariantSchema,
  props: z.object({
    title: z.string().min(1).max(120),
    description: z.string().min(1).max(240),
    whatsapp_phone: z.string().optional(),
    whatsapp_label: z.string().optional(),
    address: z.string().optional()
  })
});

export const siteSectionV2Schema = z.discriminatedUnion("type", [
  heroSectionSchema,
  catalogSectionSchema,
  testimonialsSectionSchema,
  contactSectionSchema
]);

const pageV2Schema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  sections: z.array(siteSectionV2Schema).min(1)
});

export const siteSpecV2Schema = z.object({
  schema_version: z.literal("2.0"),
  site_type: z.enum(["informative", "commerce_lite"]),
  locale: z.literal("es-LATAM"),
  template: z.object({
    id: z.enum(templateIds),
    family: z.string().min(1)
  }),
  theme: z.object({
    primary: colorToken,
    secondary: colorToken,
    background: colorToken,
    font_heading: z.string().min(1),
    font_body: z.string().min(1),
    radius: z.enum(["sm", "md", "lg"])
  }),
  pages: z.array(pageV2Schema).min(1),
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

export type SiteSpecV2 = z.infer<typeof siteSpecV2Schema>;
export type SiteSectionV2 = z.infer<typeof siteSectionV2Schema>;

export function parseSiteSpecV2(input: unknown) {
  return siteSpecV2Schema.safeParse(input);
}

export function buildSiteSpecV2FromTemplate(input: {
  siteType: "informative" | "commerce_lite";
  templateId?: TemplateId;
  businessName: string;
  offerSummary?: string;
  targetAudience?: string;
  tone?: string;
  ctaLabel?: string;
  whatsappPhone?: string;
}) {
  const businessName = normalizeBusinessName(input.businessName);
  const templateId = pickTemplateOrFallback({
    templateId: input.templateId,
    siteType: input.siteType
  });
  const template = getTemplateById(templateId);

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const ctaLabel = input.ctaLabel?.trim() || "Hablar por WhatsApp";
  const offerSummary = input.offerSummary?.trim() || `${businessName} ofrece una experiencia clara y confiable.`;
  const targetAudience = input.targetAudience?.trim() || "Personas interesadas en soluciones rápidas y efectivas";
  const tone = input.tone?.trim() || "Claro y cercano";

  const sections = template.section_order.map((sectionType, index) => {
    const sectionId = `${sectionType}-${index + 1}`;

    if (sectionType === "hero") {
      return {
        id: sectionId,
        type: "hero" as const,
        enabled: true,
        variant: template.variants.hero,
        props: {
          headline: businessName,
          subheadline: `${offerSummary} Enfocado en ${targetAudience.toLowerCase()}.`,
          cta_label: ctaLabel,
          image_url: `https://placehold.co/1200x720?text=${encodeURIComponent(businessName)}`
        }
      };
    }

    if (sectionType === "catalog") {
      return {
        id: sectionId,
        type: "catalog" as const,
        enabled: true,
        variant: template.variants.catalog,
        props: {
          title: input.siteType === "commerce_lite" ? "Catálogo destacado" : "Servicios principales",
          items: [
            {
              id: "item-1",
              name: input.siteType === "commerce_lite" ? "Producto estrella" : "Servicio principal",
              description: `${offerSummary}`,
              price: input.siteType === "commerce_lite" ? "$" : undefined,
              image_url: "https://placehold.co/600x400?text=Item+1"
            },
            {
              id: "item-2",
              name: input.siteType === "commerce_lite" ? "Producto recomendado" : "Servicio complementario",
              description: `Ideal para ${targetAudience.toLowerCase()}.`,
              price: input.siteType === "commerce_lite" ? "$" : undefined,
              image_url: "https://placehold.co/600x400?text=Item+2"
            },
            {
              id: "item-3",
              name: input.siteType === "commerce_lite" ? "Producto popular" : "Solución extendida",
              description: `Comunicación ${tone.toLowerCase()} con atención por WhatsApp.`,
              price: input.siteType === "commerce_lite" ? "$" : undefined,
              image_url: "https://placehold.co/600x400?text=Item+3"
            }
          ]
        }
      };
    }

    if (sectionType === "testimonials") {
      return {
        id: sectionId,
        type: "testimonials" as const,
        enabled: true,
        variant: template.variants.testimonials,
        props: {
          title: "Clientes que confían en nosotros",
          items: [
            {
              id: "test-1",
              quote: "La experiencia fue rápida y el resultado superó expectativas.",
              author: "Cliente 1",
              role: "Comprador"
            },
            {
              id: "test-2",
              quote: "Excelente atención y respuesta inmediata por WhatsApp.",
              author: "Cliente 2",
              role: "Emprendedor"
            },
            {
              id: "test-3",
              quote: "Recomiendo este negocio por su claridad y confianza.",
              author: "Cliente 3",
              role: "Usuario"
            }
          ]
        }
      };
    }

    return {
      id: sectionId,
      type: "contact" as const,
      enabled: true,
      variant: template.variants.contact,
      props: {
        title: "Contáctanos",
        description: `Escríbenos y recibe respuesta ${tone.toLowerCase()}.`,
        whatsapp_phone: input.whatsappPhone,
        whatsapp_label: ctaLabel,
        address: ""
      }
    };
  });

  return {
    schema_version: "2.0" as const,
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
  } satisfies SiteSpecV2;
}

function normalizeBusinessName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "Tu negocio";
  return normalized.length > 80 ? normalized.slice(0, 80) : normalized;
}

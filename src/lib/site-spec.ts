import { z } from "zod";

const colorToken = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Color must be a HEX value");

const sectionNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["hero", "catalog", "testimonials", "contact"]),
  enabled: z.boolean().default(true),
  props: z.record(z.string(), z.unknown()).default({})
});

const pageSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  sections: z.array(sectionNodeSchema).min(1)
});

export const siteSpecSchema = z.object({
  schema_version: z.literal("1.0"),
  site_type: z.enum(["informative", "commerce_lite"]),
  locale: z.literal("es-LATAM"),
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

export type SiteSpec = z.infer<typeof siteSpecSchema>;

export function buildFallbackSiteSpec(prompt: string): SiteSpec {
  const brand = extractBusinessName(prompt);

  return {
    schema_version: "1.0",
    site_type: prompt.toLowerCase().includes("catalog") || prompt.toLowerCase().includes("tienda") ? "commerce_lite" : "informative",
    locale: "es-LATAM",
    theme: {
      primary: "#111111",
      secondary: "#1d4ed8",
      background: "#f8fafc",
      font_heading: "Poppins",
      font_body: "Inter",
      radius: "md"
    },
    pages: [
      {
        id: "home",
        slug: "/",
        title: `${brand} | Inicio`,
        sections: [
          {
            id: "hero-main",
            type: "hero",
            enabled: true,
            props: {
              title: `${brand}`,
              subtitle: "La mejor opción para tu negocio.",
              cta_text: "Hablar por WhatsApp"
            }
          },
          {
            id: "catalog-main",
            type: "catalog",
            enabled: true,
            props: {
              title: "Nuestros productos/servicios"
            }
          },
          {
            id: "testimonials-main",
            type: "testimonials",
            enabled: true,
            props: {
              title: "Lo que dicen nuestros clientes"
            }
          },
          {
            id: "contact-main",
            type: "contact",
            enabled: true,
            props: {
              title: "Contáctanos"
            }
          }
        ]
      }
    ],
    integrations: {
      whatsapp: {
        enabled: true,
        cta_label: "Escríbenos por WhatsApp"
      }
    }
  };
}

function extractBusinessName(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) return "Tu Negocio";

  return trimmed.slice(0, 42);
}

export function parseSiteSpec(input: unknown) {
  return siteSpecSchema.safeParse(input);
}

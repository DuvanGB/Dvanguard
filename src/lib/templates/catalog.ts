import type { TemplateDefinition, TemplateId } from "@/lib/templates/types";

export const TEMPLATE_CATALOG: TemplateDefinition[] = [
  {
    id: "starter-clean",
    name: "Starter Clean",
    description: "Diseño limpio para servicios y presentación general.",
    tags: ["Base"],
    family: "clean",
    site_type: "informative",
    preview_label: "Limpio y directo",
    section_order: ["hero", "testimonials", "contact", "catalog"],
    variants: { hero: "centered", catalog: "cards", testimonials: "minimal", contact: "simple" },
    theme: {
      primary: "#0f172a",
      secondary: "#2563eb",
      background: "#f8fafc",
      font_heading: "Poppins",
      font_body: "Inter",
      radius: "md"
    }
  },
  {
    id: "services-bold",
    name: "Services Bold",
    description: "Jerarquía fuerte para propuestas profesionales.",
    tags: ["Servicios"],
    family: "bold",
    site_type: "informative",
    preview_label: "Impacto profesional",
    section_order: ["hero", "catalog", "testimonials", "contact"],
    variants: { hero: "split", catalog: "list", testimonials: "cards", contact: "highlight" },
    theme: {
      primary: "#111827",
      secondary: "#ea580c",
      background: "#fff7ed",
      font_heading: "Montserrat",
      font_body: "Lato",
      radius: "lg"
    }
  },
  {
    id: "local-trust",
    name: "Local Trust",
    description: "Enfocado en confianza para negocios locales.",
    tags: ["Local"],
    family: "trust",
    site_type: "informative",
    preview_label: "Confianza local",
    section_order: ["hero", "testimonials", "catalog", "contact"],
    variants: { hero: "image-left", catalog: "cards", testimonials: "spotlight", contact: "compact" },
    theme: {
      primary: "#14532d",
      secondary: "#16a34a",
      background: "#f0fdf4",
      font_heading: "Nunito",
      font_body: "Source Sans Pro",
      radius: "md"
    }
  },
  {
    id: "shop-quick",
    name: "Shop Quick",
    description: "Catálogo rápido para vender por WhatsApp.",
    tags: ["Comercio"],
    family: "shop",
    site_type: "commerce_lite",
    preview_label: "Venta rápida",
    section_order: ["hero", "catalog", "contact", "testimonials"],
    variants: { hero: "split", catalog: "grid", testimonials: "minimal", contact: "highlight" },
    theme: {
      primary: "#1f2937",
      secondary: "#0ea5e9",
      background: "#f8fafc",
      font_heading: "Poppins",
      font_body: "Inter",
      radius: "md"
    }
  },
  {
    id: "catalog-social",
    name: "Catalog Social",
    description: "Estética social para productos y prueba social.",
    tags: ["Comercio"],
    family: "social",
    site_type: "commerce_lite",
    preview_label: "Social commerce",
    section_order: ["hero", "catalog", "testimonials", "contact"],
    variants: { hero: "centered", catalog: "cards", testimonials: "cards", contact: "simple" },
    theme: {
      primary: "#312e81",
      secondary: "#f97316",
      background: "#eef2ff",
      font_heading: "Manrope",
      font_body: "DM Sans",
      radius: "lg"
    }
  },
  {
    id: "promo-dark",
    name: "Promo Dark",
    description: "Look oscuro para campañas promocionales.",
    tags: ["Moda premium"],
    family: "dark",
    site_type: "commerce_lite",
    preview_label: "Promocional oscuro",
    section_order: ["hero", "catalog", "contact", "testimonials"],
    variants: { hero: "image-left", catalog: "grid", testimonials: "spotlight", contact: "compact" },
    theme: {
      primary: "#f8fafc",
      secondary: "#f43f5e",
      background: "#0f172a",
      font_heading: "Oswald",
      font_body: "Open Sans",
      radius: "sm"
    }
  },
  {
    id: "tech-aurora",
    name: "Tech Aurora",
    description: "Luz y claridad para productos tecnológicos y SaaS.",
    tags: ["Tecnología"],
    family: "clean",
    site_type: "informative",
    preview_label: "Innovación clara",
    section_order: ["hero", "catalog", "testimonials", "contact"],
    variants: { hero: "centered", catalog: "grid", testimonials: "minimal", contact: "simple" },
    theme: {
      primary: "#0f172a",
      secondary: "#06b6d4",
      background: "#f0f9ff",
      font_heading: "Space Grotesk",
      font_body: "Inter",
      radius: "md"
    }
  },
  {
    id: "tech-pulse",
    name: "Tech Pulse",
    description: "Estética digital con energía para startups y apps.",
    tags: ["Tecnología"],
    family: "bold",
    site_type: "informative",
    preview_label: "Pulso digital",
    section_order: ["hero", "catalog", "contact", "testimonials"],
    variants: { hero: "split", catalog: "cards", testimonials: "cards", contact: "highlight" },
    theme: {
      primary: "#0b1120",
      secondary: "#22c55e",
      background: "#ecfeff",
      font_heading: "Montserrat",
      font_body: "Lato",
      radius: "lg"
    }
  },
  {
    id: "health-care",
    name: "Health Care",
    description: "Confianza y cercanía para servicios médicos.",
    tags: ["Salud"],
    family: "trust",
    site_type: "informative",
    preview_label: "Salud confiable",
    section_order: ["hero", "testimonials", "catalog", "contact"],
    variants: { hero: "image-left", catalog: "list", testimonials: "spotlight", contact: "simple" },
    theme: {
      primary: "#14532d",
      secondary: "#16a34a",
      background: "#f0fdf4",
      font_heading: "Nunito",
      font_body: "Source Sans Pro",
      radius: "md"
    }
  },
  {
    id: "health-wellness",
    name: "Health Wellness",
    description: "Minimal y calmado para bienestar y terapias.",
    tags: ["Salud"],
    family: "clean",
    site_type: "informative",
    preview_label: "Bienestar suave",
    section_order: ["hero", "catalog", "testimonials", "contact"],
    variants: { hero: "centered", catalog: "cards", testimonials: "minimal", contact: "compact" },
    theme: {
      primary: "#064e3b",
      secondary: "#22c55e",
      background: "#ecfdf3",
      font_heading: "Manrope",
      font_body: "DM Sans",
      radius: "lg"
    }
  },
  {
    id: "fashion-atelier",
    name: "Fashion Atelier",
    description: "Lujo editorial para marcas premium.",
    tags: ["Moda premium"],
    family: "dark",
    site_type: "commerce_lite",
    preview_label: "Editorial premium",
    section_order: ["hero", "catalog", "contact", "testimonials"],
    variants: { hero: "split", catalog: "grid", testimonials: "minimal", contact: "highlight" },
    theme: {
      primary: "#f8fafc",
      secondary: "#eab308",
      background: "#0b0f1a",
      font_heading: "Oswald",
      font_body: "DM Sans",
      radius: "md"
    }
  },
  {
    id: "fashion-street",
    name: "Fashion Street",
    description: "Urbano y energético para colecciones modernas.",
    tags: ["Moda premium"],
    family: "bold",
    site_type: "commerce_lite",
    preview_label: "Street premium",
    section_order: ["hero", "catalog", "testimonials", "contact"],
    variants: { hero: "centered", catalog: "cards", testimonials: "cards", contact: "simple" },
    theme: {
      primary: "#0f172a",
      secondary: "#ef4444",
      background: "#fff7ed",
      font_heading: "Montserrat",
      font_body: "Inter",
      radius: "lg"
    }
  },
  {
    id: "tech-commerce",
    name: "Tech Commerce",
    description: "Comercio tecnológico con estética limpia.",
    tags: ["Tecnología"],
    family: "shop",
    site_type: "commerce_lite",
    preview_label: "Tech commerce",
    section_order: ["hero", "catalog", "contact", "testimonials"],
    variants: { hero: "split", catalog: "grid", testimonials: "minimal", contact: "simple" },
    theme: {
      primary: "#111827",
      secondary: "#38bdf8",
      background: "#f1f5f9",
      font_heading: "Poppins",
      font_body: "Inter",
      radius: "md"
    }
  },
  {
    id: "health-commerce",
    name: "Health Commerce",
    description: "Venta de salud y bienestar con enfoque confiable.",
    tags: ["Salud"],
    family: "trust",
    site_type: "commerce_lite",
    preview_label: "Salud comercio",
    section_order: ["hero", "catalog", "contact", "testimonials"],
    variants: { hero: "image-left", catalog: "cards", testimonials: "spotlight", contact: "compact" },
    theme: {
      primary: "#14532d",
      secondary: "#16a34a",
      background: "#f0fdf4",
      font_heading: "Nunito",
      font_body: "Source Sans Pro",
      radius: "md"
    }
  }
];

const TEMPLATE_MAP = new Map(TEMPLATE_CATALOG.map((template) => [template.id, template]));

export function getTemplateById(templateId: TemplateId) {
  return TEMPLATE_MAP.get(templateId) ?? null;
}

export function getTemplatesBySiteType(siteType: "informative" | "commerce_lite") {
  return TEMPLATE_CATALOG.filter((template) => template.site_type === siteType);
}

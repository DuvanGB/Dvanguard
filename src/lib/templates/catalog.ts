import type {
  HeaderVariant,
  TemplateDefinition,
  TemplateId,
  TemplateLayoutBlueprint,
  TemplateSectionBlueprint,
  TemplateBlockBlueprint,
  TemplateLayoutRect
} from "@/lib/templates/types";

function rect(x: number, y: number, w: number, h: number, z: number): TemplateLayoutRect {
  return { x, y, w, h, z };
}

function textBlock(id: string, desktop: TemplateLayoutRect, mobile: TemplateLayoutRect, style?: TemplateBlockBlueprint["style"]): TemplateBlockBlueprint {
  return { id, type: "text", layout: { desktop, mobile }, style };
}

function imageBlock(
  id: string,
  desktop: TemplateLayoutRect,
  mobile: TemplateLayoutRect,
  style?: TemplateBlockBlueprint["style"],
  content?: TemplateBlockBlueprint["content"]
): TemplateBlockBlueprint {
  return { id, type: "image", layout: { desktop, mobile }, style, content };
}

function buttonBlock(
  id: string,
  desktop: TemplateLayoutRect,
  mobile: TemplateLayoutRect,
  style?: TemplateBlockBlueprint["style"],
  content?: TemplateBlockBlueprint["content"]
): TemplateBlockBlueprint {
  return { id, type: "button", layout: { desktop, mobile }, style, content };
}

function productBlock(id: string, desktop: TemplateLayoutRect, mobile: TemplateLayoutRect, style?: TemplateBlockBlueprint["style"]): TemplateBlockBlueprint {
  return { id, type: "product", layout: { desktop, mobile }, style };
}

function containerBlock(id: string, desktop: TemplateLayoutRect, mobile: TemplateLayoutRect, style?: TemplateBlockBlueprint["style"]): TemplateBlockBlueprint {
  return { id, type: "container", layout: { desktop, mobile }, style };
}

function shapeBlock(id: string, desktop: TemplateLayoutRect, mobile: TemplateLayoutRect, style?: TemplateBlockBlueprint["style"], shape?: "rect" | "pill" | "circle"): TemplateBlockBlueprint {
  return { id, type: "shape", layout: { desktop, mobile }, style, content: shape ? { shape } : undefined };
}

function heroFullBleed(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.5, mobile: 1.35 },
    blocks: [
      imageBlock("hero-bg", rect(0, 0, 100, 100, 1), rect(0, 0, 100, 100, 1), undefined, { fit: "cover" }),
      shapeBlock("hero-overlay", rect(0, 0, 100, 100, 2), rect(0, 0, 100, 100, 2), { bgColor: "#0f172a", opacity: 0.45 }, "rect"),
      textBlock("headline", rect(6, 16, 60, 18, 3), rect(8, 16, 84, 18, 3), { fontSize: 56, fontWeight: 700, color: "#ffffff" }),
      textBlock("subheadline", rect(6, 36, 56, 16, 3), rect(8, 34, 84, 16, 3), { fontSize: 20, color: "#e2e8f0" })
    ]
  };
}

function heroSplitLeft(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.48, mobile: 1.3 },
    blocks: [
      textBlock("headline", rect(6, 16, 46, 18, 3), rect(8, 14, 84, 18, 3), { fontSize: 48, fontWeight: 700 }),
      textBlock("subheadline", rect(6, 36, 42, 16, 3), rect(8, 32, 84, 16, 3), { fontSize: 18, color: "#475569" }),
      imageBlock("hero-image", rect(56, 12, 38, 76, 1), rect(8, 64, 84, 28, 1), { radius: 18 }, { fit: "cover" })
    ]
  };
}

function heroSplitRight(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.48, mobile: 1.3 },
    blocks: [
      imageBlock("hero-image", rect(6, 12, 40, 76, 1), rect(8, 60, 84, 30, 1), { radius: 18 }, { fit: "cover" }),
      textBlock("headline", rect(52, 18, 42, 18, 3), rect(8, 14, 84, 18, 3), { fontSize: 48, fontWeight: 700 }),
      textBlock("subheadline", rect(52, 38, 40, 16, 3), rect(8, 32, 84, 16, 3), { fontSize: 18, color: "#475569" })
    ]
  };
}

function heroCentered(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.5, mobile: 1.3 },
    blocks: [
      textBlock("headline", rect(18, 12, 64, 18, 3), rect(8, 14, 84, 18, 3), { fontSize: 50, fontWeight: 700, textAlign: "center" }),
      textBlock("subheadline", rect(18, 32, 64, 16, 3), rect(8, 32, 84, 16, 3), { fontSize: 18, color: "#475569", textAlign: "center" }),
      imageBlock("hero-image", rect(18, 66, 64, 28, 1), rect(8, 66, 84, 26, 1), { radius: 18 }, { fit: "cover" })
    ]
  };
}

function heroEditorial(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.55, mobile: 1.35 },
    blocks: [
      imageBlock("hero-image", rect(52, 0, 48, 100, 1), rect(0, 0, 100, 52, 1), { radius: 0 }, { fit: "cover" }),
      textBlock("headline", rect(6, 22, 42, 24, 3), rect(8, 58, 84, 18, 3), { fontSize: 56, fontWeight: 700 }),
      textBlock("subheadline", rect(6, 52, 40, 14, 3), rect(8, 76, 84, 12, 3), { fontSize: 18, color: "#475569" })
    ]
  };
}

function catalogCommerceGrid(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.58, mobile: 2.0 },
    blocks: [
      textBlock("title", rect(6, 6, 60, 10, 2), rect(8, 4, 84, 10, 2), { fontSize: 34, fontWeight: 700 }),
      productBlock("product-1", rect(6, 20, 28, 68, 1), rect(8, 18, 84, 24, 1)),
      productBlock("product-2", rect(36, 20, 28, 68, 1), rect(8, 46, 84, 24, 1)),
      productBlock("product-3", rect(66, 20, 28, 68, 1), rect(8, 74, 84, 24, 1))
    ]
  };
}

function catalogCommerceMosaic(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.6, mobile: 2.05 },
    blocks: [
      textBlock("title", rect(6, 6, 60, 10, 2), rect(8, 4, 84, 10, 2), { fontSize: 34, fontWeight: 700 }),
      productBlock("product-1", rect(6, 20, 40, 70, 1), rect(8, 18, 84, 24, 1)),
      productBlock("product-2", rect(50, 20, 44, 32, 1), rect(8, 46, 84, 24, 1)),
      productBlock("product-3", rect(50, 56, 44, 34, 1), rect(8, 74, 84, 24, 1))
    ]
  };
}

function catalogCommerceList(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.56, mobile: 1.8 },
    blocks: [
      textBlock("title", rect(6, 6, 60, 10, 2), rect(8, 4, 84, 10, 2), { fontSize: 34, fontWeight: 700 }),
      productBlock("product-1", rect(6, 22, 88, 18, 1), rect(8, 18, 84, 24, 1)),
      productBlock("product-2", rect(6, 44, 88, 18, 1), rect(8, 46, 84, 24, 1)),
      productBlock("product-3", rect(6, 66, 88, 18, 1), rect(8, 74, 84, 24, 1))
    ]
  };
}

function catalogInfoCards(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.56, mobile: 1.7 },
    blocks: [
      textBlock("title", rect(6, 6, 60, 10, 2), rect(8, 4, 84, 10, 2), { fontSize: 34, fontWeight: 700 }),
      containerBlock("card-1", rect(6, 20, 28, 68, 1), rect(8, 18, 84, 24, 1), { bgColor: "#ffffff", radius: 16, borderColor: "#cbd5e1", borderWidth: 1 }),
      imageBlock("image-1", rect(8, 22, 24, 26, 2), rect(12, 20, 76, 12, 2), { radius: 12 }, { fit: "cover" }),
      textBlock("name-1", rect(8, 50, 24, 8, 3), rect(12, 34, 76, 6, 3), { fontSize: 20, fontWeight: 700 }),
      textBlock("desc-1", rect(8, 60, 24, 12, 3), rect(12, 42, 76, 8, 3), { fontSize: 15, color: "#475569" }),
      containerBlock("card-2", rect(36, 20, 28, 68, 1), rect(8, 46, 84, 24, 1), { bgColor: "#ffffff", radius: 16, borderColor: "#cbd5e1", borderWidth: 1 }),
      imageBlock("image-2", rect(38, 22, 24, 26, 2), rect(12, 48, 76, 12, 2), { radius: 12 }, { fit: "cover" }),
      textBlock("name-2", rect(38, 50, 24, 8, 3), rect(12, 62, 76, 6, 3), { fontSize: 20, fontWeight: 700 }),
      textBlock("desc-2", rect(38, 60, 24, 12, 3), rect(12, 70, 76, 8, 3), { fontSize: 15, color: "#475569" }),
      containerBlock("card-3", rect(66, 20, 28, 68, 1), rect(8, 74, 84, 24, 1), { bgColor: "#ffffff", radius: 16, borderColor: "#cbd5e1", borderWidth: 1 }),
      imageBlock("image-3", rect(68, 22, 24, 26, 2), rect(12, 76, 76, 12, 2), { radius: 12 }, { fit: "cover" }),
      textBlock("name-3", rect(68, 50, 24, 8, 3), rect(12, 90, 76, 6, 3), { fontSize: 20, fontWeight: 700 }),
      textBlock("desc-3", rect(68, 60, 24, 12, 3), rect(12, 94, 76, 6, 3), { fontSize: 15, color: "#475569" })
    ]
  };
}

function catalogInfoList(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.5, mobile: 1.4 },
    blocks: [
      textBlock("title", rect(6, 6, 60, 10, 2), rect(8, 4, 84, 10, 2), { fontSize: 34, fontWeight: 700 }),
      containerBlock("card-1", rect(6, 22, 88, 16, 1), rect(8, 18, 84, 18, 1), { bgColor: "#ffffff", radius: 16, borderColor: "#cbd5e1", borderWidth: 1 }),
      textBlock("name-1", rect(10, 25, 40, 6, 2), rect(12, 20, 70, 6, 2), { fontSize: 18, fontWeight: 700 }),
      textBlock("desc-1", rect(10, 31, 70, 5, 2), rect(12, 26, 70, 6, 2), { fontSize: 14, color: "#475569" }),
      containerBlock("card-2", rect(6, 42, 88, 16, 1), rect(8, 40, 84, 18, 1), { bgColor: "#ffffff", radius: 16, borderColor: "#cbd5e1", borderWidth: 1 }),
      textBlock("name-2", rect(10, 45, 40, 6, 2), rect(12, 42, 70, 6, 2), { fontSize: 18, fontWeight: 700 }),
      textBlock("desc-2", rect(10, 51, 70, 5, 2), rect(12, 48, 70, 6, 2), { fontSize: 14, color: "#475569" }),
      containerBlock("card-3", rect(6, 62, 88, 16, 1), rect(8, 62, 84, 18, 1), { bgColor: "#ffffff", radius: 16, borderColor: "#cbd5e1", borderWidth: 1 }),
      textBlock("name-3", rect(10, 65, 40, 6, 2), rect(12, 64, 70, 6, 2), { fontSize: 18, fontWeight: 700 }),
      textBlock("desc-3", rect(10, 71, 70, 5, 2), rect(12, 70, 70, 6, 2), { fontSize: 14, color: "#475569" })
    ]
  };
}

function testimonialsCards(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.32, mobile: 1.05 },
    blocks: [
      textBlock("title", rect(6, 6, 70, 12, 2), rect(8, 4, 84, 10, 2), { fontSize: 32, fontWeight: 700 }),
      textBlock("quote-1", rect(6, 26, 28, 20, 2), rect(8, 18, 84, 20, 2), { bgColor: "#ffffff", radius: 14, borderColor: "#cbd5e1", borderWidth: 1, fontSize: 16 }),
      textBlock("quote-2", rect(36, 26, 28, 20, 2), rect(8, 42, 84, 20, 2), { bgColor: "#ffffff", radius: 14, borderColor: "#cbd5e1", borderWidth: 1, fontSize: 16 }),
      textBlock("quote-3", rect(66, 26, 28, 20, 2), rect(8, 66, 84, 20, 2), { bgColor: "#ffffff", radius: 14, borderColor: "#cbd5e1", borderWidth: 1, fontSize: 16 })
    ]
  };
}

function testimonialsMinimal(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.26, mobile: 0.85 },
    blocks: [
      textBlock("title", rect(6, 12, 70, 14, 2), rect(8, 8, 84, 12, 2), { fontSize: 30, fontWeight: 700 }),
      textBlock("quote-1", rect(6, 36, 60, 24, 2), rect(8, 28, 84, 26, 2), { fontSize: 18, color: "#475569" })
    ]
  };
}

function testimonialsSpotlight(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.34, mobile: 1.15 },
    blocks: [
      textBlock("title", rect(6, 6, 70, 12, 2), rect(8, 4, 84, 10, 2), { fontSize: 32, fontWeight: 700 }),
      textBlock("quote-1", rect(6, 26, 44, 34, 2), rect(8, 18, 84, 24, 2), { bgColor: "#ffffff", radius: 16, borderColor: "#cbd5e1", borderWidth: 1, fontSize: 17 }),
      textBlock("quote-2", rect(54, 26, 40, 16, 2), rect(8, 46, 84, 20, 2), { bgColor: "#ffffff", radius: 16, borderColor: "#cbd5e1", borderWidth: 1, fontSize: 16 }),
      textBlock("quote-3", rect(54, 46, 40, 16, 2), rect(8, 70, 84, 20, 2), { bgColor: "#ffffff", radius: 16, borderColor: "#cbd5e1", borderWidth: 1, fontSize: 16 })
    ]
  };
}

function contactSimple(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.22, mobile: 0.75 },
    blocks: [
      textBlock("title", rect(6, 16, 40, 14, 2), rect(8, 10, 84, 12, 2), { fontSize: 32, fontWeight: 700 }),
      textBlock("description", rect(6, 34, 50, 14, 2), rect(8, 26, 84, 14, 2), { fontSize: 18, color: "#475569" }),
      buttonBlock("cta", rect(6, 58, 22, 12, 3), rect(8, 50, 50, 12, 3), { bgColor: "#0c4a6e", color: "#ffffff", radius: 120, fontWeight: 700 })
    ]
  };
}

function contactHighlight(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.26, mobile: 0.85 },
    blocks: [
      shapeBlock("card-bg", rect(6, 16, 88, 62, 1), rect(8, 12, 84, 70, 1), { bgColor: "#ffffff", radius: 22, borderColor: "#cbd5e1", borderWidth: 1 }),
      textBlock("title", rect(12, 26, 40, 14, 2), rect(12, 20, 76, 12, 2), { fontSize: 30, fontWeight: 700 }),
      textBlock("description", rect(12, 44, 50, 14, 2), rect(12, 36, 76, 12, 2), { fontSize: 17, color: "#475569" }),
      buttonBlock("cta", rect(12, 60, 22, 12, 3), rect(12, 54, 50, 12, 3), { bgColor: "#0c4a6e", color: "#ffffff", radius: 120, fontWeight: 700 })
    ]
  };
}

function contactCompact(): TemplateSectionBlueprint {
  return {
    height_ratio: { desktop: 0.2, mobile: 0.7 },
    blocks: [
      textBlock("title", rect(6, 20, 40, 14, 2), rect(8, 18, 84, 12, 2), { fontSize: 28, fontWeight: 700 }),
      buttonBlock("cta", rect(6, 46, 22, 12, 3), rect(8, 40, 50, 12, 3), { bgColor: "#0c4a6e", color: "#ffffff", radius: 120, fontWeight: 700 })
    ]
  };
}

function buildBlueprint(input: {
  hero: TemplateSectionBlueprint;
  catalog: TemplateSectionBlueprint;
  testimonials: TemplateSectionBlueprint;
  contact: TemplateSectionBlueprint;
}): TemplateLayoutBlueprint {
  return input;
}

export const TEMPLATE_CATALOG: TemplateDefinition[] = [
  {
    id: "starter-clean",
    name: "Starter Clean",
    description: "Diseño limpio para servicios y presentación general.",
    tags: ["Base"],
    family: "clean",
    site_type: "informative",
    preview_label: "Limpio y directo",
    default_header_variant: "top-bar",
    layout_blueprint: buildBlueprint({
      hero: heroCentered(),
      catalog: catalogInfoCards(),
      testimonials: testimonialsMinimal(),
      contact: contactSimple()
    }),
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
    default_header_variant: "hamburger-side",
    layout_blueprint: buildBlueprint({
      hero: heroSplitRight(),
      catalog: catalogInfoList(),
      testimonials: testimonialsCards(),
      contact: contactHighlight()
    }),
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
    default_header_variant: "top-bar",
    layout_blueprint: buildBlueprint({
      hero: heroSplitLeft(),
      catalog: catalogInfoCards(),
      testimonials: testimonialsSpotlight(),
      contact: contactCompact()
    }),
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
    default_header_variant: "hamburger-side",
    layout_blueprint: buildBlueprint({
      hero: heroSplitLeft(),
      catalog: catalogCommerceGrid(),
      testimonials: testimonialsMinimal(),
      contact: contactHighlight()
    }),
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
    default_header_variant: "hamburger-overlay",
    layout_blueprint: buildBlueprint({
      hero: heroCentered(),
      catalog: catalogCommerceMosaic(),
      testimonials: testimonialsCards(),
      contact: contactSimple()
    }),
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
    default_header_variant: "hamburger-overlay",
    layout_blueprint: buildBlueprint({
      hero: heroFullBleed(),
      catalog: catalogCommerceList(),
      testimonials: testimonialsSpotlight(),
      contact: contactCompact()
    }),
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
    default_header_variant: "top-bar",
    layout_blueprint: buildBlueprint({
      hero: heroFullBleed(),
      catalog: catalogInfoCards(),
      testimonials: testimonialsMinimal(),
      contact: contactSimple()
    }),
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
    default_header_variant: "hamburger-side",
    layout_blueprint: buildBlueprint({
      hero: heroSplitRight(),
      catalog: catalogInfoCards(),
      testimonials: testimonialsCards(),
      contact: contactHighlight()
    }),
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
    default_header_variant: "top-bar",
    layout_blueprint: buildBlueprint({
      hero: heroSplitLeft(),
      catalog: catalogInfoList(),
      testimonials: testimonialsSpotlight(),
      contact: contactSimple()
    }),
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
    default_header_variant: "top-bar",
    layout_blueprint: buildBlueprint({
      hero: heroCentered(),
      catalog: catalogInfoList(),
      testimonials: testimonialsMinimal(),
      contact: contactCompact()
    }),
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
    default_header_variant: "hamburger-overlay",
    layout_blueprint: buildBlueprint({
      hero: heroEditorial(),
      catalog: catalogCommerceMosaic(),
      testimonials: testimonialsMinimal(),
      contact: contactCompact()
    }),
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
    default_header_variant: "hamburger-side",
    layout_blueprint: buildBlueprint({
      hero: heroSplitRight(),
      catalog: catalogCommerceGrid(),
      testimonials: testimonialsCards(),
      contact: contactHighlight()
    }),
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
    default_header_variant: "hamburger-overlay",
    layout_blueprint: buildBlueprint({
      hero: heroFullBleed(),
      catalog: catalogCommerceGrid(),
      testimonials: testimonialsMinimal(),
      contact: contactSimple()
    }),
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
    default_header_variant: "top-bar",
    layout_blueprint: buildBlueprint({
      hero: heroCentered(),
      catalog: catalogCommerceList(),
      testimonials: testimonialsMinimal(),
      contact: contactSimple()
    }),
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

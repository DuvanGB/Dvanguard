export const templateIds = [
  "starter-clean",
  "services-bold",
  "local-trust",
  "shop-quick",
  "catalog-social",
  "promo-dark",
  "tech-aurora",
  "tech-pulse",
  "health-care",
  "health-wellness",
  "fashion-atelier",
  "fashion-street",
  "tech-commerce",
  "health-commerce"
] as const;

export type TemplateId = (typeof templateIds)[number];

export type TemplateSiteType = "informative" | "commerce_lite";

export type HeaderVariant = "none" | "hamburger-side" | "hamburger-overlay" | "top-bar";

export type TemplateLayoutRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

export type TemplateBlockStyle = {
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  color?: string;
  bgColor?: string;
  radius?: number;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
  textAlign?: "left" | "center" | "right";
};

export type TemplateBlockBlueprint = {
  id: string;
  type: "text" | "image" | "button" | "product" | "shape" | "container";
  layout: {
    desktop: TemplateLayoutRect;
    mobile?: TemplateLayoutRect;
  };
  style?: TemplateBlockStyle;
  content?: {
    text?: string;
    label?: string;
    action?: "whatsapp" | "link";
    href?: string;
    url?: string;
    alt?: string;
    fit?: "cover" | "contain";
    name?: string;
    price?: number | string;
    currency?: string;
    image_url?: string;
    description?: string;
    shape?: "rect" | "pill" | "circle";
    title?: string;
  };
};

export type TemplateSectionBlueprint = {
  height_ratio: { desktop: number; mobile: number };
  blocks: TemplateBlockBlueprint[];
};

export type TemplateLayoutBlueprint = {
  hero: TemplateSectionBlueprint;
  catalog: TemplateSectionBlueprint;
  testimonials: TemplateSectionBlueprint;
  contact: TemplateSectionBlueprint;
};

export type HeroVariant = "centered" | "split" | "image-left";
export type CatalogVariant = "grid" | "cards" | "list";
export type TestimonialsVariant = "cards" | "minimal" | "spotlight";
export type ContactVariant = "simple" | "highlight" | "compact";

export type TemplateSectionVariants = {
  hero: HeroVariant;
  catalog: CatalogVariant;
  testimonials: TestimonialsVariant;
  contact: ContactVariant;
};

export type TemplateTheme = {
  primary: string;
  secondary: string;
  background: string;
  font_heading: string;
  font_body: string;
  radius: "sm" | "md" | "lg";
};

export type TemplateDefinition = {
  id: TemplateId;
  name: string;
  description: string;
  tags: string[];
  family: "clean" | "bold" | "trust" | "shop" | "social" | "dark";
  site_type: TemplateSiteType;
  preview_label: string;
  default_header_variant: HeaderVariant;
  section_order: Array<"hero" | "catalog" | "testimonials" | "contact">;
  variants: TemplateSectionVariants;
  theme: TemplateTheme;
  layout_blueprint: TemplateLayoutBlueprint;
};

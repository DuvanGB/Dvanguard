export const templateIds = [
  "starter-clean",
  "services-bold",
  "local-trust",
  "shop-quick",
  "catalog-social",
  "promo-dark"
] as const;

export type TemplateId = (typeof templateIds)[number];

export type TemplateSiteType = "informative" | "commerce_lite";

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
  family: "clean" | "bold" | "trust" | "shop" | "social" | "dark";
  site_type: TemplateSiteType;
  preview_label: string;
  section_order: Array<"hero" | "catalog" | "testimonials" | "contact">;
  variants: TemplateSectionVariants;
  theme: TemplateTheme;
};

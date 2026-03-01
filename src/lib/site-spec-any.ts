import { buildFallbackSiteSpec, parseSiteSpec, type SiteSpec } from "@/lib/site-spec";
import {
  buildSiteSpecV2FromTemplate,
  parseSiteSpecV2,
  type SiteSpecV2
} from "@/lib/site-spec-v2";
import { getTemplateById } from "@/lib/templates/catalog";
import { pickTemplateOrFallback } from "@/lib/templates/selector";
import type { TemplateId } from "@/lib/templates/types";

export type AnySiteSpec = SiteSpecV2;

export function parseAnySiteSpec(input: unknown, options?: { preferredTemplateId?: TemplateId | null }) {
  const parsedV2 = parseSiteSpecV2(input);
  if (parsedV2.success) {
    return {
      success: true as const,
      data: parsedV2.data,
      sourceVersion: "2.0" as const,
      migrated: false
    };
  }

  const parsedV1 = parseSiteSpec(input);
  if (parsedV1.success) {
    return {
      success: true as const,
      data: migrateV1SpecToV2(parsedV1.data, options),
      sourceVersion: "1.0" as const,
      migrated: true
    };
  }

  return {
    success: false as const,
    error: {
      v1: parsedV1.error,
      v2: parsedV2.error
    }
  };
}

export function migrateV1SpecToV2(spec: SiteSpec, options?: { preferredTemplateId?: TemplateId | null }) {
  const page = spec.pages.find((item) => item.slug === "/") ?? spec.pages[0];

  const hero = page?.sections.find((section) => section.type === "hero");
  const catalog = page?.sections.find((section) => section.type === "catalog");
  const testimonials = page?.sections.find((section) => section.type === "testimonials");
  const contact = page?.sections.find((section) => section.type === "contact");

  const businessName = String(hero?.props?.title ?? page?.title ?? "Tu negocio");
  const offerSummary = String(hero?.props?.subtitle ?? "Presentación de valor del negocio.");
  const ctaLabel = String(hero?.props?.cta_text ?? contact?.props?.cta_label ?? "Hablar por WhatsApp");

  const templateId = inferTemplateForV1(spec, options?.preferredTemplateId ?? undefined);

  const base = buildSiteSpecV2FromTemplate({
    siteType: spec.site_type,
    templateId,
    businessName,
    offerSummary,
    ctaLabel,
    whatsappPhone: spec.integrations.whatsapp?.phone
  });

  const homepage = base.pages[0];

  if (hero) {
    const heroSection = homepage.sections.find((section) => section.type === "hero");
    if (heroSection && heroSection.type === "hero") {
      heroSection.enabled = hero.enabled;
      heroSection.props.headline = String(hero.props.title ?? heroSection.props.headline);
      heroSection.props.subheadline = String(hero.props.subtitle ?? heroSection.props.subheadline);
      heroSection.props.cta_label = String(hero.props.cta_text ?? heroSection.props.cta_label);
      const imageUrl = hero.props.image_url;
      if (typeof imageUrl === "string" && /^https?:\/\//.test(imageUrl)) {
        heroSection.props.image_url = imageUrl;
      }
    }
  }

  if (catalog) {
    const catalogSection = homepage.sections.find((section) => section.type === "catalog");
    if (catalogSection && catalogSection.type === "catalog") {
      catalogSection.enabled = catalog.enabled;
      catalogSection.props.title = String(catalog.props.title ?? catalogSection.props.title);
    }
  }

  if (testimonials) {
    const testimonialsSection = homepage.sections.find((section) => section.type === "testimonials");
    if (testimonialsSection && testimonialsSection.type === "testimonials") {
      testimonialsSection.enabled = testimonials.enabled;
      testimonialsSection.props.title = String(testimonials.props.title ?? testimonialsSection.props.title);
    }
  }

  if (contact) {
    const contactSection = homepage.sections.find((section) => section.type === "contact");
    if (contactSection && contactSection.type === "contact") {
      contactSection.enabled = contact.enabled;
      contactSection.props.title = String(contact.props.title ?? contactSection.props.title);
      contactSection.props.description = String(contact.props.description ?? "Contáctanos para más información.");
      contactSection.props.whatsapp_phone = spec.integrations.whatsapp?.phone;
      contactSection.props.whatsapp_label = spec.integrations.whatsapp?.cta_label ?? ctaLabel;
    }
  }

  return {
    ...base,
    theme: {
      ...base.theme,
      primary: spec.theme.primary,
      secondary: spec.theme.secondary,
      background: spec.theme.background,
      font_heading: spec.theme.font_heading,
      font_body: spec.theme.font_body,
      radius: spec.theme.radius
    },
    integrations: {
      whatsapp: {
        enabled: spec.integrations.whatsapp?.enabled ?? true,
        phone: spec.integrations.whatsapp?.phone,
        cta_label: spec.integrations.whatsapp?.cta_label ?? ctaLabel
      }
    }
  } satisfies SiteSpecV2;
}

export function buildFallbackSiteSpecV2(prompt: string, options?: { templateId?: TemplateId; siteType?: "informative" | "commerce_lite" }) {
  const fallbackV1 = buildFallbackSiteSpec(prompt);
  const migrated = migrateV1SpecToV2(fallbackV1, { preferredTemplateId: options?.templateId });

  if (options?.siteType && migrated.site_type !== options.siteType) {
    return {
      ...buildSiteSpecV2FromTemplate({
        siteType: options.siteType,
        templateId: options.templateId,
        businessName: prompt.slice(0, 80),
        offerSummary: prompt,
        ctaLabel: "Hablar por WhatsApp"
      })
    };
  }

  return migrated;
}

function inferTemplateForV1(spec: SiteSpec, preferredTemplateId?: TemplateId) {
  if (preferredTemplateId && getTemplateById(preferredTemplateId)) {
    return preferredTemplateId;
  }

  const isDark = spec.theme.background.toLowerCase() === "#0f172a" || spec.theme.background.toLowerCase() === "#111111";
  if (isDark && spec.site_type === "commerce_lite") {
    return "promo-dark" as const;
  }

  return pickTemplateOrFallback({
    siteType: spec.site_type,
    templateId: undefined
  });
}

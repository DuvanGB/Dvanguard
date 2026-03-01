import type { AnySiteSpec } from "@/lib/site-spec-any";
import { parseAnySiteSpec } from "@/lib/site-spec-any";
import { buildSiteSpecV2FromTemplate } from "@/lib/site-spec-v2";
import type { SiteSectionV2 } from "@/lib/site-spec-v2";
import { CatalogSection, ContactSection, HeroSection, TestimonialsSection } from "@/components/runtime/sections";

type Props = {
  spec: AnySiteSpec | unknown;
};

export function SiteRenderer({ spec }: Props) {
  const parsed = parseAnySiteSpec(spec);
  const normalized = parsed.success
    ? parsed.data
    : buildSiteSpecV2FromTemplate({
        siteType: "informative",
        businessName: "Tu negocio"
      });

  const homepage = normalized.pages.find((page) => page.slug === "/") ?? normalized.pages[0] ?? null;
  const whatsapp = normalized.integrations.whatsapp;
  const contactSection = (homepage?.sections ?? []).find(
    (section): section is Extract<SiteSectionV2, { type: "contact" }> => section.type === "contact"
  );
  const phone = contactSection?.props.whatsapp_phone;
  const whatsappPhone = whatsapp?.phone ?? phone;
  const whatsappLink = whatsapp?.enabled && whatsappPhone ? `https://wa.me/${whatsappPhone}` : undefined;

  return (
    <main
      style={{
        background: normalized.theme.background,
        color: normalized.theme.primary,
        minHeight: "100vh",
        fontFamily: normalized.theme.font_body
      }}
    >
      {(homepage?.sections ?? [])
        .filter((section) => section.enabled)
        .map((section) => {
          if (section.type === "hero") {
            return <HeroSection key={section.id} section={section} whatsappLink={whatsappLink} theme={normalized.theme} />;
          }

          if (section.type === "catalog") {
            return <CatalogSection key={section.id} section={section} whatsappLink={whatsappLink} theme={normalized.theme} />;
          }

          if (section.type === "testimonials") {
            return <TestimonialsSection key={section.id} section={section} whatsappLink={whatsappLink} theme={normalized.theme} />;
          }

          return <ContactSection key={section.id} section={section} whatsappLink={whatsappLink} theme={normalized.theme} />;
        })}
    </main>
  );
}

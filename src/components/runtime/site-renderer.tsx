import type { SiteSpec } from "@/lib/site-spec";
import { CatalogSection, ContactSection, HeroSection, TestimonialsSection } from "@/components/runtime/sections";

type Props = {
  spec: SiteSpec;
};

export function SiteRenderer({ spec }: Props) {
  const homepage = spec.pages.find((page) => page.slug === "/") ?? spec.pages[0];
  const whatsapp = spec.integrations.whatsapp;
  const whatsappLink = whatsapp?.enabled && whatsapp.phone ? `https://wa.me/${whatsapp.phone}` : undefined;

  return (
    <main
      style={{
        background: spec.theme.background,
        color: spec.theme.primary,
        minHeight: "100vh"
      }}
    >
      {homepage.sections
        .filter((section) => section.enabled)
        .map((section) => {
          if (section.type === "hero") {
            return <HeroSection key={section.id} section={section} whatsappLink={whatsappLink} />;
          }

          if (section.type === "catalog") {
            return <CatalogSection key={section.id} section={section} whatsappLink={whatsappLink} />;
          }

          if (section.type === "testimonials") {
            return <TestimonialsSection key={section.id} section={section} whatsappLink={whatsappLink} />;
          }

          return <ContactSection key={section.id} section={section} whatsappLink={whatsappLink} />;
        })}
    </main>
  );
}

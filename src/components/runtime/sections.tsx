import type { SiteSpec } from "@/lib/site-spec";

type SectionProps = {
  section: SiteSpec["pages"][number]["sections"][number];
  whatsappLink?: string;
};

export function HeroSection({ section, whatsappLink }: SectionProps) {
  const title = String(section.props.title ?? "Tu Negocio");
  const subtitle = String(section.props.subtitle ?? "Describe y publica en minutos.");
  const cta = String(section.props.cta_text ?? "Hablar por WhatsApp");

  return (
    <section style={{ padding: "4rem 1rem", textAlign: "center" }}>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {whatsappLink ? (
        <a href={whatsappLink} target="_blank" rel="noreferrer" className="btn-primary">
          {cta}
        </a>
      ) : null}
    </section>
  );
}

export function CatalogSection({ section }: SectionProps) {
  const title = String(section.props.title ?? "Catálogo");
  return (
    <section style={{ padding: "2rem 1rem" }}>
      <h2>{title}</h2>
      <div className="catalog-grid">
        {Array.from({ length: 4 }).map((_, idx) => (
          <article key={idx} className="card">
            <h3>Producto {idx + 1}</h3>
            <p>Descripción breve del producto.</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TestimonialsSection({ section }: SectionProps) {
  const title = String(section.props.title ?? "Testimonios");
  return (
    <section style={{ padding: "2rem 1rem" }}>
      <h2>{title}</h2>
      <div className="catalog-grid">
        {Array.from({ length: 3 }).map((_, idx) => (
          <article key={idx} className="card">
            <p>"Excelente atención y resultados rápidos".</p>
            <strong>Cliente {idx + 1}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ContactSection({ section, whatsappLink }: SectionProps) {
  const title = String(section.props.title ?? "Contacto");
  return (
    <section style={{ padding: "2rem 1rem" }}>
      <h2>{title}</h2>
      <p>Contáctanos para más información.</p>
      {whatsappLink ? (
        <a href={whatsappLink} target="_blank" rel="noreferrer" className="btn-primary">
          Escribir por WhatsApp
        </a>
      ) : null}
    </section>
  );
}

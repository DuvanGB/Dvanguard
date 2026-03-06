import type { SiteSectionV2 } from "@/lib/site-spec-v2";

type SectionProps = {
  section: SiteSectionV2;
  whatsappLink?: string;
  theme: {
    primary: string;
    secondary: string;
    background: string;
  };
  onTrackCtaClick?: (sectionId: string) => void;
  onTrackWhatsappClick?: (sectionId: string) => void;
};

export function HeroSection({ section, whatsappLink, theme, onTrackCtaClick }: SectionProps) {
  if (section.type !== "hero") return null;

  const imageUrl = section.props.image_url || "https://placehold.co/1200x720?text=Hero";
  const layoutStyle =
    section.variant === "centered"
      ? { gridTemplateColumns: "1fr", textAlign: "center" as const }
      : { gridTemplateColumns: "1.1fr 1fr", textAlign: "left" as const };

  return (
    <section style={{ padding: "3rem 1rem" }}>
      <div
        style={{
          display: "grid",
          gap: "1.25rem",
          alignItems: "center",
          ...layoutStyle
        }}
      >
        <div>
          <h1>{section.props.headline}</h1>
          <p>{section.props.subheadline}</p>
          {whatsappLink ? (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
              onClick={() => onTrackCtaClick?.(section.id)}
            >
              {section.props.cta_label}
            </a>
          ) : null}
        </div>

        {section.variant === "centered" ? null : (
          <img
            src={imageUrl}
            alt={section.props.headline}
            style={{ width: "100%", borderRadius: "1rem", border: `1px solid ${theme.secondary}` }}
          />
        )}
      </div>
    </section>
  );
}

export function CatalogSection({ section, theme }: SectionProps) {
  if (section.type !== "catalog") return null;

  const gridColumns = section.variant === "list" ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))";

  return (
    <section style={{ padding: "2rem 1rem" }}>
      <h2>{section.props.title}</h2>
      <div style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: gridColumns }}>
        {section.props.items.map((item) => (
          <article
            key={item.id}
            className="card"
            style={{
              background: section.variant === "grid" ? "#ffffff" : theme.background,
              border: `1px solid ${theme.secondary}33`
            }}
          >
            <img
              src={item.image_url || `https://placehold.co/600x400?text=${encodeURIComponent(item.name)}`}
              alt={item.name}
              style={{ width: "100%", borderRadius: "0.6rem", marginBottom: "0.5rem" }}
            />
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            {item.price ? <strong>{item.price}</strong> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function TestimonialsSection({ section, theme }: SectionProps) {
  if (section.type !== "testimonials") return null;

  const columns = section.variant === "spotlight" ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))";

  return (
    <section style={{ padding: "2rem 1rem" }}>
      <h2>{section.props.title}</h2>
      <div style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: columns }}>
        {section.props.items.map((item) => (
          <article key={item.id} className="card" style={{ border: `1px solid ${theme.secondary}33` }}>
            <p>"{item.quote}"</p>
            <strong>{item.author}</strong>
            {item.role ? <small style={{ display: "block" }}>{item.role}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ContactSection({ section, whatsappLink, theme, onTrackWhatsappClick }: SectionProps) {
  if (section.type !== "contact") return null;

  return (
    <section
      style={{
        padding: "2rem 1rem",
        borderTop: `1px solid ${theme.secondary}40`
      }}
    >
      <h2>{section.props.title}</h2>
      <p>{section.props.description}</p>
      {section.props.address ? <p>{section.props.address}</p> : null}
      {whatsappLink ? (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
          onClick={() => onTrackWhatsappClick?.(section.id)}
        >
          {section.props.whatsapp_label || "Escribir por WhatsApp"}
        </a>
      ) : null}
    </section>
  );
}

import Link from "next/link";

export type OnboardingSiteListItem = {
  id: string;
  name: string;
  subdomain: string;
  status: "draft" | "published" | "archived";
  site_type: "informative" | "commerce_lite";
  created_at: string;
};

type Props = {
  sites: OnboardingSiteListItem[];
};

export function OnboardingSiteSelector({ sites }: Props) {
  return (
    <section className="stack">
      <h1>Onboarding IA</h1>
      <p>Selecciona el sitio que quieres generar o regenerar con IA.</p>

      <div className="catalog-grid">
        {sites.map((site) => (
          <article key={site.id} className="card stack">
            <strong>{site.name}</strong>
            <span>
              `{site.subdomain}` | {site.site_type} | {site.status}
            </span>
            <small>Creado: {new Date(site.created_at).toLocaleString()}</small>
            <Link className="btn-secondary" href={`/onboarding?siteId=${site.id}&source=selector`}>
              Continuar onboarding
            </Link>
          </article>
        ))}
      </div>

      <Link className="btn-secondary" href="/dashboard">
        Volver al dashboard
      </Link>
    </section>
  );
}

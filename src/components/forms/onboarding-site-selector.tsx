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

const typeLabels: Record<string, string> = {
  informative: "Informativo",
  commerce_lite: "Comercio",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "is-draft" },
  published: { label: "Publicado", className: "is-published" },
  archived: { label: "Archivado", className: "is-draft" },
};

export function OnboardingSiteSelector({ sites }: Props) {
  return (
    <section className="onboarding-selector stack">
      <div className="stack stack-sm" style={{ textAlign: "center" }}>
        <small className="onboarding-selector-chip">
          <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>auto_awesome</span>
          Onboarding IA
        </small>
        <h1 className="onboarding-headline">Selecciona un sitio</h1>
        <p className="muted">Elige el sitio que deseas generar o regenerar con inteligencia artificial.</p>
      </div>

      <div className="onboarding-selector-grid">
        {sites.map((site) => {
          const cfg = statusConfig[site.status] ?? statusConfig.draft;
          return (
            <Link
              key={site.id}
              href={`/onboarding?siteId=${site.id}&source=selector`}
              className="onboarding-selector-card"
            >
              <div className="onboarding-selector-card-icon">
                <span className="material-symbols-outlined">
                  {site.site_type === "commerce_lite" ? "storefront" : "language"}
                </span>
              </div>

              <div className="onboarding-selector-card-body">
                <div className="onboarding-selector-card-top">
                  <strong>{site.name}</strong>
                  <div className={`dashboard-site-card-status ${cfg.className}`}>
                    <span className="dashboard-site-card-status-dot" />
                    {cfg.label}
                  </div>
                </div>
                <small className="muted">{site.subdomain}</small>
              </div>

              <div className="onboarding-selector-card-meta">
                <span className="dashboard-badge">{typeLabels[site.site_type] ?? site.site_type}</span>
                <small className="muted">{new Date(site.created_at).toLocaleDateString()}</small>
              </div>

              <span className="material-symbols-outlined onboarding-selector-card-arrow">arrow_forward</span>
            </Link>
          );
        })}
      </div>

      <div style={{ textAlign: "center" }}>
        <Link className="btn-ghost" href="/dashboard">
          <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>arrow_back</span>
          Volver al dashboard
        </Link>
      </div>
    </section>
  );
}

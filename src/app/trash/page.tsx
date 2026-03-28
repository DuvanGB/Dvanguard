import Link from "next/link";

import { PurgeSiteButton } from "@/components/dashboard/purge-site-button";
import { RestoreSiteButton } from "@/components/dashboard/restore-site-button";
import { requireUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { listTrashedSitesForOwner, purgeExpiredDeletedSites } from "@/lib/sites-trash";

export default async function TrashPage() {
  const { user } = await requireUser();
  const admin = getSupabaseAdminClient();

  await purgeExpiredDeletedSites(admin, user.id);
  const trashedSites = await listTrashedSitesForOwner(admin, user.id);

  return (
    <main className="dashboard-shell">
      <div className="dashboard-container stack">
        <section className="dashboard-hero">
          <div className="stack" style={{ gap: "0.35rem" }}>
            <small className="dashboard-chip">Papelera</small>
            <h1>Sitios eliminados</h1>
            <p>Durante 7 días puedes restaurar un sitio o eliminarlo permanentemente si ya no lo necesitas.</p>
            <div className="dashboard-hero-actions">
              <Link href="/dashboard" className="btn-secondary">
                Volver al dashboard
              </Link>
            </div>
          </div>
          <div className="dashboard-email">{user.email}</div>
        </section>

        <section className="stack">
          <div className="dashboard-sites-head">
            <h2>Papelera</h2>
            <small>{trashedSites.length} sitios con restauración disponible</small>
          </div>

          {trashedSites.length ? (
            <div className="dashboard-sites-grid">
              {trashedSites.map((site) => (
                <article key={site.site_id} className="dashboard-site-card dashboard-site-card-trash">
                  <header className="dashboard-site-card-head">
                    <div className="stack" style={{ gap: "0.2rem" }}>
                      <strong>{site.name}</strong>
                      <small>{site.subdomain}</small>
                    </div>
                    <div className="dashboard-site-badges">
                      <span className="dashboard-badge">{site.site_type}</span>
                      <span className="dashboard-badge dashboard-badge-trash">en papelera</span>
                    </div>
                  </header>

                  <div className="dashboard-site-metrics">
                    <span>Eliminado: {new Date(site.deleted_at).toLocaleDateString()}</span>
                    <span>Purga automática: {new Date(site.purge_at).toLocaleDateString()}</span>
                    <span>Quedan: {site.days_remaining} días</span>
                  </div>

                  <div className="dashboard-site-actions">
                    <RestoreSiteButton siteId={site.site_id} />
                    <PurgeSiteButton siteId={site.site_id} siteName={site.name} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <article className="dashboard-empty-state">
              <h3>No tienes sitios en papelera</h3>
              <p>Cuando elimines un sitio aparecerá aquí durante 7 días para restaurarlo o borrarlo definitivamente.</p>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}

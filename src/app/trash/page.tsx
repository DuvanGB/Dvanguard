import Link from "next/link";

import { PurgeSiteButton } from "@/components/dashboard/purge-site-button";
import { RestoreSiteButton } from "@/components/dashboard/restore-site-button";
import { requireUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { listTrashedSitesForOwner, purgeExpiredDeletedSites } from "@/lib/sites-trash";
import { PlatformNav } from "@/components/platform-nav";
import { PlatformFooter } from "@/components/platform-footer";

export default async function TrashPage() {
  const { user } = await requireUser();
  const admin = getSupabaseAdminClient();

  await purgeExpiredDeletedSites(admin, user.id);
  const trashedSites = await listTrashedSitesForOwner(admin, user.id);

  return (
    <>
    <PlatformNav isAuthenticated />
    <main className="dashboard-shell">
      <div className="dashboard-container stack">
        <section className="dashboard-hero">
          <div className="stack stack-sm">
            <small className="dashboard-chip">Papelera</small>
            <h1>Sitios eliminados</h1>
            <p>Durante 7 días puedes restaurar un sitio o eliminarlo permanentemente si ya no lo necesitas.</p>
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
                  <div className="trash-card-header">
                    <span className="material-symbols-outlined trash-card-header-icon">delete_sweep</span>
                    <div className="trash-card-countdown">
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>schedule</span>
                      {site.days_remaining} días restantes
                    </div>
                  </div>

                  <div className="dashboard-site-card-body">
                    <div className="dashboard-site-card-head">
                      <div className="stack stack-xs">
                        <strong>{site.name}</strong>
                        <small>{site.subdomain}</small>
                      </div>
                      <div className="dashboard-site-badges">
                        <span className="dashboard-badge">{site.site_type}</span>
                        <span className="dashboard-badge dashboard-badge-trash">en papelera</span>
                      </div>
                    </div>

                    <div className="trash-card-dates">
                      <div className="trash-card-date">
                        <small>Eliminado</small>
                        <span>{new Date(site.deleted_at).toLocaleDateString()}</span>
                      </div>
                      <div className="trash-card-date">
                        <small>Purga automática</small>
                        <span>{new Date(site.purge_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="trash-card-actions">
                      <RestoreSiteButton siteId={site.site_id} />
                      <PurgeSiteButton siteId={site.site_id} siteName={site.name} />
                    </div>
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
    <PlatformFooter />
    </>
  );
}

import Link from "next/link";

import { ProRequestButton } from "@/components/account/pro-request-button";
import { DeleteSiteButton } from "@/components/dashboard/delete-site-button";
import { SitePublicationToggle } from "@/components/dashboard/site-publication-toggle";
import { CreateSiteForm } from "@/components/forms/create-site-form";
import { ModuleTour } from "@/components/guided/module-tour";
import { SiteDomainManager } from "@/components/sites/site-domain-manager";
import { requireUser } from "@/lib/auth";
import { getUsageSnapshot } from "@/lib/billing/usage";
import { getOwnerSiteAnalytics } from "@/lib/data/dashboard/analytics";
import { listTrashedSitesForOwner, purgeExpiredDeletedSites } from "@/lib/sites-trash";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();
  const admin = getSupabaseAdminClient();

  await purgeExpiredDeletedSites(admin, user.id);

  const [usageResponse, { data: pendingProRequest }, analytics, trashedSites] = await Promise.all([
    getUsageSnapshot(admin, user.id),
    supabase
      .from("pro_requests")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1),
    getOwnerSiteAnalytics({
      ownerId: user.id,
      range: "7d"
    }),
    listTrashedSitesForOwner(admin, user.id)
  ]);

  const usage = usageResponse;
  const pendingRequest = pendingProRequest?.[0] ?? null;
  const sites = analytics.sites;

  const blockedByLimit = usage.plan === "free" && (usage.ai_generations_remaining <= 0 || usage.published_sites_remaining <= 0);

  return (
    <main className="dashboard-shell">
      <div className="dashboard-container stack">
        <section className="dashboard-hero">
          <div className="stack" style={{ gap: "0.35rem" }}>
            <small className="dashboard-chip">Workspace cliente</small>
            <h1>Tu centro de sitios y activación</h1>
            <p>Gestiona contenido, publicación y rendimiento de tus sitios desde un panel profesional.</p>
            <div className="dashboard-hero-actions">
              <Link href="/pricing" className="btn-secondary">
                Ver planes
              </Link>
              <Link href="/onboarding" className="btn-primary">
                Regenerar con IA
              </Link>
              <Link href="/trash" className="btn-secondary">
                Papelera{trashedSites.length ? ` (${trashedSites.length})` : ""}
              </Link>
              <ModuleTour
                module="dashboard"
                title="Guía rápida del dashboard"
                description="Aquí controlas tus sitios, inicias nuevos proyectos y revisas el rendimiento de tu negocio."
                compact
                steps={[
                  {
                    title: "Crea o retoma un sitio",
                    body: "Desde este panel puedes crear un sitio nuevo o volver a editar uno ya existente."
                  },
                  {
                    title: "Usa IA para arrancar más rápido",
                    body: "Regenerar con IA te lleva al onboarding para capturar y refinar la información del negocio."
                  },
                  {
                    title: "Edita, publica y abre tu sitio",
                    body: "Cada tarjeta te permite editar el sitio, publicarlo y abrir la versión pública cuando esté lista."
                  }
                ]}
              />
            </div>
          </div>
          <div className="dashboard-email">{user.email}</div>
        </section>

        <section className="dashboard-kpi-grid">
          <article className="dashboard-kpi-card">
            <small>Plan actual</small>
            <strong>{usage.plan.toUpperCase()}</strong>
            <p>{usage.plan === "free" ? "Ideal para validar rápido" : "Mayor capacidad de crecimiento"}</p>
          </article>
          <article className="dashboard-kpi-card">
            <small>Generaciones IA (mes)</small>
            <strong>
              {usage.ai_generations_used} / {usage.ai_generations_limit}
            </strong>
            <p>Restantes: {usage.ai_generations_remaining}</p>
          </article>
          <article className="dashboard-kpi-card">
            <small>Sitios publicados</small>
            <strong>
              {usage.published_sites_used} / {usage.published_sites_limit}
            </strong>
            <p>Disponibles: {usage.published_sites_remaining}</p>
          </article>
          <article className="dashboard-kpi-card">
            <small>Visitas (7d)</small>
            <strong>{analytics.summary.visits}</strong>
            <p>Interacciones recientes</p>
          </article>
          <article className="dashboard-kpi-card">
            <small>Clic WhatsApp (7d)</small>
            <strong>{analytics.summary.whatsapp_clicks}</strong>
            <p>Conversaciones iniciadas</p>
          </article>
          <article className="dashboard-kpi-card">
            <small>CTR WhatsApp (7d)</small>
            <strong>{analytics.summary.ctr_whatsapp}%</strong>
            <p>Conversión sobre visitas</p>
          </article>
        </section>

        {blockedByLimit ? (
          <section className="dashboard-upgrade-banner">
            <div className="stack">
              <h2>Has alcanzado el límite de tu plan Gratis</h2>
              <p>Solicita Pro para ampliar cupos de IA y cantidad de sitios publicados activos.</p>
            </div>
            <div>
              {pendingRequest ? (
                <small>Ya tienes una solicitud Pro pendiente desde {new Date(pendingRequest.created_at).toLocaleString()}.</small>
              ) : (
                <ProRequestButton />
              )}
            </div>
          </section>
        ) : null}

        <section className="dashboard-create-panel">
          <div className="stack">
            <h2>Crear nuevo sitio</h2>
            <p>Inicia un proyecto nuevo y pasa directo al onboarding para generar tu primera versión con IA.</p>
          </div>
          <CreateSiteForm />
        </section>

        <section className="stack">
          <div className="dashboard-sites-head">
            <h2>Tus sitios</h2>
            <small>{sites.length} activos en tu workspace</small>
          </div>
          {sites.length ? (
            <div className="dashboard-sites-grid">
              {sites.map((site) => (
                <article key={site.site_id} className="dashboard-site-card">
                  <header className="dashboard-site-card-head">
                    <div className="stack" style={{ gap: "0.2rem" }}>
                      <strong>{site.name}</strong>
                      <small>{site.subdomain}</small>
                    </div>
                    <div className="dashboard-site-head-right">
                      <div className="dashboard-site-badges">
                        <span className="dashboard-badge">{site.site_type}</span>
                        <span className={`dashboard-badge ${site.status === "published" ? "dashboard-badge-ok" : ""}`}>
                          {site.status}
                        </span>
                      </div>
                      <SitePublicationToggle siteId={site.site_id} published={site.status === "published"} compact />
                    </div>
                  </header>

                  <div className="dashboard-site-metrics">
                    <span>Visitas: {site.visits}</span>
                    <span>WhatsApp: {site.whatsapp_clicks}</span>
                    <span>CTA: {site.cta_clicks}</span>
                    <span>CTR: {site.ctr_whatsapp}%</span>
                    <span>
                      Activación: {site.checklist_done}/{site.checklist_total}
                    </span>
                  </div>

                  <ul className="dashboard-checklist">
                    {site.checklist.map((item) => (
                      <li key={item.key} className={item.done ? "dashboard-check-ok" : "dashboard-check-pending"}>
                        {item.done ? "✓" : "•"} {item.label}
                      </li>
                    ))}
                  </ul>

                    <div className="dashboard-site-actions">
                      <Link className="btn-secondary" href={`/sites/${site.site_id}`}>
                        Editar
                      </Link>
                      <Link className="btn-secondary" href={`/onboarding?siteId=${site.site_id}`}>
                        Regenerar IA
                      </Link>
                      {site.status === "published" ? (
                        <a className="btn-secondary" href={site.public_url} target="_blank" rel="noreferrer">
                          Abrir sitio
                        </a>
                      ) : null}
                      <DeleteSiteButton siteId={site.site_id} siteName={site.name} />
                    </div>

                  <SiteDomainManager siteId={site.site_id} initialDomains={site.domains} compact />
                </article>
              ))}
            </div>
          ) : (
            <article className="dashboard-empty-state">
              <h3>Aún no tienes sitios creados</h3>
              <p>Crea tu primer sitio y publícalo hoy para empezar a recibir tráfico desde redes.</p>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}

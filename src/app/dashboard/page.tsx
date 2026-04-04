import Link from "next/link";

import { DeleteSiteButton } from "@/components/dashboard/delete-site-button";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { SitePublicationToggle } from "@/components/dashboard/site-publication-toggle";
import { CreateSiteForm } from "@/components/forms/create-site-form";
import { SiteDomainManager } from "@/components/sites/site-domain-manager";
import { requireUser } from "@/lib/auth";
import { getUsageSnapshot } from "@/lib/billing/usage";
import { getOwnerSiteAnalytics } from "@/lib/data/dashboard/analytics";
import { listTrashedSitesForOwner, purgeExpiredDeletedSites } from "@/lib/sites-trash";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { PlatformNav } from "@/components/platform-nav";
import { PlatformFooter } from "@/components/platform-footer";
import { getPlatformCopyMap } from "@/lib/platform-config";
import { getLocaleFromCookies, localeToScope } from "@/lib/locale";

export default async function DashboardPage() {
  const { user } = await requireUser();
  const admin = getSupabaseAdminClient();
  const locale = await getLocaleFromCookies();
  const scope = localeToScope(locale);

  await purgeExpiredDeletedSites(admin, user.id);

  const dashCopyKeys = [
    "dash.chip", "dash.hero.title", "dash.hero.desc",
    "dash.hero.greeting", "dash.hero.headline",
    "dash.cta.regenerate", "dash.cta.billing", "dash.cta.trash",
    "dash.kpi.plan", "dash.kpi.plan_free", "dash.kpi.plan_pro",
    "dash.kpi.ai", "dash.kpi.ai_remaining",
    "dash.kpi.published", "dash.kpi.available",
    "dash.kpi.visits", "dash.kpi.visits_desc",
    "dash.kpi.wa_clicks", "dash.kpi.wa_desc",
    "dash.kpi.ctr", "dash.kpi.ctr_desc",
    "dash.kpi.section", "dash.kpi.period", "dash.kpi.activation",
    "dash.create.title", "dash.create.desc",
    "dash.sites.title", "dash.sites.count",
    "dash.sites.edit", "dash.sites.regenerate", "dash.sites.open",
    "dash.sites.manage", "dash.sites.continue",
    "dash.empty.title", "dash.empty.desc",
    "dash.ia_promo.label", "dash.ia_promo.title", "dash.ia_promo.desc", "dash.ia_promo.cta",
    "dash.checklist.title"
  ];

  const [usageResponse, analytics, trashedSites, copy] = await Promise.all([
    getUsageSnapshot(admin, user.id),
    getOwnerSiteAnalytics({
      ownerId: user.id,
      range: "7d"
    }),
    listTrashedSitesForOwner(admin, user.id),
    getPlatformCopyMap(admin, dashCopyKeys, scope)
  ]);

  const t = (key: string) => copy[key] ?? key;

  const usage = usageResponse;
  const sites = analytics.sites;

  const blockedByLimit = usage.plan === "free" && (usage.ai_generations_remaining <= 0 || usage.published_sites_remaining <= 0);

  return (
    <>
    <PlatformNav isAuthenticated />
    <main className="dashboard-shell">
      <div className="dashboard-container stack">

        {/* ── Hero ──────────────────────────────────── */}
        <section className="dashboard-hero">
          <div className="dashboard-hero-intro">
            <small className="dashboard-chip">{t("dash.hero.greeting")}</small>
            <h1>
              {t("dash.hero.title")} <br />
              <span className="accent">{t("dash.hero.headline")}</span>
            </h1>
            <p>{t("dash.hero.desc")}</p>
            <div className="dashboard-hero-actions">
              <Link href="/onboarding" className="btn-primary">
                <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>add_circle</span>
                {t("dash.cta.regenerate")}
              </Link>
              <Link href="/billing" className="btn-secondary">
                {t("dash.cta.billing")}
              </Link>
              <Link href="/trash" className="btn-secondary">
                {t("dash.cta.trash")}{trashedSites.length ? ` (${trashedSites.length})` : ""}
              </Link>
            </div>
          </div>
          <div className="dashboard-email">
            {user.email}
            <SignOutButton />
          </div>
        </section>

        {/* ── KPI Strip ────────────────────────────── */}
        <section className="stack" style={{ gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <h2 style={{ margin: 0, fontSize: "1.15rem", color: "var(--text)" }}>{t("dash.kpi.section")}</h2>
            <small style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--secondary)" }}>{t("dash.kpi.period")}</small>
          </div>
          <div className="dashboard-kpi-strip">
            <article className="dashboard-kpi-card">
              <div className="dashboard-kpi-card-top">
                <span className="material-symbols-outlined dashboard-kpi-icon visits">visibility</span>
              </div>
              <div className="dashboard-kpi-card-bottom">
                <strong>{analytics.summary.visits}</strong>
                <small>{t("dash.kpi.visits")}</small>
              </div>
            </article>
            <article className="dashboard-kpi-card">
              <div className="dashboard-kpi-card-top">
                <span className="material-symbols-outlined dashboard-kpi-icon whatsapp">chat</span>
              </div>
              <div className="dashboard-kpi-card-bottom">
                <strong>{analytics.summary.whatsapp_clicks}</strong>
                <small>{t("dash.kpi.wa_clicks")}</small>
              </div>
            </article>
            <article className="dashboard-kpi-card">
              <div className="dashboard-kpi-card-top">
                <span className="material-symbols-outlined dashboard-kpi-icon ctr">ads_click</span>
              </div>
              <div className="dashboard-kpi-card-bottom">
                <strong>{analytics.summary.ctr_whatsapp}%</strong>
                <small>{t("dash.kpi.ctr")}</small>
              </div>
            </article>
            <article className="dashboard-kpi-card">
              <div className="dashboard-kpi-card-top">
                <span className="material-symbols-outlined dashboard-kpi-icon ai">auto_awesome</span>
              </div>
              <div className="dashboard-kpi-card-bottom">
                <strong>{usage.ai_generations_used}/{usage.ai_generations_limit}</strong>
                <small>{t("dash.kpi.ai")}</small>
              </div>
            </article>
            <article className="dashboard-kpi-card">
              <div className="dashboard-kpi-card-top">
                <span className="material-symbols-outlined dashboard-kpi-icon published">language</span>
              </div>
              <div className="dashboard-kpi-card-bottom">
                <strong>{usage.published_sites_used}/{usage.published_sites_limit}</strong>
                <small>{t("dash.kpi.published")}</small>
              </div>
            </article>
            <article className="dashboard-kpi-card dashboard-kpi-accent">
              <div className="dashboard-kpi-card-top">
                <span className="material-symbols-outlined dashboard-kpi-icon plan">workspace_premium</span>
              </div>
              <div className="dashboard-kpi-card-bottom">
                <strong>{usage.plan.toUpperCase()}</strong>
                <small>{t("dash.kpi.plan")}</small>
              </div>
            </article>
          </div>
        </section>

        {/* ── Banners ──────────────────────────────── */}
        {blockedByLimit ? (
          <section className="dashboard-upgrade-banner">
            <div className="stack">
              <h2>Has alcanzado el límite de tu plan Gratis</h2>
              <p>Activa o gestiona Pro desde billing para ampliar cupos de IA y sitios publicados activos.</p>
            </div>
            <div>
              <Link href="/billing" className="btn-primary">
                {t("dash.cta.billing")}
              </Link>
            </div>
          </section>
        ) : null}

        {usage.access_state === "grace_period" && usage.grace_until ? (
          <section className="dashboard-upgrade-banner">
            <div className="stack">
              <h2>Tu cuenta está en gracia por billing</h2>
              <p>Conservas temporalmente tus sitios publicados hasta el {new Date(usage.grace_until).toLocaleDateString()} mientras regularizas tu suscripción.</p>
            </div>
            <div>
              <Link href="/billing" className="btn-primary">
                {t("dash.cta.billing")}
              </Link>
            </div>
          </section>
        ) : null}

        {usage.access_state === "enforcement_applied" ? (
          <section className="dashboard-upgrade-banner">
            <div className="stack">
              <h2>Aplicamos el ajuste al límite Free</h2>
              <p>Mantuvimos publicado solo tu sitio con más visitas recientes. Puedes volver a Pro o elegir qué sitio publicar.</p>
            </div>
            <div>
              <Link href="/billing" className="btn-primary">
                {t("dash.cta.billing")}
              </Link>
            </div>
          </section>
        ) : null}

        {/* ── IA Promo Card ────────────────────────── */}
        <section className="dashboard-ia-promo">
          <div className="dashboard-ia-promo-inner">
            <div className="dashboard-ia-promo-label">
              <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>auto_fix_high</span>
              {t("dash.ia_promo.label")}
            </div>
            <h3>{t("dash.ia_promo.title")}</h3>
            <p>{t("dash.ia_promo.desc")}</p>
            <Link href="/onboarding" className="btn-accent">
              {t("dash.ia_promo.cta")} <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>arrow_forward</span>
            </Link>
          </div>
        </section>

        {/* ── Create Site ──────────────────────────── */}
        <section className="dashboard-create-panel">
          <div className="stack">
            <h2>{t("dash.create.title")}</h2>
            <p>{t("dash.create.desc")}</p>
          </div>
          <CreateSiteForm />
        </section>

        {/* ── Sites ────────────────────────────────── */}
        <section className="stack">
          <div className="dashboard-sites-head">
            <h2>{t("dash.sites.title")}</h2>
            <small>{sites.length} {t("dash.sites.count")}</small>
          </div>
          {sites.length ? (
            <div className="dashboard-sites-grid">
              {sites.map((site) => {
                const isPublished = site.status === "published";
                return (
                  <article key={site.site_id} className="dashboard-site-card">
                    {/* Preview Header */}
                    <div className="dashboard-site-card-preview">
                      <iframe
                        className="dashboard-site-card-preview-iframe"
                        src={`/sites/${site.site_id}/preview`}
                        tabIndex={-1}
                        loading="lazy"
                        sandbox="allow-same-origin"
                        title={site.name}
                      />
                      <span className="dashboard-site-card-preview-name">{site.name}</span>
                      <div className={`dashboard-site-card-status ${isPublished ? "is-published" : "is-draft"}`}>
                        <span className="dashboard-site-card-status-dot" />
                        {site.status}
                      </div>
                    </div>

                    <div className="dashboard-site-card-body">
                      {/* Name + subdomain + toggle */}
                      <div className="dashboard-site-card-head">
                        <div className="stack" style={{ gap: "0.15rem" }}>
                          <strong>{site.name}</strong>
                          <small>{site.subdomain}</small>
                        </div>
                        <div className="dashboard-site-card-head-right">
                          <SitePublicationToggle siteId={site.site_id} published={isPublished} compact />
                        </div>
                      </div>

                      {/* Mini Metrics */}
                      <div className="dashboard-site-metrics-row">
                        <div className="dashboard-site-metric">
                          <small>{t("dash.kpi.visits")}</small>
                          <strong>{site.visits}</strong>
                        </div>
                        <div className="dashboard-site-metric">
                          <small>WhatsApp</small>
                          <strong>{site.whatsapp_clicks}</strong>
                        </div>
                        <div className="dashboard-site-metric">
                          <small>CTR</small>
                          <strong>{site.ctr_whatsapp}%</strong>
                        </div>
                      </div>

                      {/* Compact Checklist */}
                      {site.checklist.length > 0 && (
                        <div className="dashboard-checklist-compact">
                          <p className="dashboard-checklist-compact-title">{t("dash.checklist.title")}</p>
                          {site.checklist.map((item) => (
                            <div key={item.key} className={`dashboard-checklist-compact-item ${item.done ? "dashboard-check-ok" : "dashboard-check-pending"}`}>
                              <span className="material-symbols-outlined" style={{ fontVariationSettings: item.done ? "'FILL' 1" : undefined }}>
                                {item.done ? "check_circle" : "radio_button_unchecked"}
                              </span>
                              <span>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions Row */}
                      <div className="dashboard-site-actions-row">
                        <div className="dashboard-site-actions-left">
                          {isPublished ? (
                            <a className="dashboard-site-action-btn" href={site.public_url} target="_blank" rel="noreferrer" title={t("dash.sites.open")}>
                              <span className="material-symbols-outlined">open_in_new</span>
                            </a>
                          ) : null}
                          <Link className="dashboard-site-action-btn" href={`/onboarding?siteId=${site.site_id}&source=regenerate`} title={t("dash.sites.regenerate")}>
                            <span className="material-symbols-outlined">auto_awesome</span>
                          </Link>
                          <DeleteSiteButton siteId={site.site_id} siteName={site.name} />
                        </div>
                        <Link className="dashboard-site-edit-btn" href={`/sites/${site.site_id}`}>
                          <span className="material-symbols-outlined">edit</span>
                          {t("dash.sites.edit")}
                        </Link>
                      </div>

                      <SiteDomainManager siteId={site.site_id} initialDomains={site.domains} compact />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <article className="dashboard-empty-state">
              <h3>{t("dash.empty.title")}</h3>
              <p>{t("dash.empty.desc")}</p>
            </article>
          )}
        </section>
      </div>
    </main>
    <PlatformFooter />
    </>
  );
}

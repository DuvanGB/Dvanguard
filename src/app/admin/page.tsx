import Link from "next/link";

import { MetricCard } from "@/components/admin/metric-card";
import { TotalCard } from "@/components/admin/total-card";
import { formatLatency, formatNumber, formatPercent } from "@/lib/data/admin/common";
import {
  getAdminMetrics,
  getAdminTotals,
  getRecentFailedJobs,
  getRecentlyPublishedSites,
  getSitesWithMostRegenerations,
  getTopTemplatesByPublication
} from "@/lib/data/admin/metrics";
import { getAdminTrafficMetrics } from "@/lib/data/admin/traffic-metrics";
import { TimeRangeSelector } from "@/components/time-range-selector";

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range = rangeParam || "7d";

  const [totals, metrics, traffic, failedJobs, recentSites, mostRegeneratedSites, topTemplates] = await Promise.all([
    getAdminTotals(),
    getAdminMetrics(range),
    getAdminTrafficMetrics(range),
    getRecentFailedJobs(8),
    getRecentlyPublishedSites(8),
    getSitesWithMostRegenerations(8, range),
    getTopTemplatesByPublication(6, range)
  ]);

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      {/* ── Platform Totals ─────────────────────────── */}
      <section className="admin-totals-strip">
        <TotalCard label="Usuarios registrados" value={formatNumber(totals.totalUsers)} icon="group" tone="accent" />
        <TotalCard label="Sitios creados" value={formatNumber(totals.totalSites)} icon="web" />
        <TotalCard label="Sitios publicados" value={formatNumber(totals.publishedSites)} icon="public" tone="positive" />
        <TotalCard label="Usuarios Pro" value={formatNumber(totals.proUsers)} icon="workspace_premium" tone="accent" />
        <TotalCard label="Jobs IA ejecutados" value={formatNumber(totals.totalAiJobs)} icon="auto_fix_high" />
        <TotalCard label="Visitas totales" value={formatNumber(totals.totalVisits)} icon="visibility" tone="positive" />
      </section>

      {/* ── Bento KPI Grid ──────────────────────────── */}
      <section className="admin-bento-grid">
        <div className="admin-bento-card">
          <span className="material-symbols-outlined">add_to_photos</span>
          <p>Sitios creados</p>
          <strong>{metrics.sitesCreated}</strong>
        </div>
        <div className="admin-bento-card">
          <span className="material-symbols-outlined">cloud_done</span>
          <p>Publicados</p>
          <strong>{metrics.sitesPublished}</strong>
        </div>
        <div className="admin-bento-card admin-bento-featured">
          <div className="admin-bento-featured-row">
            <div>
              <p>CTR WhatsApp global</p>
              <strong>{metrics.trafficWhatsappCtr}%</strong>
            </div>
            <span className="material-symbols-outlined">trending_up</span>
          </div>
          <div className="admin-bento-bar">
            <div className="admin-bento-bar-fill" style={{ width: `${Math.min(metrics.trafficWhatsappCtr, 100)}%` }} />
          </div>
        </div>
        <div className="admin-bento-card admin-bento-wide">
          <div>
            <p>Jobs IA totales</p>
            <strong>{metrics.aiJobsTotal}</strong>
          </div>
          <div className="admin-bento-chart-placeholder">
            <span className="material-symbols-outlined" style={{ color: "var(--on-surface-variant)", opacity: 0.4 }}>query_stats</span>
          </div>
        </div>
      </section>

      {/* ── Hero Panel ──────────────────────────────── */}
      <section className="admin-hero-panel">
        <div className="stack stack-sm">
          <TimeRangeSelector current={range} />
          <h2>Dashboard Ejecutivo</h2>
          <p>Métricas de rendimiento, conversión y calidad IA.</p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/admin/users" className="admin-hero-btn">
            <span className="material-symbols-outlined">group</span>
            Usuarios
          </Link>
          <Link href="/admin/sites" className="admin-hero-btn">
            <span className="material-symbols-outlined">security</span>
            Moderar sitios
          </Link>
          <Link href="/admin/ai-jobs" className="admin-hero-btn admin-hero-btn-primary">
            <span className="material-symbols-outlined">memory</span>
            Jobs IA
          </Link>
        </div>
      </section>

      {/* ── Rendimiento IA ─────────────────────────── */}
      <section>
        <div className="admin-section-head" style={{ marginBottom: "0.75rem" }}>
          <h2 className="admin-section-title">Rendimiento IA</h2>
        </div>
        <div className="admin-metric-grid">
          <MetricCard label="Jobs fallidos" value={metrics.aiJobsFailed} hint="requieren revisión" icon="error_outline" tone="danger" />
          <MetricCard label="Fallback IA" value={metrics.aiJobsFallback} hint="modo alterno" icon="swap_horiz" tone="warning" />
          <MetricCard label="Latencia p50/p95" value={formatLatency(metrics.latencyP50Ms, metrics.latencyP95Ms)} icon="speed" />
          <MetricCard label="First result acceptance" value={formatPercent(metrics.firstResultAcceptanceRate)} hint="calidad primer resultado" icon="check_circle" tone="positive" />
          <MetricCard label="Aceptación v3" value={formatPercent(metrics.v2FirstResultAcceptanceRate)} hint="resultado visual" icon="visibility" />
          <MetricCard label="Refine fallback" value={formatPercent(metrics.onboardingRefineFallbackRate)} hint="debería bajar" icon="refresh" tone="warning" />
        </div>
      </section>

      {/* ── Activación & Onboarding ────────────────── */}
      <section>
        <div className="admin-section-head" style={{ marginBottom: "0.75rem" }}>
          <h2 className="admin-section-title">Activación & Onboarding</h2>
        </div>
        <div className="admin-metric-grid">
          <MetricCard label="Publicación <24h" value={formatPercent(metrics.publishIn24hRate)} hint="activación rápida" icon="schedule" tone="positive" />
          <MetricCard label="Voice usage" value={formatPercent(metrics.voiceUsageRate)} hint="onboarding voz" icon="mic" />
          <MetricCard label="Plantilla recomendada" value={formatPercent(metrics.templateRecommendedPickRate)} hint="adopción" icon="recommend" />
          <MetricCard label="Regen p50/p95" value={`${metrics.regenerationsP50 ?? "-"} / ${metrics.regenerationsP95 ?? "-"}`} icon="autorenew" />
          <MetricCard label="Regen avg/template" value={metrics.regenerationAvgPerTemplate ?? "-"} icon="analytics" />
          <MetricCard label="Límite IA" value={metrics.limitHitAiCount} hint="tope alcanzado" icon="block" tone="warning" />
        </div>
      </section>

      {/* ── Tráfico & Conversión ───────────────────── */}
      <section>
        <div className="admin-section-head" style={{ marginBottom: "0.75rem" }}>
          <h2 className="admin-section-title">Tráfico & Conversión</h2>
        </div>
        <div className="admin-metric-grid">
          <MetricCard label="Visitas" value={metrics.trafficVisits} icon="trending_up" tone="positive" />
          <MetricCard label="Clic WhatsApp" value={metrics.trafficWhatsappClicks} icon="touch_app" tone="positive" />
          <MetricCard label="Clic CTA" value={metrics.trafficCtaClicks} icon="ads_click" />
          <MetricCard label="Límite publish" value={metrics.limitHitPublishCount} hint="tope alcanzado" icon="do_not_disturb_on" tone="warning" />
        </div>
      </section>

      {/* ── Failed Jobs ────────────────────────────── */}
      <section>
        <div className="admin-section-head" style={{ marginBottom: "0.75rem" }}>
          <h2 className="admin-section-title">Jobs IA fallidos</h2>
          <Link href="/admin/ai-jobs" className="admin-section-link">Ver todos</Link>
        </div>
        <article className="admin-panel stack">
          {failedJobs.length ? (
            <div className="admin-job-list">
              {failedJobs.slice(0, 5).map((job) => (
                <div key={job.id} className="admin-job-item">
                  <div className="admin-job-item-left">
                    <div className="admin-job-icon">
                      <span className="material-symbols-outlined">psychology</span>
                    </div>
                    <div className="admin-job-info">
                      <strong>{job.id.slice(0, 8)}…</strong>
                      <small>{job.error ?? "Error desconocido"}</small>
                    </div>
                  </div>
                  <span className="admin-job-pill admin-job-pill-error">Error</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-panel-empty">Sin fallos recientes.</p>
          )}
        </article>
      </section>

      {/* ── Sitios publicados recientemente ─────────── */}
      <section>
        <div className="admin-section-head" style={{ marginBottom: "0.75rem" }}>
          <h2 className="admin-section-title">Sitios publicados recientemente</h2>
          <Link href="/admin/sites" className="admin-section-link">Ver sitios</Link>
        </div>
        <article className="admin-panel">
          {recentSites.length ? (
            <div className="admin-site-list">
              {recentSites.slice(0, 6).map((site) => (
                <div key={`${site.site_id}-${site.published_at}`} className="admin-site-list-item">
                  <div className="admin-site-list-icon">
                    <span className="material-symbols-outlined">language</span>
                  </div>
                  <div className="admin-site-list-info">
                    <strong>{site.name}</strong>
                    <small>{site.subdomain} · {site.owner_email ?? "-"}</small>
                  </div>
                  <span className="admin-table-badge">{site.site_type}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-panel-empty">Sin publicaciones recientes.</p>
          )}
        </article>
      </section>

      {/* ── Templates + Regenerations ──────────────── */}
      <div className="admin-activity-grid">
        <article className="admin-panel stack">
          <div className="admin-panel-head">
            <h3 className="admin-panel-title">Top templates</h3>
          </div>
          {topTemplates.length ? (
            <div className="admin-template-list">
              {topTemplates.map((item, index) => (
                <div key={item.templateId} className="admin-template-row">
                  <span className={`admin-template-rank ${index < 3 ? "admin-template-rank-top" : ""}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="admin-template-info">
                    <strong>{item.templateId}</strong>
                    <small>{item.publicationsCount} publicaciones</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-panel-empty">Sin publicaciones v3 en el rango actual.</p>
          )}
        </article>

        <article className="admin-panel stack">
          <div className="admin-panel-head">
            <h3 className="admin-panel-title">Más regeneraciones</h3>
          </div>
          {mostRegeneratedSites.length ? (
            <div className="admin-site-list">
              {mostRegeneratedSites.map((site) => (
                <div key={site.site_id} className="admin-site-list-item">
                  <div className="admin-site-list-icon">
                    <span className="material-symbols-outlined">autorenew</span>
                  </div>
                  <div className="admin-site-list-info">
                    <strong>{site.name}</strong>
                    <small>{site.subdomain}</small>
                  </div>
                  <span className="admin-table-badge">{site.regenerations}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-panel-empty">Sin regeneraciones en el rango actual.</p>
          )}
        </article>
      </div>

      {/* ── Traffic Tables ─────────────────────────── */}
      <div className="admin-activity-grid">
        <article className="admin-panel admin-panel-main stack">
          <div className="admin-panel-head">
            <h3 className="admin-panel-title">Traffic: top visitas</h3>
          </div>
          {traffic.top_by_visits.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sitio</th>
                    <th>Subdominio</th>
                    <th>Visitas</th>
                    <th>WhatsApp</th>
                    <th>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {traffic.top_by_visits.map((item) => (
                    <tr key={item.site_id}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.subdomain}</td>
                      <td>{item.visits}</td>
                      <td>{item.whatsapp_clicks}</td>
                      <td><span className="admin-table-badge admin-table-badge-accent">{item.ctr_whatsapp}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-panel-empty">Sin tráfico en el rango actual.</p>
          )}
        </article>

        <article className="admin-panel admin-panel-side stack">
          <h3 className="admin-panel-title">Top clic WhatsApp</h3>
          {traffic.top_by_whatsapp.length ? (
            <div className="admin-site-list">
              {traffic.top_by_whatsapp.map((item) => (
                <div key={item.site_id} className="admin-site-list-item">
                  <div className="admin-site-list-icon">
                    <span className="material-symbols-outlined">chat</span>
                  </div>
                  <div className="admin-site-list-info">
                    <strong>{item.name}</strong>
                    <small>{item.subdomain} · {item.ctr_whatsapp}%</small>
                  </div>
                  <span className="admin-table-badge admin-table-badge-accent">{item.whatsapp_clicks}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-panel-empty">Sin clics en el rango actual.</p>
          )}
        </article>
      </div>

      {/* ── Low Conversion ─────────────────────────── */}
      <section>
        <div className="admin-section-head" style={{ marginBottom: "0.75rem" }}>
          <h2 className="admin-section-title">Alto tráfico · Baja conversión</h2>
        </div>
        <article className="admin-panel stack">
          {traffic.low_conversion.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sitio</th>
                    <th>Subdominio</th>
                    <th>Visitas</th>
                    <th>WhatsApp</th>
                    <th>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {traffic.low_conversion.map((item) => (
                    <tr key={item.site_id}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.subdomain}</td>
                      <td>{item.visits}</td>
                      <td>{item.whatsapp_clicks}</td>
                      <td><span className="admin-table-badge admin-table-badge-warning">{item.ctr_whatsapp}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-panel-empty">Sin ese patrón en el rango actual.</p>
          )}
        </article>
      </section>
    </div>
  );
}

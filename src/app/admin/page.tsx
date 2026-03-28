import Link from "next/link";

import {
  getAdminMetrics,
  getRecentFailedJobs,
  getRecentlyPublishedSites,
  getSitesWithMostRegenerations,
  getTopTemplatesByPublication
} from "@/lib/data/admin/metrics";
import { getAdminTrafficMetrics } from "@/lib/data/admin/traffic-metrics";

type Tone = "neutral" | "positive" | "warning" | "danger";

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${value}%`;
}

function formatLatency(p50: number | null, p95: number | null) {
  const left = p50 === null ? "-" : `${p50} ms`;
  const right = p95 === null ? "-" : `${p95} ms`;
  return `${left} / ${right}`;
}

function MetricCard({
  label,
  value,
  hint,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <article className={`admin-metric-card admin-metric-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : <small> </small>}
    </article>
  );
}

export default async function AdminHomePage() {
  const [metrics, traffic, failedJobs, recentSites, mostRegeneratedSites, topTemplates] = await Promise.all([
    getAdminMetrics("7d"),
    getAdminTrafficMetrics("7d"),
    getRecentFailedJobs(8),
    getRecentlyPublishedSites(8),
    getSitesWithMostRegenerations(8, "7d"),
    getTopTemplatesByPublication(6, "7d")
  ]);

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <section className="admin-hero-panel">
        <div className="stack" style={{ gap: "0.35rem" }}>
          <small className="admin-eyebrow">Vista 7 días</small>
          <h2>Dashboard Ejecutivo</h2>
          <p>Monitorea salud de plataforma, conversión y rendimiento de sitios publicados.</p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/admin/users" className="btn-secondary">
            Gestionar usuarios
          </Link>
          <Link href="/admin/sites" className="btn-secondary">
            Moderar sitios
          </Link>
          <Link href="/admin/ai-jobs" className="btn-primary">
            Revisar jobs IA
          </Link>
        </div>
      </section>

      <section className="admin-metric-grid">
        <MetricCard label="Sitios creados" value={metrics.sitesCreated} hint="últimos 7 días" />
        <MetricCard label="Sitios publicados" value={metrics.sitesPublished} hint="últimos 7 días" tone="positive" />
        <MetricCard label="Jobs IA totales" value={metrics.aiJobsTotal} hint="procesamiento generado" />
        <MetricCard label="Jobs IA fallidos" value={metrics.aiJobsFailed} hint="requieren revisión" tone="danger" />
        <MetricCard label="Fallback IA" value={metrics.aiJobsFallback} hint="modo alterno activado" tone="warning" />
        <MetricCard label="Latencia IA p50/p95" value={formatLatency(metrics.latencyP50Ms, metrics.latencyP95Ms)} />
        <MetricCard
          label="% publicación <24h"
          value={formatPercent(metrics.publishIn24hRate)}
          hint="métrica de activación"
          tone="positive"
        />
        <MetricCard
          label="First result acceptance"
          value={formatPercent(metrics.firstResultAcceptanceRate)}
          hint="calidad del primer resultado"
          tone="positive"
        />
        <MetricCard label="Voice usage rate" value={formatPercent(metrics.voiceUsageRate)} hint="onboarding voz" />
        <MetricCard
          label="Refine fallback rate"
          value={formatPercent(metrics.onboardingRefineFallbackRate)}
          hint="debería bajar con proveedor IA"
          tone="warning"
        />
        <MetricCard
          label="% plantilla recomendada"
          value={formatPercent(metrics.templateRecommendedPickRate)}
          hint="adopción de recomendación"
        />
        <MetricCard label="% aceptación v3" value={formatPercent(metrics.v2FirstResultAcceptanceRate)} hint="resultado visual v3" />
        <MetricCard label="Regeneraciones p50/p95" value={`${metrics.regenerationsP50 ?? "-"} / ${metrics.regenerationsP95 ?? "-"}`} />
        <MetricCard label="Regeneración promedio/template" value={metrics.regenerationAvgPerTemplate ?? "-"} />
        <MetricCard label="Límite IA alcanzado" value={metrics.limitHitAiCount} tone="warning" />
        <MetricCard label="Límite publish alcanzado" value={metrics.limitHitPublishCount} tone="warning" />
        <MetricCard label="Visitas públicas" value={metrics.trafficVisits} tone="positive" />
        <MetricCard label="Clic WhatsApp" value={metrics.trafficWhatsappClicks} tone="positive" />
        <MetricCard label="Clic CTA" value={metrics.trafficCtaClicks} />
        <MetricCard label="CTR WhatsApp global" value={`${metrics.trafficWhatsappCtr}%`} tone="positive" />
      </section>

      <section className="admin-panel-grid">
        <article className="admin-panel admin-panel-wide stack">
          <div className="admin-panel-head">
            <h3>Últimos jobs fallidos</h3>
            <Link href="/admin/ai-jobs" className="btn-secondary">
              Ver todos
            </Link>
          </div>
          {failedJobs.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Sitio</th>
                    <th>Usuario</th>
                    <th>Error</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {failedJobs.map((job) => (
                    <tr key={job.id}>
                      <td>{job.id.slice(0, 8)}</td>
                      <td>{job.site_id.slice(0, 8)}</td>
                      <td>{job.created_by_email ?? "-"}</td>
                      <td>{job.error ?? "-"}</td>
                      <td>{new Date(job.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sin fallos recientes.</p>
          )}
        </article>

        <article className="admin-panel stack">
          <div className="admin-panel-head">
            <h3>Solicitudes Pro</h3>
            <Link href="/admin/pro-requests" className="btn-secondary">
              Gestionar
            </Link>
          </div>
          <div className="admin-badges">
            <span className="admin-badge">Pendientes: {metrics.proRequestsPending}</span>
            <span className="admin-badge">Aprobadas: {metrics.proRequestsApproved}</span>
            <span className="admin-badge">Rechazadas: {metrics.proRequestsRejected}</span>
          </div>
          <p>El flujo manual sigue disponible como fallback de soporte mientras Stripe se vuelve el camino principal.</p>
        </article>

        <article className="admin-panel admin-panel-wide stack">
          <div className="admin-panel-head">
            <h3>Sitios publicados recientemente</h3>
            <Link href="/admin/sites" className="btn-secondary">
              Ver sitios
            </Link>
          </div>
          {recentSites.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sitio</th>
                    <th>Subdominio</th>
                    <th>Owner</th>
                    <th>Tipo</th>
                    <th>Publicado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSites.map((site) => (
                    <tr key={`${site.site_id}-${site.published_at}`}>
                      <td>{site.name}</td>
                      <td>{site.subdomain}</td>
                      <td>{site.owner_email ?? "-"}</td>
                      <td>{site.site_type}</td>
                      <td>{new Date(site.published_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sin publicaciones recientes.</p>
          )}
        </article>

        <article className="admin-panel stack">
          <h3>Top templates por publicación</h3>
          {topTemplates.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Template</th>
                    <th>Publicaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {topTemplates.map((item) => (
                    <tr key={item.templateId}>
                      <td>{item.templateId}</td>
                      <td>{item.publicationsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sin publicaciones v3 en el rango actual.</p>
          )}
        </article>

        <article className="admin-panel stack">
          <h3>Sitios con más regeneraciones</h3>
          {mostRegeneratedSites.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sitio</th>
                    <th>Subdominio</th>
                    <th>Owner</th>
                    <th>Regeneraciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mostRegeneratedSites.map((site) => (
                    <tr key={site.site_id}>
                      <td>{site.name}</td>
                      <td>{site.subdomain}</td>
                      <td>{site.owner_email ?? "-"}</td>
                      <td>{site.regenerations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sin regeneraciones en el rango actual.</p>
          )}
        </article>

        <article className="admin-panel admin-panel-wide stack">
          <h3>Traffic & Conversion: top por visitas</h3>
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
                      <td>{item.name}</td>
                      <td>{item.subdomain}</td>
                      <td>{item.visits}</td>
                      <td>{item.whatsapp_clicks}</td>
                      <td>{item.ctr_whatsapp}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sin tráfico en el rango actual.</p>
          )}
        </article>

        <article className="admin-panel stack">
          <h3>Top por clic WhatsApp</h3>
          {traffic.top_by_whatsapp.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sitio</th>
                    <th>Subdominio</th>
                    <th>WhatsApp</th>
                    <th>Visitas</th>
                    <th>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {traffic.top_by_whatsapp.map((item) => (
                    <tr key={item.site_id}>
                      <td>{item.name}</td>
                      <td>{item.subdomain}</td>
                      <td>{item.whatsapp_clicks}</td>
                      <td>{item.visits}</td>
                      <td>{item.ctr_whatsapp}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sin clics a WhatsApp en el rango actual.</p>
          )}
        </article>

        <article className="admin-panel stack">
          <h3>Alto tráfico y baja conversión</h3>
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
                      <td>{item.name}</td>
                      <td>{item.subdomain}</td>
                      <td>{item.visits}</td>
                      <td>{item.whatsapp_clicks}</td>
                      <td>{item.ctr_whatsapp}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No hay sitios con ese patrón en el rango actual.</p>
          )}
        </article>
      </section>
    </div>
  );
}

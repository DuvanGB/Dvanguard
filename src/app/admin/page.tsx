import Link from "next/link";

import {
  getAdminMetrics,
  getRecentFailedJobs,
  getRecentlyPublishedSites,
  getSitesWithMostRegenerations,
  getTopTemplatesByPublication
} from "@/lib/data/admin/metrics";
import { getAdminTrafficMetrics } from "@/lib/data/admin/traffic-metrics";

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
    <div className="stack">
      <section className="catalog-grid">
        <article className="card stack">
          <strong>Sitios creados (7d)</strong>
          <span>{metrics.sitesCreated}</span>
        </article>
        <article className="card stack">
          <strong>Sitios publicados (7d)</strong>
          <span>{metrics.sitesPublished}</span>
        </article>
        <article className="card stack">
          <strong>Jobs IA totales (7d)</strong>
          <span>{metrics.aiJobsTotal}</span>
        </article>
        <article className="card stack">
          <strong>Jobs IA fallidos (7d)</strong>
          <span>{metrics.aiJobsFailed}</span>
        </article>
        <article className="card stack">
          <strong>Fallback IA (7d)</strong>
          <span>{metrics.aiJobsFallback}</span>
        </article>
        <article className="card stack">
          <strong>Latencia p50/p95</strong>
          <span>
            {metrics.latencyP50Ms ?? "-"} ms / {metrics.latencyP95Ms ?? "-"} ms
          </span>
        </article>
        <article className="card stack">
          <strong>% publicación en 24h</strong>
          <span>{metrics.publishIn24hRate ?? "-"}%</span>
        </article>
        <article className="card stack">
          <strong>Límite IA alcanzado (7d)</strong>
          <span>{metrics.limitHitAiCount}</span>
        </article>
        <article className="card stack">
          <strong>Límite publish alcanzado (7d)</strong>
          <span>{metrics.limitHitPublishCount}</span>
        </article>
        <article className="card stack">
          <strong>Solicitudes Pro</strong>
          <span>
            pending {metrics.proRequestsPending} | approved {metrics.proRequestsApproved} | rejected{" "}
            {metrics.proRequestsRejected}
          </span>
        </article>
        <article className="card stack">
          <strong>First result acceptance (7d)</strong>
          <span>{metrics.firstResultAcceptanceRate ?? "-"}%</span>
        </article>
        <article className="card stack">
          <strong>Voice usage rate (7d)</strong>
          <span>{metrics.voiceUsageRate ?? "-"}%</span>
        </article>
        <article className="card stack">
          <strong>Refine fallback rate (7d)</strong>
          <span>{metrics.onboardingRefineFallbackRate ?? "-"}%</span>
        </article>
        <article className="card stack">
          <strong>Regeneraciones p50/p95</strong>
          <span>
            {metrics.regenerationsP50 ?? "-"} / {metrics.regenerationsP95 ?? "-"}
          </span>
        </article>
        <article className="card stack">
          <strong>% plantilla recomendada elegida</strong>
          <span>{metrics.templateRecommendedPickRate ?? "-"}%</span>
        </article>
        <article className="card stack">
          <strong>% aceptación primer resultado v2</strong>
          <span>{metrics.v2FirstResultAcceptanceRate ?? "-"}%</span>
        </article>
        <article className="card stack">
          <strong>Regeneración promedio/template</strong>
          <span>{metrics.regenerationAvgPerTemplate ?? "-"}</span>
        </article>
        <article className="card stack">
          <strong>Visitas públicas (7d)</strong>
          <span>{metrics.trafficVisits}</span>
        </article>
        <article className="card stack">
          <strong>Clic WhatsApp (7d)</strong>
          <span>{metrics.trafficWhatsappClicks}</span>
        </article>
        <article className="card stack">
          <strong>Clic CTA (7d)</strong>
          <span>{metrics.trafficCtaClicks}</span>
        </article>
        <article className="card stack">
          <strong>CTR WhatsApp global</strong>
          <span>{metrics.trafficWhatsappCtr}%</span>
        </article>
      </section>

      <section className="card stack">
        <h2>Últimos jobs fallidos</h2>
        {failedJobs.length ? (
          <table>
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
        ) : (
          <p>Sin fallos recientes.</p>
        )}
        <Link href="/admin/ai-jobs" className="btn-secondary">
          Ver todos los jobs IA
        </Link>
      </section>

      <section className="card stack">
        <h2>Sitios publicados recientemente</h2>
        {recentSites.length ? (
          <table>
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
        ) : (
          <p>Sin publicaciones recientes.</p>
        )}
        <Link href="/admin/sites" className="btn-secondary">
          Ver todos los sitios
        </Link>
      </section>

      <section className="card stack">
        <h2>Solicitudes Pro</h2>
        <p>Gestiona activaciones manuales de plan Pro para validar monetización antes de integrar Stripe.</p>
        <Link href="/admin/pro-requests" className="btn-secondary">
          Gestionar solicitudes Pro
        </Link>
      </section>

      <section className="card stack">
        <h2>Sitios con más regeneraciones (7d)</h2>
        {mostRegeneratedSites.length ? (
          <table>
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
        ) : (
          <p>Sin regeneraciones en el rango actual.</p>
        )}
      </section>

      <section className="card stack">
        <h2>Top templates por publicación (7d)</h2>
        {topTemplates.length ? (
          <table>
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
        ) : (
          <p>Sin publicaciones v2 en el rango actual.</p>
        )}
      </section>

      <section className="card stack">
        <h2>Top sitios por visitas (7d)</h2>
        {traffic.top_by_visits.length ? (
          <table>
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
        ) : (
          <p>Sin tráfico en el rango actual.</p>
        )}
      </section>

      <section className="card stack">
        <h2>Top sitios por clic WhatsApp (7d)</h2>
        {traffic.top_by_whatsapp.length ? (
          <table>
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
        ) : (
          <p>Sin clics a WhatsApp en el rango actual.</p>
        )}
      </section>

      <section className="card stack">
        <h2>Alto tráfico y baja conversión (7d)</h2>
        {traffic.low_conversion.length ? (
          <table>
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
        ) : (
          <p>No hay sitios con ese patrón en el rango actual.</p>
        )}
      </section>
    </div>
  );
}

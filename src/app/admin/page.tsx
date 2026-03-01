import Link from "next/link";

import { getAdminMetrics, getRecentFailedJobs, getRecentlyPublishedSites } from "@/lib/data/admin/metrics";

export default async function AdminHomePage() {
  const [metrics, failedJobs, recentSites] = await Promise.all([
    getAdminMetrics("7d"),
    getRecentFailedJobs(8),
    getRecentlyPublishedSites(8)
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
    </div>
  );
}

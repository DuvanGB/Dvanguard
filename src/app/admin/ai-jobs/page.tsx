import Link from "next/link";

import { AdminPaginationSummary } from "@/components/admin/admin-pagination-summary";
import { RetryJobButton } from "@/components/admin/retry-job-button";
import { listAdminAiJobs } from "@/lib/data/admin/ai-jobs";

function buildQuery(searchParams: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams();
  if (searchParams.status) query.set("status", searchParams.status);
  if (searchParams.siteId) query.set("siteId", searchParams.siteId);
  if (searchParams.userId) query.set("userId", searchParams.userId);
  if (searchParams.from) query.set("from", searchParams.from);
  if (searchParams.to) query.set("to", searchParams.to);
  query.set("page", String(page));
  query.set("pageSize", searchParams.pageSize ?? "20");
  return query.toString();
}

export default async function AdminAiJobsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");

  const result = await listAdminAiJobs({
    status: params.status,
    siteId: params.siteId,
    userId: params.userId,
    from: params.from,
    to: params.to,
    page: params.page,
    pageSize: params.pageSize
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <section className="admin-page-stack">
      <article className="admin-panel stack">
      <div className="admin-panel-head">
        <div className="stack" style={{ gap: "0.3rem" }}>
          <h2>Jobs IA</h2>
          <p>Audita colas, fallos, latencia y reintentos del pipeline de generación.</p>
        </div>
        <AdminPaginationSummary
          label={`${result.total} jobs · página ${page}/${totalPages}`}
          prevHref={`/admin/ai-jobs?${buildQuery(params, Math.max(1, page - 1))}`}
          nextHref={`/admin/ai-jobs?${buildQuery(params, Math.min(totalPages, page + 1))}`}
          disablePrev={page <= 1}
          disableNext={page >= totalPages}
        />
      </div>

      <form className="admin-filters-grid" action="/admin/ai-jobs" method="get">
        <label>
          Estado
          <select name="status" defaultValue={params.status ?? ""}>
            <option value="">Todos</option>
            <option value="queued">queued</option>
            <option value="processing">processing</option>
            <option value="done">done</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <label>
          Site ID
          <input name="siteId" defaultValue={params.siteId ?? ""} />
        </label>
        <label>
          User ID
          <input name="userId" defaultValue={params.userId ?? ""} />
        </label>
        <label>
          Desde (ISO)
          <input name="from" defaultValue={params.from ?? ""} placeholder="2026-02-01T00:00:00.000Z" />
        </label>
        <label>
          Hasta (ISO)
          <input name="to" defaultValue={params.to ?? ""} placeholder="2026-03-01T23:59:59.999Z" />
        </label>
        <div style={{ display: "flex", alignItems: "end" }}>
          <button className="btn-secondary" type="submit">
            Filtrar
          </button>
        </div>
      </form>

      {result.items.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Sitio</th>
              <th>Usuario</th>
              <th>Status</th>
              <th>Latencia</th>
              <th>Fallback</th>
              <th>Intento</th>
              <th>Creado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.id}>
                <td>{item.id.slice(0, 8)}</td>
                <td>
                  {item.site_name ?? item.site_id.slice(0, 8)} ({item.site_subdomain ?? "-"})
                </td>
                <td>{item.created_by_email ?? item.created_by}</td>
                <td>{item.status}</td>
                <td>{item.latency_ms ?? "-"}</td>
                <td>{item.fallback_reason ?? "-"}</td>
                <td>{item.attempt}</td>
                <td>{new Date(item.created_at).toLocaleString()}</td>
                <td>
                  {item.status === "failed" ? <RetryJobButton jobId={item.id} /> : <span>-</span>}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      ) : (
        <p>No hay jobs para este filtro.</p>
      )}

      <div className="admin-pagination-row">
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link
            className="btn-secondary"
            href={`/admin/ai-jobs?${buildQuery(params, Math.max(1, page - 1))}`}
            aria-disabled={page <= 1}
          >
            Anterior
          </Link>
          <Link
            className="btn-secondary"
            href={`/admin/ai-jobs?${buildQuery(params, Math.min(totalPages, page + 1))}`}
            aria-disabled={page >= totalPages}
          >
            Siguiente
          </Link>
        </div>
        <small>
          Página {page} de {totalPages} | Total {result.total}
        </small>
      </div>
      </article>
    </section>
  );
}

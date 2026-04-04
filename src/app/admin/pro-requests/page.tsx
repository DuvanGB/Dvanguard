import Link from "next/link";

import { AdminPaginationSummary } from "@/components/admin/admin-pagination-summary";
import { ReviewProRequestButton } from "@/components/admin/review-pro-request-button";
import { listAdminProRequests } from "@/lib/data/admin/pro-requests";

function buildQuery(searchParams: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams();
  if (searchParams.status) query.set("status", searchParams.status);
  query.set("page", String(page));
  query.set("pageSize", searchParams.pageSize ?? "20");
  return query.toString();
}

export default async function AdminProRequestsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");

  const result = await listAdminProRequests({
    status: params.status,
    page: params.page,
    pageSize: params.pageSize
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <section className="admin-page-stack">
      <article className="admin-panel stack">
      <div className="admin-panel-head">
        <div className="stack stack-sm">
          <h2>Solicitudes Pro</h2>
          <p>Revisa solicitudes manuales de upgrade y su estado operativo.</p>
        </div>
        <AdminPaginationSummary
          label={`${result.total} solicitudes · página ${page}/${totalPages}`}
          prevHref={`/admin/pro-requests?${buildQuery(params, Math.max(1, page - 1))}`}
          nextHref={`/admin/pro-requests?${buildQuery(params, Math.min(totalPages, page + 1))}`}
          disablePrev={page <= 1}
          disableNext={page >= totalPages}
        />
      </div>

      <form className="admin-filters-grid" action="/admin/pro-requests" method="get">
        <label>
          Estado
          <select name="status" defaultValue={params.status ?? ""}>
            <option value="">Todos</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
        </label>
        <div className="flex-row" style={{ alignItems: "end" }}>
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
              <th>ID</th>
              <th>Usuario</th>
              <th>Status</th>
              <th>Creada</th>
              <th>Revisada por</th>
              <th>Revisada en</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.id}>
                <td>{item.id.slice(0, 8)}</td>
                <td>{item.user_email ?? item.user_id}</td>
                <td>{item.status}</td>
                <td>{new Date(item.created_at).toLocaleString()}</td>
                <td>{item.reviewed_by_email ?? "-"}</td>
                <td>{item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : "-"}</td>
                <td>
                  {item.status === "pending" ? (
                    <div className="flex-row">
                      <ReviewProRequestButton requestId={item.id} decision="approved" />
                      <ReviewProRequestButton requestId={item.id} decision="rejected" />
                    </div>
                  ) : (
                    <span>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      ) : (
        <p>No hay solicitudes para este filtro.</p>
      )}

      <div className="admin-pagination-row">
        <div className="flex-wrap">
          <Link
            className="btn-secondary"
            href={`/admin/pro-requests?${buildQuery(params, Math.max(1, page - 1))}`}
            aria-disabled={page <= 1}
          >
            Anterior
          </Link>
          <Link
            className="btn-secondary"
            href={`/admin/pro-requests?${buildQuery(params, Math.min(totalPages, page + 1))}`}
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

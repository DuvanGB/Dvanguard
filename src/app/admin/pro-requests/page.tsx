import Link from "next/link";

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
    <section className="card stack">
      <h2>Solicitudes Pro</h2>

      <form className="stack" action="/admin/pro-requests" method="get">
        <label>
          Estado
          <select name="status" defaultValue={params.status ?? ""}>
            <option value="">Todos</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
        </label>
        <button className="btn-secondary" type="submit">
          Filtrar
        </button>
      </form>

      {result.items.length ? (
        <table>
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
                    <div style={{ display: "flex", gap: "0.5rem" }}>
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
      ) : (
        <p>No hay solicitudes para este filtro.</p>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
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
    </section>
  );
}

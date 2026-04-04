import Link from "next/link";

import { AdminPaginationSummary } from "@/components/admin/admin-pagination-summary";
import { ChangePlanSelect } from "@/components/admin/change-plan-select";
import { listAdminUsers } from "@/lib/data/admin/users";

function buildQuery(searchParams: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams();
  if (searchParams.search) query.set("search", searchParams.search);
  query.set("page", String(page));
  query.set("pageSize", searchParams.pageSize ?? "20");
  return query.toString();
}

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");

  const result = await listAdminUsers({
    search: params.search,
    page: params.page,
    pageSize: params.pageSize
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <section className="admin-page-stack">
      <article className="admin-panel stack">
      <div className="admin-panel-head">
        <div className="stack stack-sm">
          <h2>Usuarios</h2>
          <p>Soporte de cuentas, planes, billing y actividad reciente.</p>
        </div>
        <AdminPaginationSummary
          label={`${result.total} usuarios · página ${page}/${totalPages}`}
          prevHref={`/admin/users?${buildQuery(params, Math.max(1, page - 1))}`}
          nextHref={`/admin/users?${buildQuery(params, Math.min(totalPages, page + 1))}`}
          disablePrev={page <= 1}
          disableNext={page >= totalPages}
        />
      </div>

      <form className="admin-filters-grid" action="/admin/users" method="get">
        <label>
          Buscar por email
          <input name="search" defaultValue={params.search ?? ""} />
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
                <th>Email</th>
                <th>Plan</th>
                <th>Billing</th>
                <th>Ciclo</th>
                <th>Alta</th>
                <th>Total sitios</th>
                <th>Publicados</th>
                <th>Última actividad</th>
                <th>Acción plan</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.email}</td>
                  <td>{item.plan_code}</td>
                  <td>
                    {item.billing_status ?? "-"}
                    {item.billing_rail ? ` · ${item.billing_rail}` : ""}
                    {item.billing_method ? ` · ${item.billing_method}` : ""}
                  </td>
                  <td>
                    {item.billing_interval ?? "-"}
                    {item.billing_cancel_at_period_end ? " (cancelación fin de periodo)" : ""}
                  </td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>{item.total_sites}</td>
                  <td>{item.published_sites}</td>
                  <td>{item.last_activity ? new Date(item.last_activity).toLocaleString() : "-"}</td>
                  <td>
                    <ChangePlanSelect userId={item.id} currentPlan={item.plan_code} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No hay usuarios para este filtro.</p>
      )}

      <div className="admin-pagination-row">
        <div className="flex-wrap">
          <Link
            className="btn-secondary"
            href={`/admin/users?${buildQuery(params, Math.max(1, page - 1))}`}
            aria-disabled={page <= 1}
          >
            Anterior
          </Link>
          <Link
            className="btn-secondary"
            href={`/admin/users?${buildQuery(params, Math.min(totalPages, page + 1))}`}
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

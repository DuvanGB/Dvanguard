import Link from "next/link";

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
    <section className="card stack">
      <h2>Usuarios</h2>

      <form className="stack" action="/admin/users" method="get">
        <label>
          Buscar por email
          <input name="search" defaultValue={params.search ?? ""} />
        </label>
        <button className="btn-secondary" type="submit">
          Filtrar
        </button>
      </form>

      {result.items.length ? (
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Alta</th>
              <th>Total sitios</th>
              <th>Publicados</th>
              <th>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.id}>
                <td>{item.email}</td>
                <td>{new Date(item.created_at).toLocaleString()}</td>
                <td>{item.total_sites}</td>
                <td>{item.published_sites}</td>
                <td>{item.last_activity ? new Date(item.last_activity).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No hay usuarios para este filtro.</p>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
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
    </section>
  );
}

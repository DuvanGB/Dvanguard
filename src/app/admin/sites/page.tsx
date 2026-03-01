import Link from "next/link";

import { listAdminSites } from "@/lib/data/admin/sites";

function buildQuery(searchParams: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams();
  if (searchParams.status) query.set("status", searchParams.status);
  if (searchParams.type) query.set("type", searchParams.type);
  if (searchParams.owner) query.set("owner", searchParams.owner);
  query.set("page", String(page));
  query.set("pageSize", searchParams.pageSize ?? "20");
  return query.toString();
}

export default async function AdminSitesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");

  const result = await listAdminSites({
    status: params.status,
    type: params.type,
    owner: params.owner,
    page: params.page,
    pageSize: params.pageSize
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <section className="card stack">
      <h2>Sitios</h2>

      <form className="stack" action="/admin/sites" method="get">
        <label>
          Estado
          <select name="status" defaultValue={params.status ?? ""}>
            <option value="">Todos</option>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label>
          Tipo
          <select name="type" defaultValue={params.type ?? ""}>
            <option value="">Todos</option>
            <option value="informative">informative</option>
            <option value="commerce_lite">commerce_lite</option>
          </select>
        </label>
        <label>
          Owner email
          <input name="owner" defaultValue={params.owner ?? ""} />
        </label>
        <button className="btn-secondary" type="submit">
          Filtrar
        </button>
      </form>

      {result.items.length ? (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Subdominio</th>
              <th>Owner</th>
              <th>Estado</th>
              <th>Tipo</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.subdomain}</td>
                <td>{item.owner_email ?? "-"}</td>
                <td>{item.status}</td>
                <td>{item.site_type}</td>
                <td>{new Date(item.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No hay sitios para este filtro.</p>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Link
          className="btn-secondary"
          href={`/admin/sites?${buildQuery(params, Math.max(1, page - 1))}`}
          aria-disabled={page <= 1}
        >
          Anterior
        </Link>
        <Link
          className="btn-secondary"
          href={`/admin/sites?${buildQuery(params, Math.min(totalPages, page + 1))}`}
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

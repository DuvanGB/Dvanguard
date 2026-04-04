import Link from "next/link";

import { AdminPaginationSummary } from "@/components/admin/admin-pagination-summary";
import { SiteModerationActions } from "@/components/admin/site-moderation-actions";
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
    <section className="admin-page-stack">
      <article className="admin-panel stack">
        <div className="admin-panel-head">
          <div className="stack stack-sm">
            <h2>Moderación de sitios</h2>
            <p>Supervisa estado, owner, dominios y rendimiento reciente sin salir del módulo admin.</p>
          </div>
          <AdminPaginationSummary
            label={`${result.total} sitios · página ${page}/${totalPages}`}
            prevHref={`/admin/sites?${buildQuery(params, Math.max(1, page - 1))}`}
            nextHref={`/admin/sites?${buildQuery(params, Math.min(totalPages, page + 1))}`}
            disablePrev={page <= 1}
            disableNext={page >= totalPages}
          />
        </div>

        <form className="admin-filters-grid" action="/admin/sites" method="get">
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
          <div className="flex-row" style={{ alignItems: "end" }}>
            <button className="btn-secondary" type="submit">
              Filtrar
            </button>
          </div>
        </form>
      </article>

      {result.items.length ? (
        <div className="admin-results-stack">
          <div className="admin-site-card-grid">
            {result.items.map((item) => (
              <article key={item.id} className="admin-site-card stack">
                <div className="admin-site-card-head">
                  <div className="stack stack-xs">
                    <strong>{item.name}</strong>
                    <small className="muted">
                      {item.subdomain}
                      {item.primary_domain ? ` · ${item.primary_domain}` : ""}
                    </small>
                  </div>
                  <div className="admin-badges">
                    <span className="admin-badge">{item.site_type}</span>
                    <span className="admin-badge">{item.status}</span>
                  </div>
                </div>

                <div className="admin-site-card-meta">
                  <span>Owner: {item.owner_email ?? "-"}</span>
                  <span>Creado: {new Date(item.created_at).toLocaleDateString()}</span>
                </div>

                <div className="dashboard-site-metrics">
                  <span>Visitas 30d: {item.analytics.visits}</span>
                  <span>WhatsApp: {item.analytics.whatsapp_clicks}</span>
                  <span>CTA: {item.analytics.cta_clicks}</span>
                </div>

                <div className="admin-site-card-actions">
                  <SiteModerationActions siteId={item.id} status={item.status} />
                </div>
              </article>
            ))}
          </div>

          <div className="admin-pagination-row">
            <div className="flex-wrap">
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
          </div>
        </div>
      ) : (
        <article className="admin-panel">
          <p>No hay sitios para este filtro.</p>
        </article>
      )}
    </section>
  );
}

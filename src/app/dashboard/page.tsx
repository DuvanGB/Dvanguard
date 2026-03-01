import Link from "next/link";

import { CreateSiteForm } from "@/components/forms/create-site-form";
import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, subdomain, status, site_type, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="container stack" style={{ paddingTop: "2rem" }}>
      <header className="stack">
        <h1>Dashboard</h1>
        <p>{user.email}</p>
      </header>

      <CreateSiteForm />

      <section className="stack">
        <h2>Tus sitios</h2>
        {sites?.length ? (
          sites.map((site) => (
            <article key={site.id} className="card stack">
              <strong>{site.name}</strong>
              <span>
                `{site.subdomain}` | {site.site_type} | {site.status}
              </span>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Link className="btn-secondary" href={`/sites/${site.id}`}>
                  Editar
                </Link>
                <Link className="btn-secondary" href={`/onboarding?siteId=${site.id}`}>
                  Regenerar con IA
                </Link>
              </div>
            </article>
          ))
        ) : (
          <p>No tienes sitios creados todavía.</p>
        )}
      </section>
    </main>
  );
}

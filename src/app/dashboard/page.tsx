import Link from "next/link";

import { ProRequestButton } from "@/components/account/pro-request-button";
import { CreateSiteForm } from "@/components/forms/create-site-form";
import { requireUser } from "@/lib/auth";
import { getUsageSnapshot } from "@/lib/billing/usage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();
  const admin = getSupabaseAdminClient();

  const [{ data: sites }, usageResponse, { data: pendingProRequest }] = await Promise.all([
    supabase.from("sites").select("id, name, subdomain, status, site_type, created_at").order("created_at", { ascending: false }),
    getUsageSnapshot(admin, user.id),
    supabase
      .from("pro_requests")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const usage = usageResponse;

  return (
    <main className="container stack" style={{ paddingTop: "2rem" }}>
      <header className="stack">
        <h1>Dashboard</h1>
        <p>{user.email}</p>
        <Link href="/pricing" className="btn-secondary">
          Ver planes
        </Link>
      </header>

      <section className="catalog-grid">
        <article className="card stack">
          <strong>Plan actual</strong>
          <span>{usage.plan.toUpperCase()}</span>
        </article>
        <article className="card stack">
          <strong>Generaciones IA (mes)</strong>
          <span>
            {usage.ai_generations_used} / {usage.ai_generations_limit}
          </span>
        </article>
        <article className="card stack">
          <strong>Sitios publicados</strong>
          <span>
            {usage.published_sites_used} / {usage.published_sites_limit}
          </span>
        </article>
      </section>

      {usage.plan === "free" && (usage.ai_generations_remaining <= 0 || usage.published_sites_remaining <= 0) ? (
        <section className="card stack">
          <h2>Has alcanzado un límite del plan Gratis</h2>
          <p>
            Puedes solicitar plan Pro para ampliar cupos de generaciones IA y cantidad de sitios publicados activos.
          </p>
          {pendingProRequest ? (
            <small>Ya tienes una solicitud Pro pendiente desde {new Date(pendingProRequest.created_at).toLocaleString()}.</small>
          ) : (
            <ProRequestButton />
          )}
        </section>
      ) : null}

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

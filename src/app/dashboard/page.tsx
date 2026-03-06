import Link from "next/link";

import { ProRequestButton } from "@/components/account/pro-request-button";
import { PublishSiteButton } from "@/components/dashboard/publish-site-button";
import { CreateSiteForm } from "@/components/forms/create-site-form";
import { requireUser } from "@/lib/auth";
import { getUsageSnapshot } from "@/lib/billing/usage";
import { getOwnerSiteAnalytics } from "@/lib/data/dashboard/analytics";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();
  const admin = getSupabaseAdminClient();

  const [usageResponse, { data: pendingProRequest }, analytics] = await Promise.all([
    getUsageSnapshot(admin, user.id),
    supabase
      .from("pro_requests")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1),
    getOwnerSiteAnalytics({
      ownerId: user.id,
      range: "7d"
    })
  ]);

  const usage = usageResponse;
  const pendingRequest = pendingProRequest?.[0] ?? null;
  const sites = analytics.sites;

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
        <article className="card stack">
          <strong>Visitas (7d)</strong>
          <span>{analytics.summary.visits}</span>
        </article>
        <article className="card stack">
          <strong>Clic WhatsApp (7d)</strong>
          <span>{analytics.summary.whatsapp_clicks}</span>
        </article>
        <article className="card stack">
          <strong>CTR WhatsApp (7d)</strong>
          <span>{analytics.summary.ctr_whatsapp}%</span>
        </article>
      </section>

      {usage.plan === "free" && (usage.ai_generations_remaining <= 0 || usage.published_sites_remaining <= 0) ? (
        <section className="card stack">
          <h2>Has alcanzado un límite del plan Gratis</h2>
          <p>
            Puedes solicitar plan Pro para ampliar cupos de generaciones IA y cantidad de sitios publicados activos.
          </p>
          {pendingRequest ? (
            <small>Ya tienes una solicitud Pro pendiente desde {new Date(pendingRequest.created_at).toLocaleString()}.</small>
          ) : (
            <ProRequestButton />
          )}
        </section>
      ) : null}

      <CreateSiteForm />

      <section className="stack">
        <h2>Tus sitios</h2>
        {sites.length ? (
          sites.map((site) => (
            <article key={site.site_id} className="card stack">
              <strong>{site.name}</strong>
              <span>
                `{site.subdomain}` | {site.site_type} | {site.status}
              </span>
              <small>
                Activación: {site.checklist_done}/{site.checklist_total}
              </small>
              <small>
                Visitas {site.visits} | WhatsApp {site.whatsapp_clicks} | CTA {site.cta_clicks} | CTR {site.ctr_whatsapp}%
              </small>
              <ul>
                {site.checklist.map((item) => (
                  <li key={item.key}>
                    [{item.done ? "OK" : "PEND"}] {item.label}
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Link className="btn-secondary" href={`/sites/${site.site_id}`}>
                  Editar
                </Link>
                <Link className="btn-secondary" href={`/onboarding?siteId=${site.site_id}`}>
                  Regenerar con IA
                </Link>
                <PublishSiteButton siteId={site.site_id} />
                {site.status === "published" ? (
                  <a className="btn-secondary" href={buildPublicSiteUrl(site.subdomain)} target="_blank" rel="noreferrer">
                    Abrir sitio
                  </a>
                ) : null}
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

function buildPublicSiteUrl(subdomain: string) {
  if (env.rootDomain === "localhost") {
    return `http://${subdomain}.localhost:3000`;
  }
  return `https://${subdomain}.${env.rootDomain}`;
}

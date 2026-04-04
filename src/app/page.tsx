import Link from "next/link";
import { headers } from "next/headers";

import { SiteRenderer } from "@/components/runtime/site-renderer";
import { PlatformNav } from "@/components/platform-nav";
import { PlatformFooter } from "@/components/platform-footer";
import { getPublishedSiteByHostname, getPublishedSiteBySubdomain } from "@/lib/data/public-site";
import { stripPort } from "@/lib/site-domains";
import { getSubdomainFromHost } from "@/lib/tenant";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { getPlatformCopyMap, getPlatformSetting, PLATFORM_SETTING_KEYS } from "@/lib/platform-config";
import { getLocaleFromCookies, localeToScope } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const normalizedHost = stripPort(host);
  const subdomain = getSubdomainFromHost(host);

  if (normalizedHost && !subdomain) {
    try {
      const payload = await getPublishedSiteByHostname(normalizedHost);
      if (payload) {
        return <SiteRenderer spec={payload.siteSpec} trackEvents siteId={payload.id} subdomain={payload.subdomain} enableCart />;
      }
    } catch {
      return (
        <main className="container stack page-with-topbar-sm">
          <h1>Error de configuración</h1>
          <p>Revisa el dominio conectado, `SUPABASE_SERVICE_ROLE_KEY` y el estado de publicación del sitio.</p>
        </main>
      );
    }
  }

  if (subdomain) {
    try {
      const payload = await getPublishedSiteBySubdomain(subdomain);
      if (payload) {
        return <SiteRenderer spec={payload.siteSpec} trackEvents siteId={payload.id} subdomain={payload.subdomain} enableCart />;
      }

      return (
        <main className="container stack page-with-topbar-sm">
          <h1>Sitio no encontrado</h1>
          <p>No existe un sitio publicado para el subdominio `{subdomain}`.</p>
        </main>
      );
    } catch {
      return (
        <main className="container stack page-with-topbar-sm">
          <h1>Error de configuración</h1>
          <p>Revisa `SUPABASE_SERVICE_ROLE_KEY` y el estado de publicación del sitio.</p>
        </main>
      );
    }
  }

  const admin = getSupabaseAdminClient();
  const locale = await getLocaleFromCookies();
  const scope = localeToScope(locale);

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const copyKeys = [
    "home.chip", "home.hero.title", "home.hero.accent", "home.hero.description",
    "home.hero.cta_primary", "home.hero.cta_secondary", "home.proof",
    "home.preview_label", "home.wa_new_message", "home.wa_sample",
    "home.bento.voice.title", "home.bento.voice.desc",
    "home.bento.design.title", "home.bento.design.desc",
    "home.bento.wa.title", "home.bento.wa.desc",
    "home.bento.analytics.title", "home.bento.analytics.desc",
    "home.trust.title",
    "home.testimonial.text", "home.testimonial.author", "home.testimonial.role",
    "home.value1.title", "home.value1.desc",
    "home.value2.title", "home.value2.desc",
    "home.value3.title", "home.value3.desc",
    "home.cta.title", "home.cta.desc", "home.cta.button"
  ];

  const [copy, siteCountResult, waNumber] = await Promise.all([
    getPlatformCopyMap(admin, copyKeys, scope),
    admin.from("sites").select("id", { count: "exact", head: true }),
    getPlatformSetting(admin, PLATFORM_SETTING_KEYS.marketingWhatsappNumber, scope)
  ]);

  const t = (key: string) => copy[key] ?? key;
  const siteCount = siteCountResult.count ?? 0;
  const whatsapp = (waNumber as string) || "573203460370";

  return (
    <>
      <PlatformNav isAuthenticated={isAuthenticated} />
      <main className="marketing-shell">
        {/* ── Hero ──────────────────────────────────────── */}
        <section className="marketing-hero">
          <div className="marketing-hero-copy stack">
            <small className="marketing-chip">
              <span className="material-symbols-outlined">auto_awesome</span>
              {t("home.chip")}
            </small>
            <h1>
              {t("home.hero.title")} <br />
              <span className="accent">{t("home.hero.accent")}</span>
            </h1>
            <p>{t("home.hero.description")}</p>
            <div className="marketing-hero-actions">
              <Link href={isAuthenticated ? "/dashboard" : "/signin"} className="btn-primary">
                {t("home.hero.cta_primary")}
              </Link>
              <Link href="/pricing" className="btn-secondary">
                {t("home.hero.cta_secondary")}
              </Link>
            </div>
            <div className="marketing-proof-row">
              <span>
                <strong>{t("home.proof").replace("{count}", String(siteCount))}</strong>
              </span>
            </div>
          </div>

          <aside className="marketing-hero-panel">
            <div className="marketing-hero-panel-dots">
              <span><i /><i /><i /></span>
              <small>{t("home.preview_label")}</small>
            </div>
            <div style={{ position: "relative" }}>
              <div
                className="marketing-hero-img"
                style={{
                  background: "linear-gradient(135deg, var(--surface-low) 0%, var(--surface-high) 100%)",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  color: "var(--on-surface-variant)",
                  padding: "2rem",
                }}
              >
                <div className="marketing-hero-overlay">
                  <h3>Vanguard Real Estate</h3>
                  <div className="accent-bar" />
                </div>
              </div>
              <div className="marketing-wa-bubble">
                <div className="marketing-wa-bubble-icon">
                  <span className="material-symbols-outlined">chat</span>
                </div>
                <div>
                  <p>{t("home.wa_new_message")}</p>
                  <p>&quot;{t("home.wa_sample").replace(/^"|"$/g, "")}&quot;</p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* ── Bento Features ───────────────────────────── */}
        <section className="marketing-bento">
          <div className="marketing-bento-card span-7 surface-card">
            <div className="marketing-bento-icon primary">
              <span className="material-symbols-outlined">keyboard_voice</span>
            </div>
            <h3>{t("home.bento.voice.title")}</h3>
            <p>{t("home.bento.voice.desc")}</p>
          </div>

          <div className="marketing-bento-card span-5 tinted-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className="marketing-bento-icon secondary">
                <span className="material-symbols-outlined">architecture</span>
              </div>
              <h3>{t("home.bento.design.title")}</h3>
              <p>{t("home.bento.design.desc")}</p>
            </div>
          </div>

          <div className="marketing-bento-card span-5 surface-card" style={{ textAlign: "center" }}>
            <div className="marketing-bento-icon success" style={{ margin: "0 auto 1.5rem" }}>
              <span className="material-symbols-outlined">send</span>
            </div>
            <h3>{t("home.bento.wa.title")}</h3>
            <p>{t("home.bento.wa.desc")}</p>
          </div>

          <div className="marketing-bento-card span-7 dark-card marketing-bento-analytics-grid">
            <div>
              <h3>{t("home.bento.analytics.title")}</h3>
              <p>{t("home.bento.analytics.desc")}</p>
            </div>
            <div className="marketing-bento-analytics">
              <div className="bar-track"><div className="bar-fill" style={{ width: "80%", background: "var(--brand-soft)" }} /></div>
              <div className="bar-track"><div className="bar-fill" style={{ width: "65%", background: "var(--accent)" }} /></div>
              <div className="bar-track"><div className="bar-fill" style={{ width: "50%", background: "var(--secondary-container)" }} /></div>
            </div>
          </div>
        </section>

        {/* ── Trust / Testimonial ──────────────────────── */}
        <section className="marketing-trust">
          <h2>{t("home.trust.title")}</h2>
          <div className="marketing-testimonial">
            <p>
              &quot;{t("home.testimonial.text")}&quot;
            </p>
            <div className="marketing-testimonial-author">
              <div>
                <strong>{t("home.testimonial.author")}</strong>
                <br />
                <small>{t("home.testimonial.role")}</small>
              </div>
            </div>
          </div>
        </section>

        {/* ── Value Grid ───────────────────────────────── */}
        <section className="marketing-value-grid">
          <article className="marketing-value-card">
            <h3>{t("home.value1.title")}</h3>
            <p>{t("home.value1.desc")}</p>
          </article>
          <article className="marketing-value-card">
            <h3>{t("home.value2.title")}</h3>
            <p>{t("home.value2.desc")}</p>
          </article>
          <article className="marketing-value-card">
            <h3>{t("home.value3.title")}</h3>
            <p>{t("home.value3.desc")}</p>
          </article>
        </section>

        {/* ── CTA Banner ───────────────────────────────── */}
        <section className="marketing-cta-banner">
          <div className="stack">
            <h2>{t("home.cta.title")}</h2>
            <p>{t("home.cta.desc")}</p>
          </div>
          <Link href={isAuthenticated ? "/dashboard" : "/signin"} className="btn-primary">
            {t("home.cta.button")}
          </Link>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}

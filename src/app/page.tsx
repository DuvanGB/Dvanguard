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
            {/* ── Desktop browser mockup (background) ── */}
            <div className="hero-desktop-frame">
              <div className="hero-desktop-toolbar">
                <span className="hero-desktop-dots"><i /><i /><i /></span>
                <span className="hero-desktop-url">
                  <span className="material-symbols-outlined">lock</span>
                  vanguardbrews.dvanguard.com
                </span>
                <span />
              </div>
              <div className="hero-desktop-viewport">
                <div className="hero-scanline hero-scanline-desktop" />
                {/* Desktop site — wide layout */}
                <div className="hero-desk-site">
                  {/* Nav */}
                  <div className="hero-desk-nav">
                    <span className="hero-desk-logo">Vanguard Brews</span>
                    <div className="hero-desk-nav-links">
                      <span>Inicio</span><span>Menú</span><span>Reservas</span><span>Contacto</span>
                    </div>
                  </div>
                  {/* Hero banner */}
                  <div className="hero-desk-banner">
                    <div className="hero-desk-banner-content">
                      <h4>Café de Especialidad</h4>
                      <p>Experiencias únicas en cada taza, cultivadas con pasión.</p>
                      <div className="hero-desk-banner-btns">
                        <span className="hero-desk-btn-primary">Ver Menú</span>
                        <span className="hero-desk-btn-secondary">Reservar Mesa</span>
                      </div>
                    </div>
                    <div className="hero-desk-banner-visual">
                      <div className="hero-desk-circle" />
                      <div className="hero-desk-circle hero-desk-circle-2" />
                    </div>
                  </div>
                  {/* Feature cards row */}
                  <div className="hero-desk-features">
                    <div className="hero-desk-feature-card">
                      <span className="material-symbols-outlined">local_cafe</span>
                      <span>Café Premium</span>
                    </div>
                    <div className="hero-desk-feature-card">
                      <span className="material-symbols-outlined">restaurant</span>
                      <span>Brunch</span>
                    </div>
                    <div className="hero-desk-feature-card">
                      <span className="material-symbols-outlined">wifi</span>
                      <span>Coworking</span>
                    </div>
                  </div>
                </div>

                {/* Desktop floating indicators */}
                <div className="hero-desk-analytics">
                  <div className="hero-desk-analytics-header">
                    <span className="material-symbols-outlined">trending_up</span>
                    <span>+42% visitas</span>
                  </div>
                  <div className="hero-desk-bar-row">
                    <div className="hero-desk-bar" style={{ width: "85%" }} />
                    <div className="hero-desk-bar hero-desk-bar-2" style={{ width: "62%" }} />
                    <div className="hero-desk-bar hero-desk-bar-3" style={{ width: "45%" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Phone mockup (foreground, overlaps desktop) ── */}
            <div className="hero-phone-frame">
              <div className="hero-phone-toolbar">
                <span className="hero-phone-dots"><i /><i /><i /></span>
                <span className="hero-phone-live">
                  <i className="hero-live-dot" /> Live
                </span>
              </div>

              <div className="hero-phone-viewport">
                <div className="hero-scanline" />

                <div className="hero-site-content">
                  <div className="hero-site-banner">
                    <div className="hero-site-banner-overlay">
                      <h3>Vanguard Brews</h3>
                    </div>
                  </div>

                  <div className="hero-site-body">
                    <div className="hero-site-accent-bar" />
                    <p className="hero-site-label">MENÚ DEL DÍA</p>
                    <div className="hero-site-menu-item">
                      <span>Cold Brew Signature</span>
                      <span className="hero-site-price">$4.50</span>
                    </div>
                    <div className="hero-site-menu-item">
                      <span>Avocado Toast Art</span>
                      <span className="hero-site-price">$12.00</span>
                    </div>
                    <div className="hero-site-cta-row">
                      <div className="hero-site-cta-btn">
                        <span className="material-symbols-outlined">location_on</span>
                        <small>Visitarnos</small>
                      </div>
                      <div className="hero-site-cta-btn">
                        <span className="material-symbols-outlined">auto_stories</span>
                        <small>Reservar</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hero-notifications">
                  <div className="hero-notif-card hero-notif-lead">
                    <div className="hero-notif-icon hero-notif-icon-primary">
                      <span className="material-symbols-outlined">notifications_active</span>
                    </div>
                    <div>
                      <p className="hero-notif-title">{t("home.wa_new_message")}</p>
                      <p className="hero-notif-desc">Juan S. acaba de suscribirse</p>
                    </div>
                  </div>
                  <div className="hero-notif-card hero-notif-wa">
                    <div className="hero-notif-icon hero-notif-icon-wa">
                      <span className="material-symbols-outlined">chat</span>
                    </div>
                    <div>
                      <p className="hero-notif-title">Nueva Orden</p>
                      <p className="hero-notif-desc">&quot;{t("home.wa_sample").replace(/^"|"$/g, "")}&quot;</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Floating editing tools ── */}
            <div className="hero-tool-palette">
              <i className="hero-swatch" style={{ background: "var(--primary)" }} />
              <i className="hero-swatch" style={{ background: "var(--secondary)", opacity: 0.5 }} />
              <i className="hero-swatch" style={{ background: "var(--accent)", opacity: 0.5 }} />
              <span className="material-symbols-outlined">palette</span>
            </div>

            <div className="hero-tool-drag">
              <span className="material-symbols-outlined">drag_indicator</span>
              <span>Sección 02</span>
            </div>

            <div className="hero-tool-cursor">
              <span className="hero-cursor-label">Editar Texto</span>
              <span className="hero-cursor-blink" />
            </div>

            {/* ── Caption ── */}
            <div className="hero-panel-caption">
              <p className="hero-panel-caption-label">{t("home.preview_label")}</p>
              <h3>Crea. Edita. Crece.</h3>
            </div>

            {/* Decorative blurs */}
            <div className="hero-blur hero-blur-1" />
            <div className="hero-blur hero-blur-2" />
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

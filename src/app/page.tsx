import Link from "next/link";
import { headers } from "next/headers";

import { SiteRenderer } from "@/components/runtime/site-renderer";
import { PlatformNav } from "@/components/platform-nav";
import { PlatformFooter } from "@/components/platform-footer";
import { getPublishedSiteByHostname, getPublishedSiteBySubdomain } from "@/lib/data/public-site";
import { stripPort } from "@/lib/site-domains";
import { getSubdomainFromHost } from "@/lib/tenant";

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
        <main className="container stack" style={{ paddingTop: "3rem" }}>
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
        <main className="container stack" style={{ paddingTop: "3rem" }}>
          <h1>Sitio no encontrado</h1>
          <p>No existe un sitio publicado para el subdominio `{subdomain}`.</p>
        </main>
      );
    } catch {
      return (
        <main className="container stack" style={{ paddingTop: "3rem" }}>
          <h1>Error de configuración</h1>
          <p>Revisa `SUPABASE_SERVICE_ROLE_KEY` y el estado de publicación del sitio.</p>
        </main>
      );
    }
  }

  return (
    <>
      <PlatformNav />
      <main className="marketing-shell">
        {/* ── Hero ──────────────────────────────────────── */}
        <section className="marketing-hero">
          <div className="marketing-hero-copy stack">
            <small className="marketing-chip">
              <span className="material-symbols-outlined">auto_awesome</span>
              IA de última generación para LATAM
            </small>
            <h1>
              Tu negocio en línea <br />
              <span className="accent">en segundos</span>
            </h1>
            <p>
              La plataforma de IA para el emprendedor LATAM. Habla, crea y vende por WhatsApp.
              Olvídate de la complejidad técnica y enfócate en crecer.
            </p>
            <div className="marketing-hero-actions">
              <Link href="/signin" className="btn-primary">
                Crear sitio gratis
              </Link>
              <Link href="/pricing" className="btn-secondary">
                Ver planes
              </Link>
            </div>
            <div className="marketing-proof-row">
              <span>
                <strong>500+ sitios creados</strong> en Colombia y México
              </span>
            </div>
          </div>

          <aside className="marketing-hero-panel">
            <div className="marketing-hero-panel-dots">
              <span><i /><i /><i /></span>
              <small>Preview Mode</small>
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
                  <p>Nuevo mensaje</p>
                  <p>&quot;Hola, me interesa!&quot;</p>
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
            <h3>Crea con tu voz</h3>
            <p>
              No necesitas escribir código ni diseñar. Solo describe tu negocio por audio y nuestra IA
              se encarga de estructurar el contenido, elegir las imágenes y optimizar el sitio para vender.
            </p>
          </div>

          <div className="marketing-bento-card span-5 tinted-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className="marketing-bento-icon secondary">
                <span className="material-symbols-outlined">architecture</span>
              </div>
              <h3>Diseño a Medida</h3>
              <p>
                Layouts curados específicamente para el mercado latinoamericano.
                Minimalismo que transmite confianza y profesionalismo.
              </p>
            </div>
            <span className="bento-cta">
              Explorar estilos <span className="material-symbols-outlined">arrow_forward</span>
            </span>
          </div>

          <div className="marketing-bento-card span-5 surface-card" style={{ textAlign: "center" }}>
            <div className="marketing-bento-icon success" style={{ margin: "0 auto 1.5rem" }}>
              <span className="material-symbols-outlined">send</span>
            </div>
            <h3>Integración WhatsApp</h3>
            <p>
              Recibe todos tus pedidos y consultas directamente en tu chat.
              Convierte visitantes en clientes al instante.
            </p>
          </div>

          <div className="marketing-bento-card span-7 dark-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "center" }}>
            <div>
              <h3>Data Analytics</h3>
              <p>
                Entiende quién visita tu sitio y qué productos les interesan más
                con nuestro panel simplificado.
              </p>
            </div>
            <div className="marketing-bento-analytics">
              <div className="bar-track"><div className="bar-fill" style={{ width: "80%", background: "#9cf0ff" }} /></div>
              <div className="bar-track"><div className="bar-fill" style={{ width: "65%", background: "#00daf3" }} /></div>
              <div className="bar-track"><div className="bar-fill" style={{ width: "50%", background: "#00e3fd" }} /></div>
            </div>
          </div>
        </section>

        {/* ── Trust / Testimonial ──────────────────────── */}
        <section className="marketing-trust">
          <h2>Impulsando el ecosistema LATAM</h2>
          <div className="marketing-testimonial">
            <p>
              &quot;DVanguard cambió la forma en que mi estudio de arquitectura se presenta al mundo.
              Creamos el portafolio en una tarde usando solo notas de voz.&quot;
            </p>
            <div className="marketing-testimonial-author">
              <div>
                <strong>Alex Vanguard</strong>
                <br />
                <small>Lead Designer, Premium Tier</small>
              </div>
            </div>
          </div>
        </section>

        {/* ── Value Grid ───────────────────────────────── */}
        <section className="marketing-value-grid">
          <article className="marketing-value-card">
            <h3>Hecho para WhatsApp commerce</h3>
            <p>CTA priorizado, mensajes claros y experiencia móvil para convertir tráfico social en conversaciones.</p>
          </article>
          <article className="marketing-value-card">
            <h3>Flujo simple sin curva técnica</h3>
            <p>Sin constructor tradicional abrumador. Decisiones guiadas, edición rápida y versionado estable.</p>
          </article>
          <article className="marketing-value-card">
            <h3>Control del negocio desde dashboard</h3>
            <p>Ves uso, analítica básica y estado de publicación de cada sitio desde un solo lugar.</p>
          </article>
        </section>

        {/* ── CTA Banner ───────────────────────────────── */}
        <section className="marketing-cta-banner">
          <div className="stack">
            <h2>¿Listo para liderar el mercado digital?</h2>
            <p>Únete a la vanguardia tecnológica y lanza tu sitio hoy mismo.</p>
          </div>
          <Link href="/signin" className="btn-primary">
            Empezar Ahora — Es Gratis
          </Link>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}

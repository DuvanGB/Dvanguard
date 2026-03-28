import Link from "next/link";
import { headers } from "next/headers";

import { SiteRenderer } from "@/components/runtime/site-renderer";
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
    <main className="marketing-shell">
      <section className="marketing-hero">
        <div className="marketing-hero-copy stack">
          <small className="marketing-chip">SaaS para emprendedores LATAM</small>
          <h1>Describe tu negocio. Nosotros lo publicamos en segundos.</h1>
          <p>
            Convierte una idea en una landing lista para clientes, sin tocar código y sin un editor complejo de arrastrar
            bloques.
          </p>
          <div className="marketing-hero-actions">
            <Link href="/signin" className="btn-primary">
              Comenzar gratis
            </Link>
            <Link href="/pricing" className="btn-secondary">
              Ver planes
            </Link>
          </div>
          <div className="marketing-proof-row">
            <span>Entrada por texto y voz</span>
            <span>Editor visual en tiempo real</span>
            <span>Publicación inmediata por ruta</span>
          </div>
        </div>

        <aside className="marketing-hero-panel stack">
          <h2>Cómo se ve el resultado operativo</h2>
          <div className="marketing-mini-kpis">
            <article>
              <strong>&lt; 20s</strong>
              <small>preview inicial</small>
            </article>
            <article>
              <strong>1 clic</strong>
              <small>publicar sitio</small>
            </article>
            <article>
              <strong>100%</strong>
              <small>enfocado en conversión</small>
            </article>
          </div>
          <p>
            Diseñado para negocios que venden por redes: catálogo, testimonios, contacto y CTA directo a WhatsApp.
          </p>
        </aside>
      </section>

      <section className="marketing-steps">
        <article className="marketing-step-card">
          <span>01</span>
          <h3>Describe tu negocio</h3>
          <p>Cuéntanos qué vendes, a quién y con qué estilo. Puedes escribir o dictar por voz.</p>
        </article>
        <article className="marketing-step-card">
          <span>02</span>
          <h3>IA propone y refina</h3>
          <p>Generamos estructura, plantilla y contenido base para que empieces con ventaja.</p>
        </article>
        <article className="marketing-step-card">
          <span>03</span>
          <h3>Edita y publica</h3>
          <p>Ajusta secciones, textos e imágenes en preview realtime y publica al instante. Si quieres, luego conectas tu dominio.</p>
        </article>
      </section>

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

      <section className="marketing-cta-banner">
        <div className="stack">
          <h2>Lanza tu web hoy y valida tu oferta esta semana.</h2>
          <p>Ideal para pequeños negocios que necesitan presencia digital profesional con velocidad de ejecución.</p>
        </div>
        <Link href="/signin" className="btn-primary">
          Crear mi primer sitio
        </Link>
      </section>
    </main>
  );
}

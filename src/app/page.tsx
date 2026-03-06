import Link from "next/link";
import { headers } from "next/headers";

import { SiteRenderer } from "@/components/runtime/site-renderer";
import { getPublishedSiteBySubdomain } from "@/lib/data/public-site";
import { getSubdomainFromHost } from "@/lib/tenant";

export default async function HomePage() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const subdomain = getSubdomainFromHost(host);

  if (subdomain) {
    try {
      const payload = await getPublishedSiteBySubdomain(subdomain);
      if (payload) {
        return <SiteRenderer spec={payload.siteSpec} trackEvents siteId={payload.id} subdomain={payload.subdomain} />;
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
    <main className="container stack" style={{ paddingTop: "2.5rem" }}>
      <section className="card stack" style={{ padding: "2rem", background: "linear-gradient(135deg, #f8fafc, #e2e8f0)" }}>
        <h1>Describe tu negocio. Publica una web que convierta en minutos.</h1>
        <p>
          Crea una web optimizada para WhatsApp y redes sin lidiar con herramientas complejas. Empieza gratis y valida
          rápido.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/signin" className="btn-primary">
            Comenzar gratis
          </Link>
          <Link href="/pricing" className="btn-secondary">
            Ver precios
          </Link>
        </div>
      </section>

      <section className="catalog-grid">
        <article className="card stack">
          <h2>1. Describe tu negocio</h2>
          <p>Cuenta qué vendes y a quién le vendes en lenguaje natural.</p>
        </article>
        <article className="card stack">
          <h2>2. IA genera tu estructura</h2>
          <p>Obtén una web lista para personalizar sin comenzar desde cero.</p>
        </article>
        <article className="card stack">
          <h2>3. Publica con subdominio</h2>
          <p>Lanza tu sitio y comparte el link en redes y WhatsApp.</p>
        </article>
      </section>

      <section className="card stack">
        <h2>Para quién está hecha</h2>
        <p>
          Emprendedores y pequeños negocios LATAM que necesitan presencia digital rápida para vender, sin contratar
          desarrollo tradicional.
        </p>
      </section>
    </main>
  );
}

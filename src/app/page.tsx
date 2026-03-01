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
        return <SiteRenderer spec={payload.siteSpec} />;
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
    <main className="container stack" style={{ paddingTop: "3rem" }}>
      <h1>Describe tu negocio. Publica tu web en minutos.</h1>
      <p>
        Plataforma SaaS multi-tenant para emprendedores LATAM que quieren generar una web simple con IA y vender por
        WhatsApp.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/onboarding" className="btn-primary">
          Comenzar onboarding
        </Link>
        <Link href="/dashboard" className="btn-secondary">
          Ir al dashboard
        </Link>
      </div>
    </main>
  );
}

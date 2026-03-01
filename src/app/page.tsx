import Link from "next/link";

export default function HomePage() {
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

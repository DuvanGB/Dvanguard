import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function PricingPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const billingHref = user ? "/billing" : "/signin?next=/billing";

  return (
    <main className="container stack" style={{ paddingTop: "2.5rem" }}>
      <header className="stack">
        <h1>Planes y precios</h1>
        <p>Empieza gratis y escala cuando necesites más publicaciones y más generación IA.</p>
      </header>

      <section className="catalog-grid">
        <article className="card stack">
          <h2>Gratis</h2>
          <p>Ideal para validar tu negocio.</p>
          <ul>
            <li>1 sitio publicado activo</li>
            <li>10 generaciones IA / mes</li>
            <li>Editor esencial</li>
          </ul>
          <Link className="btn-secondary" href="/signin">
            Comenzar gratis
          </Link>
        </article>

        <article className="card stack" style={{ border: "2px solid var(--brand)" }}>
          <h2>Pro</h2>
          <p>Para crecer con más volumen.</p>
          <ul>
            <li>Plan mensual o anual</li>
            <li>Más sitios publicados activos</li>
            <li>Más generaciones IA / mes</li>
            <li>Gestión de suscripción y facturas</li>
          </ul>
          <Link className="btn-primary" href={billingHref}>
            Suscribirme
          </Link>
        </article>
      </section>

      <section className="card stack">
        <h2>Preguntas frecuentes</h2>
        <p>El plan Pro se gestiona con Wompi: tarjeta para renovación automática y PSE, Nequi o banco para compras manuales de tiempo Pro.</p>
      </section>
    </main>
  );
}

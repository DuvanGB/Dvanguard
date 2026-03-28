import Link from "next/link";

import { BillingPageClient } from "@/components/billing/billing-page-client";
import { requireUser } from "@/lib/auth";
import { getBillingSummary, listBillingInvoices } from "@/lib/billing/subscription";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { user } = await requireUser();
  const admin = getSupabaseAdminClient();
  const [summary, invoices] = await Promise.all([getBillingSummary(admin, user.id), listBillingInvoices(admin, user.id)]);

  const notices: string[] = [];
  if (params.checkout === "success") {
    notices.push("Pago recibido. Estamos sincronizando el estado de tu suscripción.");
  }
  if (params.checkout === "cancelled") {
    notices.push("El checkout fue cancelado. Puedes retomarlo cuando quieras.");
  }
  if (summary.accessState === "grace_period" && summary.graceUntil) {
    notices.push(`Tienes una gracia activa hasta ${new Date(summary.graceUntil).toLocaleDateString("es-CO")}.`);
  }
  if (summary.accessState === "enforcement_applied") {
    notices.push("Tu cuenta ya fue ajustada al límite Free. Mantuvimos publicado solo el sitio más visitado.");
  }
  if (summary.plan === "pro" && !summary.isStripeManaged) {
    notices.push("Este plan Pro fue activado manualmente por soporte o admin. La gestión de Stripe no aplica todavía a esta cuenta.");
  }

  return (
    <main className="dashboard-shell">
      <div className="dashboard-container stack">
        <section className="dashboard-hero">
          <div className="stack" style={{ gap: "0.35rem" }}>
            <small className="dashboard-chip">Billing</small>
            <h1>Suscripción y facturación</h1>
            <p>Controla tu plan Pro, renovaciones, facturas y método de pago desde un solo lugar.</p>
            <div className="dashboard-hero-actions">
              <Link href="/dashboard" className="btn-secondary">
                Volver al dashboard
              </Link>
              <Link href="/pricing" className="btn-secondary">
                Ver precios
              </Link>
            </div>
          </div>
          <div className="dashboard-email">{user.email}</div>
        </section>

        <BillingPageClient summary={summary} invoices={invoices} notices={notices} stripeEnabled={isStripeConfigured()} />
      </div>
    </main>
  );
}

import Link from "next/link";

import { BillingPageClient } from "@/components/billing/billing-page-client";
import { requireUser } from "@/lib/auth";
import { getBillingSummary, listBillingTransactions } from "@/lib/billing/subscription";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { user } = await requireUser();
  const admin = getSupabaseAdminClient();
  const [summary, transactions] = await Promise.all([
    getBillingSummary(admin, user.id, user.email ?? null),
    listBillingTransactions(admin, user.id)
  ]);

  const notices: string[] = [];
  if (params.checkout) {
    notices.push("Procesamos el estado más reciente del pago. Si tu banco todavía no confirma, verás el acceso actualizarse apenas llegue el evento.");
  }
  if (summary.accessState === "grace_period" && summary.graceUntil) {
    notices.push(`Tienes una gracia activa hasta ${new Date(summary.graceUntil).toLocaleDateString("es-CO")}.`);
  }
  if (summary.accessState === "enforcement_applied") {
    notices.push("Tu cuenta ya fue ajustada al límite Free. Mantuvimos publicado solo el sitio más visitado.");
  }
  if (summary.paymentMethodKind && summary.rail === "manual_term_purchase" && summary.currentPeriodEnd) {
    notices.push(`Tu acceso manual vence el ${new Date(summary.currentPeriodEnd).toLocaleDateString("es-CO")}.`);
  }
  if (summary.switchToCardAt) {
    notices.push(`El paso a tarjeta quedó programado para ${new Date(summary.switchToCardAt).toLocaleDateString("es-CO")}.`);
  }

  return (
    <main className="dashboard-shell">
      <div className="dashboard-container stack">
        <section className="dashboard-hero">
          <div className="stack" style={{ gap: "0.35rem" }}>
            <small className="dashboard-chip">Billing</small>
            <h1>Suscripción y facturación</h1>
            <p>Gestiona Pro con Wompi usando tarjeta, PSE, Nequi o transferencia bancaria sin salir de DVanguard.</p>
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

        <BillingPageClient
          summary={summary}
          transactions={transactions}
          notices={notices}
          wompiPublicKey={env.wompiPublicKey}
          userEmail={user.email ?? ""}
        />
      </div>
    </main>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import type { BillingSummary, BillingInterval } from "@/lib/billing/types";
import type { BillingInvoiceRecord } from "@/lib/billing/subscription";

type Props = {
  summary: BillingSummary;
  invoices: BillingInvoiceRecord[];
  notices: string[];
  stripeEnabled: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatMoney(amount: number, currency: string | null) {
  const formatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: (currency ?? "usd").toUpperCase(),
    maximumFractionDigits: 0
  });

  return formatter.format((amount ?? 0) / 100);
}

function statusLabel(summary: BillingSummary) {
  if (!summary.isStripeManaged && summary.plan === "pro") return "Pro manual";
  if (!summary.isStripeManaged) return "Sin suscripción activa";
  if (summary.cancelAtPeriodEnd && summary.currentPeriodEnd) {
    return `Cancelación al ${formatDate(summary.currentPeriodEnd)}`;
  }
  if (summary.pendingInterval === "month") {
    return `Cambio a mensual programado para ${formatDate(summary.currentPeriodEnd)}`;
  }
  if (summary.subscriptionStatus === "active") return "Activa";
  if (summary.subscriptionStatus === "past_due") return "Pago pendiente";
  return summary.subscriptionStatus;
}

function SetupPaymentMethodForm({ onSaved }: { onSaved: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setMessage(null);
    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required"
    });

    if (result.error) {
      setMessage(result.error.message ?? "No se pudo actualizar la tarjeta");
      return;
    }

    const paymentMethodId = typeof result.setupIntent?.payment_method === "string" ? result.setupIntent.payment_method : null;
    if (!paymentMethodId) {
      setMessage("No se pudo obtener el método de pago");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/billing/payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo guardar la tarjeta");
        return;
      }

      setMessage("Tarjeta actualizada");
      onSaved();
    });
  }

  return (
    <form className="stack" onSubmit={handleSubmit} style={{ gap: "0.75rem" }}>
      <PaymentElement />
      {message ? <small className="muted">{message}</small> : null}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="submit" className="btn-primary" disabled={!stripe || !elements || isPending}>
          {isPending ? "Guardando..." : "Guardar tarjeta"}
        </button>
      </div>
    </form>
  );
}

export function BillingPageClient({ summary, invoices, notices, stripeEnabled }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const stripePromise = useMemo(() => {
    if (!stripeEnabled) return null;
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
    return key ? loadStripe(key) : null;
  }, [stripeEnabled]);

  async function startCheckout(interval: BillingInterval) {
    setMessage(null);
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string; url?: string };
    if (!response.ok || !payload.url) {
      setMessage(payload.error ?? "No se pudo iniciar el checkout");
      return;
    }

    window.location.href = payload.url;
  }

  function refreshAfterAction(nextMessage: string) {
    startTransition(() => {
      setMessage(nextMessage);
      router.refresh();
    });
  }

  async function cancelSubscription() {
    setMessage(null);
    const response = await fetch("/api/billing/cancel", { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo programar la cancelación");
      return;
    }
    refreshAfterAction("La cancelación quedó programada para el fin del periodo.");
  }

  async function changeInterval(interval: BillingInterval) {
    setMessage(null);
    const response = await fetch("/api/billing/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval })
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; mode?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo cambiar el plan");
      return;
    }
    const nextMessage = payload.mode === "scheduled" ? "El cambio quedó programado para la próxima renovación." : "El cambio se aplicó correctamente.";
    refreshAfterAction(nextMessage);
  }

  async function prepareCardForm() {
    setMessage(null);
    const response = await fetch("/api/billing/setup-intent", { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; clientSecret?: string };
    if (!response.ok || !payload.clientSecret) {
      setMessage(payload.error ?? "No se pudo preparar el formulario de tarjeta");
      return;
    }
    setSetupClientSecret(payload.clientSecret);
  }

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <section className="card stack">
        <div className="stack" style={{ gap: "0.35rem" }}>
          <h1>Billing</h1>
          <p className="muted">Gestiona tu suscripción Pro, facturas y método de pago desde DVanguard.</p>
        </div>

        <div className="catalog-grid">
          <article className="card stack">
            <small className="muted">Plan actual</small>
            <strong style={{ fontSize: "1.5rem" }}>{summary.plan.toUpperCase()}</strong>
            <p className="muted">{statusLabel(summary)}</p>
            {summary.currentPeriodEnd ? <small>Próximo hito: {formatDate(summary.currentPeriodEnd)}</small> : null}
            {summary.graceUntil ? <small>Gracia hasta: {formatDate(summary.graceUntil)}</small> : null}
          </article>

          <article className="card stack">
            <small className="muted">Ciclo</small>
            <strong style={{ fontSize: "1.5rem" }}>{summary.interval === "year" ? "Anual" : summary.interval === "month" ? "Mensual" : "Sin ciclo"}</strong>
            <p className="muted">
              {summary.pendingInterval ? `Cambio pendiente a ${summary.pendingInterval === "year" ? "anual" : "mensual"}.` : "Puedes ajustar tu ciclo cuando lo necesites."}
            </p>
          </article>

          <article className="card stack">
            <small className="muted">Método de pago</small>
            <strong style={{ fontSize: "1.3rem" }}>
              {summary.paymentMethod?.last4 ? `${summary.paymentMethod.brand ?? "tarjeta"} •••• ${summary.paymentMethod.last4}` : "Sin tarjeta registrada"}
            </strong>
            <p className="muted">
              {summary.paymentMethod?.expMonth && summary.paymentMethod?.expYear
                ? `Expira ${String(summary.paymentMethod.expMonth).padStart(2, "0")}/${summary.paymentMethod.expYear}`
                : "Registra o actualiza la tarjeta que usaremos para renovaciones."}
            </p>
          </article>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {summary.plan === "free" ? (
            <>
              <button type="button" className="btn-primary" onClick={() => void startCheckout("month")} disabled={isPending || !stripeEnabled}>
                Suscribirme mensual
              </button>
              <button type="button" className="btn-secondary" onClick={() => void startCheckout("year")} disabled={isPending || !stripeEnabled}>
                Suscribirme anual
              </button>
            </>
          ) : null}

          {summary.plan === "pro" && summary.isStripeManaged ? (
            <>
              {summary.interval !== "month" ? (
                <button type="button" className="btn-secondary" onClick={() => void changeInterval("month")} disabled={isPending}>
                  Cambiar a mensual
                </button>
              ) : null}
              {summary.interval !== "year" ? (
                <button type="button" className="btn-secondary" onClick={() => void changeInterval("year")} disabled={isPending}>
                  Cambiar a anual
                </button>
              ) : null}
              {!summary.cancelAtPeriodEnd ? (
                <button type="button" className="btn-secondary btn-danger-soft" onClick={() => void cancelSubscription()} disabled={isPending}>
                  Cancelar al fin del periodo
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        {message ? <small className="muted">{message}</small> : null}
        {notices.length ? (
          <div className="stack" style={{ gap: "0.35rem" }}>
            {notices.map((notice) => (
              <small key={notice} className="muted">
                {notice}
              </small>
            ))}
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <div className="stack" style={{ gap: "0.25rem" }}>
          <h2>Método de pago</h2>
          <p className="muted">La suscripción Pro usa tarjeta para el cobro inicial y las renovaciones.</p>
        </div>

        {stripeEnabled ? (
          setupClientSecret && stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret, appearance: { theme: "stripe" } }}>
              <SetupPaymentMethodForm
                onSaved={() => {
                  setSetupClientSecret(null);
                  refreshAfterAction("Tarjeta actualizada correctamente.");
                }}
              />
            </Elements>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => void prepareCardForm()}>
              {summary.paymentMethod?.last4 ? "Actualizar tarjeta" : "Registrar tarjeta"}
            </button>
          )
        ) : (
          <small className="muted">Stripe aún no está configurado en este entorno.</small>
        )}
      </section>

      <section className="card stack">
        <div className="stack" style={{ gap: "0.25rem" }}>
          <h2>Facturas</h2>
          <p className="muted">Consulta el historial de cobros de tu cuenta.</p>
        </div>

        {invoices.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Factura</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.stripe_invoice_id}>
                    <td>{formatDate(invoice.created_at)}</td>
                    <td>{invoice.status}</td>
                    <td>{formatMoney(invoice.amount_paid || invoice.amount_due, invoice.currency)}</td>
                    <td>
                      {invoice.hosted_invoice_url ? (
                        <a href={invoice.hosted_invoice_url} target="_blank" rel="noreferrer">
                          Ver factura
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Aún no tienes facturas registradas.</p>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { BillingSummary, BillingInterval } from "@/lib/billing/types";
import type { BillingTransactionRecord } from "@/lib/billing/subscription";

type Props = {
  summary: BillingSummary;
  transactions: BillingTransactionRecord[];
  notices: string[];
  wompiPublicKey: string;
  userEmail: string;
  copy: Record<string, string>;
};

type CardFormState = {
  cardNumber: string;
  cvc: string;
  expMonth: string;
  expYear: string;
  cardholderName: string;
  phoneNumber: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatMoney(amountInCents: number, currency = "COP") {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format((amountInCents ?? 0) / 100);
}

function paymentMethodLabel(summary: BillingSummary) {
  if (summary.paymentMethodKind === "card") return "Tarjeta";
  if (summary.paymentMethodKind === "pse") return "PSE";
  if (summary.paymentMethodKind === "nequi") return "Nequi";
  if (summary.paymentMethodKind === "bank_transfer") return "Transferencia bancaria";
  return "Sin método activo";
}

function statusLabel(summary: BillingSummary) {
  if (summary.subscriptionStatus === "active" && summary.rail === "card_subscription") {
    return summary.renewsAutomatically ? "Activa con renovación" : "Activa, renovación cancelada";
  }
  if (summary.subscriptionStatus === "active" && summary.rail === "manual_term_purchase") {
    return "Tiempo manual activo";
  }
  if (summary.subscriptionStatus === "payment_pending") return "Pago pendiente";
  if (summary.subscriptionStatus === "pending_activation") return "Activación pendiente";
  if (summary.subscriptionStatus === "payment_failed") return "Pago fallido";
  if (summary.subscriptionStatus === "expired") return "Vencida";
  if (summary.subscriptionStatus === "canceled") return "Cancelada";
  return "Sin acceso Pro activo";
}

function wompiBaseUrl(publicKey: string) {
  return publicKey.startsWith("pub_test_") ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";
}

async function tokenizeCard(publicKey: string, form: CardFormState) {
  const response = await fetch(`${wompiBaseUrl(publicKey)}/tokens/cards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicKey}`
    },
    body: JSON.stringify({
      number: form.cardNumber.replace(/\s+/g, ""),
      cvc: form.cvc.trim(),
      exp_month: form.expMonth.trim(),
      exp_year: form.expYear.trim(),
      card_holder: form.cardholderName.trim()
    })
  });

  const payload = (await response.json().catch(() => ({}))) as {
    data?: { id?: string };
    error?: unknown;
  };

  if (!response.ok || !payload.data?.id) {
    throw new Error(typeof payload.error === "string" ? payload.error : "No se pudo tokenizar la tarjeta en Wompi.");
  }

  return payload.data.id;
}

export function BillingPageClient({ summary, transactions, notices, wompiPublicKey, userEmail, copy }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [legalTermsAccepted, setLegalTermsAccepted] = useState(summary.legal.accepted);
  const [legalPrivacyAccepted, setLegalPrivacyAccepted] = useState(summary.legal.accepted);
  const [cardForm, setCardForm] = useState<CardFormState>({
    cardNumber: "",
    cvc: "",
    expMonth: "",
    expYear: "",
    cardholderName: "",
    phoneNumber: ""
  });

  const cardReady = useMemo(() => {
    return Boolean(
      wompiPublicKey &&
        cardForm.cardNumber.replace(/\s+/g, "").length >= 13 &&
        cardForm.cvc.trim().length >= 3 &&
        cardForm.expMonth.trim().length >= 2 &&
        cardForm.expYear.trim().length >= 2 &&
        cardForm.cardholderName.trim().length >= 2
    );
  }, [cardForm, wompiPublicKey]);

  function refresh(nextMessage: string) {
    startTransition(() => {
      setMessage(nextMessage);
      router.refresh();
    });
  }

  async function ensureLegalAccepted() {
    if (summary.legal.accepted) return true;
    if (!legalTermsAccepted || !legalPrivacyAccepted) {
      setMessage("Debes aceptar Términos y Privacidad antes de iniciar un pago.");
      return false;
    }

    const response = await fetch("/api/billing/legal/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptTerms: true, acceptPrivacy: true })
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo guardar la aceptación legal.");
      return false;
    }
    return true;
  }

  async function handleCardAction(interval: BillingInterval, scheduleOnly = false) {
    setMessage(null);
    const legalOk = await ensureLegalAccepted();
    if (!legalOk) return;

    if (!cardReady) {
      setMessage("Completa los datos de la tarjeta antes de continuar.");
      return;
    }

    try {
      const token = await tokenizeCard(wompiPublicKey, cardForm);
      const endpoint = scheduleOnly ? "/api/billing/wompi/switch-to-card" : "/api/billing/wompi/card/subscribe";
      const body = scheduleOnly
        ? { token }
        : {
            token,
            interval,
            cardholderName: cardForm.cardholderName,
            phoneNumber: cardForm.phoneNumber
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
        checkoutUrl?: string | null;
        switchToCardAt?: string | null;
      };

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo procesar la tarjeta.");
        return;
      }

      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      refresh(
        scheduleOnly
          ? `La tarjeta quedó programada para activarse el ${formatDate(payload.switchToCardAt ?? summary.currentPeriodEnd)}.`
          : "Tarjeta registrada y suscripción actualizada."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo tokenizar la tarjeta.");
    }
  }

  async function handleManualCheckout() {
    setMessage(null);
    const legalOk = await ensureLegalAccepted();
    if (!legalOk) return;

    const response = await fetch("/api/billing/wompi/manual/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "pse" })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      redirectUrl?: string | null;
    };
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo iniciar el pago.");
      return;
    }

    if (payload.redirectUrl) {
      window.location.href = payload.redirectUrl;
      return;
    }

    refresh("El pago quedó registrado.");
  }

  async function cancelAutoRenew() {
    setMessage(null);
    const response = await fetch("/api/billing/cancel", { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo cancelar la renovación.");
      return;
    }
    refresh("La renovación automática quedó cancelada al final del periodo actual.");
  }

  async function changeInterval(interval: BillingInterval) {
    setMessage(null);
    const response = await fetch("/api/billing/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval })
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo cambiar el ciclo.");
      return;
    }
    refresh(`El siguiente cobro quedó configurado en ciclo ${interval === "year" ? "anual" : "mensual"}.`);
  }

  return (
    <div className="stack">
      {/* ── Plan Status Strip ─────────────────────────── */}
      <div className="billing-status-strip">
        <div className="billing-status-card">
          <div className="billing-status-icon">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          </div>
          <div className="stack stack-xs">
            <small className="billing-status-label">Plan actual</small>
            <strong>{summary.plan.toUpperCase()}</strong>
          </div>
        </div>

        <div className="billing-status-card">
          <div className="billing-status-icon">
            <span className="material-symbols-outlined">sync</span>
          </div>
          <div className="stack stack-xs">
            <small className="billing-status-label">{statusLabel(summary)}</small>
            <strong>{summary.rail === "card_subscription" ? "Tarjeta recurrente" : summary.rail === "manual_term_purchase" ? "Tiempo manual" : "Sin rail"}</strong>
          </div>
        </div>

        <div className="billing-status-card">
          <div className="billing-status-icon">
            <span className="material-symbols-outlined">credit_card</span>
          </div>
          <div className="stack stack-xs">
            <small className="billing-status-label">Método guardado</small>
            <strong>
              {summary.paymentMethod?.last4
                ? `${summary.paymentMethod.brand ?? "Tarjeta"} •••• ${summary.paymentMethod.last4}`
                : "Sin tarjeta"}
            </strong>
            {summary.paymentMethod?.expMonth && summary.paymentMethod?.expYear ? (
              <small className="muted">Expira {String(summary.paymentMethod.expMonth).padStart(2, "0")}/{summary.paymentMethod.expYear}</small>
            ) : null}
          </div>
        </div>

        {summary.currentPeriodEnd ? (
          <div className="billing-status-card">
            <div className="billing-status-icon">
              <span className="material-symbols-outlined">event</span>
            </div>
            <div className="stack stack-xs">
              <small className="billing-status-label">Vencimiento</small>
              <strong>{formatDate(summary.currentPeriodEnd)}</strong>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Alerts ────────────────────────────────────── */}
      {message ? <div className="billing-alert"><span className="material-symbols-outlined">info</span>{message}</div> : null}
      {notices.length ? (
        <div className="stack stack-sm">
          {notices.map((notice) => (
            <div key={notice} className="billing-alert">
              <span className="material-symbols-outlined">notifications</span>
              {notice}
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Legal Section ─────────────────────────────── */}
      <section className="billing-section glass-panel">
        <div className="billing-section-head">
          <span className="material-symbols-outlined billing-section-icon">gavel</span>
          <div className="stack stack-xs">
            <h2>{copy["billing.legal.title"]}</h2>
            <p className="muted">{copy["billing.legal.description"]}</p>
          </div>
        </div>

        <div className="billing-legal-checks">
          <label className="billing-legal-check">
            <input type="checkbox" checked={legalTermsAccepted} onChange={(event) => setLegalTermsAccepted(event.target.checked)} />
            <span>
              Acepto los <Link href="/terms">Términos</Link> de DVanguard (versión {summary.legal.termsVersion}).
            </span>
          </label>
          <label className="billing-legal-check">
            <input type="checkbox" checked={legalPrivacyAccepted} onChange={(event) => setLegalPrivacyAccepted(event.target.checked)} />
            <span>
              Acepto la <Link href="/privacy">Política de Privacidad</Link> (versión {summary.legal.privacyVersion}).
            </span>
          </label>
        </div>

        <div className="billing-wompi-links">
          {summary.wompiAcceptance.termsPermalink ? (
            <a href={summary.wompiAcceptance.termsPermalink} target="_blank" rel="noreferrer">
              <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>open_in_new</span>
              Contrato comercial Wompi
            </a>
          ) : null}
          {summary.wompiAcceptance.personalDataPermalink ? (
            <a href={summary.wompiAcceptance.personalDataPermalink} target="_blank" rel="noreferrer">
              <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>open_in_new</span>
              Tratamiento de datos Wompi
            </a>
          ) : null}
        </div>

        <small className="muted">
          {summary.legal.accepted ? `Aceptado el ${formatDate(summary.legal.acceptedAt)}` : "Todavía no has registrado la aceptación legal."}
        </small>
      </section>

      {/* ── Asymmetric Grid: Card + Manual ────────────── */}
      <div className="billing-grid">
        {/* ── Recurring Card Payment ─────────────────── */}
        <section className="billing-section billing-section-main glass-panel">
          <div className="billing-section-head">
            <span className="material-symbols-outlined billing-section-icon">credit_card</span>
            <div className="stack stack-xs">
              <h2>{copy["billing.card.title"]}</h2>
              <p className="muted">{copy["billing.card.description"]}</p>
            </div>
          </div>

          <div className="billing-form-grid">
            <label className="billing-field billing-field-wide">
              <small>Nombre del titular</small>
              <input value={cardForm.cardholderName} onChange={(event) => setCardForm((prev) => ({ ...prev, cardholderName: event.target.value }))} placeholder="Como aparece en la tarjeta" />
            </label>
            <label className="billing-field">
              <small>Teléfono</small>
              <input value={cardForm.phoneNumber} onChange={(event) => setCardForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} placeholder="+573001234567" />
            </label>
            <label className="billing-field">
              <small>Número de tarjeta</small>
              <input value={cardForm.cardNumber} onChange={(event) => setCardForm((prev) => ({ ...prev, cardNumber: event.target.value }))} placeholder="4242 4242 4242 4242" />
            </label>
            <label className="billing-field">
              <small>Mes exp.</small>
              <input value={cardForm.expMonth} onChange={(event) => setCardForm((prev) => ({ ...prev, expMonth: event.target.value }))} placeholder="12" />
            </label>
            <label className="billing-field">
              <small>Año exp.</small>
              <input value={cardForm.expYear} onChange={(event) => setCardForm((prev) => ({ ...prev, expYear: event.target.value }))} placeholder="29" />
            </label>
            <label className="billing-field">
              <small>CVC</small>
              <input type="password" value={cardForm.cvc} onChange={(event) => setCardForm((prev) => ({ ...prev, cvc: event.target.value }))} placeholder="•••" />
            </label>
          </div>

          <div className="billing-actions">
            <button type="button" className="btn-primary" disabled={!cardReady || isPending} onClick={() => void handleCardAction("month")}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>encrypted</span>
              Pagar mensual
            </button>
            <button type="button" className="btn-secondary" disabled={!cardReady || isPending} onClick={() => void handleCardAction("year")}>
              Pagar anual
            </button>
          </div>

          {summary.rail === "card_subscription" ? (
            <div className="billing-card-manage">
              {summary.renewsAutomatically ? (
                <button type="button" className="btn-secondary btn-sm btn-danger" onClick={() => void cancelAutoRenew()}>
                  Cancelar renovación
                </button>
              ) : null}
              {summary.interval !== "month" ? (
                <button type="button" className="btn-secondary btn-sm" onClick={() => void changeInterval("month")}>
                  Cambiar a mensual
                </button>
              ) : null}
              {summary.interval !== "year" ? (
                <button type="button" className="btn-secondary btn-sm" onClick={() => void changeInterval("year")}>
                  Cambiar a anual
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="billing-security-badge">
            <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>lock</span>
            Encriptación de grado bancario · Procesado por Wompi
          </div>
        </section>

        {/* ── One-Time Payments Side ─────────────────── */}
        <section className="billing-section billing-section-side stack">
          <div className="billing-section-head">
            <span className="material-symbols-outlined billing-section-icon">shopping_bag</span>
            <div className="stack stack-xs">
              <h2>{copy["billing.manual.title"]}</h2>
              <p className="muted">{copy["billing.manual.description"]}</p>
            </div>
          </div>

          <p className="muted" style={{ fontSize: "0.8rem" }}>
            Acepta PSE, Nequi y transferencia bancaria. Serás redirigido a Wompi para elegir tu método y completar el pago de forma segura.
          </p>

          <button type="button" className="billing-wompi-cta" onClick={() => void handleManualCheckout()}>
            <span className="material-symbols-outlined">open_in_new</span>
            Pagar
          </button>
        </section>
      </div>

      {/* ── Switch to Card (if manual active) ─────────── */}
      {summary.rail === "manual_term_purchase" && summary.currentPeriodEnd ? (
        <section className="billing-section glass-panel">
          <div className="billing-section-head">
            <span className="material-symbols-outlined billing-section-icon">swap_horiz</span>
            <div className="stack stack-xs">
              <h2>{copy["billing.switch.title"]}</h2>
              <p className="muted">
                {copy["billing.switch.description"]} Tienes tiempo Pro manual activo hasta el {formatDate(summary.currentPeriodEnd)}.
              </p>
            </div>
          </div>
          <button type="button" className="btn-secondary" disabled={!cardReady} onClick={() => void handleCardAction("month", true)}>
            <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>credit_card</span>
            Registrar tarjeta para renovar al vencimiento
          </button>
        </section>
      ) : null}

      {/* ── Transaction History ───────────────────────── */}
      <section className="billing-section glass-panel">
        <div className="billing-section-head">
          <span className="material-symbols-outlined billing-section-icon">receipt_long</span>
          <div className="stack stack-xs">
            <h2>{copy["billing.transactions.title"]}</h2>
            <p className="muted">{copy["billing.transactions.description"]}</p>
          </div>
        </div>

        {transactions.length ? (
          <div className="billing-table-wrap">
            <table className="billing-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <span>{formatDate(transaction.created_at)}</span>
                    </td>
                    <td>
                      <div className="billing-table-method">
                        <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>
                          {transaction.method === "card" ? "credit_card" : transaction.method === "pse" ? "account_balance" : "payments"}
                        </span>
                        {transaction.method}
                      </div>
                    </td>
                    <td>
                      <span className={`billing-table-status ${transaction.status === "APPROVED" ? "is-ok" : transaction.status === "ERROR" || transaction.status === "DECLINED" ? "is-error" : ""}`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td><strong>{formatMoney(transaction.amount_in_cents, transaction.currency)}</strong></td>
                    <td>
                      {transaction.checkout_url ? (
                        <a href={transaction.checkout_url} target="_blank" rel="noreferrer" className="billing-table-action">
                          Ver pago
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
          <p className="muted">Aún no tienes movimientos registrados.</p>
        )}
      </section>
    </div>
  );
}

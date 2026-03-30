"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { BillingSummary, BillingInterval } from "@/lib/billing/types";
import type { BillingTransactionRecord } from "@/lib/billing/subscription";
import { formatCurrencyLatam, formatDateLatam } from "@/lib/locale-latam";

type Props = {
  summary: BillingSummary;
  transactions: BillingTransactionRecord[];
  notices: string[];
  wompiPublicKey: string;
  userEmail: string;
};

type CardFormState = {
  cardNumber: string;
  cvc: string;
  expMonth: string;
  expYear: string;
  cardholderName: string;
  phoneNumber: string;
};

type ManualFormState = {
  customerName: string;
  phoneNumber: string;
  legalIdType: string;
  legalId: string;
  userType: "0" | "1";
  financialInstitutionCode: string;
};

function formatDate(value: string | null) {
  return formatDateLatam(value);
}

function formatMoney(amountInCents: number, currency = "COP") {
  return formatCurrencyLatam((amountInCents ?? 0) / 100, currency);
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

export function BillingPageClient({ summary, transactions, notices, wompiPublicKey, userEmail }: Props) {
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
  const [manualForm, setManualForm] = useState<ManualFormState>({
    customerName: "",
    phoneNumber: "",
    legalIdType: "CC",
    legalId: "",
    userType: "0",
    financialInstitutionCode: ""
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

  async function handleStoredCardUpdate() {
    setMessage(null);
    const legalOk = await ensureLegalAccepted();
    if (!legalOk) return;

    if (!cardReady) {
      setMessage("Completa los datos de la nueva tarjeta antes de actualizar la información guardada.");
      return;
    }

    try {
      const token = await tokenizeCard(wompiPublicKey, cardForm);
      const response = await fetch("/api/billing/payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo actualizar la tarjeta guardada.");
        return;
      }

      refresh("La tarjeta guardada quedó actualizada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo tokenizar la nueva tarjeta.");
    }
  }

  async function handleStoredCardDelete() {
    setMessage(null);
    const response = await fetch("/api/billing/payment-method", { method: "DELETE" });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      renewalCanceled?: boolean;
      removedScheduledSwitch?: boolean;
    };

    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo eliminar la tarjeta guardada.");
      return;
    }

    if (payload.renewalCanceled) {
      refresh("Eliminamos la tarjeta y cancelamos la renovación automática futura. Mantienes tu acceso actual hasta el final del periodo.");
      return;
    }

    if (payload.removedScheduledSwitch) {
      refresh("Eliminamos la tarjeta guardada y también quitamos el paso automático a tarjeta que estaba programado.");
      return;
    }

    refresh("La tarjeta guardada fue eliminada.");
  }

  async function handleManualCheckout(method: "pse" | "nequi" | "bank_transfer") {
    setMessage(null);
    const legalOk = await ensureLegalAccepted();
    if (!legalOk) return;

    const response = await fetch("/api/billing/wompi/manual/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        customerName: manualForm.customerName,
        phoneNumber: manualForm.phoneNumber,
        legalIdType: manualForm.legalIdType,
        legalId: manualForm.legalId,
        userType: Number(manualForm.userType),
        financialInstitutionCode: manualForm.financialInstitutionCode
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      redirectUrl?: string | null;
      status?: string;
    };
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo iniciar el pago.");
      return;
    }

    if (payload.redirectUrl) {
      window.location.href = payload.redirectUrl;
      return;
    }

    refresh(`El pago por ${method === "pse" ? "PSE" : method === "nequi" ? "Nequi" : "transferencia"} quedó registrado.`);
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
    <div className="stack" style={{ gap: "1rem" }}>
      <section className="card stack">
        <div className="stack" style={{ gap: "0.35rem" }}>
          <h1>Billing</h1>
          <p className="muted">Wompi es ahora la base de pagos del producto: tarjeta para renovación y PSE/Nequi/banco para comprar tiempo Pro.</p>
        </div>

        <div className="catalog-grid">
          <article className="card stack">
            <small className="muted">Plan actual</small>
            <strong style={{ fontSize: "1.5rem" }}>{summary.plan.toUpperCase()}</strong>
            <p className="muted">{statusLabel(summary)}</p>
            {summary.currentPeriodEnd ? <small>Hasta: {formatDate(summary.currentPeriodEnd)}</small> : null}
          </article>

          <article className="card stack">
            <small className="muted">Rail activo</small>
            <strong style={{ fontSize: "1.3rem" }}>{summary.rail === "card_subscription" ? "Tarjeta recurrente" : summary.rail === "manual_term_purchase" ? "Tiempo manual" : "Sin rail"}</strong>
            <p className="muted">{paymentMethodLabel(summary)}</p>
          </article>

          <article className="card stack">
            <small className="muted">Método guardado</small>
            <strong style={{ fontSize: "1.3rem" }}>
              {summary.paymentMethod?.last4 ? `${summary.paymentMethod.brand ?? "tarjeta"} •••• ${summary.paymentMethod.last4}` : "Sin tarjeta guardada"}
            </strong>
            <p className="muted">
              {summary.paymentMethod?.expMonth && summary.paymentMethod?.expYear
                ? `Expira ${String(summary.paymentMethod.expMonth).padStart(2, "0")}/${summary.paymentMethod.expYear}`
                : "Si compras con tarjeta, la usamos también para renovaciones."}
            </p>
            {summary.paymentMethod ? (
              <small className="muted">
                Si reemplazas la tarjeta, la nueva queda como método principal. Si la eliminas y dependías de ella para renovar, la renovación automática se cancela.
              </small>
            ) : null}
          </article>
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
          <h2>Primer paso legal</h2>
          <p className="muted">Antes de pagar, necesitamos registrar tu aceptación de DVanguard y mostrarte los contratos de Wompi.</p>
        </div>

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
        <div className="stack" style={{ gap: "0.35rem" }}>
          {summary.wompiAcceptance.termsPermalink ? (
            <a href={summary.wompiAcceptance.termsPermalink} target="_blank" rel="noreferrer">
              Ver contrato comercial de Wompi
            </a>
          ) : null}
          {summary.wompiAcceptance.personalDataPermalink ? (
            <a href={summary.wompiAcceptance.personalDataPermalink} target="_blank" rel="noreferrer">
              Ver autorización de tratamiento de datos de Wompi
            </a>
          ) : null}
        </div>
        <small className="muted">
          {summary.legal.accepted ? `Aceptado el ${formatDate(summary.legal.acceptedAt)}` : "Todavía no has registrado la aceptación legal."}
        </small>
      </section>

      <section className="card stack">
        <div className="stack" style={{ gap: "0.25rem" }}>
          <h2>Tarjeta: suscripción mensual o anual</h2>
          <p className="muted">La tarjeta sí queda lista para renovar automáticamente. Úsala si quieres continuidad sin repetir el pago cada mes.</p>
        </div>

        <div className="catalog-grid">
          <label>
            Nombre del titular
            <input value={cardForm.cardholderName} onChange={(event) => setCardForm((prev) => ({ ...prev, cardholderName: event.target.value }))} />
          </label>
          <label>
            Teléfono
            <input value={cardForm.phoneNumber} onChange={(event) => setCardForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} placeholder="+573001234567" />
          </label>
          <label>
            Número de tarjeta
            <input value={cardForm.cardNumber} onChange={(event) => setCardForm((prev) => ({ ...prev, cardNumber: event.target.value }))} placeholder="4242 4242 4242 4242" />
          </label>
          <label>
            CVC
            <input value={cardForm.cvc} onChange={(event) => setCardForm((prev) => ({ ...prev, cvc: event.target.value }))} placeholder="123" />
          </label>
          <label>
            Mes exp.
            <input value={cardForm.expMonth} onChange={(event) => setCardForm((prev) => ({ ...prev, expMonth: event.target.value }))} placeholder="12" />
          </label>
          <label>
            Año exp.
            <input value={cardForm.expYear} onChange={(event) => setCardForm((prev) => ({ ...prev, expYear: event.target.value }))} placeholder="29" />
          </label>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn-primary" disabled={!cardReady || isPending} onClick={() => void handleCardAction("month")}>
            Pagar mensual con tarjeta
          </button>
          <button type="button" className="btn-secondary" disabled={!cardReady || isPending} onClick={() => void handleCardAction("year")}>
            Pagar anual con tarjeta
          </button>
          <button type="button" className="btn-secondary" disabled={!cardReady || isPending} onClick={() => void handleStoredCardUpdate()}>
            Actualizar tarjeta guardada
          </button>
          {summary.paymentMethod ? (
            <button type="button" className="btn-secondary btn-danger-soft" disabled={isPending} onClick={() => void handleStoredCardDelete()}>
              Eliminar tarjeta
            </button>
          ) : null}
          {summary.rail === "card_subscription" && summary.renewsAutomatically ? (
            <button type="button" className="btn-secondary btn-danger-soft" onClick={() => void cancelAutoRenew()}>
              Cancelar renovación
            </button>
          ) : null}
          {summary.rail === "card_subscription" && summary.interval !== "month" ? (
            <button type="button" className="btn-secondary" onClick={() => void changeInterval("month")}>
              Próximo cobro mensual
            </button>
          ) : null}
          {summary.rail === "card_subscription" && summary.interval !== "year" ? (
            <button type="button" className="btn-secondary" onClick={() => void changeInterval("year")}>
              Próximo cobro anual
            </button>
          ) : null}
        </div>
      </section>

      <section className="card stack">
        <div className="stack" style={{ gap: "0.25rem" }}>
          <h2>PSE, Nequi y banco: compra de tiempo</h2>
          <p className="muted">Estos medios no suscriben. Compran un periodo mensual de Pro y luego decides si renovar manualmente o pasar a tarjeta.</p>
        </div>

        <div className="catalog-grid">
          <label>
            Nombre / razón social
            <input value={manualForm.customerName} onChange={(event) => setManualForm((prev) => ({ ...prev, customerName: event.target.value }))} />
          </label>
          <label>
            Teléfono
            <input value={manualForm.phoneNumber} onChange={(event) => setManualForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} />
          </label>
          <label>
            Tipo de documento
            <input value={manualForm.legalIdType} onChange={(event) => setManualForm((prev) => ({ ...prev, legalIdType: event.target.value }))} placeholder="CC" />
          </label>
          <label>
            Documento
            <input value={manualForm.legalId} onChange={(event) => setManualForm((prev) => ({ ...prev, legalId: event.target.value }))} />
          </label>
          <label>
            Usuario PSE
            <select value={manualForm.userType} onChange={(event) => setManualForm((prev) => ({ ...prev, userType: event.target.value as "0" | "1" }))}>
              <option value="0">Persona</option>
              <option value="1">Empresa</option>
            </select>
          </label>
          <label>
            Código banco PSE
            <input
              value={manualForm.financialInstitutionCode}
              onChange={(event) => setManualForm((prev) => ({ ...prev, financialInstitutionCode: event.target.value }))}
              placeholder="Busca el código en tu banco / Wompi"
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn-secondary" onClick={() => void handleManualCheckout("pse")}>
            Pagar con PSE
          </button>
          <button type="button" className="btn-secondary" onClick={() => void handleManualCheckout("nequi")}>
            Pagar con Nequi
          </button>
          <button type="button" className="btn-secondary" onClick={() => void handleManualCheckout("bank_transfer")}>
            Pagar por banco
          </button>
        </div>
      </section>

      {summary.rail === "manual_term_purchase" && summary.currentPeriodEnd ? (
        <section className="card stack">
          <h2>Pasar a tarjeta al vencimiento</h2>
          <p className="muted">
            Tienes tiempo Pro manual activo hasta el {formatDate(summary.currentPeriodEnd)}. Si quieres, registra la tarjeta ahora y la dejamos programada para activarse al vencer ese periodo.
          </p>
          <button type="button" className="btn-secondary" disabled={!cardReady} onClick={() => void handleCardAction("month", true)}>
            Registrar tarjeta para renovar al vencimiento
          </button>
        </section>
      ) : null}

      <section className="card stack">
        <div className="stack" style={{ gap: "0.25rem" }}>
          <h2>Historial de movimientos</h2>
          <p className="muted">Aquí verás cargos recurrentes, compras manuales y estados de confirmación.</p>
        </div>

        {transactions.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
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
                    <td>{formatDate(transaction.created_at)}</td>
                    <td>{transaction.method}</td>
                    <td>{transaction.status}</td>
                    <td>{formatMoney(transaction.amount_in_cents, transaction.currency)}</td>
                    <td>
                      {transaction.checkout_url ? (
                        <a href={transaction.checkout_url} target="_blank" rel="noreferrer">
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

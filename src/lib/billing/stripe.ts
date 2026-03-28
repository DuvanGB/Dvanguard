import Stripe from "stripe";

import { env } from "@/lib/env";
import type { BillingInterval } from "@/lib/billing/types";

let stripeClient: Stripe | null = null;

export function isStripeConfigured() {
  return Boolean(
    env.stripeSecretKey &&
      env.stripePublishableKey &&
      env.stripeWebhookSecret &&
      env.stripePriceProMonthly &&
      env.stripePriceProYearly
  );
}

export function getStripeServerClient() {
  if (!env.stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey, {
      apiVersion: "2026-03-25.dahlia"
    });
  }

  return stripeClient;
}

export function getStripePriceId(interval: BillingInterval) {
  if (interval === "year") {
    if (!env.stripePriceProYearly) {
      throw new Error("Missing STRIPE_PRICE_PRO_YEARLY");
    }
    return env.stripePriceProYearly;
  }

  if (!env.stripePriceProMonthly) {
    throw new Error("Missing STRIPE_PRICE_PRO_MONTHLY");
  }

  return env.stripePriceProMonthly;
}

export function getIntervalFromStripePrice(priceId: string | null | undefined): BillingInterval | null {
  if (!priceId) return null;
  if (priceId === env.stripePriceProMonthly) return "month";
  if (priceId === env.stripePriceProYearly) return "year";
  return null;
}

export function hasStripeManagedProStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export function toDateIso(timestampSeconds: number | null | undefined) {
  if (!timestampSeconds) return null;
  return new Date(timestampSeconds * 1000).toISOString();
}

export function extractDefaultPaymentMethod(
  paymentMethod: Stripe.PaymentMethod | string | null | undefined
): { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null } {
  if (!paymentMethod || typeof paymentMethod === "string") {
    return { brand: null, last4: null, expMonth: null, expYear: null };
  }

  return {
    brand: paymentMethod.card?.brand ?? null,
    last4: paymentMethod.card?.last4 ?? null,
    expMonth: paymentMethod.card?.exp_month ?? null,
    expYear: paymentMethod.card?.exp_year ?? null
  };
}

export function hasPaymentMethodDetails(paymentMethod: {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}) {
  return Boolean(paymentMethod.last4);
}

export function extractCustomerInvoicePaymentMethod(
  customer: Stripe.Customer | Stripe.DeletedCustomer | string | null | undefined
) {
  if (!customer || typeof customer === "string" || customer.deleted) {
    return { brand: null, last4: null, expMonth: null, expYear: null };
  }

  const paymentMethod = customer.invoice_settings.default_payment_method;
  return extractDefaultPaymentMethod(typeof paymentMethod === "string" ? null : paymentMethod);
}

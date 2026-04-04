import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { getDefaultProPlanCode, getPlanDefinition } from "@/lib/billing/plans";
import type { BillingInterval, BillingPaymentMethodKind } from "@/lib/billing/types";

type JsonRecord = Record<string, unknown>;

export type WompiMerchantAcceptance = {
  acceptanceToken: string | null;
  personalDataAuthToken: string | null;
  termsPermalink: string | null;
  personalDataPermalink: string | null;
};

type WompiTransactionInput = {
  reference: string;
  amountInCents: number;
  customerEmail: string;
  redirectUrl?: string | null;
  customerData?: JsonRecord | null;
  paymentMethod: JsonRecord;
  paymentSourceId?: number | null;
  acceptanceToken: string;
  acceptPersonalAuth: string;
  ipAddress?: string | null;
};

type WompiPaymentSourceInput = {
  token: string;
  customerEmail: string;
  acceptanceToken: string;
  acceptPersonalAuth: string;
};

function resolveBaseUrl() {
  if (env.wompiApiBaseUrl) {
    return env.wompiApiBaseUrl.replace(/\/$/, "");
  }

  const publicKey = env.wompiPublicKey;
  if (publicKey.startsWith("pub_test_")) {
    return "https://sandbox.wompi.co/v1";
  }

  return "https://production.wompi.co/v1";
}

export function isWompiConfigured() {
  return Boolean(env.wompiPublicKey && env.wompiPrivateKey && env.wompiIntegritySecret);
}

function ensureWompiConfigured() {
  if (!isWompiConfigured()) {
    throw new Error("Wompi no está configurado en este entorno.");
  }
}

async function wompiRequest<T>(path: string, init: RequestInit & { auth?: "public" | "private" | "none" } = {}) {
  ensureWompiConfigured();
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");

  const auth = init.auth ?? "private";
  if (auth === "private") {
    headers.set("Authorization", `Bearer ${env.wompiPrivateKey}`);
  } else if (auth === "public") {
    headers.set("Authorization", `Bearer ${env.wompiPublicKey}`);
  }

  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: unknown };
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload && payload.error
        ? JSON.stringify(payload.error)
        : `Wompi HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function getWompiAcceptanceTokens(): Promise<WompiMerchantAcceptance> {
  ensureWompiConfigured();

  const response = await wompiRequest<{
    data?: {
      presigned_acceptance?: {
        acceptance_token?: string | null;
        permalink?: string | null;
      } | null;
      presigned_personal_data_auth?: {
        acceptance_token?: string | null;
        permalink?: string | null;
      } | null;
    };
  }>(`/merchants/${env.wompiPublicKey}`, { method: "GET", auth: "none" });

  return {
    acceptanceToken: response.data?.presigned_acceptance?.acceptance_token ?? null,
    personalDataAuthToken: response.data?.presigned_personal_data_auth?.acceptance_token ?? null,
    termsPermalink: response.data?.presigned_acceptance?.permalink ?? null,
    personalDataPermalink: response.data?.presigned_personal_data_auth?.permalink ?? null
  };
}

export async function getPlanAmountInCents(admin: SupabaseClient, interval: BillingInterval) {
  const proPlanCode = await getDefaultProPlanCode(admin);
  const plan = await getPlanDefinition(admin, proPlanCode);
  const amountInCents = interval === "year" ? plan.yearlyPriceCents : plan.monthlyPriceCents;

  if (!amountInCents || amountInCents <= 0) {
    throw new Error(`Missing visible price for plan ${proPlanCode} (${interval}).`);
  }

  return amountInCents;
}

export async function getManualAmountInCents(
  admin: SupabaseClient,
  _kind: Exclude<BillingPaymentMethodKind, "card">
) {
  return getPlanAmountInCents(admin, "month");
}

export function buildWompiReference(prefix: string, userId: string) {
  return `${prefix}-${userId.slice(0, 8)}-${Date.now()}`;
}

export function buildWompiIntegritySignature(input: { reference: string; amountInCents: number; currency?: string }) {
  const currency = input.currency ?? "COP";
  return createHash("sha256")
    .update(`${input.reference}${input.amountInCents}${currency}${env.wompiIntegritySecret}`)
    .digest("hex");
}

export async function createWompiPaymentSource(input: WompiPaymentSourceInput) {
  const response = await wompiRequest<{
    data?: {
      id?: number;
      status?: string;
      public_data?: {
        bin?: string | null;
        last_four?: string | null;
        brand?: string | null;
        exp_month?: number | null;
        exp_year?: number | null;
      } | null;
    };
  }>("/payment_sources", {
    method: "POST",
    body: JSON.stringify({
      type: "CARD",
      token: input.token,
      customer_email: input.customerEmail,
      acceptance_token: input.acceptanceToken,
      accept_personal_auth: input.acceptPersonalAuth
    })
  });

  return response.data ?? {};
}

export async function createWompiTransaction(input: WompiTransactionInput) {
  const response = await wompiRequest<{ data?: JsonRecord }>("/transactions", {
    method: "POST",
    body: JSON.stringify({
      amount_in_cents: input.amountInCents,
      currency: "COP",
      customer_email: input.customerEmail,
      acceptance_token: input.acceptanceToken,
      accept_personal_auth: input.acceptPersonalAuth,
      reference: input.reference,
      signature: buildWompiIntegritySignature({
        reference: input.reference,
        amountInCents: input.amountInCents,
        currency: "COP"
      }),
      payment_method: input.paymentMethod,
      payment_source_id: input.paymentSourceId ?? undefined,
      customer_data: input.customerData ?? undefined,
      redirect_url: input.redirectUrl ?? undefined,
      ip: input.ipAddress ?? undefined
    })
  });

  return response.data ?? {};
}

export type WompiPaymentLinkInput = {
  name: string;
  description: string;
  amountInCents: number;
  redirectUrl: string;
  expiresAtMinutes?: number;
  customerEmail?: string;
};

export type WompiPaymentLinkResult = {
  id: string;
  url: string;
};

export async function createWompiPaymentLink(input: WompiPaymentLinkInput): Promise<WompiPaymentLinkResult> {
  const expiresAt = new Date(Date.now() + (input.expiresAtMinutes ?? 30) * 60 * 1000).toISOString();

  const response = await wompiRequest<{
    data?: {
      id?: string;
      name?: string;
      active?: boolean;
    };
  }>("/payment_links", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      single_use: true,
      collect_shipping: false,
      currency: "COP",
      amount_in_cents: input.amountInCents,
      redirect_url: input.redirectUrl,
      expires_at: expiresAt,
      customer_data: input.customerEmail
        ? { customer_email: input.customerEmail }
        : undefined
    })
  });

  const id = response.data?.id;
  if (!id) {
    throw new Error("Wompi no retornó un Payment Link válido.");
  }

  const base = env.wompiPublicKey.startsWith("pub_test_")
    ? "https://checkout.wompi.co/l"
    : "https://checkout.wompi.co/l";

  return { id, url: `${base}/${id}` };
}

export async function getWompiTransaction(transactionId: string) {
  const response = await wompiRequest<{ data?: JsonRecord }>(`/transactions/${transactionId}`, {
    method: "GET",
    auth: "public"
  });
  return response.data ?? {};
}

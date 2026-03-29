import type { SupabaseClient } from "@supabase/supabase-js";

import { FREE_PLAN, PRO_PLAN, ensureUserPlan, getPlanLimits } from "@/lib/billing/plans";
import type {
  BillingAccessState,
  BillingInterval,
  BillingLegalAcceptanceStatus,
  BillingPaymentMethodKind,
  BillingPaymentRail,
  BillingSubscriptionStatus,
  BillingSummary,
  PlanCode
} from "@/lib/billing/types";
import {
  buildWompiReference,
  createWompiPaymentSource,
  createWompiTransaction,
  getManualAmountInCents,
  getPlanAmountInCents,
  getWompiAcceptanceTokens,
  getWompiTransaction,
  isWompiConfigured
} from "@/lib/billing/wompi";
import { env } from "@/lib/env";
import { recordPlatformEvent } from "@/lib/platform-events";

const GRACE_DAYS = 3;
const ENFORCEMENT_LOOKBACK_DAYS = 30;
const MANUAL_REMINDER_DAYS = 7;

type JsonRecord = Record<string, unknown>;

export type BillingSubscriptionRecord = {
  id: string;
  user_id: string;
  provider: "wompi";
  rail: BillingPaymentRail;
  payment_method_kind: BillingPaymentMethodKind;
  plan_code: PlanCode;
  billing_interval: BillingInterval | null;
  term_length_days: number;
  status: BillingSubscriptionStatus;
  access_state: BillingAccessState;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_until: string | null;
  renews_automatically: boolean;
  next_charge_at: string | null;
  switch_to_card_at: string | null;
  switch_to_card_payment_method_id: string | null;
  reminder_sent_at: string | null;
  payment_method_id: string | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_exp_month: number | null;
  payment_method_exp_year: number | null;
  metadata_json: JsonRecord;
};

export type BillingTransactionRecord = {
  id: string;
  reference: string;
  external_transaction_id: string | null;
  method: BillingPaymentMethodKind;
  status: string;
  amount_in_cents: number;
  currency: string;
  checkout_url: string | null;
  paid_at: string | null;
  approved_at: string | null;
  created_at: string;
};

type BillingPaymentMethodRecord = {
  id: string;
  user_id: string;
  wompi_payment_source_id: number;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  status: string;
  is_default: boolean;
};

function normalizeBillingStatus(value: string | null | undefined): BillingSubscriptionStatus {
  if (
    value === "active" ||
    value === "payment_pending" ||
    value === "pending_activation" ||
    value === "payment_failed" ||
    value === "expired" ||
    value === "canceled"
  ) {
    return value;
  }

  return "not_started";
}

function normalizeAccessState(value: string | null | undefined): BillingAccessState {
  if (value === "grace_period" || value === "enforcement_applied") return value;
  return "within_limit";
}

function getGraceUntilIso(now = new Date()) {
  return new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function addDaysIso(startIso: string, days: number) {
  const start = new Date(startIso);
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function daysForInterval(interval: BillingInterval) {
  return interval === "year" ? 365 : 30;
}

function toCheckoutUrl(rawPayload: JsonRecord | null | undefined) {
  if (!rawPayload) return null;
  const paymentLink =
    typeof rawPayload.payment_link === "string"
      ? rawPayload.payment_link
      : typeof rawPayload.redirect_url === "string"
        ? rawPayload.redirect_url
        : null;
  if (paymentLink) return paymentLink;

  const paymentMethod = rawPayload.payment_method;
  if (!paymentMethod || typeof paymentMethod !== "object") return null;
  const extra = (paymentMethod as JsonRecord).extra;
  if (!extra || typeof extra !== "object") return null;
  if (typeof (extra as JsonRecord).async_payment_url === "string") {
    return String((extra as JsonRecord).async_payment_url);
  }
  if (typeof (extra as JsonRecord).redirect_url === "string") {
    return String((extra as JsonRecord).redirect_url);
  }
  return null;
}

function wompiStatusToBillingStatus(status: string | null | undefined): BillingSubscriptionStatus {
  if (status === "APPROVED") return "active";
  if (status === "PENDING") return "payment_pending";
  if (status === "DECLINED" || status === "ERROR" || status === "VOIDED") return "payment_failed";
  return "payment_pending";
}

function mapInterval(value: unknown): BillingInterval | null {
  return value === "year" ? "year" : value === "month" ? "month" : null;
}

function mapPaymentKind(value: unknown): BillingPaymentMethodKind {
  if (value === "pse" || value === "nequi" || value === "bank_transfer" || value === "card") {
    return value;
  }
  return "card";
}

function sanitizeMetadata(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

async function requireBillingLegalAccepted(admin: SupabaseClient, userId: string) {
  const legal = await getBillingLegalStatus(admin, userId);
  if (!legal.accepted) {
    throw new Error("Debes aceptar términos y privacidad antes de iniciar un pago.");
  }
  return legal;
}

async function getDefaultPaymentMethod(admin: SupabaseClient, userId: string): Promise<BillingPaymentMethodRecord | null> {
  const { data, error } = await admin
    .from("billing_payment_methods")
    .select("id, user_id, wompi_payment_source_id, brand, last4, exp_month, exp_year, status, is_default")
    .eq("user_id", userId)
    .eq("status", "available")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing payment method: ${error.message}`);
  }

  if (!data) return null;
  return {
    id: data.id,
    user_id: data.user_id,
    wompi_payment_source_id: Number(data.wompi_payment_source_id),
    brand: data.brand ?? null,
    last4: data.last4 ?? null,
    exp_month: typeof data.exp_month === "number" ? data.exp_month : null,
    exp_year: typeof data.exp_year === "number" ? data.exp_year : null,
    status: data.status,
    is_default: Boolean(data.is_default)
  };
}

async function persistPaymentMethod(
  admin: SupabaseClient,
  input: {
    userId: string;
    wompiPaymentSourceId: number;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
  }
) {
  await admin.from("billing_payment_methods").update({ is_default: false }).eq("user_id", input.userId);

  const { data, error } = await admin
    .from("billing_payment_methods")
    .upsert(
      {
        user_id: input.userId,
        provider: "wompi",
        method_type: "card",
        wompi_payment_source_id: input.wompiPaymentSourceId,
        brand: input.brand,
        last4: input.last4,
        exp_month: input.expMonth,
        exp_year: input.expYear,
        status: "available",
        is_default: true
      },
      { onConflict: "wompi_payment_source_id" }
    )
    .select("id, user_id, wompi_payment_source_id, brand, last4, exp_month, exp_year, status, is_default")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to persist payment method");
  }

  return {
    id: data.id,
    user_id: data.user_id,
    wompi_payment_source_id: Number(data.wompi_payment_source_id),
    brand: data.brand ?? null,
    last4: data.last4 ?? null,
    exp_month: typeof data.exp_month === "number" ? data.exp_month : null,
    exp_year: typeof data.exp_year === "number" ? data.exp_year : null,
    status: data.status,
    is_default: Boolean(data.is_default)
  } satisfies BillingPaymentMethodRecord;
}

export async function getBillingLegalStatus(admin: SupabaseClient, userId: string): Promise<BillingLegalAcceptanceStatus> {
  const { data, error } = await admin
    .from("billing_legal_acceptances")
    .select("accepted_at, terms_version, privacy_version")
    .eq("user_id", userId)
    .eq("terms_version", env.billingTermsVersion)
    .eq("privacy_version", env.billingPrivacyVersion)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing legal status: ${error.message}`);
  }

  return {
    accepted: Boolean(data),
    acceptedAt: data?.accepted_at ?? null,
    termsVersion: env.billingTermsVersion,
    privacyVersion: env.billingPrivacyVersion
  };
}

export async function acceptBillingLegalTerms(admin: SupabaseClient, userId: string) {
  const timestamp = nowIso();
  const { error } = await admin.from("billing_legal_acceptances").upsert(
    {
      user_id: userId,
      terms_version: env.billingTermsVersion,
      privacy_version: env.billingPrivacyVersion,
      accepted_at: timestamp
    },
    { onConflict: "user_id,terms_version,privacy_version" }
  );

  if (error) {
    throw new Error(`Failed to persist billing legal acceptance: ${error.message}`);
  }

  return {
    accepted: true,
    acceptedAt: timestamp,
    termsVersion: env.billingTermsVersion,
    privacyVersion: env.billingPrivacyVersion
  } satisfies BillingLegalAcceptanceStatus;
}

export async function listBillingTransactions(admin: SupabaseClient, userId: string, limit = 20): Promise<BillingTransactionRecord[]> {
  const { data, error } = await admin
    .from("billing_transactions")
    .select("id, reference, external_transaction_id, method, status, amount_in_cents, currency, checkout_url, paid_at, approved_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load billing transactions: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    reference: row.reference,
    external_transaction_id: row.external_transaction_id ?? null,
    method: mapPaymentKind(row.method),
    status: row.status,
    amount_in_cents: Number(row.amount_in_cents ?? 0),
    currency: row.currency ?? "COP",
    checkout_url: row.checkout_url ?? null,
    paid_at: row.paid_at ?? null,
    approved_at: row.approved_at ?? null,
    created_at: row.created_at
  }));
}

export async function listBillingInvoices(admin: SupabaseClient, userId: string, limit = 20) {
  return listBillingTransactions(admin, userId, limit);
}

export async function getBillingSubscriptionRecord(admin: SupabaseClient, userId: string): Promise<BillingSubscriptionRecord | null> {
  const { data, error } = await admin
    .from("billing_memberships")
    .select(
      [
        "id",
        "user_id",
        "provider",
        "rail",
        "payment_method_kind",
        "plan_code",
        "interval",
        "term_length_days",
        "status",
        "access_state",
        "starts_at",
        "ends_at",
        "renews_automatically",
        "next_charge_at",
        "switch_to_card_at",
        "switch_to_card_payment_method_id",
        "reminder_sent_at",
        "grace_until",
        "payment_method_id",
        "metadata_json"
      ].join(", ")
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing membership: ${error.message}`);
  }

  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  const paymentMethod = row.payment_method_id
    ? await admin
        .from("billing_payment_methods")
        .select("brand, last4, exp_month, exp_year")
        .eq("id", String(row.payment_method_id))
        .maybeSingle()
        .then(({ data: method }) => method ?? null)
    : null;

  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    provider: "wompi",
    rail: row.rail === "manual_term_purchase" ? "manual_term_purchase" : "card_subscription",
    payment_method_kind: mapPaymentKind(row.payment_method_kind),
    plan_code: row.plan_code === PRO_PLAN ? PRO_PLAN : FREE_PLAN,
    billing_interval: mapInterval(row.interval),
    term_length_days: Number(row.term_length_days ?? 30),
    status: normalizeBillingStatus(typeof row.status === "string" ? row.status : null),
    access_state: normalizeAccessState(typeof row.access_state === "string" ? row.access_state : null),
    current_period_start: typeof row.starts_at === "string" ? row.starts_at : null,
    current_period_end: typeof row.ends_at === "string" ? row.ends_at : null,
    cancel_at_period_end: !Boolean(row.renews_automatically),
    grace_until: typeof row.grace_until === "string" ? row.grace_until : null,
    renews_automatically: Boolean(row.renews_automatically),
    next_charge_at: typeof row.next_charge_at === "string" ? row.next_charge_at : null,
    switch_to_card_at: typeof row.switch_to_card_at === "string" ? row.switch_to_card_at : null,
    switch_to_card_payment_method_id: typeof row.switch_to_card_payment_method_id === "string" ? row.switch_to_card_payment_method_id : null,
    reminder_sent_at: typeof row.reminder_sent_at === "string" ? row.reminder_sent_at : null,
    payment_method_id: typeof row.payment_method_id === "string" ? row.payment_method_id : null,
    payment_method_brand: typeof paymentMethod?.brand === "string" ? paymentMethod.brand : null,
    payment_method_last4: typeof paymentMethod?.last4 === "string" ? paymentMethod.last4 : null,
    payment_method_exp_month: typeof paymentMethod?.exp_month === "number" ? paymentMethod.exp_month : null,
    payment_method_exp_year: typeof paymentMethod?.exp_year === "number" ? paymentMethod.exp_year : null,
    metadata_json: sanitizeMetadata(row.metadata_json)
  };
}

export async function assignPlanDirectly(admin: SupabaseClient, input: { userId: string; planCode: PlanCode; assignedBy?: string | null }) {
  const { error } = await admin.from("user_plans").upsert(
    {
      user_id: input.userId,
      plan_code: input.planCode,
      assigned_by: input.assignedBy ?? null,
      assigned_at: nowIso()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Failed to assign plan directly: ${error.message}`);
  }
}

export async function getMostVisitedPublishedSiteId(admin: SupabaseClient, userId: string) {
  const fromIso = new Date(Date.now() - ENFORCEMENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: sites, error: sitesError } = await admin
    .from("sites")
    .select("id, updated_at")
    .eq("owner_id", userId)
    .eq("status", "published")
    .is("deleted_at", null);

  if (sitesError) {
    throw new Error(`Failed to load published sites for enforcement: ${sitesError.message}`);
  }

  const publishedSites = sites ?? [];
  if (!publishedSites.length) return null;
  if (publishedSites.length === 1) return publishedSites[0].id;

  const siteIds = publishedSites.map((site) => site.id);
  const { data: analytics, error: analyticsError } = await admin
    .from("site_analytics_events")
    .select("site_id")
    .in("site_id", siteIds)
    .eq("event_type", "visit")
    .gte("occurred_at", fromIso);

  if (analyticsError) {
    throw new Error(`Failed to load analytics for enforcement: ${analyticsError.message}`);
  }

  const visitsBySiteId = new Map<string, number>();
  for (const site of siteIds) {
    visitsBySiteId.set(site, 0);
  }
  for (const row of analytics ?? []) {
    visitsBySiteId.set(row.site_id, (visitsBySiteId.get(row.site_id) ?? 0) + 1);
  }

  publishedSites.sort((left, right) => {
    const rightVisits = visitsBySiteId.get(right.id) ?? 0;
    const leftVisits = visitsBySiteId.get(left.id) ?? 0;
    if (rightVisits !== leftVisits) return rightVisits - leftVisits;
    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });

  return publishedSites[0]?.id ?? null;
}

export async function enforcePublishedSiteLimitForFreePlan(admin: SupabaseClient, userId: string) {
  const winnerSiteId = await getMostVisitedPublishedSiteId(admin, userId);
  if (!winnerSiteId) return { keptSiteId: null, unpublishedSiteIds: [] as string[] };

  const { data: sites, error: sitesError } = await admin
    .from("sites")
    .select("id")
    .eq("owner_id", userId)
    .eq("status", "published")
    .is("deleted_at", null)
    .neq("id", winnerSiteId);

  if (sitesError) {
    throw new Error(`Failed to load overflow sites for enforcement: ${sitesError.message}`);
  }

  const toUnpublish = (sites ?? []).map((site) => site.id);
  if (!toUnpublish.length) {
    return { keptSiteId: winnerSiteId, unpublishedSiteIds: [] as string[] };
  }

  await admin.from("site_publications").update({ is_active: false }).in("site_id", toUnpublish);
  await admin.from("sites").update({ status: "draft" }).in("id", toUnpublish);

  await admin.from("events").insert(
    toUnpublish.map((siteId) => ({
      site_id: siteId,
      event_type: "site.unpublished",
      payload_json: { reason: "billing_enforcement", keptSiteId: winnerSiteId }
    }))
  );

  return { keptSiteId: winnerSiteId, unpublishedSiteIds: toUnpublish };
}

async function sendManualReminderEmail(input: { to: string; endsAt: string; method: BillingPaymentMethodKind }) {
  if (!env.resendApiKey || !env.resendFromEmail) return false;

  const label = input.method === "pse" ? "PSE" : input.method === "nequi" ? "Nequi" : "transferencia bancaria";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.resendApiKey}`
    },
    body: JSON.stringify({
      from: env.resendFromEmail,
      to: [input.to],
      subject: "Tu plan Pro está por vencer",
      html: `<p>Tu acceso Pro pagado con ${label} vence el ${new Date(input.endsAt).toLocaleDateString("es-CO")}.</p><p>Puedes renovarlo desde tu panel o registrar una tarjeta para continuar sin interrupciones.</p>`
    })
  });

  return response.ok;
}

async function maybeSendManualReminder(admin: SupabaseClient, membership: BillingSubscriptionRecord, email: string | null | undefined) {
  if (!email || membership.rail !== "manual_term_purchase" || !membership.current_period_end || membership.reminder_sent_at) return;

  const remainingMs = new Date(membership.current_period_end).getTime() - Date.now();
  const remainingDays = remainingMs / (24 * 60 * 60 * 1000);
  if (remainingDays > MANUAL_REMINDER_DAYS || remainingDays < 0) return;

  const sent = await sendManualReminderEmail({
    to: email,
    endsAt: membership.current_period_end,
    method: membership.payment_method_kind
  }).catch(() => false);

  if (sent) {
    await admin.from("billing_memberships").update({ reminder_sent_at: nowIso() }).eq("id", membership.id);
  }
}

async function recordTransaction(
  admin: SupabaseClient,
  input: {
    userId: string;
    membershipId?: string | null;
    method: BillingPaymentMethodKind;
    reference: string;
    externalTransactionId?: string | null;
    status: string;
    amountInCents: number;
    interval?: BillingInterval | null;
    rawPayload: JsonRecord;
    checkoutUrl?: string | null;
    paidAt?: string | null;
    approvedAt?: string | null;
  }
) {
  const { data, error } = await admin
    .from("billing_transactions")
    .upsert(
      {
        user_id: input.userId,
        provider: "wompi",
        method: input.method,
        membership_id: input.membershipId ?? null,
        reference: input.reference,
        external_transaction_id: input.externalTransactionId ?? null,
        status: input.status,
        amount_in_cents: input.amountInCents,
        currency: "COP",
        interval: input.interval ?? null,
        checkout_url: input.checkoutUrl ?? null,
        paid_at: input.paidAt ?? null,
        approved_at: input.approvedAt ?? null,
        raw_payload: input.rawPayload
      },
      { onConflict: "reference" }
    )
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to record billing transaction");
  }

  return data.id as string;
}

async function createOrExtendMembershipForApprovedTransaction(
  admin: SupabaseClient,
  input: {
    userId: string;
    method: BillingPaymentMethodKind;
    interval: BillingInterval | null;
    rail: BillingPaymentRail;
    paymentMethodId?: string | null;
    transactionId?: string | null;
    metadata?: JsonRecord;
  }
) {
  const latest = await getBillingSubscriptionRecord(admin, input.userId);
  const now = nowIso();
  const durationDays = input.method === "card" ? daysForInterval(input.interval ?? "month") : 30;
  const baseStart =
    latest?.status === "active" && latest.current_period_end && new Date(latest.current_period_end).getTime() > Date.now()
      ? latest.current_period_end
      : now;
  const nextEnd = addDaysIso(baseStart, durationDays);

  if (latest) {
    const { data, error } = await admin
      .from("billing_memberships")
      .update({
        provider: "wompi",
        rail: input.rail,
        payment_method_kind: input.method,
        plan_code: PRO_PLAN,
        interval: input.interval,
        term_length_days: durationDays,
        status: "active",
        starts_at: latest.status === "active" && latest.current_period_start ? latest.current_period_start : now,
        ends_at: nextEnd,
        renews_automatically: input.rail === "card_subscription",
        payment_method_id: input.paymentMethodId ?? latest.payment_method_id,
        next_charge_at: input.rail === "card_subscription" ? nextEnd : null,
        switch_to_card_at: null,
        switch_to_card_payment_method_id: null,
        access_state: "within_limit",
        grace_until: null,
        metadata_json: { ...(latest.metadata_json ?? {}), ...(input.metadata ?? {}), latestTransactionId: input.transactionId ?? null }
      })
      .eq("id", latest.id)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to update billing membership");
    }

    return latest.id;
  }

  const { data, error } = await admin
    .from("billing_memberships")
    .insert({
      user_id: input.userId,
      provider: "wompi",
      rail: input.rail,
      payment_method_kind: input.method,
      plan_code: PRO_PLAN,
      interval: input.interval,
      term_length_days: durationDays,
      status: "active",
      starts_at: now,
      ends_at: nextEnd,
      renews_automatically: input.rail === "card_subscription",
      payment_method_id: input.paymentMethodId ?? null,
      next_charge_at: input.rail === "card_subscription" ? nextEnd : null,
      metadata_json: { ...(input.metadata ?? {}), latestTransactionId: input.transactionId ?? null }
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create billing membership");
  }

  return data.id as string;
}

async function markMembershipPaymentPending(
  admin: SupabaseClient,
  input: {
    userId: string;
    rail: BillingPaymentRail;
    method: BillingPaymentMethodKind;
    interval: BillingInterval | null;
    paymentMethodId?: string | null;
    metadata?: JsonRecord;
  }
) {
  const existing = await getBillingSubscriptionRecord(admin, input.userId);
  if (existing) {
    await admin
      .from("billing_memberships")
      .update({
        rail: input.rail,
        payment_method_kind: input.method,
        interval: input.interval,
        payment_method_id: input.paymentMethodId ?? existing.payment_method_id,
        renews_automatically: input.rail === "card_subscription",
        status: "payment_pending",
        metadata_json: { ...(existing.metadata_json ?? {}), ...(input.metadata ?? {}) }
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await admin
    .from("billing_memberships")
    .insert({
      user_id: input.userId,
      provider: "wompi",
      rail: input.rail,
      payment_method_kind: input.method,
      plan_code: PRO_PLAN,
      interval: input.interval,
      term_length_days: input.method === "card" ? daysForInterval(input.interval ?? "month") : 30,
      status: "payment_pending",
      renews_automatically: input.rail === "card_subscription",
      payment_method_id: input.paymentMethodId ?? null,
      metadata_json: input.metadata ?? {}
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create pending billing membership");
  }

  return data.id as string;
}

function getCardPaymentMethodDetails(paymentSourceData: JsonRecord | undefined) {
  const publicData = paymentSourceData?.public_data;
  if (!publicData || typeof publicData !== "object") {
    return { brand: null, last4: null, expMonth: null, expYear: null };
  }

  return {
    brand: typeof (publicData as JsonRecord).brand === "string" ? String((publicData as JsonRecord).brand) : null,
    last4: typeof (publicData as JsonRecord).last_four === "string" ? String((publicData as JsonRecord).last_four) : null,
    expMonth: typeof (publicData as JsonRecord).exp_month === "number" ? Number((publicData as JsonRecord).exp_month) : null,
    expYear: typeof (publicData as JsonRecord).exp_year === "number" ? Number((publicData as JsonRecord).exp_year) : null
  };
}

function parseApprovedAt(rawPayload: JsonRecord) {
  if (typeof rawPayload.finalized_at === "string") return rawPayload.finalized_at;
  if (typeof rawPayload.created_at === "string") return rawPayload.created_at;
  return nowIso();
}

async function createStoredCardCharge(admin: SupabaseClient, input: { userId: string; interval: BillingInterval; paymentMethod: BillingPaymentMethodRecord }) {
  const acceptance = await getWompiAcceptanceTokens();
  if (!acceptance.acceptanceToken || !acceptance.personalDataAuthToken) {
    throw new Error("No se pudieron obtener los tokens de aceptación de Wompi.");
  }

  const reference = buildWompiReference("pro-card", input.userId);
  const amountInCents = getPlanAmountInCents(input.interval);
  const rawTx = await createWompiTransaction({
    reference,
    amountInCents,
    customerEmail: "",
    acceptanceToken: acceptance.acceptanceToken,
    acceptPersonalAuth: acceptance.personalDataAuthToken,
    paymentMethod: {
      installments: 1
    },
    paymentSourceId: input.paymentMethod.wompi_payment_source_id
  });

  return {
    reference,
    amountInCents,
    rawTx
  };
}

async function renewCardMembershipIfDue(admin: SupabaseClient, membership: BillingSubscriptionRecord) {
  if (
    membership.rail !== "card_subscription" ||
    !membership.renews_automatically ||
    !membership.payment_method_id ||
    !membership.current_period_end ||
    new Date(membership.current_period_end).getTime() > Date.now()
  ) {
    return;
  }

  const paymentMethod = await getDefaultPaymentMethod(admin, membership.user_id);
  if (!paymentMethod) {
    await admin.from("billing_memberships").update({ status: "payment_failed" }).eq("id", membership.id);
    return;
  }

  const { data: profile } = await admin.from("profiles").select("email").eq("id", membership.user_id).maybeSingle();
  const acceptance = await getWompiAcceptanceTokens();
  if (!acceptance.acceptanceToken || !acceptance.personalDataAuthToken) return;

  const reference = buildWompiReference("renew-card", membership.user_id);
  const amountInCents = getPlanAmountInCents(membership.billing_interval ?? "month");
  const rawTx = await createWompiTransaction({
    reference,
    amountInCents,
    customerEmail: profile?.email ?? "",
    acceptanceToken: acceptance.acceptanceToken,
    acceptPersonalAuth: acceptance.personalDataAuthToken,
    paymentMethod: { installments: 1 },
    paymentSourceId: paymentMethod.wompi_payment_source_id
  }).catch(() => null);

  if (!rawTx) {
    await admin.from("billing_memberships").update({ status: "payment_failed" }).eq("id", membership.id);
    return;
  }

  const rawStatus = typeof rawTx.status === "string" ? rawTx.status : "PENDING";
  const transactionId = await recordTransaction(admin, {
    userId: membership.user_id,
    membershipId: membership.id,
    method: "card",
    reference,
    externalTransactionId: typeof rawTx.id === "string" ? rawTx.id : null,
    status: rawStatus,
    amountInCents,
    interval: membership.billing_interval,
    rawPayload: rawTx,
    checkoutUrl: toCheckoutUrl(rawTx),
    approvedAt: rawStatus === "APPROVED" ? parseApprovedAt(rawTx) : null,
    paidAt: rawStatus === "APPROVED" ? parseApprovedAt(rawTx) : null
  });

  if (rawStatus === "APPROVED") {
    await createOrExtendMembershipForApprovedTransaction(admin, {
      userId: membership.user_id,
      method: "card",
      interval: membership.billing_interval ?? "month",
      rail: "card_subscription",
      paymentMethodId: paymentMethod.id,
      transactionId
    });
  } else {
    await admin
      .from("billing_memberships")
      .update({ status: wompiStatusToBillingStatus(rawStatus), next_charge_at: membership.current_period_end })
      .eq("id", membership.id);
  }
}

async function maybeActivateScheduledCardSwitch(admin: SupabaseClient, membership: BillingSubscriptionRecord) {
  if (
    !membership.switch_to_card_at ||
    !membership.switch_to_card_payment_method_id ||
    new Date(membership.switch_to_card_at).getTime() > Date.now()
  ) {
    return;
  }

  const { data: paymentMethodRow, error } = await admin
    .from("billing_payment_methods")
    .select("id, user_id, wompi_payment_source_id, brand, last4, exp_month, exp_year, status, is_default")
    .eq("id", membership.switch_to_card_payment_method_id)
    .maybeSingle();

  if (error || !paymentMethodRow) {
    return;
  }

  const paymentMethod: BillingPaymentMethodRecord = {
    id: paymentMethodRow.id,
    user_id: paymentMethodRow.user_id,
    wompi_payment_source_id: Number(paymentMethodRow.wompi_payment_source_id),
    brand: paymentMethodRow.brand ?? null,
    last4: paymentMethodRow.last4 ?? null,
    exp_month: typeof paymentMethodRow.exp_month === "number" ? paymentMethodRow.exp_month : null,
    exp_year: typeof paymentMethodRow.exp_year === "number" ? paymentMethodRow.exp_year : null,
    status: paymentMethodRow.status,
    is_default: Boolean(paymentMethodRow.is_default)
  };

  const { data: profile } = await admin.from("profiles").select("email").eq("id", membership.user_id).maybeSingle();
  const acceptance = await getWompiAcceptanceTokens();
  if (!acceptance.acceptanceToken || !acceptance.personalDataAuthToken) return;

  const reference = buildWompiReference("switch-card", membership.user_id);
  const amountInCents = getPlanAmountInCents("month");
  const rawTx = await createWompiTransaction({
    reference,
    amountInCents,
    customerEmail: profile?.email ?? "",
    acceptanceToken: acceptance.acceptanceToken,
    acceptPersonalAuth: acceptance.personalDataAuthToken,
    paymentMethod: { installments: 1 },
    paymentSourceId: paymentMethod.wompi_payment_source_id
  }).catch(() => null);

  if (!rawTx) {
    await admin.from("billing_memberships").update({ status: "pending_activation" }).eq("id", membership.id);
    return;
  }

  const rawStatus = typeof rawTx.status === "string" ? rawTx.status : "PENDING";
  const txId = await recordTransaction(admin, {
    userId: membership.user_id,
    membershipId: membership.id,
    method: "card",
    reference,
    externalTransactionId: typeof rawTx.id === "string" ? rawTx.id : null,
    status: rawStatus,
    amountInCents,
    interval: "month",
    rawPayload: rawTx,
    checkoutUrl: toCheckoutUrl(rawTx),
    approvedAt: rawStatus === "APPROVED" ? parseApprovedAt(rawTx) : null,
    paidAt: rawStatus === "APPROVED" ? parseApprovedAt(rawTx) : null
  });

  if (rawStatus === "APPROVED") {
    await createOrExtendMembershipForApprovedTransaction(admin, {
      userId: membership.user_id,
      method: "card",
      interval: "month",
      rail: "card_subscription",
      paymentMethodId: paymentMethod.id,
      transactionId: txId
    });
  } else {
    await admin
      .from("billing_memberships")
      .update({ status: rawStatus === "PENDING" ? "pending_activation" : "payment_failed" })
      .eq("id", membership.id);
  }
}

async function runBillingAutomation(admin: SupabaseClient, userId: string, email?: string | null) {
  const membership = await getBillingSubscriptionRecord(admin, userId);
  if (!membership) return null;

  if (membership.rail === "manual_term_purchase") {
    await maybeSendManualReminder(admin, membership, email);
  }

  if (membership.status === "active" && membership.current_period_end && new Date(membership.current_period_end).getTime() <= Date.now()) {
    if (membership.rail === "card_subscription" && membership.renews_automatically) {
      await renewCardMembershipIfDue(admin, membership);
    } else {
      await admin.from("billing_memberships").update({ status: "expired", renews_automatically: false }).eq("id", membership.id);
    }
  }

  await maybeActivateScheduledCardSwitch(admin, membership);
  return getBillingSubscriptionRecord(admin, userId);
}

export async function applyBillingAccessRules(admin: SupabaseClient, userId: string, email?: string | null) {
  let subscription = await runBillingAutomation(admin, userId, email);
  if (!subscription) {
    const currentPlan = await ensureUserPlan(admin, userId);
    if (currentPlan.plan_code === PRO_PLAN) {
      return {
        subscription: null,
        accessState: "within_limit" as BillingAccessState
      };
    }

    await assignPlanDirectly(admin, { userId, planCode: FREE_PLAN });
    return {
      subscription: null,
      accessState: "within_limit" as BillingAccessState
    };
  }

  const now = Date.now();
  const hasProAccess =
    subscription.status === "active" &&
    Boolean(subscription.current_period_end) &&
    new Date(subscription.current_period_end ?? 0).getTime() > now;

  if (hasProAccess) {
    await assignPlanDirectly(admin, { userId, planCode: PRO_PLAN });

    if (subscription.access_state !== "within_limit" || subscription.grace_until) {
      await admin.from("billing_memberships").update({ access_state: "within_limit", grace_until: null }).eq("id", subscription.id);
      subscription = { ...subscription, access_state: "within_limit", grace_until: null };
    }

    return {
      subscription,
      accessState: "within_limit" as BillingAccessState
    };
  }

  await assignPlanDirectly(admin, { userId, planCode: FREE_PLAN });

  const freeLimits = await getPlanLimits(admin, FREE_PLAN);
  const { count: publishedCount, error: publishedError } = await admin
    .from("sites")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("status", "published")
    .is("deleted_at", null);

  if (publishedError) {
    throw new Error(`Failed to count published sites for billing enforcement: ${publishedError.message}`);
  }

  const publishedSites = publishedCount ?? 0;
  if (publishedSites <= freeLimits.maxPublishedSites) {
    if (subscription.access_state !== "within_limit" || subscription.grace_until) {
      await admin.from("billing_memberships").update({ access_state: "within_limit", grace_until: null }).eq("id", subscription.id);
      subscription = { ...subscription, access_state: "within_limit", grace_until: null };
    }

    return { subscription, accessState: "within_limit" as BillingAccessState };
  }

  const graceUntil = subscription.grace_until ? new Date(subscription.grace_until) : null;
  if (!graceUntil || Number.isNaN(graceUntil.getTime()) || graceUntil <= new Date()) {
    if (!graceUntil) {
      const nextGrace = getGraceUntilIso();
      await admin.from("billing_memberships").update({ access_state: "grace_period", grace_until: nextGrace }).eq("id", subscription.id);

      await recordPlatformEvent(admin, {
        eventType: "billing.grace_started",
        userId,
        payload: {
          graceUntil: nextGrace,
          publishedSites,
          freeLimit: freeLimits.maxPublishedSites
        }
      }).catch(() => undefined);

      return {
        subscription: { ...subscription, access_state: "grace_period", grace_until: nextGrace },
        accessState: "grace_period" as BillingAccessState
      };
    }

    const enforcement = await enforcePublishedSiteLimitForFreePlan(admin, userId);
    await admin.from("billing_memberships").update({ access_state: "enforcement_applied", grace_until: null }).eq("id", subscription.id);

    await recordPlatformEvent(admin, {
      eventType: "billing.enforcement_applied",
      userId,
      siteId: enforcement.keptSiteId,
      payload: {
        keptSiteId: enforcement.keptSiteId,
        unpublishedSiteIds: enforcement.unpublishedSiteIds
      }
    }).catch(() => undefined);

    return {
      subscription: { ...subscription, access_state: "enforcement_applied", grace_until: null },
      accessState: "enforcement_applied" as BillingAccessState
    };
  }

  if (subscription.access_state !== "grace_period") {
    await admin.from("billing_memberships").update({ access_state: "grace_period" }).eq("id", subscription.id);
  }

  return {
    subscription: { ...subscription, access_state: "grace_period" },
    accessState: "grace_period" as BillingAccessState
  };
}

export async function getBillingSummary(admin: SupabaseClient, userId: string, email?: string | null): Promise<BillingSummary> {
  await ensureUserPlan(admin, userId);
  const [legal, acceptance, applied] = await Promise.all([
    getBillingLegalStatus(admin, userId),
    isWompiConfigured()
      ? getWompiAcceptanceTokens().catch(() => ({
          acceptanceToken: null,
          personalDataAuthToken: null,
          termsPermalink: null,
          personalDataPermalink: null
        }))
      : Promise.resolve({
          acceptanceToken: null,
          personalDataAuthToken: null,
          termsPermalink: null,
          personalDataPermalink: null
        }),
    applyBillingAccessRules(admin, userId, email)
  ]);

  const plan = (await ensureUserPlan(admin, userId)).plan_code as PlanCode;
  const subscription = applied.subscription;

  return {
    plan,
    provider: subscription ? "wompi" : null,
    rail: subscription?.rail ?? null,
    paymentMethodKind: subscription?.payment_method_kind ?? null,
    interval: subscription?.billing_interval ?? null,
    subscriptionStatus: subscription?.status ?? "not_started",
    renewsAutomatically: subscription?.renews_automatically ?? false,
    currentPeriodStart: subscription?.current_period_start ?? null,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    accessState: normalizeAccessState(subscription?.access_state ?? null),
    graceUntil: subscription?.grace_until ?? null,
    checkoutEnabled: isWompiConfigured(),
    switchToCardAt: subscription?.switch_to_card_at ?? null,
    legal,
    wompiAcceptance: {
      termsPermalink: acceptance.termsPermalink,
      personalDataPermalink: acceptance.personalDataPermalink
    },
    paymentMethod: subscription?.payment_method_last4
      ? {
          brand: subscription.payment_method_brand,
          last4: subscription.payment_method_last4,
          expMonth: subscription.payment_method_exp_month,
          expYear: subscription.payment_method_exp_year
        }
      : null
  };
}

export async function subscribeUserWithCard(
  admin: SupabaseClient,
  input: {
    userId: string;
    email: string;
    interval: BillingInterval;
    token: string;
    cardholderName?: string | null;
    phoneNumber?: string | null;
    ipAddress?: string | null;
  }
) {
  await requireBillingLegalAccepted(admin, input.userId);
  const acceptance = await getWompiAcceptanceTokens();
  if (!acceptance.acceptanceToken || !acceptance.personalDataAuthToken) {
    throw new Error("No se pudieron obtener los contratos de aceptación de Wompi.");
  }

  const paymentSource = await createWompiPaymentSource({
    token: input.token,
    customerEmail: input.email,
    acceptanceToken: acceptance.acceptanceToken,
    acceptPersonalAuth: acceptance.personalDataAuthToken
  });

  const cardDetails = getCardPaymentMethodDetails(paymentSource as JsonRecord);
  const persistedPaymentMethod = await persistPaymentMethod(admin, {
    userId: input.userId,
    wompiPaymentSourceId: Number(paymentSource.id),
    brand: cardDetails.brand,
    last4: cardDetails.last4,
    expMonth: cardDetails.expMonth,
    expYear: cardDetails.expYear
  });

  const reference = buildWompiReference(`pro-${input.interval}`, input.userId);
  const amountInCents = getPlanAmountInCents(input.interval);
  const rawTx = await createWompiTransaction({
    reference,
    amountInCents,
    customerEmail: input.email,
    acceptanceToken: acceptance.acceptanceToken,
    acceptPersonalAuth: acceptance.personalDataAuthToken,
    paymentMethod: { installments: 1 },
    paymentSourceId: Number(paymentSource.id),
    customerData: {
      full_name: input.cardholderName ?? undefined,
      phone_number: input.phoneNumber ?? undefined
    },
    ipAddress: input.ipAddress ?? undefined
  });

  const rawStatus = typeof rawTx.status === "string" ? rawTx.status : "PENDING";
  const membershipId =
    rawStatus === "APPROVED"
      ? await createOrExtendMembershipForApprovedTransaction(admin, {
          userId: input.userId,
          method: "card",
          interval: input.interval,
          rail: "card_subscription",
          paymentMethodId: persistedPaymentMethod.id,
          metadata: { initialCheckout: true }
        })
      : await markMembershipPaymentPending(admin, {
          userId: input.userId,
          rail: "card_subscription",
          method: "card",
          interval: input.interval,
          paymentMethodId: persistedPaymentMethod.id,
          metadata: { initialCheckout: true }
        });

  await recordTransaction(admin, {
    userId: input.userId,
    membershipId,
    method: "card",
    reference,
    externalTransactionId: typeof rawTx.id === "string" ? rawTx.id : null,
    status: rawStatus,
    amountInCents,
    interval: input.interval,
    rawPayload: rawTx,
    checkoutUrl: toCheckoutUrl(rawTx),
    approvedAt: rawStatus === "APPROVED" ? parseApprovedAt(rawTx) : null,
    paidAt: rawStatus === "APPROVED" ? parseApprovedAt(rawTx) : null
  });

  await applyBillingAccessRules(admin, input.userId, input.email);

  return {
    status: wompiStatusToBillingStatus(rawStatus),
    checkoutUrl: toCheckoutUrl(rawTx),
    paymentMethod: persistedPaymentMethod
  };
}

export async function createManualBillingCheckout(
  admin: SupabaseClient,
  input: {
    userId: string;
    email: string;
    method: Exclude<BillingPaymentMethodKind, "card">;
    customerName?: string | null;
    phoneNumber?: string | null;
    legalIdType?: string | null;
    legalId?: string | null;
    userType?: number | null;
    financialInstitutionCode?: string | null;
    ipAddress?: string | null;
  }
) {
  await requireBillingLegalAccepted(admin, input.userId);
  const acceptance = await getWompiAcceptanceTokens();
  if (!acceptance.acceptanceToken || !acceptance.personalDataAuthToken) {
    throw new Error("No se pudieron obtener los contratos de aceptación de Wompi.");
  }

  const reference = buildWompiReference(`pro-${input.method}`, input.userId);
  const redirectUrl = `${env.appUrl}/billing?checkout=${input.method}_pending`;
  const amountInCents = getManualAmountInCents(input.method);

  let paymentMethod: JsonRecord;
  if (input.method === "pse") {
    paymentMethod = {
      type: "PSE",
      user_type: input.userType ?? 0,
      user_legal_id_type: input.legalIdType ?? "CC",
      user_legal_id: input.legalId ?? "",
      financial_institution_code: input.financialInstitutionCode ?? "",
      payment_description: "Suscripción Pro mensual DVanguard",
      ecommerce_url: redirectUrl
    };
  } else if (input.method === "nequi") {
    paymentMethod = {
      type: "NEQUI",
      phone_number: input.phoneNumber ?? ""
    };
  } else {
    paymentMethod = {
      type: "BANCOLOMBIA_TRANSFER",
      user_type: "PERSON",
      payment_description: "Suscripción Pro mensual DVanguard",
      ecommerce_url: redirectUrl
    };
  }

  const rawTx = await createWompiTransaction({
    reference,
    amountInCents,
    customerEmail: input.email,
    redirectUrl,
    acceptanceToken: acceptance.acceptanceToken,
    acceptPersonalAuth: acceptance.personalDataAuthToken,
    paymentMethod,
    customerData: {
      full_name: input.customerName ?? undefined,
      phone_number: input.phoneNumber ?? undefined,
      legal_id: input.legalId ?? undefined,
      legal_id_type: input.legalIdType ?? undefined
    },
    ipAddress: input.ipAddress ?? undefined
  });

  const rawStatus = typeof rawTx.status === "string" ? rawTx.status : "PENDING";
  const txId = await recordTransaction(admin, {
    userId: input.userId,
    method: input.method,
    reference,
    externalTransactionId: typeof rawTx.id === "string" ? rawTx.id : null,
    status: rawStatus,
    amountInCents,
    interval: "month",
    rawPayload: rawTx,
    checkoutUrl: toCheckoutUrl(rawTx),
    approvedAt: rawStatus === "APPROVED" ? parseApprovedAt(rawTx) : null,
    paidAt: rawStatus === "APPROVED" ? parseApprovedAt(rawTx) : null
  });

  if (rawStatus === "APPROVED") {
    const membershipId = await createOrExtendMembershipForApprovedTransaction(admin, {
      userId: input.userId,
      method: input.method,
      interval: null,
      rail: "manual_term_purchase",
      transactionId: txId
    });
    await admin.from("billing_transactions").update({ membership_id: membershipId }).eq("id", txId);
  }

  await applyBillingAccessRules(admin, input.userId, input.email);

  return {
    status: wompiStatusToBillingStatus(rawStatus),
    redirectUrl: toCheckoutUrl(rawTx),
    transactionId: typeof rawTx.id === "string" ? rawTx.id : null
  };
}

export async function switchManualMembershipToCard(
  admin: SupabaseClient,
  input: {
    userId: string;
    email: string;
    token: string;
  }
) {
  await requireBillingLegalAccepted(admin, input.userId);
  const current = await getBillingSubscriptionRecord(admin, input.userId);
  if (!current || current.rail !== "manual_term_purchase" || !current.current_period_end) {
    throw new Error("No tienes una compra manual vigente para programar el cambio a tarjeta.");
  }

  const acceptance = await getWompiAcceptanceTokens();
  if (!acceptance.acceptanceToken || !acceptance.personalDataAuthToken) {
    throw new Error("No se pudieron obtener los contratos de aceptación de Wompi.");
  }

  const paymentSource = await createWompiPaymentSource({
    token: input.token,
    customerEmail: input.email,
    acceptanceToken: acceptance.acceptanceToken,
    acceptPersonalAuth: acceptance.personalDataAuthToken
  });

  const cardDetails = getCardPaymentMethodDetails(paymentSource as JsonRecord);
  const persistedPaymentMethod = await persistPaymentMethod(admin, {
    userId: input.userId,
    wompiPaymentSourceId: Number(paymentSource.id),
    brand: cardDetails.brand,
    last4: cardDetails.last4,
    expMonth: cardDetails.expMonth,
    expYear: cardDetails.expYear
  });

  const { error } = await admin
    .from("billing_memberships")
    .update({
      switch_to_card_at: current.current_period_end,
      switch_to_card_payment_method_id: persistedPaymentMethod.id
    })
    .eq("id", current.id);

  if (error) {
    throw new Error(`Failed to schedule switch to card: ${error.message}`);
  }

  return {
    switchToCardAt: current.current_period_end
  };
}

export async function cancelBillingSubscription(admin: SupabaseClient, userId: string) {
  const current = await getBillingSubscriptionRecord(admin, userId);
  if (!current || current.rail !== "card_subscription") {
    throw new Error("No hay una suscripción con tarjeta activa para cancelar.");
  }

  const { error } = await admin
    .from("billing_memberships")
    .update({ renews_automatically: false })
    .eq("id", current.id);

  if (error) {
    throw new Error(`Failed to cancel recurring billing: ${error.message}`);
  }

  return { ok: true };
}

export async function changeBillingPlanInterval(admin: SupabaseClient, userId: string, interval: BillingInterval) {
  const current = await getBillingSubscriptionRecord(admin, userId);
  if (!current || current.rail !== "card_subscription") {
    throw new Error("No hay una suscripción con tarjeta para cambiar de ciclo.");
  }

  const { error } = await admin
    .from("billing_memberships")
    .update({
      interval,
      term_length_days: daysForInterval(interval),
      metadata_json: { ...(current.metadata_json ?? {}), requestedInterval: interval }
    })
    .eq("id", current.id);

  if (error) {
    throw new Error(`Failed to change card billing interval: ${error.message}`);
  }

  return { mode: "scheduled" as const };
}

export async function syncBillingTransactionFromWompi(admin: SupabaseClient, transactionId: string) {
  const rawTx = sanitizeMetadata(await getWompiTransaction(transactionId));
  const reference = typeof rawTx.reference === "string" ? rawTx.reference : null;
  if (!reference) {
    throw new Error("La transacción de Wompi no incluye referencia.");
  }

  const { data: local, error } = await admin
    .from("billing_transactions")
    .select("id, user_id, membership_id, method, interval")
    .or(`external_transaction_id.eq.${transactionId},reference.eq.${reference}`)
    .maybeSingle();

  if (error || !local) {
    throw new Error(error?.message ?? "No encontramos la transacción local para sincronizar.");
  }

  const rawStatus = typeof rawTx.status === "string" ? rawTx.status : "PENDING";
  const approvedAt = rawStatus === "APPROVED" ? parseApprovedAt(rawTx) : null;
  const paymentKind = mapPaymentKind(local.method);

  await admin
    .from("billing_transactions")
    .update({
      external_transaction_id: typeof rawTx.id === "string" ? rawTx.id : transactionId,
      status: rawStatus,
      checkout_url: toCheckoutUrl(rawTx),
      paid_at: approvedAt,
      approved_at: approvedAt,
      raw_payload: rawTx
    })
    .eq("id", local.id);

  if (rawStatus === "APPROVED") {
    const membershipId = await createOrExtendMembershipForApprovedTransaction(admin, {
      userId: local.user_id,
      method: paymentKind,
      interval: mapInterval(local.interval),
      rail: paymentKind === "card" ? "card_subscription" : "manual_term_purchase",
      transactionId: local.id
    });
    await admin.from("billing_transactions").update({ membership_id: membershipId }).eq("id", local.id);
  } else if (local.membership_id) {
    await admin.from("billing_memberships").update({ status: wompiStatusToBillingStatus(rawStatus) }).eq("id", local.membership_id);
  }

  await applyBillingAccessRules(admin, local.user_id);

  return {
    reference,
    status: rawStatus
  };
}

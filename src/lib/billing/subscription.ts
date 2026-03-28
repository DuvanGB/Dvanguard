import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import { FREE_PLAN, PRO_PLAN, ensureUserPlan, getPlanLimits } from "@/lib/billing/plans";
import type {
  BillingAccessState,
  BillingInterval,
  BillingSubscriptionStatus,
  BillingSummary,
  PlanCode
} from "@/lib/billing/types";
import { recordPlatformEvent } from "@/lib/platform-events";
import {
  extractCustomerInvoicePaymentMethod,
  extractDefaultPaymentMethod,
  getIntervalFromStripePrice,
  getStripePriceId,
  getStripeServerClient,
  hasPaymentMethodDetails,
  hasStripeManagedProStatus,
  toDateIso
} from "@/lib/billing/stripe";

const GRACE_DAYS = 3;
const ENFORCEMENT_LOOKBACK_DAYS = 30;

function getStripeInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const raw = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  if (typeof raw.subscription === "string") return raw.subscription;
  if (raw.subscription && typeof raw.subscription === "object") return raw.subscription.id;
  return null;
}

function getStripeSubscriptionTimestamp(
  subscription: Stripe.Subscription,
  field: "current_period_start" | "current_period_end" | "canceled_at"
) {
  const raw = subscription as unknown as Record<string, unknown>;
  const value = raw[field];
  return typeof value === "number" ? value : null;
}

export type BillingSubscriptionRecord = {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  stripe_product_id: string | null;
  plan_code: PlanCode;
  billing_interval: BillingInterval;
  status: BillingSubscriptionStatus;
  access_state: BillingAccessState;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  grace_until: string | null;
  pending_interval: BillingInterval | null;
  default_payment_method_brand: string | null;
  default_payment_method_last4: string | null;
  default_payment_method_exp_month: number | null;
  default_payment_method_exp_year: number | null;
  latest_invoice_id: string | null;
  last_event_id: string | null;
  last_event_at: string | null;
  metadata_json: Record<string, unknown> | null;
};

export type BillingInvoiceRecord = {
  stripe_invoice_id: string;
  status: string;
  currency: string | null;
  amount_due: number;
  amount_paid: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
};

function normalizeBillingStatus(value: string | null | undefined): BillingSubscriptionStatus {
  if (
    value === "active" ||
    value === "trialing" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "unpaid" ||
    value === "incomplete" ||
    value === "incomplete_expired" ||
    value === "paused"
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

async function resolveCustomerPaymentMethodDetails(
  stripe: ReturnType<typeof getStripeServerClient>,
  stripeCustomer: Stripe.Subscription["customer"] | string | null | undefined
) {
  if (!stripeCustomer) {
    return { brand: null, last4: null, expMonth: null, expYear: null };
  }

  if (typeof stripeCustomer !== "string") {
    return extractCustomerInvoicePaymentMethod(stripeCustomer);
  }

  const customer = await stripe.customers.retrieve(stripeCustomer, {
    expand: ["invoice_settings.default_payment_method"]
  });

  return extractCustomerInvoicePaymentMethod(customer);
}

export async function getBillingSubscriptionRecord(admin: SupabaseClient, userId: string): Promise<BillingSubscriptionRecord | null> {
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select(
      [
        "user_id",
        "stripe_customer_id",
        "stripe_subscription_id",
        "stripe_price_id",
        "stripe_product_id",
        "plan_code",
        "billing_interval",
        "status",
        "access_state",
        "current_period_start",
        "current_period_end",
        "cancel_at_period_end",
        "canceled_at",
        "grace_until",
        "pending_interval",
        "default_payment_method_brand",
        "default_payment_method_last4",
        "default_payment_method_exp_month",
        "default_payment_method_exp_year",
        "latest_invoice_id",
        "last_event_id",
        "last_event_at",
        "metadata_json"
      ].join(", ")
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing subscription: ${error.message}`);
  }

  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;

  return {
    user_id: String(row.user_id ?? ""),
    stripe_customer_id: String(row.stripe_customer_id ?? ""),
    stripe_subscription_id: String(row.stripe_subscription_id ?? ""),
    stripe_price_id: String(row.stripe_price_id ?? ""),
    stripe_product_id: typeof row.stripe_product_id === "string" ? row.stripe_product_id : null,
    plan_code: row.plan_code === PRO_PLAN ? PRO_PLAN : FREE_PLAN,
    billing_interval: row.billing_interval === "year" ? "year" : "month",
    status: normalizeBillingStatus(typeof row.status === "string" ? row.status : null),
    access_state: normalizeAccessState(typeof row.access_state === "string" ? row.access_state : null),
    current_period_start: typeof row.current_period_start === "string" ? row.current_period_start : null,
    current_period_end: typeof row.current_period_end === "string" ? row.current_period_end : null,
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    canceled_at: typeof row.canceled_at === "string" ? row.canceled_at : null,
    grace_until: typeof row.grace_until === "string" ? row.grace_until : null,
    pending_interval: row.pending_interval === "year" ? "year" : row.pending_interval === "month" ? "month" : null,
    default_payment_method_brand: typeof row.default_payment_method_brand === "string" ? row.default_payment_method_brand : null,
    default_payment_method_last4: typeof row.default_payment_method_last4 === "string" ? row.default_payment_method_last4 : null,
    default_payment_method_exp_month: typeof row.default_payment_method_exp_month === "number" ? row.default_payment_method_exp_month : null,
    default_payment_method_exp_year: typeof row.default_payment_method_exp_year === "number" ? row.default_payment_method_exp_year : null,
    latest_invoice_id: typeof row.latest_invoice_id === "string" ? row.latest_invoice_id : null,
    last_event_id: typeof row.last_event_id === "string" ? row.last_event_id : null,
    last_event_at: typeof row.last_event_at === "string" ? row.last_event_at : null,
    metadata_json:
      row.metadata_json && typeof row.metadata_json === "object" && !Array.isArray(row.metadata_json)
        ? (row.metadata_json as Record<string, unknown>)
        : {}
  };
}

export async function getBillingSubscriptionRecordByStripeId(
  admin: SupabaseClient,
  stripeSubscriptionId: string
): Promise<BillingSubscriptionRecord | null> {
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select(
      [
        "user_id",
        "stripe_customer_id",
        "stripe_subscription_id",
        "stripe_price_id",
        "stripe_product_id",
        "plan_code",
        "billing_interval",
        "status",
        "access_state",
        "current_period_start",
        "current_period_end",
        "cancel_at_period_end",
        "canceled_at",
        "grace_until",
        "pending_interval",
        "default_payment_method_brand",
        "default_payment_method_last4",
        "default_payment_method_exp_month",
        "default_payment_method_exp_year",
        "latest_invoice_id",
        "last_event_id",
        "last_event_at",
        "metadata_json"
      ].join(", ")
    )
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing subscription by Stripe id: ${error.message}`);
  }

  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;

  return {
    user_id: String(row.user_id ?? ""),
    stripe_customer_id: String(row.stripe_customer_id ?? ""),
    stripe_subscription_id: String(row.stripe_subscription_id ?? ""),
    stripe_price_id: String(row.stripe_price_id ?? ""),
    stripe_product_id: typeof row.stripe_product_id === "string" ? row.stripe_product_id : null,
    plan_code: row.plan_code === PRO_PLAN ? PRO_PLAN : FREE_PLAN,
    billing_interval: row.billing_interval === "year" ? "year" : "month",
    status: normalizeBillingStatus(typeof row.status === "string" ? row.status : null),
    access_state: normalizeAccessState(typeof row.access_state === "string" ? row.access_state : null),
    current_period_start: typeof row.current_period_start === "string" ? row.current_period_start : null,
    current_period_end: typeof row.current_period_end === "string" ? row.current_period_end : null,
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    canceled_at: typeof row.canceled_at === "string" ? row.canceled_at : null,
    grace_until: typeof row.grace_until === "string" ? row.grace_until : null,
    pending_interval: row.pending_interval === "year" ? "year" : row.pending_interval === "month" ? "month" : null,
    default_payment_method_brand: typeof row.default_payment_method_brand === "string" ? row.default_payment_method_brand : null,
    default_payment_method_last4: typeof row.default_payment_method_last4 === "string" ? row.default_payment_method_last4 : null,
    default_payment_method_exp_month: typeof row.default_payment_method_exp_month === "number" ? row.default_payment_method_exp_month : null,
    default_payment_method_exp_year: typeof row.default_payment_method_exp_year === "number" ? row.default_payment_method_exp_year : null,
    latest_invoice_id: typeof row.latest_invoice_id === "string" ? row.latest_invoice_id : null,
    last_event_id: typeof row.last_event_id === "string" ? row.last_event_id : null,
    last_event_at: typeof row.last_event_at === "string" ? row.last_event_at : null,
    metadata_json:
      row.metadata_json && typeof row.metadata_json === "object" && !Array.isArray(row.metadata_json)
        ? (row.metadata_json as Record<string, unknown>)
        : {}
  };
}

export async function listBillingInvoices(admin: SupabaseClient, userId: string, limit = 12): Promise<BillingInvoiceRecord[]> {
  const { data, error } = await admin
    .from("billing_invoices")
    .select(
      "stripe_invoice_id, status, currency, amount_due, amount_paid, hosted_invoice_url, invoice_pdf, period_start, period_end, due_date, paid_at, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load billing invoices: ${error.message}`);
  }

  return (data ?? []).map((invoice) => ({
    ...invoice,
    amount_due: Number(invoice.amount_due ?? 0),
    amount_paid: Number(invoice.amount_paid ?? 0)
  }));
}

export async function upsertBillingCustomer(admin: SupabaseClient, input: { userId: string; stripeCustomerId: string; email?: string | null }) {
  const { error } = await admin.from("billing_customers").upsert(
    {
      user_id: input.userId,
      stripe_customer_id: input.stripeCustomerId,
      email: input.email ?? null
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Failed to upsert billing customer: ${error.message}`);
  }
}

export async function getStripeCustomerIdForUser(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();

  if (error) {
    throw new Error(`Failed to load Stripe customer: ${error.message}`);
  }

  return data?.stripe_customer_id ?? null;
}

export async function resolveUserIdForStripeCustomer(
  admin: SupabaseClient,
  stripeCustomerId: string,
  metadataUserId?: string | null
) {
  const hinted = metadataUserId?.trim();
  if (hinted) {
    await upsertBillingCustomer(admin, { userId: hinted, stripeCustomerId });
    return hinted;
  }

  const { data, error } = await admin.from("billing_customers").select("user_id").eq("stripe_customer_id", stripeCustomerId).maybeSingle();
  if (error) {
    throw new Error(`Failed to resolve Stripe customer owner: ${error.message}`);
  }

  return data?.user_id ?? null;
}

export async function ensureStripeCustomer(admin: SupabaseClient, input: { userId: string; email: string | null }) {
  const existing = await getStripeCustomerIdForUser(admin, input.userId);
  if (existing) return existing;

  const stripe = getStripeServerClient();
  const customer = await stripe.customers.create({
    email: input.email ?? undefined,
    metadata: {
      user_id: input.userId
    }
  });

  await upsertBillingCustomer(admin, {
    userId: input.userId,
    stripeCustomerId: customer.id,
    email: input.email
  });

  return customer.id;
}

export async function upsertBillingInvoiceFromStripe(
  admin: SupabaseClient,
  input: {
    userId: string;
    invoice: Stripe.Invoice;
  }
) {
  const periodStart = input.invoice.lines.data[0]?.period?.start;
  const periodEnd = input.invoice.lines.data[0]?.period?.end;

  const { error } = await admin.from("billing_invoices").upsert(
    {
      user_id: input.userId,
      stripe_invoice_id: input.invoice.id,
      stripe_subscription_id: getStripeInvoiceSubscriptionId(input.invoice),
      status: input.invoice.status ?? "draft",
      currency: input.invoice.currency ?? null,
      amount_due: input.invoice.amount_due ?? 0,
      amount_paid: input.invoice.amount_paid ?? 0,
      hosted_invoice_url: input.invoice.hosted_invoice_url ?? null,
      invoice_pdf: input.invoice.invoice_pdf ?? null,
      period_start: toDateIso(periodStart),
      period_end: toDateIso(periodEnd),
      due_date: toDateIso(input.invoice.due_date),
      paid_at: input.invoice.status_transitions.paid_at ? toDateIso(input.invoice.status_transitions.paid_at) : null
    },
    { onConflict: "stripe_invoice_id" }
  );

  if (error) {
    throw new Error(`Failed to upsert billing invoice: ${error.message}`);
  }
}

export async function assignPlanDirectly(admin: SupabaseClient, input: { userId: string; planCode: PlanCode; assignedBy?: string | null }) {
  const { error } = await admin.from("user_plans").upsert(
    {
      user_id: input.userId,
      plan_code: input.planCode,
      assigned_by: input.assignedBy ?? null,
      assigned_at: new Date().toISOString()
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

export async function applyBillingAccessRules(admin: SupabaseClient, userId: string) {
  const subscription = await getBillingSubscriptionRecord(admin, userId);
  if (!subscription) {
    return {
      subscription: null,
      accessState: "within_limit" as BillingAccessState
    };
  }

  const hasProAccess = hasStripeManagedProStatus(subscription.status);

  if (hasProAccess) {
    await assignPlanDirectly(admin, { userId, planCode: PRO_PLAN });

    if (subscription.access_state !== "within_limit" || subscription.grace_until) {
      await admin
        .from("billing_subscriptions")
        .update({ access_state: "within_limit", grace_until: null })
        .eq("user_id", userId);
    }

    return { subscription: { ...subscription, access_state: "within_limit", grace_until: null }, accessState: "within_limit" as BillingAccessState };
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
      await admin
        .from("billing_subscriptions")
        .update({ access_state: "within_limit", grace_until: null })
        .eq("user_id", userId);
    }

    return { subscription: { ...subscription, access_state: "within_limit", grace_until: null }, accessState: "within_limit" as BillingAccessState };
  }

  const now = new Date();
  const graceUntil = subscription.grace_until ? new Date(subscription.grace_until) : null;
  if (!graceUntil || Number.isNaN(graceUntil.getTime()) || graceUntil <= now) {
    if (!graceUntil) {
      const nextGrace = getGraceUntilIso(now);
      await admin
        .from("billing_subscriptions")
        .update({ access_state: "grace_period", grace_until: nextGrace })
        .eq("user_id", userId);

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
    await admin
      .from("billing_subscriptions")
      .update({ access_state: "enforcement_applied", grace_until: null })
      .eq("user_id", userId);

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
    await admin
      .from("billing_subscriptions")
      .update({ access_state: "grace_period" })
      .eq("user_id", userId);
  }

  return { subscription: { ...subscription, access_state: "grace_period" }, accessState: "grace_period" as BillingAccessState };
}

export async function syncSubscriptionFromStripe(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  options?: { eventId?: string | null }
) {
  const stripe = getStripeServerClient();
  const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const metadataUserId = subscription.metadata?.user_id ?? null;
  const userId = await resolveUserIdForStripeCustomer(admin, stripeCustomerId, metadataUserId);

  if (!userId) {
    throw new Error(`Could not resolve local user for Stripe customer ${stripeCustomerId}`);
  }

  const price = subscription.items.data[0]?.price;
  const subscriptionPaymentMethod = extractDefaultPaymentMethod(subscription.default_payment_method);
  const customerPaymentMethod = hasPaymentMethodDetails(subscriptionPaymentMethod)
    ? subscriptionPaymentMethod
    : await resolveCustomerPaymentMethodDetails(stripe, subscription.customer);
  const paymentMethod = hasPaymentMethodDetails(subscriptionPaymentMethod) ? subscriptionPaymentMethod : customerPaymentMethod;
  const interval = getIntervalFromStripePrice(price?.id) ?? (price?.recurring?.interval === "year" ? "year" : "month");
  const metadataJson = {
    ...subscription.metadata,
    pending_interval: subscription.metadata?.dvanguard_pending_interval ?? null
  };
  const customerEmail =
    typeof subscription.customer === "object" && !("deleted" in subscription.customer) ? subscription.customer.email ?? null : null;

  await upsertBillingCustomer(admin, {
    userId,
    stripeCustomerId,
    email: customerEmail
  });

  const { error } = await admin.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: price?.id ?? "",
      stripe_product_id: typeof price?.product === "string" ? price.product : price?.product?.id ?? null,
      plan_code: PRO_PLAN,
      billing_interval: interval,
      status: normalizeBillingStatus(subscription.status),
      current_period_start: toDateIso(getStripeSubscriptionTimestamp(subscription, "current_period_start")),
      current_period_end: toDateIso(getStripeSubscriptionTimestamp(subscription, "current_period_end")),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: toDateIso(getStripeSubscriptionTimestamp(subscription, "canceled_at")),
      pending_interval:
        subscription.metadata?.dvanguard_pending_interval === "year"
          ? "year"
          : subscription.metadata?.dvanguard_pending_interval === "month"
            ? "month"
            : null,
      default_payment_method_brand: paymentMethod.brand,
      default_payment_method_last4: paymentMethod.last4,
      default_payment_method_exp_month: paymentMethod.expMonth,
      default_payment_method_exp_year: paymentMethod.expYear,
      latest_invoice_id:
        typeof subscription.latest_invoice === "string"
          ? subscription.latest_invoice
          : subscription.latest_invoice?.id ?? null,
      last_event_id: options?.eventId ?? null,
      last_event_at: new Date().toISOString(),
      metadata_json: metadataJson
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Failed to upsert billing subscription: ${error.message}`);
  }

  await applyBillingAccessRules(admin, userId);

  return userId;
}

export async function getBillingSummary(admin: SupabaseClient, userId: string): Promise<BillingSummary> {
  await ensureUserPlan(admin, userId);
  const { subscription } = await applyBillingAccessRules(admin, userId);
  const { data: userPlan, error: planError } = await admin.from("user_plans").select("plan_code").eq("user_id", userId).maybeSingle();

  if (planError) {
    throw new Error(`Failed to load user plan: ${planError.message}`);
  }

  const customerId = await getStripeCustomerIdForUser(admin, userId);
  const plan = userPlan?.plan_code === PRO_PLAN ? PRO_PLAN : FREE_PLAN;
  let paymentMethod = subscription
    ? {
        brand: subscription.default_payment_method_brand,
        last4: subscription.default_payment_method_last4,
        expMonth: subscription.default_payment_method_exp_month,
        expYear: subscription.default_payment_method_exp_year
      }
    : null;

  if (customerId && (!paymentMethod || !paymentMethod.last4)) {
    try {
      const stripe = getStripeServerClient();
      const customer = await stripe.customers.retrieve(customerId, {
        expand: ["invoice_settings.default_payment_method"]
      });
      const fallbackPaymentMethod = extractCustomerInvoicePaymentMethod(customer);

      if (hasPaymentMethodDetails(fallbackPaymentMethod)) {
        paymentMethod = fallbackPaymentMethod;
        if (subscription) {
          await admin
            .from("billing_subscriptions")
            .update({
              default_payment_method_brand: fallbackPaymentMethod.brand,
              default_payment_method_last4: fallbackPaymentMethod.last4,
              default_payment_method_exp_month: fallbackPaymentMethod.expMonth,
              default_payment_method_exp_year: fallbackPaymentMethod.expYear,
              last_event_at: new Date().toISOString()
            })
            .eq("user_id", userId);
        }
      }
    } catch {
      // Billing page should remain usable even if Stripe fallback lookup fails.
    }
  }

  return {
    plan,
    isStripeManaged: Boolean(subscription),
    interval: subscription?.billing_interval ?? null,
    subscriptionStatus: subscription?.status ?? "not_started",
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    currentPeriodStart: subscription?.current_period_start ?? null,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    accessState: normalizeAccessState(subscription?.access_state),
    graceUntil: subscription?.grace_until ?? null,
    pendingInterval:
      subscription?.pending_interval === "year" ? "year" : subscription?.pending_interval === "month" ? "month" : null,
    customerId,
    checkoutEnabled: true,
    paymentMethod
  };
}

export async function createCheckoutSession(admin: SupabaseClient, input: {
  userId: string;
  email: string | null;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripeServerClient();
  const customerId = await ensureStripeCustomer(admin, { userId: input.userId, email: input.email });
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [
      {
        price: getStripePriceId(input.interval),
        quantity: 1
      }
    ],
    allow_promotion_codes: true,
    metadata: {
      user_id: input.userId,
      plan_code: PRO_PLAN,
      billing_interval: input.interval
    },
    subscription_data: {
      metadata: {
        user_id: input.userId,
        plan_code: PRO_PLAN,
        billing_interval: input.interval
      }
    }
  });

  await recordPlatformEvent(admin, {
    eventType: "billing.checkout_started",
    userId: input.userId,
    payload: { interval: input.interval, sessionId: session.id }
  }).catch(() => undefined);

  return session;
}

export async function createSetupIntent(admin: SupabaseClient, input: { userId: string; email: string | null }) {
  const stripe = getStripeServerClient();
  const customerId = await ensureStripeCustomer(admin, { userId: input.userId, email: input.email });

  return stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: {
      user_id: input.userId
    }
  });
}

export async function setDefaultPaymentMethod(admin: SupabaseClient, input: { userId: string; paymentMethodId: string }) {
  const stripe = getStripeServerClient();
  const customerId = await ensureStripeCustomer(admin, { userId: input.userId, email: null });
  await stripe.paymentMethods.attach(input.paymentMethodId, { customer: customerId }).catch(() => undefined);
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: input.paymentMethodId
    }
  });

  const subscription = await getBillingSubscriptionRecord(admin, input.userId);
  if (subscription) {
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      default_payment_method: input.paymentMethodId
    });

    const refreshed = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
      expand: ["default_payment_method"]
    });
    await syncSubscriptionFromStripe(admin, refreshed);
  }

  await recordPlatformEvent(admin, {
    eventType: "billing.payment_method_updated",
    userId: input.userId,
    payload: {}
  }).catch(() => undefined);
}

export async function cancelBillingSubscription(admin: SupabaseClient, userId: string) {
  const subscription = await getBillingSubscriptionRecord(admin, userId);
  if (!subscription) {
    throw new Error("No Stripe-managed subscription found");
  }

  const stripe = getStripeServerClient();
  const updated = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
    metadata: {
      ...(subscription.metadata_json ?? {}),
      dvanguard_pending_interval: ""
    }
  });

  await admin
    .from("billing_subscriptions")
    .update({ cancel_at_period_end: true, pending_interval: null, last_event_at: new Date().toISOString() })
    .eq("user_id", userId);

  await recordPlatformEvent(admin, {
    eventType: "billing.cancel_scheduled",
    userId,
    payload: {
      subscriptionId: updated.id,
      currentPeriodEnd: toDateIso(getStripeSubscriptionTimestamp(updated, "current_period_end"))
    }
  }).catch(() => undefined);

  return updated;
}

export async function changeBillingPlanInterval(admin: SupabaseClient, userId: string, interval: BillingInterval) {
  const subscription = await getBillingSubscriptionRecord(admin, userId);
  if (!subscription) {
    throw new Error("No Stripe-managed subscription found");
  }

  if (subscription.billing_interval === interval && !subscription.pending_interval) {
    throw new Error("Tu suscripción ya usa ese ciclo de cobro.");
  }

  const stripe = getStripeServerClient();

  if (subscription.billing_interval === "year" && interval === "month") {
    const updated = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
      metadata: {
        ...(subscription.metadata_json ?? {}),
        dvanguard_pending_interval: "month"
      }
    });

    await admin
      .from("billing_subscriptions")
      .update({ pending_interval: "month", cancel_at_period_end: true, last_event_at: new Date().toISOString() })
      .eq("user_id", userId);

    await recordPlatformEvent(admin, {
      eventType: "billing.interval_change_scheduled",
      userId,
      payload: {
        from: "year",
        to: "month",
        currentPeriodEnd: toDateIso(getStripeSubscriptionTimestamp(updated, "current_period_end"))
      }
    }).catch(() => undefined);

    return { mode: "scheduled" as const, subscription: updated };
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
  const itemId = stripeSubscription.items.data[0]?.id;
  if (!itemId) {
    throw new Error("Subscription item not found");
  }

  const updated = await stripe.subscriptionItems.update(itemId, {
    price: getStripePriceId(interval),
    proration_behavior: "create_prorations",
    payment_behavior: "allow_incomplete"
  });

  const refreshed = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
    expand: ["default_payment_method"]
  });
  refreshed.metadata = {
    ...refreshed.metadata,
    dvanguard_pending_interval: ""
  };
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    metadata: refreshed.metadata,
    cancel_at_period_end: false
  });

  await syncSubscriptionFromStripe(
    admin,
    {
      ...refreshed,
      items: {
        ...refreshed.items,
        data: refreshed.items.data.map((item) => (item.id === updated.id ? updated : item))
      },
      cancel_at_period_end: false,
      metadata: {
        ...refreshed.metadata,
        dvanguard_pending_interval: ""
      }
    } as Stripe.Subscription
  );

  await admin.from("billing_subscriptions").update({ pending_interval: null }).eq("user_id", userId);

  await recordPlatformEvent(admin, {
    eventType: "billing.interval_changed",
    userId,
    payload: {
      from: subscription.billing_interval,
      to: interval,
      mode: "immediate"
    }
  }).catch(() => undefined);

  return { mode: "immediate" as const };
}

export async function maybeCreatePendingReplacementSubscription(admin: SupabaseClient, stripeSubscriptionId: string) {
  const local = await getBillingSubscriptionRecordByStripeId(admin, stripeSubscriptionId);
  if (!local?.pending_interval) {
    return null;
  }

  const stripe = getStripeServerClient();
  const customer = await stripe.customers.retrieve(local.stripe_customer_id);
  if (customer.deleted) {
    return null;
  }

  const defaultPaymentMethodId =
    typeof customer.invoice_settings.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings.default_payment_method?.id ?? null;

  if (!defaultPaymentMethodId) {
    await admin.from("billing_subscriptions").update({ pending_interval: null }).eq("user_id", local.user_id);
    return null;
  }

  const created = await stripe.subscriptions.create({
    customer: local.stripe_customer_id,
    default_payment_method: defaultPaymentMethodId,
    items: [{ price: getStripePriceId(local.pending_interval) }],
    metadata: {
      user_id: local.user_id,
      plan_code: PRO_PLAN,
      billing_interval: local.pending_interval
    },
    expand: ["default_payment_method"]
  });

  await syncSubscriptionFromStripe(admin, created);
  await admin.from("billing_subscriptions").update({ pending_interval: null }).eq("user_id", local.user_id);

  await recordPlatformEvent(admin, {
    eventType: "billing.interval_change_completed",
    userId: local.user_id,
    payload: {
      to: local.pending_interval,
      previousSubscriptionId: stripeSubscriptionId,
      subscriptionId: created.id
    }
  }).catch(() => undefined);

  return created;
}

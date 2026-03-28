import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { recordPlatformEvent } from "@/lib/platform-events";
import { isStripeConfigured, getStripeServerClient } from "@/lib/billing/stripe";
import {
  getBillingSubscriptionRecordByStripeId,
  maybeCreatePendingReplacementSubscription,
  syncSubscriptionFromStripe,
  upsertBillingInvoiceFromStripe,
  resolveUserIdForStripeCustomer,
  applyBillingAccessRules
} from "@/lib/billing/subscription";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const stripe = getStripeServerClient();
  const admin = getSupabaseAdminClient();
  const payload = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription, {
          expand: ["default_payment_method"]
        });
        const userId = await syncSubscriptionFromStripe(admin, subscription, { eventId: event.id });
        await recordPlatformEvent(admin, {
          eventType: "billing.subscription_activated",
          userId,
          payload: { sessionId: session.id, subscriptionId: subscription.id }
        }).catch(() => undefined);
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const data = event.data.object as Stripe.Subscription;
      const subscription = await stripe.subscriptions.retrieve(data.id, {
        expand: ["default_payment_method"]
      });
      await syncSubscriptionFromStripe(admin, subscription, { eventId: event.id });
    }

    if (event.type === "customer.subscription.deleted") {
      const data = event.data.object as Stripe.Subscription;
      const local = await getBillingSubscriptionRecordByStripeId(admin, data.id);
      if (local?.pending_interval) {
        const replacement = await maybeCreatePendingReplacementSubscription(admin, data.id);
        if (replacement) {
          return NextResponse.json({ ok: true, replaced: true });
        }
      }

      await syncSubscriptionFromStripe(admin, data, { eventId: event.id });
      if (local?.user_id) {
        await applyBillingAccessRules(admin, local.user_id);
      }
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceWithSubscription = invoice as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
      const userId = stripeCustomerId ? await resolveUserIdForStripeCustomer(admin, stripeCustomerId) : null;
      if (userId) {
        await upsertBillingInvoiceFromStripe(admin, { userId, invoice });
      }

      const subscriptionId =
        typeof invoiceWithSubscription.subscription === "string"
          ? invoiceWithSubscription.subscription
          : invoiceWithSubscription.subscription?.id ?? null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["default_payment_method"]
        });
        await syncSubscriptionFromStripe(admin, subscription, { eventId: event.id });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

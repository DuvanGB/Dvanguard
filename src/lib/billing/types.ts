export type PlanCode = "free" | "pro";
export type BillingInterval = "month" | "year";
export type BillingAccessState = "within_limit" | "grace_period" | "enforcement_applied";
export type BillingPaymentRail = "card_subscription" | "manual_term_purchase";
export type BillingPaymentMethodKind = "card" | "pse" | "nequi" | "bank_transfer";
export type BillingSubscriptionStatus =
  | "active"
  | "payment_pending"
  | "pending_activation"
  | "payment_failed"
  | "expired"
  | "canceled"
  | "not_started";

export type UsageSnapshot = {
  plan: PlanCode;
  ai_generations_used: number;
  ai_generations_limit: number;
  published_sites_used: number;
  published_sites_limit: number;
  ai_generations_remaining: number;
  published_sites_remaining: number;
  billing_interval: BillingInterval | null;
  subscription_status: BillingSubscriptionStatus;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  access_state: BillingAccessState;
  grace_until: string | null;
};

export type ProRequestStatus = "pending" | "approved" | "rejected";

export type BillingLegalAcceptanceStatus = {
  accepted: boolean;
  acceptedAt: string | null;
  termsVersion: string;
  privacyVersion: string;
};

export type BillingSummary = {
  plan: PlanCode;
  provider: "wompi" | null;
  rail: BillingPaymentRail | null;
  paymentMethodKind: BillingPaymentMethodKind | null;
  interval: BillingInterval | null;
  subscriptionStatus: BillingSubscriptionStatus;
  renewsAutomatically: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  accessState: BillingAccessState;
  graceUntil: string | null;
  checkoutEnabled: boolean;
  switchToCardAt: string | null;
  legal: BillingLegalAcceptanceStatus;
  wompiAcceptance: {
    termsPermalink: string | null;
    personalDataPermalink: string | null;
  };
  paymentMethod:
    | {
        brand: string | null;
        last4: string | null;
        expMonth: number | null;
        expYear: number | null;
      }
    | null;
};

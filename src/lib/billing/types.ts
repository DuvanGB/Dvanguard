export type PlanCode = "free" | "pro";
export type BillingInterval = "month" | "year";
export type BillingAccessState = "within_limit" | "grace_period" | "enforcement_applied";
export type BillingSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
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

export type BillingSummary = {
  plan: PlanCode;
  isStripeManaged: boolean;
  interval: BillingInterval | null;
  subscriptionStatus: BillingSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  accessState: BillingAccessState;
  graceUntil: string | null;
  pendingInterval: BillingInterval | null;
  customerId: string | null;
  checkoutEnabled: boolean;
  paymentMethod:
    | {
        brand: string | null;
        last4: string | null;
        expMonth: number | null;
        expYear: number | null;
      }
    | null;
};

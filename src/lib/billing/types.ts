export type PlanCode = "free" | "pro";

export type UsageSnapshot = {
  plan: PlanCode;
  ai_generations_used: number;
  ai_generations_limit: number;
  published_sites_used: number;
  published_sites_limit: number;
  ai_generations_remaining: number;
  published_sites_remaining: number;
};

export type ProRequestStatus = "pending" | "approved" | "rejected";

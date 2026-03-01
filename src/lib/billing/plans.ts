import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { PlanCode } from "@/lib/billing/types";

const VALID_PLAN_CODES: PlanCode[] = ["free", "pro"];

function resolvePlanCode(raw: string | undefined, fallback: PlanCode): PlanCode {
  const normalized = (raw ?? "").trim().toLowerCase();
  return VALID_PLAN_CODES.includes(normalized as PlanCode) ? (normalized as PlanCode) : fallback;
}

export const FREE_PLAN: PlanCode = resolvePlanCode(env.defaultFreePlan, "free");
export const PRO_PLAN: PlanCode = resolvePlanCode(env.defaultProPlan, "pro");

export async function ensureUserPlan(admin: SupabaseClient, userId: string) {
  const { data: existing } = await admin.from("user_plans").select("user_id, plan_code").eq("user_id", userId).maybeSingle();

  if (existing) {
    return existing;
  }

  const { data: created, error } = await admin
    .from("user_plans")
    .insert({ user_id: userId, plan_code: FREE_PLAN })
    .select("user_id, plan_code")
    .maybeSingle();

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to assign default plan");
  }

  return created;
}

export async function getPlanLimits(admin: SupabaseClient, planCode: PlanCode) {
  const { data: plan, error } = await admin
    .from("plan_definitions")
    .select("code, max_ai_generations_per_month, max_published_sites")
    .eq("code", planCode)
    .maybeSingle();

  if (error || !plan) {
    throw new Error(error?.message ?? `Plan definition not found: ${planCode}`);
  }

  return {
    code: plan.code as PlanCode,
    maxAiGenerationsPerMonth: plan.max_ai_generations_per_month,
    maxPublishedSites: plan.max_published_sites
  };
}

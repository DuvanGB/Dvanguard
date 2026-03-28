import type { SupabaseClient } from "@supabase/supabase-js";

import type { UsageSnapshot } from "@/lib/billing/types";
import { ensureUserPlan, getPlanLimits } from "@/lib/billing/plans";

export function getCurrentPeriodStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export async function getUsageSnapshot(admin: SupabaseClient, userId: string): Promise<UsageSnapshot> {
  const userPlan = await ensureUserPlan(admin, userId);
  const limits = await getPlanLimits(admin, userPlan.plan_code);
  const period = getCurrentPeriodStart();

  const [{ data: monthly }, { count: publishedSitesUsed }] = await Promise.all([
    admin
      .from("usage_counters_monthly")
      .select("ai_generations_count")
      .eq("user_id", userId)
      .eq("period", period)
      .maybeSingle(),
    admin.from("sites").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "published").is("deleted_at", null)
  ]);

  const aiUsed = monthly?.ai_generations_count ?? 0;
  const publishedUsed = publishedSitesUsed ?? 0;

  return {
    plan: limits.code,
    ai_generations_used: aiUsed,
    ai_generations_limit: limits.maxAiGenerationsPerMonth,
    published_sites_used: publishedUsed,
    published_sites_limit: limits.maxPublishedSites,
    ai_generations_remaining: Math.max(0, limits.maxAiGenerationsPerMonth - aiUsed),
    published_sites_remaining: Math.max(0, limits.maxPublishedSites - publishedUsed)
  };
}

export async function incrementAiGenerationUsage(admin: SupabaseClient, userId: string) {
  const period = getCurrentPeriodStart();

  const { data: existing } = await admin
    .from("usage_counters_monthly")
    .select("ai_generations_count")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  const nextValue = (existing?.ai_generations_count ?? 0) + 1;

  const { error } = await admin.from("usage_counters_monthly").upsert(
    {
      user_id: userId,
      period,
      ai_generations_count: nextValue
    },
    { onConflict: "user_id,period" }
  );

  if (error) {
    throw new Error(error.message);
  }

  return nextValue;
}

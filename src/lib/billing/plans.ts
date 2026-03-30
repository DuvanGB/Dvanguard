import type { SupabaseClient } from "@supabase/supabase-js";

import { getPlanDefaultsConfig, type PlatformScope } from "@/lib/platform-config";
import type { PlanCode } from "@/lib/billing/types";

const VALID_PLAN_CODES: PlanCode[] = ["free", "pro"];

export type PlanDefinitionRecord = {
  code: PlanCode;
  name: string;
  description: string | null;
  bullets: string[];
  monthlyPriceCents: number | null;
  yearlyPriceCents: number | null;
  ctaLabel: string | null;
  maxAiGenerationsPerMonth: number;
  maxPublishedSites: number;
};

function assertPlanCode(raw: string, source: string): PlanCode {
  const normalized = raw.trim().toLowerCase();
  if (VALID_PLAN_CODES.includes(normalized as PlanCode)) {
    return normalized as PlanCode;
  }

  throw new Error(`Invalid plan code in ${source}: ${raw}`);
}

function normalizeBullets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : []));
}

export async function getDefaultPlanCodes(admin: SupabaseClient, scope?: PlatformScope) {
  const { freePlanCode, proPlanCode } = await getPlanDefaultsConfig(admin, scope);
  return {
    freePlanCode: assertPlanCode(freePlanCode, "platform_settings.plans.default_free_code"),
    proPlanCode: assertPlanCode(proPlanCode, "platform_settings.plans.default_pro_code")
  };
}

export async function getDefaultFreePlanCode(admin: SupabaseClient, scope?: PlatformScope) {
  return (await getDefaultPlanCodes(admin, scope)).freePlanCode;
}

export async function getDefaultProPlanCode(admin: SupabaseClient, scope?: PlatformScope) {
  return (await getDefaultPlanCodes(admin, scope)).proPlanCode;
}

export async function ensureUserPlan(admin: SupabaseClient, userId: string) {
  const { data: existing } = await admin.from("user_plans").select("user_id, plan_code").eq("user_id", userId).maybeSingle();

  if (existing) {
    return {
      ...existing,
      plan_code: assertPlanCode(existing.plan_code, "user_plans.plan_code")
    };
  }

  const freePlanCode = await getDefaultFreePlanCode(admin);
  const { data: created, error } = await admin
    .from("user_plans")
    .insert({ user_id: userId, plan_code: freePlanCode })
    .select("user_id, plan_code")
    .maybeSingle();

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to assign default plan");
  }

  return {
    ...created,
    plan_code: assertPlanCode(created.plan_code, "user_plans.plan_code")
  };
}

export async function getPlanDefinition(admin: SupabaseClient, planCode: PlanCode) {
  const { data: plan, error } = await admin
    .from("plan_definitions")
    .select("code, name, description, bullets_json, monthly_price_cents, yearly_price_cents, cta_label, max_ai_generations_per_month, max_published_sites")
    .eq("code", planCode)
    .maybeSingle();

  if (error || !plan) {
    throw new Error(error?.message ?? `Plan definition not found: ${planCode}`);
  }

  return {
    code: assertPlanCode(plan.code, "plan_definitions.code"),
    name: plan.name,
    description: plan.description ?? null,
    bullets: normalizeBullets(plan.bullets_json),
    monthlyPriceCents: typeof plan.monthly_price_cents === "number" ? plan.monthly_price_cents : plan.monthly_price_cents == null ? null : Number(plan.monthly_price_cents),
    yearlyPriceCents: typeof plan.yearly_price_cents === "number" ? plan.yearly_price_cents : plan.yearly_price_cents == null ? null : Number(plan.yearly_price_cents),
    ctaLabel: plan.cta_label ?? null,
    maxAiGenerationsPerMonth: Number(plan.max_ai_generations_per_month ?? 0),
    maxPublishedSites: Number(plan.max_published_sites ?? 0)
  } satisfies PlanDefinitionRecord;
}

export async function listPlanDefinitions(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("plan_definitions")
    .select("code, name, description, bullets_json, monthly_price_cents, yearly_price_cents, cta_label, max_ai_generations_per_month, max_published_sites")
    .order("code", { ascending: true });

  if (error) {
    throw new Error(`Failed to list plan definitions: ${error.message}`);
  }

  return (data ?? []).map((plan) => ({
    code: assertPlanCode(plan.code, "plan_definitions.code"),
    name: plan.name,
    description: plan.description ?? null,
    bullets: normalizeBullets(plan.bullets_json),
    monthlyPriceCents: typeof plan.monthly_price_cents === "number" ? plan.monthly_price_cents : plan.monthly_price_cents == null ? null : Number(plan.monthly_price_cents),
    yearlyPriceCents: typeof plan.yearly_price_cents === "number" ? plan.yearly_price_cents : plan.yearly_price_cents == null ? null : Number(plan.yearly_price_cents),
    ctaLabel: plan.cta_label ?? null,
    maxAiGenerationsPerMonth: Number(plan.max_ai_generations_per_month ?? 0),
    maxPublishedSites: Number(plan.max_published_sites ?? 0)
  })) satisfies PlanDefinitionRecord[];
}

export async function getPlanLimits(admin: SupabaseClient, planCode: PlanCode) {
  const plan = await getPlanDefinition(admin, planCode);
  return {
    code: plan.code,
    maxAiGenerationsPerMonth: plan.maxAiGenerationsPerMonth,
    maxPublishedSites: plan.maxPublishedSites
  };
}

export async function upsertPlanDefinition(
  admin: SupabaseClient,
  input: {
    code: PlanCode;
    name: string;
    description?: string | null;
    bullets?: string[];
    monthlyPriceCents?: number | null;
    yearlyPriceCents?: number | null;
    ctaLabel?: string | null;
    maxAiGenerationsPerMonth?: number;
    maxPublishedSites?: number;
  }
) {
  const { error } = await admin.from("plan_definitions").upsert(
    {
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      bullets_json: input.bullets ?? [],
      monthly_price_cents: input.monthlyPriceCents ?? null,
      yearly_price_cents: input.yearlyPriceCents ?? null,
      cta_label: input.ctaLabel ?? null,
      max_ai_generations_per_month: input.maxAiGenerationsPerMonth ?? 0,
      max_published_sites: input.maxPublishedSites ?? 0
    },
    { onConflict: "code" }
  );

  if (error) {
    throw new Error(`Failed to upsert plan definition ${input.code}: ${error.message}`);
  }
}

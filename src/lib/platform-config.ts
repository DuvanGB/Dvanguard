import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformScope = {
  countryCode?: string | null;
  localeCode?: string | null;
};

export type PlatformSettingRecord = {
  id: string;
  setting_key: string;
  country_code: string | null;
  locale_code: string | null;
  value_json: unknown;
  description: string | null;
};

export type PlatformCopyRecord = {
  id: string;
  entry_key: string;
  country_code: string | null;
  locale_code: string | null;
  value_text: string;
  description: string | null;
};

export const DEFAULT_PLATFORM_SCOPE = {
  countryCode: "CO",
  localeCode: "es-CO"
} satisfies Required<PlatformScope>;

export const PLATFORM_SETTING_KEYS = {
  billingGraceDays: "billing.grace_days",
  billingEnforcementLookbackDays: "billing.enforcement_lookback_days",
  billingManualReminderDays: "billing.manual_reminder_days",
  trashRetentionDays: "trash.retention_days",
  plansDefaultFreeCode: "plans.default_free_code",
  plansDefaultProCode: "plans.default_pro_code",
  onboardingVoiceLocale: "onboarding.voice_locale",
  onboardingMaxInputChars: "onboarding.max_input_chars"
} as const;

function normalizeScope(scope?: PlatformScope) {
  return {
    countryCode: scope?.countryCode ?? DEFAULT_PLATFORM_SCOPE.countryCode,
    localeCode: scope?.localeCode ?? DEFAULT_PLATFORM_SCOPE.localeCode
  };
}

function scoreScopeMatch(
  row: { country_code: string | null; locale_code: string | null },
  scope: Required<PlatformScope>
) {
  const countryMatches = row.country_code === scope.countryCode;
  const localeMatches = row.locale_code === scope.localeCode;
  if (countryMatches && localeMatches) return 3;
  if (!row.country_code && localeMatches) return 2;
  if (!row.country_code && !row.locale_code) return 1;
  return 0;
}

function pickScopedRow<T extends { country_code: string | null; locale_code: string | null }>(rows: T[], scope?: PlatformScope) {
  const normalizedScope = normalizeScope(scope);
  const sorted = [...rows].sort((left, right) => scoreScopeMatch(right, normalizedScope) - scoreScopeMatch(left, normalizedScope));
  return sorted.find((row) => scoreScopeMatch(row, normalizedScope) > 0) ?? null;
}

export async function getPlatformSetting<T = unknown>(
  admin: SupabaseClient,
  key: string,
  scope?: PlatformScope
): Promise<T> {
  const { data, error } = await admin
    .from("platform_settings")
    .select("id, setting_key, country_code, locale_code, value_json, description")
    .eq("setting_key", key);

  if (error) {
    throw new Error(`Failed to load platform setting ${key}: ${error.message}`);
  }

  const match = pickScopedRow((data ?? []) as PlatformSettingRecord[], scope);
  if (!match) {
    throw new Error(`Missing platform setting: ${key}`);
  }

  return match.value_json as T;
}

export async function getPlatformSettingNumber(admin: SupabaseClient, key: string, scope?: PlatformScope) {
  const value = await getPlatformSetting<number | string>(admin, key, scope);
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Platform setting ${key} is not numeric.`);
  }
  return numeric;
}

export async function getPlatformSettingString(admin: SupabaseClient, key: string, scope?: PlatformScope) {
  const value = await getPlatformSetting<string>(admin, key, scope);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Platform setting ${key} is not a string.`);
  }
  return value;
}

export async function listPlatformSettings(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("platform_settings")
    .select("id, setting_key, country_code, locale_code, value_json, description")
    .order("setting_key", { ascending: true })
    .order("country_code", { ascending: true })
    .order("locale_code", { ascending: true });

  if (error) {
    throw new Error(`Failed to list platform settings: ${error.message}`);
  }

  return (data ?? []) as PlatformSettingRecord[];
}

export async function upsertPlatformSetting(
  admin: SupabaseClient,
  input: {
    key: string;
    value: unknown;
    description?: string | null;
    countryCode?: string | null;
    localeCode?: string | null;
  }
) {
  const countryCode = input.countryCode === undefined ? DEFAULT_PLATFORM_SCOPE.countryCode : input.countryCode;
  const localeCode = input.localeCode === undefined ? DEFAULT_PLATFORM_SCOPE.localeCode : input.localeCode;

  let existingQuery = admin.from("platform_settings").select("id").eq("setting_key", input.key);
  existingQuery = countryCode === null ? existingQuery.is("country_code", null) : existingQuery.eq("country_code", countryCode);
  existingQuery = localeCode === null ? existingQuery.is("locale_code", null) : existingQuery.eq("locale_code", localeCode);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) {
    throw new Error(`Failed to load existing platform setting ${input.key}: ${existingError.message}`);
  }

  const payload = {
    setting_key: input.key,
    country_code: countryCode,
    locale_code: localeCode,
    value_json: input.value,
    description: input.description ?? null
  };

  const { error } = existing
    ? await admin.from("platform_settings").update(payload).eq("id", existing.id)
    : await admin.from("platform_settings").insert(payload);

  if (error) {
    throw new Error(`Failed to upsert platform setting ${input.key}: ${error.message}`);
  }
}

export async function getPlatformCopy(admin: SupabaseClient, key: string, scope?: PlatformScope) {
  const { data, error } = await admin
    .from("platform_copy_entries")
    .select("id, entry_key, country_code, locale_code, value_text, description")
    .eq("entry_key", key);

  if (error) {
    throw new Error(`Failed to load platform copy ${key}: ${error.message}`);
  }

  const match = pickScopedRow((data ?? []) as PlatformCopyRecord[], scope);
  if (!match) {
    throw new Error(`Missing platform copy entry: ${key}`);
  }

  return match.value_text;
}

export async function getPlatformCopyMap(admin: SupabaseClient, keys: string[], scope?: PlatformScope) {
  if (!keys.length) return {} as Record<string, string>;
  const { data, error } = await admin
    .from("platform_copy_entries")
    .select("id, entry_key, country_code, locale_code, value_text, description")
    .in("entry_key", keys);

  if (error) {
    throw new Error(`Failed to load platform copy map: ${error.message}`);
  }

  const rows = (data ?? []) as PlatformCopyRecord[];
  return keys.reduce<Record<string, string>>((acc, key) => {
    const match = pickScopedRow(rows.filter((row) => row.entry_key === key), scope);
    if (!match) {
      throw new Error(`Missing platform copy entry: ${key}`);
    }
    acc[key] = match.value_text;
    return acc;
  }, {});
}

export async function listPlatformCopyEntries(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("platform_copy_entries")
    .select("id, entry_key, country_code, locale_code, value_text, description")
    .order("entry_key", { ascending: true })
    .order("country_code", { ascending: true })
    .order("locale_code", { ascending: true });

  if (error) {
    throw new Error(`Failed to list platform copy entries: ${error.message}`);
  }

  return (data ?? []) as PlatformCopyRecord[];
}

export async function upsertPlatformCopyEntry(
  admin: SupabaseClient,
  input: {
    key: string;
    value: string;
    description?: string | null;
    countryCode?: string | null;
    localeCode?: string | null;
  }
) {
  const countryCode = input.countryCode === undefined ? DEFAULT_PLATFORM_SCOPE.countryCode : input.countryCode;
  const localeCode = input.localeCode === undefined ? DEFAULT_PLATFORM_SCOPE.localeCode : input.localeCode;

  let existingQuery = admin.from("platform_copy_entries").select("id").eq("entry_key", input.key);
  existingQuery = countryCode === null ? existingQuery.is("country_code", null) : existingQuery.eq("country_code", countryCode);
  existingQuery = localeCode === null ? existingQuery.is("locale_code", null) : existingQuery.eq("locale_code", localeCode);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) {
    throw new Error(`Failed to load existing platform copy ${input.key}: ${existingError.message}`);
  }

  const payload = {
    entry_key: input.key,
    country_code: countryCode,
    locale_code: localeCode,
    value_text: input.value,
    description: input.description ?? null
  };

  const { error } = existing
    ? await admin.from("platform_copy_entries").update(payload).eq("id", existing.id)
    : await admin.from("platform_copy_entries").insert(payload);

  if (error) {
    throw new Error(`Failed to upsert platform copy ${input.key}: ${error.message}`);
  }
}

export async function getBillingPolicyConfig(admin: SupabaseClient, scope?: PlatformScope) {
  const [graceDays, enforcementLookbackDays, manualReminderDays] = await Promise.all([
    getPlatformSettingNumber(admin, PLATFORM_SETTING_KEYS.billingGraceDays, scope),
    getPlatformSettingNumber(admin, PLATFORM_SETTING_KEYS.billingEnforcementLookbackDays, scope),
    getPlatformSettingNumber(admin, PLATFORM_SETTING_KEYS.billingManualReminderDays, scope)
  ]);

  return { graceDays, enforcementLookbackDays, manualReminderDays };
}

export async function getTrashPolicyConfig(admin: SupabaseClient, scope?: PlatformScope) {
  const retentionDays = await getPlatformSettingNumber(admin, PLATFORM_SETTING_KEYS.trashRetentionDays, scope);
  return { retentionDays };
}

export async function getOnboardingPlatformConfig(admin: SupabaseClient, scope?: PlatformScope) {
  const [voiceLocale, maxInputChars] = await Promise.all([
    getPlatformSettingString(admin, PLATFORM_SETTING_KEYS.onboardingVoiceLocale, scope),
    getPlatformSettingNumber(admin, PLATFORM_SETTING_KEYS.onboardingMaxInputChars, scope)
  ]);

  return { voiceLocale, maxInputChars };
}

export async function getPlanDefaultsConfig(admin: SupabaseClient, scope?: PlatformScope) {
  const [freePlanCode, proPlanCode] = await Promise.all([
    getPlatformSettingString(admin, PLATFORM_SETTING_KEYS.plansDefaultFreeCode, scope),
    getPlatformSettingString(admin, PLATFORM_SETTING_KEYS.plansDefaultProCode, scope)
  ]);

  return { freePlanCode, proPlanCode };
}

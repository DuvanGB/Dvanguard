const requiredPublic = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_ROOT_DOMAIN"] as const;

for (const key of requiredPublic) {
  if (!process.env[key]) {
    console.warn(`[env] Missing required variable: ${key}`);
  }
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  adminAllowlistEmails: process.env.ADMIN_ALLOWLIST_EMAILS ?? "",
  defaultFreePlan: process.env.DEFAULT_FREE_PLAN ?? "free",
  defaultProPlan: process.env.DEFAULT_PRO_PLAN ?? "pro",
  rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  aiProvider: process.env.AI_PROVIDER ?? "mock",
  aiBaseUrl: process.env.AI_BASE_URL ?? "",
  aiApiKey: process.env.AI_API_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "",
  onboardingRefineProvider: process.env.ONBOARDING_REFINE_PROVIDER ?? "llm",
  voiceLocale: process.env.VOICE_LOCALE ?? "es-CO",
  onboardingMaxInputChars: parsePositiveInt(process.env.ONBOARDING_MAX_INPUT_CHARS, 3000)
};

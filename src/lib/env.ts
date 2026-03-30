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
  rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  publicSiteUrlMode: process.env.PUBLIC_SITE_URL_MODE ?? "path",
  aiProvider: process.env.AI_PROVIDER ?? "mock",
  aiBaseUrl: process.env.AI_BASE_URL ?? "",
  aiApiKey: process.env.AI_API_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "",
  aiWorkerBaseUrl: process.env.AI_WORKER_BASE_URL ?? "",
  aiWorkerSharedSecret: process.env.AI_WORKER_SHARED_SECRET ?? "",
  aiWorkerModel: process.env.AI_WORKER_MODEL ?? "qwen2.5:7b-instruct",
  aiGenerationPollMs: parsePositiveInt(process.env.AI_GENERATION_POLL_MS, 1200),
  onboardingRefineProvider: process.env.ONBOARDING_REFINE_PROVIDER ?? "llm",
  wompiPublicKey: process.env.WOMPI_PUBLIC_KEY ?? "",
  wompiPrivateKey: process.env.WOMPI_PRIVATE_KEY ?? "",
  wompiEventsSecret: process.env.WOMPI_EVENTS_SECRET ?? "",
  wompiIntegritySecret: process.env.WOMPI_INTEGRITY_SECRET ?? "",
  wompiApiBaseUrl: process.env.WOMPI_API_BASE_URL ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  stripePriceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  stripePriceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
  vercelProjectId: process.env.VERCEL_PROJECT_ID ?? "",
  vercelTeamId: process.env.VERCEL_TEAM_ID ?? process.env.VERCEL_ORG_ID ?? "",
  vercelToken: process.env.VERCEL_TOKEN ?? ""
};

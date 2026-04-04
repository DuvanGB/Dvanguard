import Link from "next/link";

import { getPlatformCopyMap } from "@/lib/platform-config";
import { listPlanDefinitions } from "@/lib/billing/plans";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { PlatformNav } from "@/components/platform-nav";
import { PlatformFooter } from "@/components/platform-footer";

function formatMoney(amountInCents: number | null) {
  if (!amountInCents) return null;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(amountInCents / 100);
}

export default async function PricingPage() {
  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const billingHref = user ? "/billing" : "/signin?next=/billing";
  const [plans, copy] = await Promise.all([
    listPlanDefinitions(admin),
    getPlatformCopyMap(admin, [
      "pricing.hero.title",
      "pricing.hero.description",
      "pricing.faq.title",
      "pricing.faq.description"
    ])
  ]);

  return (
    <>
    <PlatformNav isAuthenticated={!!user} />
    <main className="pricing-shell page-with-topbar">
      <div className="container stack stack-lg">
        <header className="pricing-hero stack stack-sm">
          <h1>{copy["pricing.hero.title"]}</h1>
          <p>{copy["pricing.hero.description"]}</p>
        </header>

        <section className="pricing-grid">
          {plans.map((plan) => {
            const isPro = plan.code === "pro";
            const priceLabel = isPro
              ? `${formatMoney(plan.monthlyPriceCents)} / mes${plan.yearlyPriceCents ? ` · ${formatMoney(plan.yearlyPriceCents)} / año` : ""}`
              : "Sin costo";

            return (
              <article key={plan.code} className={`pricing-card stack${isPro ? " is-featured" : ""}`}>
                <h2>{plan.name}</h2>
                <p>{plan.description}</p>
                <strong className="pricing-price">{priceLabel}</strong>
                <ul>
                  {plan.bullets.map((bullet) => (
                    <li key={bullet}>
                      <span className="material-symbols-outlined">check_circle</span>
                      {bullet}
                    </li>
                  ))}
                </ul>
                <Link className={isPro ? "btn-primary" : "btn-secondary"} href={isPro ? billingHref : "/signin"}>
                  {plan.ctaLabel ?? (isPro ? "Suscribirme" : "Comenzar gratis")}
                </Link>
              </article>
            );
          })}
        </section>

        <section className="pricing-faq stack">
          <h2>{copy["pricing.faq.title"]}</h2>
          <p>{copy["pricing.faq.description"]}</p>
        </section>
      </div>
    </main>
    <PlatformFooter />
    </>
  );
}

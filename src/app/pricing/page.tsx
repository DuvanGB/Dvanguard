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
    <PlatformNav />
    <main className="container stack" style={{ paddingTop: "5.5rem" }}>
      <header className="stack">
        <h1>{copy["pricing.hero.title"]}</h1>
        <p>{copy["pricing.hero.description"]}</p>
      </header>

      <section className="catalog-grid">
        {plans.map((plan) => {
          const isPro = plan.code === "pro";
          const priceLabel = isPro
            ? `${formatMoney(plan.monthlyPriceCents)} / mes${plan.yearlyPriceCents ? ` · ${formatMoney(plan.yearlyPriceCents)} / año` : ""}`
            : "Sin costo";

          return (
            <article key={plan.code} className="card stack" style={isPro ? { border: "2px solid var(--brand)" } : undefined}>
              <h2>{plan.name}</h2>
              <p>{plan.description}</p>
              <strong>{priceLabel}</strong>
              <ul>
                {plan.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <Link className={isPro ? "btn-primary" : "btn-secondary"} href={isPro ? billingHref : "/signin"}>
                {plan.ctaLabel ?? (isPro ? "Suscribirme" : "Comenzar gratis")}
              </Link>
            </article>
          );
        })}
      </section>

      <section className="card stack">
        <h2>{copy["pricing.faq.title"]}</h2>
        <p>{copy["pricing.faq.description"]}</p>
      </section>
    </main>
    <PlatformFooter />
    </>
  );
}

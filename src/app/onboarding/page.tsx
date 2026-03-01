import Link from "next/link";

import { OnboardingWizard } from "@/components/forms/onboarding-wizard";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { supabase } = await requireUser();
  const params = await searchParams;

  const siteId = params.siteId;

  if (!siteId) {
    return (
      <main className="container stack" style={{ paddingTop: "2rem" }}>
        <h1>Onboarding IA</h1>
        <p>Primero crea un sitio en dashboard para iniciar este flujo.</p>
        <Link className="btn-secondary" href="/dashboard">
          Ir al dashboard
        </Link>
      </main>
    );
  }

  const { data: site } = await supabase.from("sites").select("id, name").eq("id", siteId).maybeSingle();

  if (!site) {
    return (
      <main className="container stack" style={{ paddingTop: "2rem" }}>
        <h1>Onboarding IA</h1>
        <p>No se encontró el sitio solicitado.</p>
      </main>
    );
  }

  return (
    <main className="container stack" style={{ paddingTop: "2rem" }}>
      <h1>Onboarding IA</h1>
      <p>Sitio: {site.name}</p>
      <OnboardingWizard siteId={site.id} maxInputChars={env.onboardingMaxInputChars} voiceLocale={env.voiceLocale} />
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { OnboardingSiteSelector, type OnboardingSiteListItem } from "@/components/forms/onboarding-site-selector";
import { OnboardingWizard } from "@/components/forms/onboarding-wizard";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { recordPlatformEvent } from "@/lib/platform-events";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ siteId?: string; source?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const params = await searchParams;
  const admin = getSupabaseAdminClient();

  const siteId = params.siteId;
  const source = params.source;

  if (!siteId) {
    const { data: sites } = await supabase
      .from("sites")
      .select("id, name, subdomain, status, site_type, created_at")
      .order("created_at", { ascending: false });

    const siteList = (sites ?? []) as OnboardingSiteListItem[];

    if (siteList.length === 1) {
      const onlySiteId = siteList[0]?.id;
      if (onlySiteId) {
        try {
          await recordPlatformEvent(admin, {
            eventType: "onboarding.site_selector.auto_redirected",
            userId: user.id,
            siteId: onlySiteId,
            payload: {
              siteCount: 1
            }
          });
        } catch {
          // best effort
        }
        redirect(`/onboarding?siteId=${onlySiteId}`);
      }
    }

    if (siteList.length > 1) {
      try {
        await recordPlatformEvent(admin, {
          eventType: "onboarding.site_selector.viewed",
          userId: user.id,
          payload: {
            siteCount: siteList.length
          }
        });
      } catch {
        // best effort
      }
    }

    if (siteList.length > 1) {
      return (
        <main className="container stack" style={{ paddingTop: "2rem" }}>
          <OnboardingSiteSelector sites={siteList} />
        </main>
      );
    }

    return (
      <main className="container stack" style={{ paddingTop: "2rem" }}>
        <h1>Onboarding IA</h1>
        <p>No tienes sitios creados todavía. Crea uno para iniciar este flujo.</p>
        <Link className="btn-secondary" href="/dashboard">
          Ir al dashboard
        </Link>
      </main>
    );
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", siteId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!site) {
    return (
      <main className="container stack" style={{ paddingTop: "2rem" }}>
        <h1>Onboarding IA</h1>
        <p>No se encontró el sitio solicitado.</p>
      </main>
    );
  }

  if (source === "selector") {
    try {
      await recordPlatformEvent(admin, {
        eventType: "onboarding.site_selector.selected",
        userId: user.id,
        siteId: site.id,
        payload: {
          source
        }
      });
    } catch {
      // best effort
    }
  }

  return (
    <main className="container stack" style={{ paddingTop: "2rem" }}>
      <h1>Onboarding IA</h1>
      <p>Sitio: {site.name}</p>
      <OnboardingWizard siteId={site.id} maxInputChars={env.onboardingMaxInputChars} voiceLocale={env.voiceLocale} />
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { OnboardingSiteSelector, type OnboardingSiteListItem } from "@/components/forms/onboarding-site-selector";
import { OnboardingWizard } from "@/components/forms/onboarding-wizard";
import { requireUser } from "@/lib/auth";
import { recordPlatformEvent } from "@/lib/platform-events";
import { getOnboardingPlatformConfig } from "@/lib/platform-config";
import { normalizeSiteSpecV3, type SiteSpecV3 } from "@/lib/site-spec-v3";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { PlatformNav } from "@/components/platform-nav";
import { PlatformFooter } from "@/components/platform-footer";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ siteId?: string; source?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const params = await searchParams;
  const admin = getSupabaseAdminClient();
  const onboardingConfig = await getOnboardingPlatformConfig(admin);

  const siteId = params.siteId;
  const source = params.source;

  if (!siteId) {
    const { data: sites } = await supabase
      .from("sites")
      .select("id, name, subdomain, status, site_type, created_at")
      .is("deleted_at", null)
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
        <>
        <PlatformNav isAuthenticated isStatic />
        <main className="onboarding-shell" style={{ paddingBottom: "3rem" }}>
          <OnboardingSiteSelector sites={siteList} />
        </main>
        <PlatformFooter />
        </>
      );
    }

    return (
      <>
      <PlatformNav isAuthenticated isStatic />
      <main className="onboarding-shell" style={{ paddingBottom: "3rem" }}>
        <h1>Onboarding IA</h1>
        <p>No tienes sitios creados todavía. Crea uno para iniciar este flujo.</p>
        <Link className="btn-secondary" href="/dashboard">
          Ir al dashboard
        </Link>
      </main>
      <PlatformFooter />
      </>
    );
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, current_version_id")
    .eq("id", siteId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!site) {
    return (
      <>
      <PlatformNav isAuthenticated isStatic />
      <main className="onboarding-shell" style={{ paddingBottom: "3rem" }}>
        <h1>Onboarding IA</h1>
        <p>No se encontró el sitio solicitado.</p>
      </main>
      <PlatformFooter />
      </>
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

  let initialSpec: SiteSpecV3 | undefined;
  if (source === "regenerate" && site.current_version_id) {
    const { data: version } = await admin
      .from("site_versions")
      .select("site_spec_json")
      .eq("id", site.current_version_id)
      .maybeSingle();

    const normalized = normalizeSiteSpecV3(version?.site_spec_json);
    if (normalized) {
      initialSpec = normalized.spec;
    }
  }

  return (
    <>
    <PlatformNav isAuthenticated isStatic />
    <main className="onboarding-shell" style={{ paddingBottom: "3rem" }}>
      <OnboardingWizard
        siteId={site.id}
        siteName={site.name}
        maxInputChars={onboardingConfig.maxInputChars}
        voiceLocale={onboardingConfig.voiceLocale}
        generationMode={source === "regenerate" ? "regenerate" : "new"}
        initialSpec={initialSpec}
      />
    </main>
    <PlatformFooter />
    </>
  );
}

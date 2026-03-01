import type { SupabaseClient } from "@supabase/supabase-js";

import { parseAnySiteSpec } from "@/lib/site-spec-any";
import { buildSiteSpecV2FromTemplate, type SiteSpecV2 } from "@/lib/site-spec-v2";
import { recordPlatformEvent } from "@/lib/platform-events";

export async function ensureSiteCurrentVersionV2(input: {
  supabase: SupabaseClient;
  admin?: SupabaseClient;
  siteId: string;
  ownerId?: string;
  fallbackSiteName?: string;
}) {
  const { supabase, siteId } = input;

  const { data: site } = await supabase
    .from("sites")
    .select("id, owner_id, name, site_type, current_version_id")
    .eq("id", siteId)
    .maybeSingle();

  if (!site) {
    return { ok: false as const, reason: "site_not_found" as const };
  }

  if (input.ownerId && site.owner_id !== input.ownerId) {
    return { ok: false as const, reason: "forbidden" as const };
  }

  if (!site.current_version_id) {
    const initial = buildSiteSpecV2FromTemplate({
      siteType: site.site_type,
      businessName: site.name || input.fallbackSiteName || "Tu negocio"
    });

    const created = await createMigratedVersion({
      supabase,
      siteId,
      siteType: site.site_type,
      v2Spec: initial,
      oldVersionId: null,
      ownerId: site.owner_id,
      admin: input.admin
    });

    return { ok: true as const, migrated: true as const, siteSpec: initial, versionId: created.versionId };
  }

  const { data: currentVersion } = await supabase
    .from("site_versions")
    .select("id, site_spec_json")
    .eq("id", site.current_version_id)
    .maybeSingle();

  const parsed = parseAnySiteSpec(currentVersion?.site_spec_json, {});
  if (!parsed.success) {
    const fallback = buildSiteSpecV2FromTemplate({
      siteType: site.site_type,
      businessName: site.name || input.fallbackSiteName || "Tu negocio"
    });

    const created = await createMigratedVersion({
      supabase,
      siteId,
      siteType: site.site_type,
      v2Spec: fallback,
      oldVersionId: currentVersion?.id ?? null,
      ownerId: site.owner_id,
      admin: input.admin
    });

    return { ok: true as const, migrated: true as const, siteSpec: fallback, versionId: created.versionId };
  }

  if (!parsed.migrated) {
    return {
      ok: true as const,
      migrated: false as const,
      siteSpec: parsed.data,
      versionId: site.current_version_id
    };
  }

  const created = await createMigratedVersion({
    supabase,
    siteId,
    siteType: site.site_type,
    v2Spec: parsed.data,
    oldVersionId: site.current_version_id,
    ownerId: site.owner_id,
    admin: input.admin
  });

  return { ok: true as const, migrated: true as const, siteSpec: parsed.data, versionId: created.versionId };
}

async function createMigratedVersion(input: {
  supabase: SupabaseClient;
  admin?: SupabaseClient;
  siteId: string;
  siteType: "informative" | "commerce_lite";
  oldVersionId: string | null;
  ownerId: string;
  v2Spec: SiteSpecV2;
}) {
  const { supabase } = input;
  const { data: latestVersion } = await supabase
    .from("site_versions")
    .select("version")
    .eq("site_id", input.siteId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  const { data: created, error } = await supabase
    .from("site_versions")
    .insert({
      site_id: input.siteId,
      version: nextVersion,
      site_spec_json: input.v2Spec,
      source: "migration_v1_to_v2"
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to create migrated version");
  }

  await supabase
    .from("sites")
    .update({
      current_version_id: created.id,
      site_type: input.siteType
    })
    .eq("id", input.siteId);

  await supabase.from("events").insert({
    site_id: input.siteId,
    event_type: "site.v2.migrated",
    payload_json: {
      oldVersionId: input.oldVersionId,
      newVersionId: created.id
    }
  });

  if (input.admin) {
    try {
      await recordPlatformEvent(input.admin, {
        eventType: "site.v2.migrated",
        userId: input.ownerId,
        siteId: input.siteId,
        payload: {
          oldVersionId: input.oldVersionId,
          newVersionId: created.id
        }
      });
    } catch {
      // best effort
    }
  }

  return { versionId: created.id };
}

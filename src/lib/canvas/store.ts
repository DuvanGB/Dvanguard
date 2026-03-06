import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildSiteSpecV3FromBrief, parseSiteSpecV3, type SiteSpecV3 } from "@/lib/site-spec-v3";

export async function getOwnedSiteWithCurrentSpec(input: {
  supabase: SupabaseClient;
  siteId: string;
  userId: string;
}) {
  const { supabase, siteId, userId } = input;
  const { data: site } = await supabase
    .from("sites")
    .select("id, owner_id, name, site_type, current_version_id")
    .eq("id", siteId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!site) return null;

  let spec: SiteSpecV3 = buildSiteSpecV3FromBrief({
    siteType: site.site_type,
    businessName: site.name
  });

  if (site.current_version_id) {
    const { data: version } = await supabase
      .from("site_versions")
      .select("id, site_spec_json")
      .eq("id", site.current_version_id)
      .maybeSingle();

    const parsed = parseSiteSpecV3(version?.site_spec_json);
    if (parsed.success) {
      spec = parsed.data;
    }
  }

  return { site, spec };
}

export async function saveSiteSpecVersion(input: {
  supabase: SupabaseClient;
  siteId: string;
  spec: SiteSpecV3;
  source: "manual" | "canvas_auto_save" | "canvas_manual_checkpoint" | "hybrid_generate";
}) {
  const { supabase, siteId, spec, source } = input;
  const parsed = parseSiteSpecV3(spec);
  if (!parsed.success) {
    throw new Error("Invalid SiteSpec v3 payload");
  }

  const contentHash = hashSpec(spec);

  const { data: latestVersion } = await supabase
    .from("site_versions")
    .select("id, version, content_hash, site_spec_json")
    .eq("site_id", siteId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousHash =
    latestVersion?.content_hash ??
    (latestVersion?.site_spec_json ? hashSpec(latestVersion.site_spec_json as SiteSpecV3) : null);

  if (previousHash && previousHash === contentHash && latestVersion?.id) {
    await supabase.from("sites").update({ current_version_id: latestVersion.id }).eq("id", siteId);
    return { versionId: latestVersion.id, deduped: true as const, hash: contentHash };
  }

  const nextVersion = (latestVersion?.version ?? 0) + 1;
  const { data: version, error } = await supabase
    .from("site_versions")
    .insert({
      site_id: siteId,
      version: nextVersion,
      site_spec_json: spec,
      source,
      content_hash: contentHash
    })
    .select("id")
    .maybeSingle();

  if (error || !version) {
    throw new Error(error?.message ?? "Failed to save site version");
  }

  await supabase.from("sites").update({ current_version_id: version.id }).eq("id", siteId);

  return { versionId: version.id, deduped: false as const, hash: contentHash };
}

function hashSpec(input: SiteSpecV3) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

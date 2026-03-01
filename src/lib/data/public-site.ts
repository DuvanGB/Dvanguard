import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parseAnySiteSpec, type AnySiteSpec } from "@/lib/site-spec-any";

export type PublicSitePayload = {
  id: string;
  name: string;
  subdomain: string;
  siteSpec: AnySiteSpec;
};

export async function getPublishedSiteBySubdomain(subdomain: string): Promise<PublicSitePayload | null> {
  const admin = getSupabaseAdminClient();

  const { data: site, error: siteError } = await admin
    .from("sites")
    .select("id, name, subdomain, status, current_version_id")
    .eq("subdomain", subdomain)
    .eq("status", "published")
    .maybeSingle();

  if (siteError) {
    throw new Error(`Failed to query published site: ${siteError.message}`);
  }

  if (!site) {
    return null;
  }

  const { data: activePublication } = await admin
    .from("site_publications")
    .select("version_id")
    .eq("site_id", site.id)
    .eq("is_active", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionId = activePublication?.version_id ?? site.current_version_id;
  if (!versionId) {
    return null;
  }

  const { data: version, error: versionError } = await admin
    .from("site_versions")
    .select("site_spec_json")
    .eq("id", versionId)
    .maybeSingle();

  if (versionError) {
    throw new Error(`Failed to query published version: ${versionError.message}`);
  }

  if (!version) {
    return null;
  }

  const parsed = parseAnySiteSpec(version.site_spec_json);
  if (!parsed.success) {
    return null;
  }

  return {
    id: site.id,
    name: site.name,
    subdomain: site.subdomain,
    siteSpec: parsed.data
  };
}

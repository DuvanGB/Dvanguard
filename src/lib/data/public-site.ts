import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parseAnySiteSpec, type AnySiteSpec } from "@/lib/site-spec-any";
import { stripPort } from "@/lib/site-domains";
import { purgeExpiredDeletedSites } from "@/lib/sites-trash";

export type PublishedSiteRecord = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  current_version_id: string | null;
};

export type PublicSitePayload = {
  id: string;
  name: string;
  subdomain: string;
  siteSpec: AnySiteSpec;
};

export async function getPublishedSiteRecordById(siteId: string): Promise<PublishedSiteRecord | null> {
  const admin = getSupabaseAdminClient();
  await purgeExpiredDeletedSites(admin);
  const { data: site, error } = await admin
    .from("sites")
    .select("id, name, subdomain, status, current_version_id")
    .eq("id", siteId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to query published site by id: ${error.message}`);
  }

  return site;
}

export async function getPublishedSiteRecordBySubdomain(subdomain: string): Promise<PublishedSiteRecord | null> {
  const admin = getSupabaseAdminClient();
  await purgeExpiredDeletedSites(admin);
  const { data: site, error } = await admin
    .from("sites")
    .select("id, name, subdomain, status, current_version_id")
    .eq("subdomain", subdomain)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to query published site by subdomain: ${error.message}`);
  }

  return site;
}

export async function getPublishedSiteRecordByHostname(hostname: string): Promise<PublishedSiteRecord | null> {
  const normalizedHost = stripPort(hostname);
  if (!normalizedHost) return null;

  const admin = getSupabaseAdminClient();
  await purgeExpiredDeletedSites(admin);
  const { data: domain, error } = await admin
    .from("site_domains")
    .select("site_id")
    .eq("hostname", normalizedHost)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to query published site by hostname: ${error.message}`);
  }

  if (!domain?.site_id) {
    return null;
  }

  return getPublishedSiteRecordById(domain.site_id);
}

export async function getPublishedSiteBySubdomain(subdomain: string): Promise<PublicSitePayload | null> {
  const site = await getPublishedSiteRecordBySubdomain(subdomain);
  if (!site) return null;
  return getPublicSitePayload(site);
}

export async function getPublishedSiteByHostname(hostname: string): Promise<PublicSitePayload | null> {
  const site = await getPublishedSiteRecordByHostname(hostname);
  if (!site) return null;
  return getPublicSitePayload(site);
}

async function getPublicSitePayload(site: PublishedSiteRecord): Promise<PublicSitePayload | null> {
  const admin = getSupabaseAdminClient();
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

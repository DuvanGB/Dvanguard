import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { SiteDomainRecord } from "@/lib/site-domains";

export async function listSiteDomainsBySiteIds(siteIds: string[]) {
  if (!siteIds.length) return new Map<string, SiteDomainRecord[]>();

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("site_domains")
    .select("id, site_id, hostname, status, verification_json, is_primary, created_at, verified_at")
    .in("site_id", siteIds)
    .neq("status", "removed")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load site domains: ${error.message}`);
  }

  const grouped = new Map<string, SiteDomainRecord[]>();
  for (const row of (data ?? []) as SiteDomainRecord[]) {
    const current = grouped.get(row.site_id) ?? [];
    current.push(row);
    grouped.set(row.site_id, current);
  }

  return grouped;
}

export async function listSiteDomainsForSite(siteId: string) {
  const grouped = await listSiteDomainsBySiteIds([siteId]);
  return grouped.get(siteId) ?? [];
}

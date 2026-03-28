import { listSiteDomainsBySiteIds } from "@/lib/data/site-domains";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { pickPrimaryDomain } from "@/lib/site-domains";
import { parsePagination } from "@/lib/data/admin/common";

type Params = {
  status?: string | null;
  type?: string | null;
  owner?: string | null;
  page?: string | null;
  pageSize?: string | null;
};

export async function listAdminSites(params: Params) {
  const admin = getSupabaseAdminClient();
  const { page, pageSize, from, to } = parsePagination(params);
  const ownerSearch = params.owner?.trim().toLowerCase();

  let ownerIdsFilter: string[] | null = null;
  if (ownerSearch) {
    const { data: matchedOwners } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", `%${ownerSearch}%`)
      .limit(500);

    ownerIdsFilter = (matchedOwners ?? []).map((row) => row.id);
    if (!ownerIdsFilter.length) {
      return { items: [], total: 0, page, pageSize };
    }
  }

  let query = admin
    .from("sites")
    .select("id, owner_id, name, subdomain, status, site_type, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.type) {
    query = query.eq("site_type", params.type);
  }

  if (ownerIdsFilter) {
    query = query.in("owner_id", ownerIdsFilter);
  }

  const { data: sites, count } = await query.range(from, to);

  if (!sites?.length) {
    return { items: [], total: count ?? 0, page, pageSize };
  }

  const ownerIds = Array.from(new Set(sites.map((site) => site.owner_id)));
  const siteIds = sites.map((site) => site.id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: profiles }, domainsBySiteId, { data: analyticsEvents }] = await Promise.all([
    admin.from("profiles").select("id, email").in("id", ownerIds),
    listSiteDomainsBySiteIds(siteIds),
    admin.from("site_analytics_events").select("site_id, event_type").in("site_id", siteIds).gte("occurred_at", thirtyDaysAgo)
  ]);
  const emailByOwner = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));
  const analyticsBySiteId = new Map<string, { visits: number; whatsapp_clicks: number; cta_clicks: number }>();

  for (const event of analyticsEvents ?? []) {
    const current = analyticsBySiteId.get(event.site_id) ?? { visits: 0, whatsapp_clicks: 0, cta_clicks: 0 };
    if (event.event_type === "visit") current.visits += 1;
    if (event.event_type === "whatsapp_click") current.whatsapp_clicks += 1;
    if (event.event_type === "cta_click") current.cta_clicks += 1;
    analyticsBySiteId.set(event.site_id, current);
  }

  const items = sites.map((site) => ({
    ...site,
    owner_email: emailByOwner.get(site.owner_id) ?? null,
    primary_domain: pickPrimaryDomain(domainsBySiteId.get(site.id) ?? [])?.hostname ?? null,
    analytics: analyticsBySiteId.get(site.id) ?? { visits: 0, whatsapp_clicks: 0, cta_clicks: 0 }
  }));

  return { items, total: count ?? 0, page, pageSize };
}

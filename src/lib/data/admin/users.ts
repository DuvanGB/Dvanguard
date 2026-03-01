import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parsePagination } from "@/lib/data/admin/common";

type Params = {
  search?: string | null;
  page?: string | null;
  pageSize?: string | null;
};

export async function listAdminUsers(params: Params) {
  const admin = getSupabaseAdminClient();
  const { page, pageSize, from, to } = parsePagination(params);

  let query = admin.from("profiles").select("id, email, role, created_at", { count: "exact" }).order("created_at", {
    ascending: false
  });

  const search = params.search?.trim();
  if (search) {
    query = query.ilike("email", `%${search}%`);
  }

  const { data: profiles, count } = await query.range(from, to);

  if (!profiles?.length) {
    return { items: [], total: count ?? 0, page, pageSize };
  }

  const profileIds = profiles.map((profile) => profile.id);
  const { data: sites } = await admin.from("sites").select("id, owner_id, status").in("owner_id", profileIds);

  const siteIds = (sites ?? []).map((site) => site.id);
  const { data: events } = siteIds.length
    ? await admin.from("events").select("site_id, created_at").in("site_id", siteIds).order("created_at", { ascending: false })
    : { data: [] as Array<{ site_id: string; created_at: string }> };

  const sitesByOwner = new Map<string, Array<{ id: string; status: string }>>();
  for (const site of sites ?? []) {
    const current = sitesByOwner.get(site.owner_id) ?? [];
    current.push(site);
    sitesByOwner.set(site.owner_id, current);
  }

  const ownerBySite = new Map((sites ?? []).map((site) => [site.id, site.owner_id]));
  const latestActivityByOwner = new Map<string, string>();

  for (const event of events ?? []) {
    const ownerId = ownerBySite.get(event.site_id);
    if (!ownerId) continue;

    if (!latestActivityByOwner.has(ownerId)) {
      latestActivityByOwner.set(ownerId, event.created_at);
    }
  }

  const items = profiles.map((profile) => {
    const ownerSites = sitesByOwner.get(profile.id) ?? [];

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      created_at: profile.created_at,
      total_sites: ownerSites.length,
      published_sites: ownerSites.filter((site) => site.status === "published").length,
      last_activity: latestActivityByOwner.get(profile.id) ?? null
    };
  });

  return { items, total: count ?? 0, page, pageSize };
}

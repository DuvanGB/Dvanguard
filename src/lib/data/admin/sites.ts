import { getSupabaseAdminClient } from "@/lib/supabase/server";
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
  const { data: profiles } = await admin.from("profiles").select("id, email").in("id", ownerIds);
  const emailByOwner = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));

  const items = sites.map((site) => ({
    ...site,
    owner_email: emailByOwner.get(site.owner_id) ?? null
  }));

  return { items, total: count ?? 0, page, pageSize };
}

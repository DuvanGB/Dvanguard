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
  const [{ data: sites }, { data: plans }, { data: billingMemberships }] = await Promise.all([
    admin.from("sites").select("id, owner_id, status").in("owner_id", profileIds),
    admin.from("user_plans").select("user_id, plan_code").in("user_id", profileIds),
    admin
      .from("billing_memberships")
      .select("user_id, status, interval, access_state, ends_at, renews_automatically, rail, payment_method_kind, created_at")
      .in("user_id", profileIds)
      .order("created_at", { ascending: false })
  ]);

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
  const planByUser = new Map((plans ?? []).map((plan) => [plan.user_id, plan.plan_code]));
  const billingByUser = new Map<string, Record<string, unknown>>();
  for (const item of billingMemberships ?? []) {
    if (!billingByUser.has(item.user_id)) {
      billingByUser.set(item.user_id, item);
    }
  }
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
    const billing = billingByUser.get(profile.id);

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      plan_code: planByUser.get(profile.id) ?? "free",
      billing_status: typeof billing?.status === "string" ? billing.status : null,
      billing_interval: typeof billing?.interval === "string" ? billing.interval : null,
      billing_access_state: typeof billing?.access_state === "string" ? billing.access_state : null,
      billing_current_period_end: typeof billing?.ends_at === "string" ? billing.ends_at : null,
      billing_cancel_at_period_end: typeof billing?.renews_automatically === "boolean" ? !billing.renews_automatically : false,
      billing_rail: typeof billing?.rail === "string" ? billing.rail : null,
      billing_method: typeof billing?.payment_method_kind === "string" ? billing.payment_method_kind : null,
      created_at: profile.created_at,
      total_sites: ownerSites.length,
      published_sites: ownerSites.filter((site) => site.status === "published").length,
      last_activity: latestActivityByOwner.get(profile.id) ?? null
    };
  });

  return { items, total: count ?? 0, page, pageSize };
}

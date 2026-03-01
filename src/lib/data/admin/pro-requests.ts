import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parsePagination } from "@/lib/data/admin/common";

type Params = {
  status?: string | null;
  page?: string | null;
  pageSize?: string | null;
};

export async function listAdminProRequests(params: Params) {
  const admin = getSupabaseAdminClient();
  const { page, pageSize, from, to } = parsePagination(params);

  let query = admin
    .from("pro_requests")
    .select("id, user_id, status, reviewed_by, reviewed_at, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data: requests, count } = await query.range(from, to);

  if (!requests?.length) {
    return { items: [], total: count ?? 0, page, pageSize };
  }

  const profileIds = Array.from(
    new Set(
      requests
        .flatMap((row) => [row.user_id, row.reviewed_by])
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  const { data: profiles } = profileIds.length
    ? await admin.from("profiles").select("id, email").in("id", profileIds)
    : { data: [] as Array<{ id: string; email: string }> };

  const emailById = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));

  const items = requests.map((row) => ({
    ...row,
    user_email: emailById.get(row.user_id) ?? null,
    reviewed_by_email: row.reviewed_by ? emailById.get(row.reviewed_by) ?? null : null
  }));

  return { items, total: count ?? 0, page, pageSize };
}

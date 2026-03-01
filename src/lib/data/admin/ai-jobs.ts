import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parsePagination } from "@/lib/data/admin/common";

type Params = {
  status?: string | null;
  siteId?: string | null;
  userId?: string | null;
  from?: string | null;
  to?: string | null;
  page?: string | null;
  pageSize?: string | null;
};

export async function listAdminAiJobs(params: Params) {
  const admin = getSupabaseAdminClient();
  const { page, pageSize, from, to } = parsePagination(params);

  let query = admin
    .from("ai_jobs")
    .select(
      "id, site_id, created_by, job_type, status, error, output_json, created_at, started_at, completed_at, retry_of_job_id, attempt",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.siteId) {
    query = query.eq("site_id", params.siteId);
  }

  if (params.userId) {
    query = query.eq("created_by", params.userId);
  }

  if (params.from) {
    const parsedFrom = new Date(params.from);
    if (!Number.isNaN(parsedFrom.getTime())) {
      query = query.gte("created_at", parsedFrom.toISOString());
    }
  }

  if (params.to) {
    const parsedTo = new Date(params.to);
    if (!Number.isNaN(parsedTo.getTime())) {
      query = query.lte("created_at", parsedTo.toISOString());
    }
  }

  const { data: jobs, count } = await query.range(from, to);

  if (!jobs?.length) {
    return { items: [], total: count ?? 0, page, pageSize };
  }

  const userIds = Array.from(new Set(jobs.map((job) => job.created_by)));
  const siteIds = Array.from(new Set(jobs.map((job) => job.site_id)));

  const [{ data: profiles }, { data: sites }] = await Promise.all([
    admin.from("profiles").select("id, email").in("id", userIds),
    admin.from("sites").select("id, name, subdomain").in("id", siteIds)
  ]);

  const emailById = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));
  const siteById = new Map((sites ?? []).map((site) => [site.id, site]));

  const items = jobs.map((job) => {
    const output = (job.output_json ?? {}) as Record<string, unknown>;
    const rawLatency = output.latencyMs;
    const latencyMs = typeof rawLatency === "number" ? rawLatency : Number(rawLatency ?? "");

    return {
      ...job,
      created_by_email: emailById.get(job.created_by) ?? null,
      site_name: siteById.get(job.site_id)?.name ?? null,
      site_subdomain: siteById.get(job.site_id)?.subdomain ?? null,
      latency_ms: Number.isFinite(latencyMs) ? latencyMs : null,
      fallback_reason:
        typeof output.fallbackReason === "string" && output.fallbackReason.trim().length
          ? output.fallbackReason
          : null,
      source: typeof output.source === "string" ? output.source : null
    };
  });

  return { items, total: count ?? 0, page, pageSize };
}

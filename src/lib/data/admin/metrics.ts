import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parseRange, percentile } from "@/lib/data/admin/common";

export type AdminMetrics = {
  range: string;
  sitesCreated: number;
  sitesPublished: number;
  aiJobsTotal: number;
  aiJobsFailed: number;
  aiJobsFallback: number;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
};

export async function getAdminMetrics(rangeParam?: string | null): Promise<AdminMetrics> {
  const admin = getSupabaseAdminClient();
  const range = parseRange(rangeParam);
  const fromIso = range.from.toISOString();

  const [{ data: sites }, { data: publications }, { data: jobs }] = await Promise.all([
    admin.from("sites").select("id", { count: "exact" }).gte("created_at", fromIso),
    admin.from("site_publications").select("site_id, published_at").gte("published_at", fromIso),
    admin.from("ai_jobs").select("status, output_json, created_at").gte("created_at", fromIso)
  ]);

  const sitesCreated = sites?.length ?? 0;
  const sitesPublished = new Set((publications ?? []).map((row) => row.site_id)).size;

  const jobsTotal = jobs?.length ?? 0;
  const jobsFailed = (jobs ?? []).filter((job) => job.status === "failed").length;

  const jobsFallback = (jobs ?? []).filter((job) => {
    const output = (job.output_json ?? {}) as Record<string, unknown>;
    const source = output.source;
    return source === "fallback";
  }).length;

  const latencies = (jobs ?? [])
    .map((job) => {
      const output = (job.output_json ?? {}) as Record<string, unknown>;
      const raw = output.latencyMs;
      if (typeof raw === "number") return raw;
      if (typeof raw === "string") {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    })
    .filter((value): value is number => value !== null);

  return {
    range: range.label,
    sitesCreated,
    sitesPublished,
    aiJobsTotal: jobsTotal,
    aiJobsFailed: jobsFailed,
    aiJobsFallback: jobsFallback,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95)
  };
}

export async function getRecentFailedJobs(limit = 10) {
  const admin = getSupabaseAdminClient();
  const { data: jobs } = await admin
    .from("ai_jobs")
    .select("id, site_id, created_by, error, created_at")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!jobs?.length) return [];

  const userIds = Array.from(new Set(jobs.map((job) => job.created_by)));
  const { data: profiles } = await admin.from("profiles").select("id, email").in("id", userIds);
  const emailById = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));

  return jobs.map((job) => ({
    ...job,
    created_by_email: emailById.get(job.created_by) ?? null
  }));
}

export async function getRecentlyPublishedSites(limit = 10) {
  const admin = getSupabaseAdminClient();
  const { data: publications } = await admin
    .from("site_publications")
    .select("site_id, published_at")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (!publications?.length) return [];

  const siteIds = Array.from(new Set(publications.map((row) => row.site_id)));
  const { data: sites } = await admin
    .from("sites")
    .select("id, name, subdomain, owner_id, status, site_type")
    .in("id", siteIds);

  const ownerIds = Array.from(new Set((sites ?? []).map((site) => site.owner_id)));
  const { data: profiles } = await admin.from("profiles").select("id, email").in("id", ownerIds);

  const siteById = new Map((sites ?? []).map((site) => [site.id, site]));
  const emailByOwner = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));

  return publications
    .map((row) => {
      const site = siteById.get(row.site_id);
      if (!site) return null;

      return {
        site_id: site.id,
        name: site.name,
        subdomain: site.subdomain,
        status: site.status,
        site_type: site.site_type,
        owner_email: emailByOwner.get(site.owner_id) ?? null,
        published_at: row.published_at
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

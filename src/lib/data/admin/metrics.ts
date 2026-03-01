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
  publishIn24hRate: number | null;
  limitHitAiCount: number;
  limitHitPublishCount: number;
  proRequestsPending: number;
  proRequestsApproved: number;
  proRequestsRejected: number;
  firstResultAcceptanceRate: number | null;
  voiceUsageRate: number | null;
  onboardingRefineFallbackRate: number | null;
  regenerationsP50: number | null;
  regenerationsP95: number | null;
  templateRecommendedPickRate: number | null;
  v2FirstResultAcceptanceRate: number | null;
  regenerationAvgPerTemplate: number | null;
};

export async function getAdminMetrics(rangeParam?: string | null): Promise<AdminMetrics> {
  const admin = getSupabaseAdminClient();
  const range = parseRange(rangeParam);
  const fromIso = range.from.toISOString();

  const [{ data: sites }, { data: publications }, { data: jobs }, { data: signups }, { data: platformEvents }, { data: proRequests }] =
    await Promise.all([
      admin.from("sites").select("id", { count: "exact" }).gte("created_at", fromIso),
      admin.from("site_publications").select("site_id, published_at").gte("published_at", fromIso),
      admin.from("ai_jobs").select("status, output_json, created_at").gte("created_at", fromIso),
      admin.from("profiles").select("id, created_at").gte("created_at", fromIso),
      admin
        .from("platform_events")
        .select("event_type, user_id, site_id, payload_json, created_at")
        .gte("created_at", fromIso)
        .in("event_type", [
          "plan.limit_hit.ai",
          "plan.limit_hit.publish",
          "site.generation.first_attempt_done",
          "site.generation.regenerated",
          "site.first_result.accepted",
          "site.v2.first_result.accepted",
          "onboarding.refine.completed",
          "template.selected",
          "template.recommended"
        ]),
      admin.from("pro_requests").select("status, created_at").gte("created_at", fromIso)
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

  let publishIn24hRate: number | null = null;

  if (signups?.length) {
    const userIds = signups.map((signup) => signup.id);
    const { data: ownedSites } = await admin.from("sites").select("id, owner_id").in("owner_id", userIds);
    const ownerBySite = new Map((ownedSites ?? []).map((site) => [site.id, site.owner_id]));
    const siteIds = (ownedSites ?? []).map((site) => site.id);

    let firstPublishByUser = new Map<string, string>();
    if (siteIds.length) {
      const { data: allPublications } = await admin.from("site_publications").select("site_id, published_at").in("site_id", siteIds);

      for (const publication of allPublications ?? []) {
        const ownerId = ownerBySite.get(publication.site_id);
        if (!ownerId) continue;

        const current = firstPublishByUser.get(ownerId);
        if (!current || new Date(publication.published_at).getTime() < new Date(current).getTime()) {
          firstPublishByUser.set(ownerId, publication.published_at);
        }
      }
    }

    const publishedWithin24h = signups.filter((signup) => {
      const firstPublishedAt = firstPublishByUser.get(signup.id);
      if (!firstPublishedAt) return false;

      const diffMs = new Date(firstPublishedAt).getTime() - new Date(signup.created_at).getTime();
      return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000;
    }).length;

    publishIn24hRate = Number(((publishedWithin24h / signups.length) * 100).toFixed(2));
  }

  const limitHitAiCount = (platformEvents ?? []).filter((event) => event.event_type === "plan.limit_hit.ai").length;
  const limitHitPublishCount = (platformEvents ?? []).filter((event) => event.event_type === "plan.limit_hit.publish").length;
  const proRequestsPending = (proRequests ?? []).filter((row) => row.status === "pending").length;
  const proRequestsApproved = (proRequests ?? []).filter((row) => row.status === "approved").length;
  const proRequestsRejected = (proRequests ?? []).filter((row) => row.status === "rejected").length;

  const firstAttemptEvents = (platformEvents ?? []).filter((event) => event.event_type === "site.generation.first_attempt_done");
  const acceptedEvents = (platformEvents ?? []).filter((event) => event.event_type === "site.first_result.accepted");
  const acceptedV2Events = (platformEvents ?? []).filter((event) => event.event_type === "site.v2.first_result.accepted");
  const refineEvents = (platformEvents ?? []).filter((event) => event.event_type === "onboarding.refine.completed");
  const regenerationEvents = (platformEvents ?? []).filter((event) => event.event_type === "site.generation.regenerated");
  const templateSelectedEvents = (platformEvents ?? []).filter((event) => event.event_type === "template.selected");

  const firstAttemptUsers = new Set(
    firstAttemptEvents.map((event) => event.user_id).filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  const acceptedUsers = new Set(
    acceptedEvents.map((event) => event.user_id).filter((value): value is string => typeof value === "string" && value.length > 0)
  );

  const firstResultAcceptanceRate = firstAttemptUsers.size
    ? Number(((acceptedUsers.size / firstAttemptUsers.size) * 100).toFixed(2))
    : null;

  const v2AttemptUsers = new Set(
    firstAttemptEvents
      .filter((event) => {
        const payload = (event.payload_json ?? {}) as Record<string, unknown>;
        return typeof payload.templateId === "string" && payload.templateId.length > 0;
      })
      .map((event) => event.user_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  const v2AcceptedUsers = new Set(
    acceptedV2Events.map((event) => event.user_id).filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  const v2FirstResultAcceptanceRate = v2AttemptUsers.size
    ? Number(((v2AcceptedUsers.size / v2AttemptUsers.size) * 100).toFixed(2))
    : null;

  const refineVoiceCount = refineEvents.filter((event) => {
    const payload = (event.payload_json ?? {}) as Record<string, unknown>;
    return payload.inputMode === "voice";
  }).length;
  const voiceUsageRate = refineEvents.length ? Number(((refineVoiceCount / refineEvents.length) * 100).toFixed(2)) : null;

  const refineFallbackCount = refineEvents.filter((event) => {
    const payload = (event.payload_json ?? {}) as Record<string, unknown>;
    return payload.provider !== "llm";
  }).length;
  const onboardingRefineFallbackRate = refineEvents.length
    ? Number(((refineFallbackCount / refineEvents.length) * 100).toFixed(2))
    : null;

  const regenerationBySite = new Map<string, number>();
  for (const event of firstAttemptEvents) {
    if (event.site_id) regenerationBySite.set(event.site_id, 0);
  }
  for (const event of regenerationEvents) {
    if (!event.site_id) continue;
    regenerationBySite.set(event.site_id, (regenerationBySite.get(event.site_id) ?? 0) + 1);
  }

  const regenerationSeries = Array.from(regenerationBySite.values());

  const selectedRecommendedCount = templateSelectedEvents.filter((event) => {
    const payload = (event.payload_json ?? {}) as Record<string, unknown>;
    return payload.selectedRecommended === true;
  }).length;
  const templateRecommendedPickRate = templateSelectedEvents.length
    ? Number(((selectedRecommendedCount / templateSelectedEvents.length) * 100).toFixed(2))
    : null;

  const regenerationCountByTemplate = new Map<string, number>();
  for (const event of regenerationEvents) {
    const payload = (event.payload_json ?? {}) as Record<string, unknown>;
    const templateId = typeof payload.templateId === "string" ? payload.templateId : null;
    if (!templateId) continue;
    regenerationCountByTemplate.set(templateId, (regenerationCountByTemplate.get(templateId) ?? 0) + 1);
  }
  const regenerationAvgPerTemplate = regenerationCountByTemplate.size
    ? Number(
        (
          Array.from(regenerationCountByTemplate.values()).reduce((acc, current) => acc + current, 0) /
          regenerationCountByTemplate.size
        ).toFixed(2)
      )
    : null;

  return {
    range: range.label,
    sitesCreated,
    sitesPublished,
    aiJobsTotal: jobsTotal,
    aiJobsFailed: jobsFailed,
    aiJobsFallback: jobsFallback,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    publishIn24hRate,
    limitHitAiCount,
    limitHitPublishCount,
    proRequestsPending,
    proRequestsApproved,
    proRequestsRejected,
    firstResultAcceptanceRate,
    v2FirstResultAcceptanceRate,
    voiceUsageRate,
    onboardingRefineFallbackRate,
    regenerationsP50: percentile(regenerationSeries, 50),
    regenerationsP95: percentile(regenerationSeries, 95),
    templateRecommendedPickRate,
    regenerationAvgPerTemplate
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

export async function getSitesWithMostRegenerations(limit = 10, rangeParam?: string | null) {
  const admin = getSupabaseAdminClient();
  const range = parseRange(rangeParam);
  const fromIso = range.from.toISOString();

  const { data: events } = await admin
    .from("platform_events")
    .select("site_id")
    .eq("event_type", "site.generation.regenerated")
    .gte("created_at", fromIso);

  const siteCounter = new Map<string, number>();
  for (const event of events ?? []) {
    if (!event.site_id) continue;
    siteCounter.set(event.site_id, (siteCounter.get(event.site_id) ?? 0) + 1);
  }

  const ranked = Array.from(siteCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (!ranked.length) {
    return [];
  }

  const siteIds = ranked.map(([siteId]) => siteId);
  const { data: sites } = await admin.from("sites").select("id, name, subdomain, owner_id").in("id", siteIds);
  const ownerIds = Array.from(new Set((sites ?? []).map((site) => site.owner_id)));
  const { data: profiles } = await admin.from("profiles").select("id, email").in("id", ownerIds);

  const siteById = new Map((sites ?? []).map((site) => [site.id, site]));
  const ownerEmailById = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));

  return ranked
    .map(([siteId, regenerations]) => {
      const site = siteById.get(siteId);
      if (!site) return null;
      return {
        site_id: site.id,
        name: site.name,
        subdomain: site.subdomain,
        owner_email: ownerEmailById.get(site.owner_id) ?? null,
        regenerations
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function getTopTemplatesByPublication(limit = 5, rangeParam?: string | null) {
  const admin = getSupabaseAdminClient();
  const range = parseRange(rangeParam);
  const fromIso = range.from.toISOString();

  const { data: publications } = await admin
    .from("site_publications")
    .select("version_id, published_at")
    .gte("published_at", fromIso);

  if (!publications?.length) {
    return [];
  }

  const versionIds = Array.from(new Set(publications.map((row) => row.version_id)));
  const { data: versions } = await admin.from("site_versions").select("id, site_spec_json").in("id", versionIds);

  const templateByVersionId = new Map<string, string>();
  for (const version of versions ?? []) {
    const templateId = ((version.site_spec_json ?? {}) as Record<string, unknown>)?.template;
    const parsedTemplateId =
      templateId && typeof templateId === "object" && typeof (templateId as Record<string, unknown>).id === "string"
        ? ((templateId as Record<string, unknown>).id as string)
        : null;

    if (!parsedTemplateId) continue;
    templateByVersionId.set(version.id, parsedTemplateId);
  }

  const templateCount = new Map<string, number>();
  for (const publication of publications) {
    const templateId = templateByVersionId.get(publication.version_id);
    if (!templateId) continue;
    templateCount.set(templateId, (templateCount.get(templateId) ?? 0) + 1);
  }

  return Array.from(templateCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([templateId, publicationsCount]) => ({
      templateId,
      publicationsCount
    }));
}

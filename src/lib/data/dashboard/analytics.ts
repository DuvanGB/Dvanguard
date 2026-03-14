import { parseRange } from "@/lib/data/admin/common";
import { parseAnySiteSpec } from "@/lib/site-spec-any";
import type { AnySiteSpec } from "@/lib/site-spec-any";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type ActivationChecklistItem = {
  key: "content" | "image" | "whatsapp" | "published";
  label: string;
  done: boolean;
};

export type SiteAnalyticsSnapshot = {
  site_id: string;
  name: string;
  subdomain: string;
  status: "draft" | "published" | "archived";
  site_type: "informative" | "commerce_lite";
  created_at: string;
  visits: number;
  whatsapp_clicks: number;
  cta_clicks: number;
  ctr_whatsapp: number;
  checklist: ActivationChecklistItem[];
  checklist_done: number;
  checklist_total: number;
};

export type OwnerAnalyticsResult = {
  range: "7d" | "30d" | "24h";
  from: string;
  sites: SiteAnalyticsSnapshot[];
  summary: {
    visits: number;
    whatsapp_clicks: number;
    cta_clicks: number;
    ctr_whatsapp: number;
  };
};

export async function getOwnerSiteAnalytics(input: {
  ownerId: string;
  range?: string | null;
  siteId?: string | null;
}): Promise<OwnerAnalyticsResult> {
  const admin = getSupabaseAdminClient();
  const range = parseRange(input.range);
  const fromIso = range.from.toISOString();

  let query = admin
    .from("sites")
    .select("id, name, subdomain, status, site_type, created_at, current_version_id")
    .eq("owner_id", input.ownerId)
    .order("created_at", { ascending: false });

  if (input.siteId) {
    query = query.eq("id", input.siteId);
  }

  const { data: sites } = await query;
  const siteList = sites ?? [];

  if (!siteList.length) {
    return {
      range: range.label as OwnerAnalyticsResult["range"],
      from: fromIso,
      sites: [],
      summary: {
        visits: 0,
        whatsapp_clicks: 0,
        cta_clicks: 0,
        ctr_whatsapp: 0
      }
    };
  }

  const siteIds = siteList.map((site) => site.id);
  const versionIds = siteList
    .map((site) => site.current_version_id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const [{ data: events }, { data: versions }] = await Promise.all([
    admin
      .from("site_analytics_events")
      .select("site_id, event_type")
      .in("site_id", siteIds)
      .gte("occurred_at", fromIso),
    versionIds.length
      ? admin.from("site_versions").select("id, site_spec_json").in("id", versionIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  const versionById = new Map((versions ?? []).map((version) => [version.id, version.site_spec_json]));
  const counters = new Map<string, { visits: number; whatsapp_clicks: number; cta_clicks: number }>();

  for (const siteId of siteIds) {
    counters.set(siteId, { visits: 0, whatsapp_clicks: 0, cta_clicks: 0 });
  }

  for (const event of events ?? []) {
    const current = counters.get(event.site_id);
    if (!current) continue;
    if (event.event_type === "visit") current.visits += 1;
    if (event.event_type === "whatsapp_click") current.whatsapp_clicks += 1;
    if (event.event_type === "cta_click") current.cta_clicks += 1;
  }

  const snapshots: SiteAnalyticsSnapshot[] = siteList.map((site) => {
    const counts = counters.get(site.id) ?? { visits: 0, whatsapp_clicks: 0, cta_clicks: 0 };
    const specRaw = site.current_version_id ? versionById.get(site.current_version_id) : null;
    const parsed = parseAnySiteSpec(specRaw);
    const checklist = parsed.success
      ? buildActivationChecklist(parsed.data, site.status)
      : buildFallbackChecklist(site.status);
    const checklistDone = checklist.filter((item) => item.done).length;

    return {
      site_id: site.id,
      name: site.name,
      subdomain: site.subdomain,
      status: normalizeSiteStatus(site.status),
      site_type: normalizeSiteType(site.site_type),
      created_at: site.created_at,
      visits: counts.visits,
      whatsapp_clicks: counts.whatsapp_clicks,
      cta_clicks: counts.cta_clicks,
      ctr_whatsapp: counts.visits ? Number(((counts.whatsapp_clicks / counts.visits) * 100).toFixed(2)) : 0,
      checklist,
      checklist_done: checklistDone,
      checklist_total: checklist.length
    };
  });

  const summaryVisits = snapshots.reduce((acc, site) => acc + site.visits, 0);
  const summaryWhatsapp = snapshots.reduce((acc, site) => acc + site.whatsapp_clicks, 0);
  const summaryCta = snapshots.reduce((acc, site) => acc + site.cta_clicks, 0);

  return {
    range: range.label as OwnerAnalyticsResult["range"],
    from: fromIso,
    sites: snapshots,
    summary: {
      visits: summaryVisits,
      whatsapp_clicks: summaryWhatsapp,
      cta_clicks: summaryCta,
      ctr_whatsapp: summaryVisits ? Number(((summaryWhatsapp / summaryVisits) * 100).toFixed(2)) : 0
    }
  };
}

function buildActivationChecklist(spec: AnySiteSpec, status: string) {
  const homepage = spec.pages.find((page) => page.slug === "/") ?? spec.pages[0];
  const enabledSections = homepage?.sections.filter((section) => section.enabled) ?? [];
  const allBlocks = enabledSections.flatMap((section) => section.blocks);

  const hasContent =
    allBlocks.some((block) => block.type === "text" && block.content.text.trim().length >= 12) &&
    enabledSections.length >= 2;

  const hasPrimaryImage = allBlocks.some((block) => {
    if (block.type === "image") return Boolean(block.content.url);
    if (block.type === "product") return Boolean(block.content.image_url);
    return false;
  });

  const hasWhatsappButton = allBlocks.some((block) => block.type === "button" && block.content.action === "whatsapp");
  const hasWhatsapp = Boolean(spec.integrations.whatsapp?.enabled && (spec.integrations.whatsapp?.phone || hasWhatsappButton));

  return [
    { key: "content", label: "Contenido mínimo", done: Boolean(hasContent) },
    { key: "image", label: "Imagen principal", done: Boolean(hasPrimaryImage) },
    { key: "whatsapp", label: "CTA WhatsApp", done: hasWhatsapp },
    { key: "published", label: "Sitio publicado", done: status === "published" }
  ] satisfies ActivationChecklistItem[];
}

function buildFallbackChecklist(status: string) {
  return [
    { key: "content", label: "Contenido mínimo", done: false },
    { key: "image", label: "Imagen principal", done: false },
    { key: "whatsapp", label: "CTA WhatsApp", done: false },
    { key: "published", label: "Sitio publicado", done: status === "published" }
  ] satisfies ActivationChecklistItem[];
}

function normalizeSiteStatus(value: string): SiteAnalyticsSnapshot["status"] {
  if (value === "published" || value === "archived") return value;
  return "draft";
}

function normalizeSiteType(value: string): SiteAnalyticsSnapshot["site_type"] {
  if (value === "commerce_lite") return value;
  return "informative";
}

import { parseRange } from "@/lib/data/admin/common";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminTrafficMetrics = {
  range: "7d" | "30d" | "24h";
  from: string;
  totals: {
    visits: number;
    whatsapp_clicks: number;
    cta_clicks: number;
    ctr_whatsapp: number;
  };
  top_by_visits: Array<{
    site_id: string;
    name: string;
    subdomain: string;
    visits: number;
    whatsapp_clicks: number;
    ctr_whatsapp: number;
  }>;
  top_by_whatsapp: Array<{
    site_id: string;
    name: string;
    subdomain: string;
    whatsapp_clicks: number;
    visits: number;
    ctr_whatsapp: number;
  }>;
  low_conversion: Array<{
    site_id: string;
    name: string;
    subdomain: string;
    visits: number;
    whatsapp_clicks: number;
    ctr_whatsapp: number;
  }>;
};

export async function getAdminTrafficMetrics(rangeParam?: string | null): Promise<AdminTrafficMetrics> {
  const admin = getSupabaseAdminClient();
  const range = parseRange(rangeParam);
  const fromIso = range.from.toISOString();

  const { data: events } = await admin
    .from("site_analytics_events")
    .select("site_id, event_type")
    .gte("occurred_at", fromIso);

  const counters = new Map<string, { visits: number; whatsapp_clicks: number; cta_clicks: number }>();

  for (const event of events ?? []) {
    const current = counters.get(event.site_id) ?? { visits: 0, whatsapp_clicks: 0, cta_clicks: 0 };
    if (event.event_type === "visit") current.visits += 1;
    if (event.event_type === "whatsapp_click") current.whatsapp_clicks += 1;
    if (event.event_type === "cta_click") current.cta_clicks += 1;
    counters.set(event.site_id, current);
  }

  const siteIds = Array.from(counters.keys());
  const { data: sites } = siteIds.length
    ? await admin.from("sites").select("id, name, subdomain").in("id", siteIds)
    : { data: [] };

  const siteById = new Map((sites ?? []).map((site) => [site.id, site]));

  const rows = siteIds
    .map((siteId) => {
      const site = siteById.get(siteId);
      if (!site) return null;
      const counter = counters.get(siteId) ?? { visits: 0, whatsapp_clicks: 0, cta_clicks: 0 };
      const ctr = counter.visits ? Number(((counter.whatsapp_clicks / counter.visits) * 100).toFixed(2)) : 0;
      return {
        site_id: siteId,
        name: site.name,
        subdomain: site.subdomain,
        visits: counter.visits,
        whatsapp_clicks: counter.whatsapp_clicks,
        cta_clicks: counter.cta_clicks,
        ctr_whatsapp: ctr
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const totalVisits = rows.reduce((acc, row) => acc + row.visits, 0);
  const totalWhatsapp = rows.reduce((acc, row) => acc + row.whatsapp_clicks, 0);
  const totalCta = rows.reduce((acc, row) => acc + row.cta_clicks, 0);

  return {
    range: range.label as AdminTrafficMetrics["range"],
    from: fromIso,
    totals: {
      visits: totalVisits,
      whatsapp_clicks: totalWhatsapp,
      cta_clicks: totalCta,
      ctr_whatsapp: totalVisits ? Number(((totalWhatsapp / totalVisits) * 100).toFixed(2)) : 0
    },
    top_by_visits: [...rows].sort((a, b) => b.visits - a.visits).slice(0, 10),
    top_by_whatsapp: [...rows].sort((a, b) => b.whatsapp_clicks - a.whatsapp_clicks).slice(0, 10),
    low_conversion: [...rows]
      .filter((row) => row.visits >= 20 && row.ctr_whatsapp < 5)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10)
  };
}

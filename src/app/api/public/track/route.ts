import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getRequestClientKey } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSubdomainFromHost } from "@/lib/tenant";

const bodySchema = z.object({
  eventType: z.enum(["visit", "whatsapp_click", "cta_click"]),
  siteId: z.string().uuid().optional(),
  subdomain: z.string().min(1).optional(),
  pageSlug: z.string().min(1).max(120).default("/"),
  sectionId: z.string().max(120).optional(),
  clientId: z.string().uuid().optional(),
  meta: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: NextRequest) {
  const rate = enforceRateLimit({
    key: `public-track:${getRequestClientKey(request, null)}`,
    limit: 240,
    windowMs: 60_000
  });

  if (!rate.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const hostSubdomain = getSubdomainFromHost(request.headers.get("host"));
  const effectiveSubdomain = parsed.data.subdomain ?? hostSubdomain;
  if (!effectiveSubdomain) {
    return NextResponse.json({ error: "Subdomain not found" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: site } = await admin
    .from("sites")
    .select("id, subdomain, status")
    .eq("subdomain", effectiveSubdomain)
    .eq("status", "published")
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Published site not found" }, { status: 404 });
  }

  if (parsed.data.siteId && parsed.data.siteId !== site.id) {
    return NextResponse.json({ error: "Site mismatch" }, { status: 400 });
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") ?? "";

  const { error } = await admin.from("site_analytics_events").insert({
    site_id: site.id,
    subdomain: site.subdomain,
    event_type: parsed.data.eventType,
    page_slug: parsed.data.pageSlug,
    section_id: parsed.data.sectionId ?? null,
    client_id: parsed.data.clientId ?? null,
    meta_json: {
      ...(parsed.data.meta ?? {}),
      ip,
      userAgent
    }
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { recordPlatformEvent } from "@/lib/platform-events";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  action: z.enum(["suspend", "restore"])
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rate = enforceRateLimit({ key: `admin:site-moderate:${auth.user.id}`, limit: 20, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: site } = await admin
    .from("sites")
    .select("id, owner_id, status, subdomain")
    .eq("id", id)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const action = parsed.data.action;

  if (action === "suspend") {
    await admin.from("site_publications").update({ is_active: false }).eq("site_id", site.id);
    const { error: updateError } = await admin.from("sites").update({ status: "archived" }).eq("id", site.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await admin.from("events").insert({
      site_id: site.id,
      event_type: "admin.site.suspended",
      payload_json: { adminId: auth.user.id }
    });

    try {
      await recordPlatformEvent(admin, {
        eventType: "admin.site.suspended",
        userId: site.owner_id,
        siteId: site.id,
        payload: {
          adminId: auth.user.id,
          subdomain: site.subdomain
        }
      });
    } catch {
      // best effort
    }

    return NextResponse.json({ ok: true, status: "archived" });
  }

  const { data: latestPublication } = await admin
    .from("site_publications")
    .select("id")
    .eq("site_id", site.id)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPublication) {
    await admin.from("site_publications").update({ is_active: false }).eq("site_id", site.id);
    await admin.from("site_publications").update({ is_active: true }).eq("id", latestPublication.id);
  }

  const nextStatus = latestPublication ? "published" : "draft";
  const { error: restoreError } = await admin.from("sites").update({ status: nextStatus }).eq("id", site.id);
  if (restoreError) {
    return NextResponse.json({ error: restoreError.message }, { status: 400 });
  }

  await admin.from("events").insert({
    site_id: site.id,
    event_type: "admin.site.restored",
    payload_json: { adminId: auth.user.id, status: nextStatus }
  });

  try {
    await recordPlatformEvent(admin, {
      eventType: "admin.site.restored",
      userId: site.owner_id,
      siteId: site.id,
      payload: {
        adminId: auth.user.id,
        status: nextStatus,
        subdomain: site.subdomain
      }
    });
  } catch {
    // best effort
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}

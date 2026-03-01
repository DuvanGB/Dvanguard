import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { getUsageSnapshot } from "@/lib/billing/usage";
import { recordPlatformEvent } from "@/lib/platform-events";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  versionId: z.string().uuid().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();
  const admin = getSupabaseAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = bodySchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, current_version_id, status")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const versionId = parsedBody.data.versionId ?? site.current_version_id;

  if (!versionId) {
    return NextResponse.json({ error: "No version available for publish" }, { status: 400 });
  }

  const usage = await getUsageSnapshot(admin, user.id);
  const isNewPublication = site.status !== "published";

  if (isNewPublication && usage.published_sites_used >= usage.published_sites_limit) {
    try {
      await recordPlatformEvent(admin, {
        eventType: "plan.limit_hit.publish",
        userId: user.id,
        siteId: id,
        payload: {
          plan: usage.plan,
          used: usage.published_sites_used,
          limit: usage.published_sites_limit
        }
      });
    } catch {
      // best effort
    }

    return NextResponse.json(
      {
        error: "Has alcanzado el límite de sitios publicados de tu plan.",
        plan: usage.plan,
        published_sites_used: usage.published_sites_used,
        published_sites_limit: usage.published_sites_limit
      },
      { status: 402 }
    );
  }

  await supabase.from("site_publications").update({ is_active: false }).eq("site_id", id);

  const { data: publication, error } = await supabase
    .from("site_publications")
    .insert({
      site_id: id,
      version_id: versionId,
      is_active: true
    })
    .select("id, version_id, published_at")
    .maybeSingle();

  if (error || !publication) {
    return NextResponse.json({ error: error?.message ?? "Failed to publish" }, { status: 400 });
  }

  await supabase.from("sites").update({ status: "published", current_version_id: versionId }).eq("id", id);
  await supabase.from("events").insert({
    site_id: id,
    event_type: "site.published",
    payload_json: { versionId }
  });

  if (isNewPublication && usage.published_sites_used === 0) {
    try {
      await recordPlatformEvent(admin, {
        eventType: "site.first_published",
        userId: user.id,
        siteId: id,
        payload: { versionId }
      });
    } catch {
      // best effort
    }
  }

  return NextResponse.json({ publication });
}

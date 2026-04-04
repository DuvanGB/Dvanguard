import { NextResponse } from "next/server";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { recordPlatformEvent } from "@/lib/platform-events";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rate = enforceRateLimit({ key: `admin:site-delete:${auth.user.id}`, limit: 10, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const admin = getSupabaseAdminClient();
  const { data: site } = await admin
    .from("sites")
    .select("id, owner_id, name, subdomain")
    .eq("id", id)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  try {
    await recordPlatformEvent(admin, {
      eventType: "admin.site.deleted",
      userId: site.owner_id,
      siteId: site.id,
      payload: {
        adminId: auth.user.id,
        name: site.name,
        subdomain: site.subdomain
      }
    });
  } catch {
    // best effort
  }

  const { error: deleteError } = await admin.from("sites").delete().eq("id", site.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

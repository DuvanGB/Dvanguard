import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { purgeExpiredDeletedSites } from "@/lib/sites-trash";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();
  const admin = getSupabaseAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await purgeExpiredDeletedSites(admin, user.id);

  const { data: site } = await supabase
    .from("sites")
    .select("id, deleted_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found in trash" }, { status: 404 });
  }

  const { error } = await supabase
    .from("sites")
    .update({
      status: "draft",
      deleted_at: null
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabase.from("events").insert({
    site_id: id,
    event_type: "site.restored",
    payload_json: {}
  });

  return NextResponse.json({ restored: true });
}

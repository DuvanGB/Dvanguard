import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { purgeExpiredDeletedSites } from "@/lib/sites-trash";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const purgeBodySchema = z.object({
  confirmationName: z.string().min(1).max(120)
});

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();
  const admin = getSupabaseAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await purgeExpiredDeletedSites(admin, user.id);

  const body = await request.json().catch(() => ({}));
  const parsed = purgeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, deleted_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found in trash" }, { status: 404 });
  }

  if (parsed.data.confirmationName.trim() !== site.name.trim()) {
    return NextResponse.json({ error: "El nombre no coincide con el sitio." }, { status: 400 });
  }

  await supabase.from("events").insert({
    site_id: id,
    event_type: "site.purged",
    payload_json: {
      purgedAt: new Date().toISOString()
    }
  });

  const { error } = await supabase.from("sites").delete().eq("id", id).eq("owner_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ purged: true });
}

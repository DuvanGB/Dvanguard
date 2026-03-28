import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { purgeExpiredDeletedSites } from "@/lib/sites-trash";

const deleteBodySchema = z.object({
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
  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, deleted_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  if (parsed.data.confirmationName.trim() !== site.name.trim()) {
    return NextResponse.json({ error: "El nombre no coincide con el sitio." }, { status: 400 });
  }

  const deletedAt = new Date().toISOString();

  await supabase.from("site_publications").update({ is_active: false }).eq("site_id", id);

  const { error } = await supabase
    .from("sites")
    .update({
      status: "archived",
      deleted_at: deletedAt
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabase.from("events").insert({
    site_id: id,
    event_type: "site.soft_deleted",
    payload_json: {
      deletedAt
    }
  });

  return NextResponse.json({ deleted: true, deletedAt });
}

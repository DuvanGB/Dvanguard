import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id, assetId } = await params;
  const { user, supabase } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: asset } = await supabase
    .from("site_media_assets")
    .select("id, kind, storage_path")
    .eq("id", assetId)
    .eq("site_id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (asset.kind === "uploaded" && asset.storage_path) {
    const admin = getSupabaseAdminClient();
    await admin.storage.from("site-assets").remove([asset.storage_path]);
  }

  const { error } = await supabase
    .from("site_media_assets")
    .delete()
    .eq("id", assetId)
    .eq("site_id", id)
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

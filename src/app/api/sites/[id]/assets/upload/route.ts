import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE_BYTES = 6 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const altText = String(formData?.get("altText") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large. Max 6MB." }, { status: 400 });
  }

  const timestamp = Date.now();
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  const storagePath = `user/${user.id}/site/${id}/${timestamp}-${safeName}`;

  const admin = getSupabaseAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from("site-assets").upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: publicUrlData } = admin.storage.from("site-assets").getPublicUrl(storagePath);
  const publicUrl = publicUrlData.publicUrl;

  const { data: asset, error: insertError } = await supabase
    .from("site_media_assets")
    .insert({
      site_id: id,
      owner_id: user.id,
      kind: "uploaded",
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: file.type,
      size_bytes: file.size,
      alt_text: altText || null
    })
    .select("id, kind, storage_path, public_url, mime_type, size_bytes, alt_text, created_at")
    .maybeSingle();

  if (insertError || !asset) {
    await admin.storage.from("site-assets").remove([storagePath]);
    return NextResponse.json({ error: insertError?.message ?? "Failed to save asset metadata" }, { status: 400 });
  }

  return NextResponse.json({ asset }, { status: 201 });
}

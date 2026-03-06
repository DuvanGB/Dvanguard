import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";

const bodySchema = z.object({
  url: z.string().url(),
  altText: z.string().max(160).optional()
});

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

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { data: asset, error } = await supabase
    .from("site_media_assets")
    .insert({
      site_id: id,
      owner_id: user.id,
      kind: "external",
      public_url: parsed.data.url,
      alt_text: parsed.data.altText?.trim() || null
    })
    .select("id, kind, storage_path, public_url, mime_type, size_bytes, alt_text, created_at")
    .maybeSingle();

  if (error || !asset) {
    return NextResponse.json({ error: error?.message ?? "Failed to save external asset" }, { status: 400 });
  }

  return NextResponse.json({ asset }, { status: 201 });
}

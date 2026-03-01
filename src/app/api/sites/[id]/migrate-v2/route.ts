import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { ensureSiteCurrentVersionV2 } from "@/lib/site-spec-migration";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ensureSiteCurrentVersionV2({
      supabase,
      admin: getSupabaseAdminClient(),
      siteId: id,
      ownerId: user.id
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.reason === "forbidden" ? 403 : 404 });
    }

    return NextResponse.json({
      migrated: result.migrated,
      versionId: result.versionId,
      siteSpec: result.siteSpec
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

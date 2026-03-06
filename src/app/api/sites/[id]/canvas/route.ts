import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { getOwnedSiteWithCurrentSpec } from "@/lib/canvas/store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getOwnedSiteWithCurrentSpec({
    supabase,
    siteId: id,
    userId: user.id
  });

  if (!result) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({
    siteId: result.site.id,
    currentVersionId: result.site.current_version_id,
    spec: result.spec
  });
}

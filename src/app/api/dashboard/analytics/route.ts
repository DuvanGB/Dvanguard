import { NextRequest, NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { getOwnerSiteAnalytics } from "@/lib/data/dashboard/analytics";

export async function GET(request: NextRequest) {
  const { user } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteId = request.nextUrl.searchParams.get("siteId");
  const range = request.nextUrl.searchParams.get("range");

  const result = await getOwnerSiteAnalytics({
    ownerId: user.id,
    siteId,
    range
  });

  return NextResponse.json(result);
}

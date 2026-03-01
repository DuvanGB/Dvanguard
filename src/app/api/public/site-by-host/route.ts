import { NextRequest, NextResponse } from "next/server";

import { getPublishedSiteBySubdomain } from "@/lib/data/public-site";
import { getSubdomainFromHost } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const hostFromQuery = request.nextUrl.searchParams.get("host");
  const host = hostFromQuery ?? request.headers.get("host");

  const subdomain = getSubdomainFromHost(host);
  if (!subdomain) {
    return NextResponse.json({ error: "No tenant subdomain found" }, { status: 400 });
  }

  const payload = await getPublishedSiteBySubdomain(subdomain);

  if (!payload) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}

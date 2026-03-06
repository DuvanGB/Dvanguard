import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { getAdminTrafficMetrics } from "@/lib/data/admin/traffic-metrics";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const range = request.nextUrl.searchParams.get("range");
  const metrics = await getAdminTrafficMetrics(range);

  return NextResponse.json(metrics);
}

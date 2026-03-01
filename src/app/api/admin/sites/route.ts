import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { listAdminSites } from "@/lib/data/admin/sites";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;

  const result = await listAdminSites({
    status: params.get("status"),
    type: params.get("type"),
    owner: params.get("owner"),
    page: params.get("page"),
    pageSize: params.get("pageSize")
  });

  return NextResponse.json(result);
}

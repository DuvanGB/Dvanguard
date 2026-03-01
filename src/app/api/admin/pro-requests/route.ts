import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { listAdminProRequests } from "@/lib/data/admin/pro-requests";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;

  const result = await listAdminProRequests({
    status: params.get("status"),
    page: params.get("page"),
    pageSize: params.get("pageSize")
  });

  return NextResponse.json(result);
}

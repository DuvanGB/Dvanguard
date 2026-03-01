import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { listAdminUsers } from "@/lib/data/admin/users";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;

  const result = await listAdminUsers({
    search: params.get("search"),
    page: params.get("page"),
    pageSize: params.get("pageSize")
  });

  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { listAdminAiJobs } from "@/lib/data/admin/ai-jobs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;

  const result = await listAdminAiJobs({
    status: params.get("status"),
    siteId: params.get("siteId"),
    userId: params.get("userId"),
    from: params.get("from"),
    to: params.get("to"),
    page: params.get("page"),
    pageSize: params.get("pageSize")
  });

  return NextResponse.json(result);
}

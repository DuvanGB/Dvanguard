import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { getUsageSnapshot } from "@/lib/billing/usage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const { user } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const usage = await getUsageSnapshot(admin, user.id);

  return NextResponse.json(usage);
}

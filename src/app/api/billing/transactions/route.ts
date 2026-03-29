import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { listBillingTransactions } from "@/lib/billing/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const transactions = await listBillingTransactions(admin, user.id);
  return NextResponse.json({ transactions });
}

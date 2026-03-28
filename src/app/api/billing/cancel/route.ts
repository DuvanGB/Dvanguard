import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { cancelBillingSubscription } from "@/lib/billing/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST() {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  await cancelBillingSubscription(admin, user.id);
  return NextResponse.json({ ok: true });
}

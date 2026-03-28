import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { createSetupIntent } from "@/lib/billing/subscription";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST() {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const admin = getSupabaseAdminClient();
  const setupIntent = await createSetupIntent(admin, { userId: user.id, email: user.email ?? null });
  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}

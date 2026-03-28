import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/billing/subscription";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  interval: z.enum(["month", "year"])
});

export async function POST(request: Request) {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const session = await createCheckoutSession(admin, {
    userId: user.id,
    email: user.email ?? null,
    interval: parsed.data.interval,
    successUrl: `${env.appUrl}/billing?checkout=success`,
    cancelUrl: `${env.appUrl}/billing?checkout=cancelled`
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
}

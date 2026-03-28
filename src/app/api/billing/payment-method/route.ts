import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { setDefaultPaymentMethod } from "@/lib/billing/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  paymentMethodId: z.string().min(1)
});

export async function POST(request: Request) {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  await setDefaultPaymentMethod(admin, { userId: user.id, paymentMethodId: parsed.data.paymentMethodId });
  return NextResponse.json({ ok: true });
}

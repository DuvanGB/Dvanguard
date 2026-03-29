import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { acceptBillingLegalTerms } from "@/lib/billing/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true)
});

export async function POST(request: Request) {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Debes aceptar términos y privacidad." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const legal = await acceptBillingLegalTerms(admin, user.id);
  return NextResponse.json({ ok: true, legal });
}

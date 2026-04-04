import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { createManualCheckoutViaPaymentLink } from "@/lib/billing/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  method: z.enum(["pse", "nequi", "bank_transfer"])
});

export async function POST(request: Request) {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  try {
    const result = await createManualCheckoutViaPaymentLink(admin, {
      userId: user.id,
      email: user.email ?? "",
      method: parsed.data.method
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar el pago manual" },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { removeStoredCardPaymentMethod, updateStoredCardPaymentMethod } from "@/lib/billing/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  token: z.string().min(8)
});

export async function POST(request: NextRequest) {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdminClient();
    const result = await updateStoredCardPaymentMethod(admin, {
      userId: user.id,
      email: user.email ?? "",
      token: parsed.data.token
    });

    return NextResponse.json({
      ok: true,
      paymentMethod: result.paymentMethod
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la tarjeta guardada" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdminClient();
    const result = await removeStoredCardPaymentMethod(admin, user.id);

    return NextResponse.json({
      ok: true,
      renewalCanceled: result.renewalCanceled,
      removedScheduledSwitch: result.removedScheduledSwitch
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar la tarjeta guardada" },
      { status: 400 }
    );
  }
}

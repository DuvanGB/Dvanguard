import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { switchManualMembershipToCard } from "@/lib/billing/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  token: z.string().min(1)
});

export async function POST(request: Request) {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  try {
    const result = await switchManualMembershipToCard(admin, {
      userId: user.id,
      email: user.email ?? "",
      token: parsed.data.token
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo programar el cambio a tarjeta" },
      { status: 400 }
    );
  }
}

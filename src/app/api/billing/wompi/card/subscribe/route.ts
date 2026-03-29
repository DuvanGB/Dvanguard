import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { subscribeUserWithCard } from "@/lib/billing/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  token: z.string().min(1),
  interval: z.enum(["month", "year"]),
  cardholderName: z.string().min(2).max(120).optional(),
  phoneNumber: z.string().min(7).max(32).optional()
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

  const forwardedFor = (await headers()).get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? null;
  const admin = getSupabaseAdminClient();

  try {
    const result = await subscribeUserWithCard(admin, {
      userId: user.id,
      email: user.email ?? "",
      interval: parsed.data.interval,
      token: parsed.data.token,
      cardholderName: parsed.data.cardholderName ?? null,
      phoneNumber: parsed.data.phoneNumber ?? null,
      ipAddress
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la tarjeta" },
      { status: 400 }
    );
  }
}

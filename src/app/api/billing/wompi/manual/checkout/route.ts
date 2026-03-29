import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { createManualBillingCheckout } from "@/lib/billing/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  method: z.enum(["pse", "nequi", "bank_transfer"]),
  customerName: z.string().min(2).max(120).optional(),
  phoneNumber: z.string().min(7).max(32).optional(),
  legalIdType: z.string().min(2).max(8).optional(),
  legalId: z.string().min(4).max(32).optional(),
  userType: z.number().int().min(0).max(1).optional(),
  financialInstitutionCode: z.string().min(1).max(16).optional()
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
    const result = await createManualBillingCheckout(admin, {
      userId: user.id,
      email: user.email ?? "",
      method: parsed.data.method,
      customerName: parsed.data.customerName ?? null,
      phoneNumber: parsed.data.phoneNumber ?? null,
      legalIdType: parsed.data.legalIdType ?? null,
      legalId: parsed.data.legalId ?? null,
      userType: parsed.data.userType ?? null,
      financialInstitutionCode: parsed.data.financialInstitutionCode ?? null,
      ipAddress
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar el pago manual" },
      { status: 400 }
    );
  }
}

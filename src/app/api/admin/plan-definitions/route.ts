import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { listPlanDefinitions, upsertPlanDefinition } from "@/lib/billing/plans";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  code: z.enum(["free", "pro"]),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  bullets: z.array(z.string()).optional(),
  monthlyPriceCents: z.number().nullable().optional(),
  yearlyPriceCents: z.number().nullable().optional(),
  ctaLabel: z.string().nullable().optional(),
  maxAiGenerationsPerMonth: z.number().int().nonnegative().optional(),
  maxPublishedSites: z.number().int().nonnegative().optional()
});

export async function GET() {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdminClient();
  const plans = await listPlanDefinitions(admin);
  return NextResponse.json({ plans });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rate = enforceRateLimit({ key: `admin:plan-defs:${auth.user.id}`, limit: 20, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido.", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  await upsertPlanDefinition(admin, parsed.data);
  return NextResponse.json({ ok: true });
}

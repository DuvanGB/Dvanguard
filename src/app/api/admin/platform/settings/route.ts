import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { listPlatformSettings, upsertPlatformSetting } from "@/lib/platform-config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  description: z.string().nullable().optional(),
  countryCode: z.string().trim().min(2).nullable().optional(),
  localeCode: z.string().trim().min(2).nullable().optional()
});

export async function GET() {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdminClient();
  const settings = await listPlatformSettings(admin);
  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido.", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  await upsertPlatformSetting(admin, {
    key: parsed.data.key,
    value: parsed.data.value,
    description: parsed.data.description ?? null,
    countryCode: parsed.data.countryCode ?? undefined,
    localeCode: parsed.data.localeCode ?? undefined
  });

  return NextResponse.json({ ok: true });
}

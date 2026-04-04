import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { publishLegalDocumentVersion } from "@/lib/legal-documents";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  versionId: z.string().uuid()
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rate = enforceRateLimit({ key: `admin:legal-publish:${auth.user.id}`, limit: 10, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido.", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  await publishLegalDocumentVersion(admin, parsed.data.versionId);
  return NextResponse.json({ ok: true });
}

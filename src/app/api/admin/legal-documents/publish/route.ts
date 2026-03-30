import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { publishLegalDocumentVersion } from "@/lib/legal-documents";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  versionId: z.string().uuid()
});

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
  await publishLegalDocumentVersion(admin, parsed.data.versionId);
  return NextResponse.json({ ok: true });
}

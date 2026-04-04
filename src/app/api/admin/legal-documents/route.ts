import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { createLegalDocumentVersion, listLegalDocumentsWithVersions } from "@/lib/legal-documents";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  slug: z.enum(["terms", "privacy"]),
  versionLabel: z.string().min(1),
  title: z.string().min(1),
  bodyMarkdown: z.string().min(1),
  countryCode: z.string().trim().min(2).nullable().optional(),
  localeCode: z.string().trim().min(2).nullable().optional()
});

export async function GET() {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdminClient();
  const result = await listLegalDocumentsWithVersions(admin);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rate = enforceRateLimit({ key: `admin:legal-docs:${auth.user.id}`, limit: 20, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido.", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  await createLegalDocumentVersion(admin, parsed.data);
  return NextResponse.json({ ok: true });
}

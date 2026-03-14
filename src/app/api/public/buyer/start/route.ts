import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().email(),
  next: z.string().optional()
});

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const nextPath = sanitizeNext(parsed.data.next);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        user_type: "buyer"
      }
    }
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

function sanitizeNext(value?: string) {
  if (!value || typeof value !== "string") return "/";
  if (!value.startsWith("/")) return "/";
  return value;
}

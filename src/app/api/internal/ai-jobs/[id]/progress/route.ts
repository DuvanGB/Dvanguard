import { NextRequest, NextResponse } from "next/server";

import { applyVisualGenerationProgress } from "@/lib/ai/process-site-generation";
import { visualGenerationProgressSchema } from "@/lib/ai/visual-generation";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const secret = request.headers.get("x-worker-secret");

  if (!env.aiWorkerSharedSecret || secret !== env.aiWorkerSharedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = visualGenerationProgressSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  await applyVisualGenerationProgress({
    supabase: admin,
    jobId: id,
    ...parsed.data
  });

  return NextResponse.json({ ok: true });
}


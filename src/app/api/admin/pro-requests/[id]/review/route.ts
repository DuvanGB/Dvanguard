import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { reviewProRequest } from "@/lib/billing/requests";
import { recordPlatformEvent } from "@/lib/platform-events";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  decision: z.enum(["approved", "rejected"])
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAdminApiUser();

  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  try {
    const requestRow = await reviewProRequest(admin, {
      requestId: id,
      adminId: auth.user.id,
      decision: parsed.data.decision
    });

    if (parsed.data.decision === "approved") {
      await recordPlatformEvent(admin, {
        eventType: "pro.approved",
        userId: requestRow.user_id,
        payload: { approvedBy: auth.user.id, requestId: requestRow.id }
      });
    }

    return NextResponse.json({ ok: true, request: requestRow, decision: parsed.data.decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to review request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

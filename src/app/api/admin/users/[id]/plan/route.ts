import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiUser } from "@/lib/admin-auth";
import { assignUserPlan } from "@/lib/billing/requests";
import { recordPlatformEvent } from "@/lib/platform-events";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  planCode: z.enum(["free", "pro"])
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
    await assignUserPlan(admin, {
      userId: id,
      planCode: parsed.data.planCode,
      assignedBy: auth.user.id
    });

    if (parsed.data.planCode === "pro") {
      await recordPlatformEvent(admin, {
        eventType: "pro.approved",
        userId: id,
        payload: { approvedBy: auth.user.id }
      });
    }

    return NextResponse.json({ ok: true, planCode: parsed.data.planCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to change plan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { createProRequest } from "@/lib/billing/requests";
import { getUsageSnapshot } from "@/lib/billing/usage";
import { recordPlatformEvent } from "@/lib/platform-events";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST() {
  const { user } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  try {
    const usage = await getUsageSnapshot(admin, user.id);
    if (usage.plan === "pro") {
      return NextResponse.json({ error: "Tu cuenta ya está en plan Pro." }, { status: 400 });
    }

    const result = await createProRequest(admin, user.id);

    if (result.created) {
      await recordPlatformEvent(admin, {
        eventType: "pro.requested",
        userId: user.id,
        payload: { requestId: result.request.id }
      });
    }

    return NextResponse.json({
      request: result.request,
      created: result.created
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

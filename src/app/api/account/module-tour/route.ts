import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";

const moduleSchema = z.enum(["dashboard", "onboarding", "editor"]);

const postSchema = z.object({
  module: moduleSchema,
  status: z.enum(["completed", "dismissed"])
});

export async function GET(request: NextRequest) {
  const { user, supabase } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const module = moduleSchema.safeParse(request.nextUrl.searchParams.get("module"));
  if (!module.success) {
    return NextResponse.json({ error: "Invalid module" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_module_tours")
    .select("module, completed, dismissed, last_seen_at")
    .eq("user_id", user.id)
    .eq("module", module.data)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    module: module.data,
    status: data
      ? {
          completed: Boolean(data.completed),
          dismissed: Boolean(data.dismissed),
          lastSeenAt: data.last_seen_at
        }
      : null
  });
}

export async function POST(request: NextRequest) {
  const { user, supabase } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const nextState =
    parsed.data.status === "completed"
      ? { completed: true, dismissed: false }
      : { completed: false, dismissed: true };

  const { data, error } = await supabase
    .from("user_module_tours")
    .upsert(
      {
        user_id: user.id,
        module: parsed.data.module,
        ...nextState,
        last_seen_at: new Date().toISOString()
      },
      { onConflict: "user_id,module" }
    )
    .select("module, completed, dismissed, last_seen_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "No se pudo actualizar el tour" }, { status: 400 });
  }

  return NextResponse.json({
    module: data.module,
    status: {
      completed: Boolean(data.completed),
      dismissed: Boolean(data.dismissed),
      lastSeenAt: data.last_seen_at
    }
  });
}

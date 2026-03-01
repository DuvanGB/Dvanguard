import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordPlatformEvent(
  admin: SupabaseClient,
  input: {
    eventType: string;
    userId?: string | null;
    siteId?: string | null;
    payload?: Record<string, unknown>;
  }
) {
  const { error } = await admin.from("platform_events").insert({
    event_type: input.eventType,
    user_id: input.userId ?? null,
    site_id: input.siteId ?? null,
    payload_json: input.payload ?? {}
  });

  if (error) {
    throw new Error(error.message);
  }
}

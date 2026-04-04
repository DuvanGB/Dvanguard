import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlanCode } from "@/lib/billing/types";

export async function assignUserPlan(admin: SupabaseClient, input: { userId: string; planCode: PlanCode; assignedBy: string }) {
  const { error } = await admin.from("user_plans").upsert(
    {
      user_id: input.userId,
      plan_code: input.planCode,
      assigned_by: input.assignedBy,
      assigned_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

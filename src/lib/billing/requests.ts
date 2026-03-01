import type { SupabaseClient } from "@supabase/supabase-js";

import { PRO_PLAN } from "@/lib/billing/plans";
import type { PlanCode, ProRequestStatus } from "@/lib/billing/types";

export async function createProRequest(admin: SupabaseClient, userId: string) {
  const { data: existing } = await admin
    .from("pro_requests")
    .select("id, status, created_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { request: existing, created: false };
  }

  const { data: request, error } = await admin
    .from("pro_requests")
    .insert({ user_id: userId, status: "pending" })
    .select("id, status, created_at")
    .maybeSingle();

  if (error || !request) {
    throw new Error(error?.message ?? "Failed to create pro request");
  }

  return { request, created: true };
}

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

export async function reviewProRequest(
  admin: SupabaseClient,
  input: {
    requestId: string;
    adminId: string;
    decision: ProRequestStatus;
  }
) {
  const { data: request, error: requestError } = await admin
    .from("pro_requests")
    .select("id, user_id, status")
    .eq("id", input.requestId)
    .maybeSingle();

  if (requestError || !request) {
    throw new Error(requestError?.message ?? "Request not found");
  }

  if (request.status !== "pending") {
    throw new Error("Request has already been reviewed");
  }

  const { error: updateError } = await admin
    .from("pro_requests")
    .update({
      status: input.decision,
      reviewed_by: input.adminId,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", input.requestId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (input.decision === "approved") {
    await assignUserPlan(admin, {
      userId: request.user_id,
      planCode: PRO_PLAN,
      assignedBy: input.adminId
    });
  }

  return request;
}

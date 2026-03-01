import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: job } = await supabase
    .from("ai_jobs")
    .select("id, site_id, status, output_json, error, created_by")
    .eq("id", id)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    output: job.output_json,
    error: job.error
  });
}

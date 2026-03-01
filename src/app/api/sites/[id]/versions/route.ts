import { NextResponse } from "next/server";
import { z } from "zod";

import { maybeRecordFirstResultAccepted } from "@/lib/ai/start-site-generation";
import { requireApiUser } from "@/lib/auth";
import { parseSiteSpec } from "@/lib/site-spec";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  siteSpec: z.unknown()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsedSpec = parseSiteSpec(parsedBody.data.siteSpec);
  if (!parsedSpec.success) {
    return NextResponse.json({ error: "Invalid SiteSpec", issues: parsedSpec.error.issues }, { status: 400 });
  }

  const { data: site } = await supabase.from("sites").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { data: latestVersion } = await supabase
    .from("site_versions")
    .select("version")
    .eq("site_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  const { data: version, error } = await supabase
    .from("site_versions")
    .insert({
      site_id: id,
      version: nextVersion,
      site_spec_json: parsedSpec.data,
      source: "manual"
    })
    .select("id")
    .maybeSingle();

  if (error || !version) {
    return NextResponse.json({ error: error?.message ?? "Failed to save version" }, { status: 400 });
  }

  await supabase.from("sites").update({ current_version_id: version.id }).eq("id", id);

  await supabase.from("events").insert({
    site_id: id,
    event_type: "site.version.saved",
    payload_json: { versionId: version.id }
  });

  try {
    await maybeRecordFirstResultAccepted({
      admin: getSupabaseAdminClient(),
      userId: user.id,
      siteId: id,
      action: "manual_save"
    });
  } catch {
    // best effort
  }

  return NextResponse.json({ versionId: version.id }, { status: 201 });
}

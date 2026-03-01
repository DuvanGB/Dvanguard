import { NextResponse } from "next/server";
import { z } from "zod";

import { maybeRecordFirstResultAccepted } from "@/lib/ai/start-site-generation";
import { requireApiUser } from "@/lib/auth";
import { parseAnySiteSpec } from "@/lib/site-spec-any";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { recordPlatformEvent } from "@/lib/platform-events";

const bodySchema = z.object({
  siteSpec: z.unknown()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();
  const admin = getSupabaseAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsedSpec = parseAnySiteSpec(parsedBody.data.siteSpec);
  if (!parsedSpec.success) {
    return NextResponse.json({ error: "Invalid SiteSpec", issues: parsedSpec.error }, { status: 400 });
  }

  const normalizedSpec = parsedSpec.data;

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

  let previousSpec: unknown = null;
  if (latestVersion?.version) {
    const { data: previousVersion } = await supabase
      .from("site_versions")
      .select("site_spec_json")
      .eq("site_id", id)
      .eq("version", latestVersion.version)
      .maybeSingle();
    if (previousVersion?.site_spec_json) {
      previousSpec = previousVersion.site_spec_json;
    }
  }

  const { data: version, error } = await supabase
    .from("site_versions")
    .insert({
      site_id: id,
      version: nextVersion,
      site_spec_json: normalizedSpec,
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
    await recordPlatformEvent(admin, {
      eventType: "editor.content.saved",
      userId: user.id,
      siteId: id,
      payload: {
        versionId: version.id,
        schemaVersion: normalizedSpec.schema_version,
        templateId: normalizedSpec.schema_version === "2.0" ? normalizedSpec.template.id : null
      }
    });
  } catch {
    // best effort
  }

  if (normalizedSpec.schema_version === "2.0" && previousSpec) {
    const parsedPrev = parseAnySiteSpec(previousSpec);
    if (parsedPrev.success && parsedPrev.data.schema_version === "2.0") {
      const currentSections = normalizedSpec.pages[0]?.sections ?? [];
      const previousSections = parsedPrev.data.pages[0]?.sections ?? [];

      for (const section of currentSections) {
        const prevSection = previousSections.find((item) => item.id === section.id && item.type === section.type);
        if (!prevSection) continue;

        if (section.variant !== prevSection.variant) {
          try {
            await recordPlatformEvent(admin, {
              eventType: "editor.section.variant_changed",
              userId: user.id,
              siteId: id,
              payload: {
                sectionId: section.id,
                sectionType: section.type,
                fromVariant: prevSection.variant,
                toVariant: section.variant
              }
            });
          } catch {
            // best effort
          }
        }
      }
    }
  }

  try {
    await maybeRecordFirstResultAccepted({
      admin,
      userId: user.id,
      siteId: id,
      action: "manual_save"
    });
  } catch {
    // best effort
  }

  return NextResponse.json({ versionId: version.id }, { status: 201 });
}

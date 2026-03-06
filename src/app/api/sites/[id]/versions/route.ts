import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import { maybeRecordFirstResultAccepted } from "@/lib/ai/start-site-generation";
import { requireApiUser } from "@/lib/auth";
import { parseAnySiteSpec } from "@/lib/site-spec-any";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { recordPlatformEvent } from "@/lib/platform-events";

const bodySchema = z.object({
  siteSpec: z.unknown(),
  source: z.enum(["manual", "auto_save", "manual_checkpoint"]).optional()
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
  const source = parsedBody.data.source ?? "manual";
  const contentHash = hashSpec(normalizedSpec);

  const { data: site } = await supabase.from("sites").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { data: latestVersion } = await supabase
    .from("site_versions")
    .select("id, version, content_hash, site_spec_json")
    .eq("site_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  let previousSpec: unknown = latestVersion?.site_spec_json ?? null;
  const previousHash =
    latestVersion?.content_hash ??
    (latestVersion?.site_spec_json ? hashSpec(latestVersion.site_spec_json) : null);

  if (previousHash && previousHash === contentHash && latestVersion?.id) {
    await supabase.from("sites").update({ current_version_id: latestVersion.id }).eq("id", id);
    return NextResponse.json({ versionId: latestVersion.id, deduped: true }, { status: 200 });
  }

  const { data: version, error } = await supabase
    .from("site_versions")
    .insert({
      site_id: id,
      version: nextVersion,
      site_spec_json: normalizedSpec,
      source,
      content_hash: contentHash
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
    payload_json: { versionId: version.id, source, deduped: false }
  });

  try {
    await recordPlatformEvent(admin, {
      eventType: "editor.content.saved",
      userId: user.id,
      siteId: id,
      payload: {
        versionId: version.id,
        schemaVersion: normalizedSpec.schema_version,
        templateId: normalizedSpec.schema_version === "2.0" ? normalizedSpec.template.id : null,
        source
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

  if (source !== "auto_save") {
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
  }

  return NextResponse.json({ versionId: version.id }, { status: 201 });
}

function hashSpec(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { getRequestClientKey } from "@/lib/http";
import { logError, logInfo } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildFallbackSiteSpec } from "@/lib/site-spec";

const bodySchema = z.object({
  name: z.string().min(2).max(80),
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  siteType: z.enum(["informative", "commerce_lite"]).default("informative")
});

export async function POST(request: NextRequest) {
  const { user, supabase } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = enforceRateLimit({
    key: `sites:create:${getRequestClientKey(request, user.id)}`,
    limit: 20,
    windowMs: 60_000
  });

  if (!rate.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const body = await request.json();
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsedBody.error.issues }, { status: 400 });
  }

  const { name, subdomain, siteType } = parsedBody.data;

  // Ensure profile exists for users created before the profile trigger/migrations.
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? ""
    },
    { onConflict: "id" }
  );

  if (profileError) {
    logError("ensure_profile_failed", { userId: user.id, error: profileError.message });
    return NextResponse.json(
      {
        error: "No se pudo crear/verificar perfil del usuario. Ejecuta migraciones y reintenta.",
        details: profileError.message
      },
      { status: 400 }
    );
  }

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .insert({
      owner_id: user.id,
      name,
      subdomain,
      site_type: siteType,
      status: "draft"
    })
    .select("id, owner_id, name, subdomain, site_type, status")
    .maybeSingle();

  if (siteError || !site) {
    logError("create_site_failed", { userId: user.id, error: siteError?.message });
    return NextResponse.json({ error: siteError?.message ?? "Failed to create site" }, { status: 400 });
  }

  const initialSpec = buildFallbackSiteSpec(name);

  const { data: version, error: versionError } = await supabase
    .from("site_versions")
    .insert({
      site_id: site.id,
      version: 1,
      site_spec_json: initialSpec,
      source: "manual"
    })
    .select("id")
    .maybeSingle();

  if (versionError || !version) {
    logError("create_site_version_failed", { siteId: site.id, error: versionError?.message });
    return NextResponse.json({ error: versionError?.message ?? "Failed to create initial version" }, { status: 400 });
  }

  await supabase.from("sites").update({ current_version_id: version.id }).eq("id", site.id);

  logInfo("site_created", { siteId: site.id, userId: user.id });

  return NextResponse.json({ site, currentVersionId: version.id }, { status: 201 });
}

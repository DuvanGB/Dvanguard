import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { verifyDomainOnVercel } from "@/lib/vercel-domains";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; domainId: string }> }) {
  const { id, domainId } = await params;
  const { user, supabase } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: site } = await supabase.from("sites").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { data: domain } = await supabase
    .from("site_domains")
    .select("id, hostname, status")
    .eq("id", domainId)
    .eq("site_id", id)
    .neq("status", "removed")
    .maybeSingle();

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  try {
    const snapshot = await verifyDomainOnVercel(domain.hostname);
    const nextStatus = snapshot.domain?.verified ? "active" : snapshot.config?.misconfigured ? "failed" : "verifying";

    const { data: updated, error } = await supabase
      .from("site_domains")
      .update({
        status: nextStatus,
        verification_json: {
          domain: snapshot.domain,
          config: snapshot.config
        },
        verified_at: nextStatus === "active" ? new Date().toISOString() : null
      })
      .eq("id", domainId)
      .select("id, site_id, hostname, status, verification_json, is_primary, created_at, verified_at")
      .maybeSingle();

    if (error || !updated) {
      return NextResponse.json({ error: error?.message ?? "No se pudo actualizar el dominio" }, { status: 400 });
    }

    return NextResponse.json({ domain: updated });
  } catch (error) {
    await supabase
      .from("site_domains")
      .update({
        status: "failed",
        verification_json: { error: error instanceof Error ? error.message : "Unknown error" }
      })
      .eq("id", domainId);

    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo verificar el dominio" }, { status: 400 });
  }
}

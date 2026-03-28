import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string; domainId: string }> }) {
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
    .select("id")
    .eq("id", domainId)
    .eq("site_id", id)
    .neq("status", "removed")
    .maybeSingle();

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const resetResult = await supabase.from("site_domains").update({ is_primary: false }).eq("site_id", id).neq("status", "removed");
  if (resetResult.error) {
    return NextResponse.json({ error: resetResult.error.message }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("site_domains")
    .update({ is_primary: true })
    .eq("id", domainId)
    .select("id, site_id, hostname, status, verification_json, is_primary, created_at, verified_at")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? "No se pudo marcar el dominio primario" }, { status: 400 });
  }

  return NextResponse.json({ domain: updated });
}

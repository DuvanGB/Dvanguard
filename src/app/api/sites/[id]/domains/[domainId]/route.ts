import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { removeDomainFromVercel } from "@/lib/vercel-domains";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; domainId: string }> }) {
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
    .select("id, hostname, is_primary")
    .eq("id", domainId)
    .eq("site_id", id)
    .neq("status", "removed")
    .maybeSingle();

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  try {
    await removeDomainFromVercel(domain.hostname);
  } catch {
    // best effort: seguimos con la baja local para no bloquear al usuario
  }

  const { error } = await supabase
    .from("site_domains")
    .update({
      status: "removed",
      is_primary: false,
      verification_json: { removed_at: new Date().toISOString() }
    })
    .eq("id", domainId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (domain.is_primary) {
    const { data: fallback } = await supabase
      .from("site_domains")
      .select("id")
      .eq("site_id", id)
      .neq("status", "removed")
      .order("status", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fallback?.id) {
      await supabase.from("site_domains").update({ is_primary: true }).eq("id", fallback.id);
    }
  }

  return NextResponse.json({ ok: true });
}

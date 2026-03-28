import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { normalizeHostname, isValidHostname, type SiteDomainRecord } from "@/lib/site-domains";
import { registerDomainOnVercel } from "@/lib/vercel-domains";

const bodySchema = z.object({
  hostname: z.string().min(3).max(253)
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: site } = await supabase.from("sites").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("site_domains")
    .select("id, site_id, hostname, status, verification_json, is_primary, created_at, verified_at")
    .eq("site_id", id)
    .neq("status", "removed")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ domains: (data ?? []) as SiteDomainRecord[] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: site } = await supabase.from("sites").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const hostname = normalizeHostname(parsed.data.hostname);
  if (!isValidHostname(hostname)) {
    return NextResponse.json({ error: "Hostname inválido" }, { status: 400 });
  }

  const { data: existingDomains } = await supabase
    .from("site_domains")
    .select("id")
    .eq("site_id", id)
    .neq("status", "removed")
    .limit(1);

  const { data: inserted, error: insertError } = await supabase
    .from("site_domains")
    .insert({
      site_id: id,
      hostname,
      status: "pending",
      is_primary: !(existingDomains?.length ?? 0)
    })
    .select("id, site_id, hostname, status, verification_json, is_primary, created_at, verified_at")
    .maybeSingle();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? "No se pudo registrar el dominio" }, { status: 400 });
  }

  try {
    const snapshot = await registerDomainOnVercel(hostname);
    const nextStatus = resolveDomainStatus(snapshot.domain?.verified, snapshot.config?.misconfigured === true);

    const { data: updated, error: updateError } = await supabase
      .from("site_domains")
      .update({
        status: nextStatus,
        verification_json: {
          domain: snapshot.domain,
          config: snapshot.config,
          recommended_www: suggestWwwDomain(hostname)
        },
        verified_at: nextStatus === "active" ? new Date().toISOString() : null
      })
      .eq("id", inserted.id)
      .select("id, site_id, hostname, status, verification_json, is_primary, created_at, verified_at")
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message ?? "No se pudo actualizar el dominio" }, { status: 400 });
    }

    return NextResponse.json({ domain: updated }, { status: 201 });
  } catch (error) {
    await supabase
      .from("site_domains")
      .update({
        status: "failed",
        verification_json: { error: error instanceof Error ? error.message : "Unknown error" }
      })
      .eq("id", inserted.id);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo sincronizar el dominio con Vercel" },
      { status: 400 }
    );
  }
}

function resolveDomainStatus(verified: boolean | undefined, misconfigured: boolean) {
  if (verified) return "active";
  if (misconfigured) return "failed";
  return "verifying";
}

function suggestWwwDomain(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length === 2) {
    return `www.${hostname}`;
  }
  return null;
}

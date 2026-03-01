import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteEditor } from "@/components/editor/site-editor";
import { requireUser } from "@/lib/auth";
import { buildSiteSpecV2FromTemplate } from "@/lib/site-spec-v2";
import { ensureSiteCurrentVersionV2 } from "@/lib/site-spec-migration";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function SiteEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, subdomain, site_type, current_version_id")
    .eq("id", id)
    .maybeSingle();

  if (!site) {
    notFound();
  }

  const migrated = await ensureSiteCurrentVersionV2({
    supabase,
    admin: getSupabaseAdminClient(),
    siteId: site.id,
    fallbackSiteName: site.name
  });

  const siteSpec = migrated.ok
    ? migrated.siteSpec
    : buildSiteSpecV2FromTemplate({
        siteType: site.site_type,
        businessName: site.name
      });

  return (
    <main className="container stack" style={{ paddingTop: "2rem" }}>
      <header className="stack">
        <h1>{site.name}</h1>
        <p>Subdominio: {site.subdomain}</p>
        <Link href="/dashboard" className="btn-secondary">
          Volver al dashboard
        </Link>
      </header>

      <SiteEditor siteId={site.id} initialSpec={siteSpec} />
    </main>
  );
}

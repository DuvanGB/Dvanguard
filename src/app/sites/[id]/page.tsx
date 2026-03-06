import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteEditor } from "@/components/editor/site-editor";
import { requireUser } from "@/lib/auth";
import { parseSiteSpecV3, buildSiteSpecV3FromBrief, type SiteSpecV3 } from "@/lib/site-spec-v3";
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

  const admin = getSupabaseAdminClient();
  let initialSpec: SiteSpecV3 = buildSiteSpecV3FromBrief({
    siteType: site.site_type,
    businessName: site.name
  });

  if (site.current_version_id) {
    const { data: version } = await admin
      .from("site_versions")
      .select("site_spec_json")
      .eq("id", site.current_version_id)
      .maybeSingle();

    const parsed = parseSiteSpecV3(version?.site_spec_json);
    if (parsed.success) {
      initialSpec = parsed.data;
    }
  }

  return (
    <main className="container stack" style={{ paddingTop: "2rem" }}>
      <header className="stack">
        <h1>{site.name}</h1>
        <p>Subdominio: {site.subdomain}</p>
        <Link href="/dashboard" className="btn-secondary">
          Volver al dashboard
        </Link>
      </header>

      <SiteEditor siteId={site.id} initialSpec={initialSpec} />
    </main>
  );
}

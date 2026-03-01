import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteEditor } from "@/components/editor/site-editor";
import { requireUser } from "@/lib/auth";
import { buildFallbackSiteSpec, parseSiteSpec } from "@/lib/site-spec";

export default async function SiteEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, subdomain, current_version_id")
    .eq("id", id)
    .maybeSingle();

  if (!site) {
    notFound();
  }

  const versionId = site.current_version_id;
  let siteSpec = buildFallbackSiteSpec(site.name);

  if (versionId) {
    const { data: version } = await supabase
      .from("site_versions")
      .select("site_spec_json")
      .eq("id", versionId)
      .maybeSingle();

    if (version) {
      const parsed = parseSiteSpec(version.site_spec_json);
      if (parsed.success) {
        siteSpec = parsed.data;
      }
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

      <SiteEditor siteId={site.id} initialSpec={siteSpec} />
    </main>
  );
}

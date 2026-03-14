import { notFound } from "next/navigation";

import { SiteEditor } from "@/components/editor/site-editor";
import { requireUser } from "@/lib/auth";
import { buildSiteSpecV3FromBrief, normalizeSiteSpecV3, type SiteSpecV3 } from "@/lib/site-spec-v3";
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
  let initialMigrated = false;

  if (site.current_version_id) {
    const { data: version } = await admin
      .from("site_versions")
      .select("site_spec_json")
      .eq("id", site.current_version_id)
      .maybeSingle();

    const normalized = normalizeSiteSpecV3(version?.site_spec_json);
    if (normalized) {
      initialSpec = normalized.spec;
      initialMigrated = normalized.migrated;
    }
  }

  return (
    <main className="editor-page">
      <SiteEditor
        siteId={site.id}
        siteName={site.name}
        subdomain={site.subdomain}
        initialSpec={initialSpec}
        initialMigrated={initialMigrated}
      />
    </main>
  );
}

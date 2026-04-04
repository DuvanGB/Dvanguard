import { notFound, redirect } from "next/navigation";

import { SiteRenderer } from "@/components/runtime/site-renderer";
import { requireUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parseAnySiteSpec } from "@/lib/site-spec-any";

export const dynamic = "force-dynamic";

/**
 * Owner-only preview: renders any site the authenticated user owns,
 * regardless of publication status. Used for dashboard card thumbnails.
 */
export default async function SitePreviewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireUser();

  const admin = getSupabaseAdminClient();

  const { data: site } = await admin
    .from("sites")
    .select("id, name, subdomain, current_version_id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!site || !site.current_version_id) {
    notFound();
  }

  const { data: version } = await admin
    .from("site_versions")
    .select("site_spec_json")
    .eq("id", site.current_version_id)
    .maybeSingle();

  if (!version) {
    notFound();
  }

  const parsed = parseAnySiteSpec(version.site_spec_json);
  if (!parsed.success) {
    notFound();
  }

  return <SiteRenderer spec={parsed.data} siteId={site.id} subdomain={site.subdomain} />;
}

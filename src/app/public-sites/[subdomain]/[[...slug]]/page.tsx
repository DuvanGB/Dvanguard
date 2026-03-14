import { notFound } from "next/navigation";

import { SiteRenderer } from "@/components/runtime/site-renderer";
import { getPublishedSiteBySubdomain } from "@/lib/data/public-site";

export const dynamic = "force-dynamic";

export default async function PublicSitePage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params;
  const payload = await getPublishedSiteBySubdomain(subdomain);

  if (!payload) {
    notFound();
  }

  return <SiteRenderer spec={payload.siteSpec} trackEvents siteId={payload.id} subdomain={payload.subdomain} enableCart />;
}

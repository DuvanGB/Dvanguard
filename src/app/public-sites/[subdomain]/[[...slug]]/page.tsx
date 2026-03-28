import { notFound } from "next/navigation";

import { SiteRenderer } from "@/components/runtime/site-renderer";
import { getPublishedSiteByHostname, getPublishedSiteBySubdomain } from "@/lib/data/public-site";

export const dynamic = "force-dynamic";

export default async function PublicSitePage({
  params,
  searchParams
}: {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ host?: string }>;
}) {
  const { subdomain } = await params;
  const query = await searchParams;
  const payload =
    subdomain === "__host__" && query.host
      ? await getPublishedSiteByHostname(query.host)
      : await getPublishedSiteBySubdomain(subdomain);

  if (!payload) {
    notFound();
  }

  return <SiteRenderer spec={payload.siteSpec} trackEvents siteId={payload.id} subdomain={payload.subdomain} enableCart />;
}

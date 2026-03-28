import { env } from "@/lib/env";
import { pickPrimaryDomain, type SiteDomainRecord } from "@/lib/site-domains";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getPathModePublicUrl(subdomain: string) {
  return `${trimTrailingSlash(env.appUrl)}/public-sites/${subdomain}`;
}

export function buildEffectivePublicUrl(input: {
  subdomain: string;
  domains?: SiteDomainRecord[] | null;
}) {
  const primaryDomain = pickPrimaryDomain(input.domains ?? []);
  if (primaryDomain) {
    return `https://${primaryDomain.hostname}`;
  }

  return getPathModePublicUrl(input.subdomain);
}

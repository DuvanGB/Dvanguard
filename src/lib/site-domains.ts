export type PublicUrlMode = "path" | "custom_domain";
export type SiteDomainStatus = "pending" | "verifying" | "active" | "failed" | "removed";

export type SiteDomainRecord = {
  id: string;
  site_id: string;
  hostname: string;
  status: SiteDomainStatus;
  verification_json: Record<string, unknown>;
  is_primary: boolean;
  created_at: string;
  verified_at: string | null;
};

export function normalizeHostname(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

export function isValidHostname(hostname: string) {
  return /^(?!:\/\/)(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(hostname);
}

export function stripPort(host: string | null) {
  return (host ?? "").split(":")[0]?.trim().toLowerCase() || "";
}

export function pickPrimaryDomain(domains: SiteDomainRecord[]) {
  return domains.find((domain) => domain.is_primary && domain.status === "active")
    ?? domains.find((domain) => domain.status === "active")
    ?? null;
}

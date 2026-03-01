import { env } from "@/lib/env";

export function getSubdomainFromHost(host: string | null): string | null {
  if (!host) return null;

  const normalized = host.split(":")[0].toLowerCase();

  if (normalized === "localhost") return null;

  if (normalized.endsWith(`.${env.rootDomain}`)) {
    const subdomain = normalized.replace(`.${env.rootDomain}`, "");
    if (!subdomain || subdomain === "www") return null;
    return subdomain;
  }

  if (normalized.endsWith(".localhost")) {
    const [subdomain] = normalized.split(".");
    if (subdomain && subdomain !== "www") return subdomain;
  }

  return null;
}

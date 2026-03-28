import { env } from "@/lib/env";
import { stripPort } from "@/lib/site-domains";

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

export function isPrimaryAppHost(host: string | null) {
  const normalized = stripPort(host);
  if (!normalized) return false;

  const appHost = (() => {
    try {
      return new URL(env.appUrl).host.toLowerCase();
    } catch {
      return "";
    }
  })();

  return normalized === "localhost" || normalized === env.rootDomain || normalized === appHost || normalized === `www.${env.rootDomain}`;
}

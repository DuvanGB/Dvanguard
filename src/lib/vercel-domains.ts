import { env } from "@/lib/env";

type VercelProjectDomain = {
  name: string;
  apexName?: string;
  projectId?: string;
  verified?: boolean;
  verification?: Array<{
    type?: string;
    domain?: string;
    value?: string;
    reason?: string;
  }>;
  redirect?: string | null;
  redirectStatusCode?: number | null;
  gitBranch?: string | null;
  customEnvironmentId?: string | null;
  updatedAt?: number;
  createdAt?: number;
};

type VercelDomainConfig = {
  configuredBy?: string | null;
  acceptedChallenges?: string[];
  recommendedIPv4?: Array<{ rank: number; value: string[] }>;
  recommendedCNAME?: Array<{ rank: number; value: string }>;
  misconfigured?: boolean;
};

type DomainSnapshot = {
  domain: VercelProjectDomain | null;
  config: VercelDomainConfig | null;
};

export async function registerDomainOnVercel(hostname: string) {
  const domain = await vercelRequest<VercelProjectDomain>(`/v10/projects/${encodeURIComponent(env.vercelProjectId)}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: hostname })
  });

  const snapshot = await getDomainSnapshot(hostname).catch(() => ({ domain, config: null }));
  return snapshot;
}

export async function verifyDomainOnVercel(hostname: string) {
  await vercelRequest<VercelProjectDomain>(`/v9/projects/${encodeURIComponent(env.vercelProjectId)}/domains/${encodeURIComponent(hostname)}/verify`, {
    method: "POST"
  });

  return getDomainSnapshot(hostname);
}

export async function getDomainSnapshot(hostname: string): Promise<DomainSnapshot> {
  const [domain, config] = await Promise.all([
    vercelRequest<VercelProjectDomain>(`/v9/projects/${encodeURIComponent(env.vercelProjectId)}/domains/${encodeURIComponent(hostname)}`, {
      method: "GET"
    }),
    vercelRequest<VercelDomainConfig>(
      `/v6/domains/${encodeURIComponent(hostname)}/config?projectIdOrName=${encodeURIComponent(env.vercelProjectId)}`,
      {
        method: "GET"
      }
    ).catch(() => null)
  ]);

  return { domain, config };
}

export async function removeDomainFromVercel(hostname: string) {
  await vercelRequest(`/v9/projects/${encodeURIComponent(env.vercelProjectId)}/domains/${encodeURIComponent(hostname)}`, {
    method: "DELETE",
    body: JSON.stringify({ removeRedirects: true })
  });
}

function assertVercelConfig() {
  if (!env.vercelToken || !env.vercelProjectId) {
    throw new Error("Vercel Domains API no está configurada. Define VERCEL_TOKEN y VERCEL_PROJECT_ID.");
  }
}

async function vercelRequest<T = unknown>(path: string, init: RequestInit) {
  assertVercelConfig();

  const url = new URL(`https://api.vercel.com${path}`);
  if (env.vercelTeamId) {
    url.searchParams.set("teamId", env.vercelTeamId);
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.vercelToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  const payload = text ? safeJsonParse(text) : {};

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: { message?: string } | string }).error && typeof (payload as { error?: unknown }).error === "object"
            ? ((payload as { error?: { message?: string } }).error?.message ?? "Vercel API error")
            : (payload as { error?: string }).error)
        : `Vercel API error (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

function safeJsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

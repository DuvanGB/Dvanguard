import { buildFallbackSiteSpecV3, parseSiteSpecV3, type SiteSpecV3 } from "@/lib/site-spec-v3";

export type AnySiteSpec = SiteSpecV3;

export function parseAnySiteSpec(input: unknown) {
  const parsed = parseSiteSpecV3(input);
  if (parsed.success) {
    return {
      success: true as const,
      data: parsed.data,
      sourceVersion: parsed.data.schema_version,
      migrated: false as const
    };
  }

  return {
    success: false as const,
    error: parsed.error
  };
}

export function buildFallbackAnySiteSpec(prompt: string) {
  return buildFallbackSiteSpecV3(prompt);
}

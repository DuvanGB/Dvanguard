import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_PLATFORM_SCOPE, type PlatformScope } from "@/lib/platform-config";

export type LegalDocumentSlug = "terms" | "privacy";

export type LegalDocumentVersionRecord = {
  id: string;
  document_id: string;
  country_code: string | null;
  locale_code: string | null;
  version_label: string;
  title: string;
  body_markdown: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  effective_from: string | null;
  created_at: string;
  updated_at: string;
};

export type LegalDocumentRecord = {
  id: string;
  slug: LegalDocumentSlug;
  title: string;
  description: string | null;
};

function normalizeScope(scope?: PlatformScope) {
  return {
    countryCode: scope?.countryCode ?? DEFAULT_PLATFORM_SCOPE.countryCode,
    localeCode: scope?.localeCode ?? DEFAULT_PLATFORM_SCOPE.localeCode
  };
}

function scoreScopeMatch(
  row: { country_code: string | null; locale_code: string | null },
  scope: { countryCode: string; localeCode: string }
) {
  const countryMatches = row.country_code === scope.countryCode;
  const localeMatches = row.locale_code === scope.localeCode;
  if (countryMatches && localeMatches) return 3;
  if (!row.country_code && localeMatches) return 2;
  if (!row.country_code && !row.locale_code) return 1;
  return 0;
}

function pickScopedVersion(rows: LegalDocumentVersionRecord[], scope?: PlatformScope) {
  const normalizedScope = normalizeScope(scope);
  const sorted = [...rows].sort((left, right) => scoreScopeMatch(right, normalizedScope) - scoreScopeMatch(left, normalizedScope));
  return sorted.find((row) => scoreScopeMatch(row, normalizedScope) > 0) ?? null;
}

export async function getPublishedLegalDocument(admin: SupabaseClient, slug: LegalDocumentSlug, scope?: PlatformScope) {
  const { data: document, error: documentError } = await admin
    .from("legal_documents")
    .select("id, slug, title, description")
    .eq("slug", slug)
    .maybeSingle();

  if (documentError || !document) {
    throw new Error(documentError?.message ?? `Missing legal document: ${slug}`);
  }

  const { data: versions, error: versionError } = await admin
    .from("legal_document_versions")
    .select("id, document_id, country_code, locale_code, version_label, title, body_markdown, status, published_at, effective_from, created_at, updated_at")
    .eq("document_id", document.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (versionError) {
    throw new Error(`Failed to load legal document version for ${slug}: ${versionError.message}`);
  }

  const version = pickScopedVersion((versions ?? []) as LegalDocumentVersionRecord[], scope);
  if (!version) {
    throw new Error(`Missing published legal document version for ${slug}`);
  }

  return {
    document: document as LegalDocumentRecord,
    version
  };
}

export async function listLegalDocumentsWithVersions(admin: SupabaseClient) {
  const { data: documents, error: documentsError } = await admin
    .from("legal_documents")
    .select("id, slug, title, description")
    .order("slug", { ascending: true });

  if (documentsError) {
    throw new Error(`Failed to list legal documents: ${documentsError.message}`);
  }

  const { data: versions, error: versionsError } = await admin
    .from("legal_document_versions")
    .select("id, document_id, country_code, locale_code, version_label, title, body_markdown, status, published_at, effective_from, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (versionsError) {
    throw new Error(`Failed to list legal document versions: ${versionsError.message}`);
  }

  return {
    documents: (documents ?? []) as LegalDocumentRecord[],
    versions: (versions ?? []) as LegalDocumentVersionRecord[]
  };
}

export async function createLegalDocumentVersion(
  admin: SupabaseClient,
  input: {
    slug: LegalDocumentSlug;
    versionLabel: string;
    title: string;
    bodyMarkdown: string;
    countryCode?: string | null;
    localeCode?: string | null;
  }
) {
  const { data: document, error: documentError } = await admin
    .from("legal_documents")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle();

  if (documentError || !document) {
    throw new Error(documentError?.message ?? `Missing legal document: ${input.slug}`);
  }

  const { error } = await admin.from("legal_document_versions").insert({
    document_id: document.id,
    country_code: input.countryCode === undefined ? DEFAULT_PLATFORM_SCOPE.countryCode : input.countryCode,
    locale_code: input.localeCode === undefined ? DEFAULT_PLATFORM_SCOPE.localeCode : input.localeCode,
    version_label: input.versionLabel,
    title: input.title,
    body_markdown: input.bodyMarkdown,
    status: "draft"
  });

  if (error) {
    throw new Error(`Failed to create legal document version: ${error.message}`);
  }
}

export async function publishLegalDocumentVersion(admin: SupabaseClient, versionId: string) {
  const { data: version, error: versionError } = await admin
    .from("legal_document_versions")
    .select("id, document_id, country_code, locale_code")
    .eq("id", versionId)
    .maybeSingle();

  if (versionError || !version) {
    throw new Error(versionError?.message ?? "Legal document version not found.");
  }

  let archiveQuery = admin
    .from("legal_document_versions")
    .update({ status: "archived" })
    .eq("document_id", version.document_id)
    .eq("status", "published");

  archiveQuery =
    version.country_code === null ? archiveQuery.is("country_code", null) : archiveQuery.eq("country_code", version.country_code);
  archiveQuery =
    version.locale_code === null ? archiveQuery.is("locale_code", null) : archiveQuery.eq("locale_code", version.locale_code);

  const { error: archiveError } = await archiveQuery;
  if (archiveError) {
    throw new Error(`Failed to archive previous published version: ${archiveError.message}`);
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("legal_document_versions")
    .update({ status: "published", published_at: now, effective_from: now })
    .eq("id", versionId);

  if (error) {
    throw new Error(`Failed to publish legal document version: ${error.message}`);
  }
}

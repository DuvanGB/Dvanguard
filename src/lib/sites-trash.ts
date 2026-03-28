import type { SupabaseClient } from "@supabase/supabase-js";

const TRASH_RETENTION_DAYS = 7;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type TrashedSiteRecord = {
  site_id: string;
  name: string;
  subdomain: string;
  site_type: "informative" | "commerce_lite";
  status: "draft" | "published" | "archived";
  deleted_at: string;
  purge_at: string;
  days_remaining: number;
};

export function getTrashPurgeAt(deletedAt: string | Date) {
  const base = typeof deletedAt === "string" ? new Date(deletedAt) : deletedAt;
  return new Date(base.getTime() + TRASH_RETENTION_MS);
}

export function getTrashDaysRemaining(deletedAt: string | Date, now = new Date()) {
  const purgeAt = getTrashPurgeAt(deletedAt);
  return Math.max(0, Math.ceil((purgeAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

export async function purgeExpiredDeletedSites(admin: SupabaseClient, ownerId?: string) {
  const thresholdIso = new Date(Date.now() - TRASH_RETENTION_MS).toISOString();
  let query = admin.from("sites").select("id, owner_id").not("deleted_at", "is", null).lte("deleted_at", thresholdIso);

  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  const { data: sites, error } = await query;
  if (error) {
    throw new Error(`Failed to load expired deleted sites: ${error.message}`);
  }

  const expiredSites = sites ?? [];
  if (!expiredSites.length) return 0;

  for (const site of expiredSites) {
    const { error: deleteError } = await admin.from("sites").delete().eq("id", site.id);
    if (deleteError) {
      throw new Error(`Failed to hard delete site ${site.id}: ${deleteError.message}`);
    }
  }

  return expiredSites.length;
}

export async function listTrashedSitesForOwner(admin: SupabaseClient, ownerId: string): Promise<TrashedSiteRecord[]> {
  const { data, error } = await admin
    .from("sites")
    .select("id, name, subdomain, site_type, status, deleted_at")
    .eq("owner_id", ownerId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load trashed sites: ${error.message}`);
  }

  const now = new Date();
  return (data ?? []).flatMap((site) => {
    if (!site.deleted_at) return [];
    const purgeAt = getTrashPurgeAt(site.deleted_at);
    return [
      {
        site_id: site.id,
        name: site.name,
        subdomain: site.subdomain,
        site_type: site.site_type === "commerce_lite" ? "commerce_lite" : "informative",
        status: site.status === "published" ? "published" : site.status === "archived" ? "archived" : "draft",
        deleted_at: site.deleted_at,
        purge_at: purgeAt.toISOString(),
        days_remaining: getTrashDaysRemaining(site.deleted_at, now)
      }
    ];
  });
}

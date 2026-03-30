import type { SupabaseClient } from "@supabase/supabase-js";

import { getTrashPolicyConfig } from "@/lib/platform-config";

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

async function getTrashRetentionMs(admin: SupabaseClient) {
  const { retentionDays } = await getTrashPolicyConfig(admin);
  return retentionDays * 24 * 60 * 60 * 1000;
}

function computeTrashPurgeAt(deletedAt: string | Date, retentionMs: number) {
  const base = typeof deletedAt === "string" ? new Date(deletedAt) : deletedAt;
  return new Date(base.getTime() + retentionMs);
}

export async function getTrashPurgeAt(admin: SupabaseClient, deletedAt: string | Date) {
  const retentionMs = await getTrashRetentionMs(admin);
  return computeTrashPurgeAt(deletedAt, retentionMs);
}

export async function getTrashDaysRemaining(admin: SupabaseClient, deletedAt: string | Date, now = new Date()) {
  const retentionMs = await getTrashRetentionMs(admin);
  const purgeAt = computeTrashPurgeAt(deletedAt, retentionMs);
  return Math.max(0, Math.ceil((purgeAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

export async function purgeExpiredDeletedSites(admin: SupabaseClient, ownerId?: string) {
  const retentionMs = await getTrashRetentionMs(admin);
  const thresholdIso = new Date(Date.now() - retentionMs).toISOString();
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
  const retentionMs = await getTrashRetentionMs(admin);
  const items: TrashedSiteRecord[] = [];
  for (const site of data ?? []) {
    if (!site.deleted_at) continue;
    const purgeAt = computeTrashPurgeAt(site.deleted_at, retentionMs);
    items.push({
      site_id: site.id,
      name: site.name,
      subdomain: site.subdomain,
      site_type: site.site_type === "commerce_lite" ? "commerce_lite" : "informative",
      status: site.status === "published" ? "published" : site.status === "archived" ? "archived" : "draft",
      deleted_at: site.deleted_at,
      purge_at: purgeAt.toISOString(),
      days_remaining: Math.max(0, Math.ceil((purgeAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    });
  }

  return items;
}

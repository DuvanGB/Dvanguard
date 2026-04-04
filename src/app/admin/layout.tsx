import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { PlatformNav } from "@/components/platform-nav";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPlatformCopyMap } from "@/lib/platform-config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdminUser();
  const admin = getSupabaseAdminClient();
  const copy = await getPlatformCopyMap(admin, [
    "admin.layout.eyebrow",
    "admin.layout.title",
    "admin.layout.description"
  ]);

  return (
    <>
      <PlatformNav isAuthenticated isStatic hideLinks />
      <main className="admin-shell">
        <div className="admin-container">
          <header className="admin-header">
            <div className="stack">
              <small className="admin-eyebrow">{copy["admin.layout.eyebrow"]}</small>
              <h1>{copy["admin.layout.title"]}</h1>
              <p>{copy["admin.layout.description"]}</p>
            </div>
            <div className="admin-user-pill">{user.email}</div>
          </header>
          <AdminNav />
          <section className="admin-content">{children}</section>
        </div>
      </main>
    </>
  );
}

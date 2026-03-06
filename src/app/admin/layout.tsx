import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdminUser } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdminUser();

  return (
    <main className="admin-shell">
      <div className="admin-shell-glow" />
      <div className="admin-container">
        <header className="admin-header">
          <div className="stack">
            <small className="admin-eyebrow">Operación interna</small>
            <h1>Control Center</h1>
            <p>Visibilidad operativa de usuarios, sitios, generación IA y conversión.</p>
          </div>
          <div className="admin-user-pill">{user.email}</div>
        </header>
        <AdminNav />
        <section className="admin-content">{children}</section>
      </div>
    </main>
  );
}

import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdminUser } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdminUser();

  return (
    <main className="container stack" style={{ paddingTop: "2rem" }}>
      <header className="stack">
        <h1>Panel Admin</h1>
        <p>{user.email}</p>
        <AdminNav />
      </header>
      {children}
    </main>
  );
}

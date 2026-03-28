"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSitePublicationToggle } from "@/components/admin/admin-site-publication-toggle";

type Props = {
  siteId: string;
  status: string;
};

export function SiteModerationActions({ siteId, status }: Props) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<"delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runDelete() {
    const confirmed = window.confirm("¿Seguro que quieres eliminar este sitio? Esta acción es irreversible.");
    if (!confirmed) return;

    setLoadingAction("delete");
    setMessage(null);

    const response = await fetch(`/api/admin/sites/${siteId}`, {
      method: "DELETE"
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo eliminar el sitio");
      setLoadingAction(null);
      return;
    }

    setMessage("Sitio eliminado");
    setLoadingAction(null);
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: "0.35rem" }}>
      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
        <AdminSitePublicationToggle siteId={siteId} enabled={status !== "archived"} />
        <button type="button" className="btn-secondary btn-danger-soft" onClick={runDelete} disabled={Boolean(loadingAction)}>
          {loadingAction === "delete" ? "Eliminando..." : "Eliminar"}
        </button>
      </div>
      {message ? <small>{message}</small> : null}
    </div>
  );
}

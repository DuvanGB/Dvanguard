"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  siteId: string;
  status: string;
};

export function SiteModerationActions({ siteId, status }: Props) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<"suspend" | "restore" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runModeration(action: "suspend" | "restore") {
    setLoadingAction(action);
    setMessage(null);

    const response = await fetch(`/api/admin/sites/${siteId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo actualizar el sitio");
      setLoadingAction(null);
      return;
    }

    setMessage(action === "suspend" ? "Sitio suspendido" : "Sitio reactivado");
    setLoadingAction(null);
    router.refresh();
  }

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
        {status === "archived" ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => runModeration("restore")}
            disabled={Boolean(loadingAction)}
          >
            {loadingAction === "restore" ? "Reactivando..." : "Reactivar"}
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => runModeration("suspend")}
            disabled={Boolean(loadingAction)}
          >
            {loadingAction === "suspend" ? "Suspendiendo..." : "Suspender"}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={runDelete} disabled={Boolean(loadingAction)}>
          {loadingAction === "delete" ? "Eliminando..." : "Eliminar"}
        </button>
      </div>
      {message ? <small>{message}</small> : null}
    </div>
  );
}

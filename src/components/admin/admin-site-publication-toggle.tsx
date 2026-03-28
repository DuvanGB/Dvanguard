"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  siteId: string;
  enabled: boolean;
};

export function AdminSitePublicationToggle({ siteId, enabled }: Props) {
  const router = useRouter();
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleToggle() {
    const nextEnabled = !isEnabled;
    setMessage(null);

    const response = await fetch(`/api/admin/sites/${siteId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: nextEnabled ? "restore" : "suspend" })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo actualizar el sitio");
      return;
    }

    setIsEnabled(nextEnabled);
    setMessage(nextEnabled ? "Sitio activo" : "Sitio suspendido");
    startTransition(() => router.refresh());
  }

  return (
    <div className="dashboard-toggle-inline">
      <button
        type="button"
        className={`dashboard-publish-toggle dashboard-publish-toggle-compact ${isEnabled ? "is-on" : "is-off"}`}
        onClick={() => void handleToggle()}
        disabled={isPending}
        aria-pressed={isEnabled}
        aria-label={isEnabled ? "Suspender sitio" : "Reactivar sitio"}
        title={isEnabled ? "Activo" : "Suspendido"}
      >
        <span className="dashboard-publish-toggle-track">
          <span className="dashboard-publish-toggle-thumb" />
        </span>
      </button>
      {message ? <small className="muted">{message}</small> : null}
    </div>
  );
}

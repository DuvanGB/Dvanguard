"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  siteId: string;
  published: boolean;
  compact?: boolean;
};

export function SitePublicationToggle({ siteId, published, compact = false }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(published);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function togglePublication() {
    const nextEnabled = !enabled;
    setMessage(null);

    const response = await fetch(`/api/sites/${siteId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled })
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo actualizar la publicación");
      return;
    }

    setEnabled(nextEnabled);
    setMessage(nextEnabled ? "Sitio publicado" : "Sitio apagado");
    startTransition(() => router.refresh());
  }

  const label = isPending ? "Actualizando..." : enabled ? "Publicado" : "Apagado";

  return compact ? (
    <div className="dashboard-toggle-inline">
      <button
        type="button"
        className={`dashboard-publish-toggle dashboard-publish-toggle-compact ${enabled ? "is-on" : "is-off"}`}
        onClick={() => void togglePublication()}
        disabled={isPending}
        aria-pressed={enabled}
        aria-label={`Estado de publicación: ${label}`}
        title={label}
      >
        <span className="dashboard-publish-toggle-track">
          <span className="dashboard-publish-toggle-thumb" />
        </span>
      </button>
      {message ? <small className="muted">{message}</small> : null}
    </div>
  ) : (
    <div className="dashboard-toggle-stack">
      <button
        type="button"
        className={`dashboard-publish-toggle ${enabled ? "is-on" : "is-off"}`}
        onClick={() => void togglePublication()}
        disabled={isPending}
        aria-pressed={enabled}
      >
        <span className="dashboard-publish-toggle-track">
          <span className="dashboard-publish-toggle-thumb" />
        </span>
        <span>{label}</span>
      </button>
      {message ? <small className="muted">{message}</small> : null}
    </div>
  );
}

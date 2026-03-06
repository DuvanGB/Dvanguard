"use client";

import { useState } from "react";

type Props = {
  siteId: string;
};

export function PublishSiteButton({ siteId }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function publish() {
    setLoading(true);
    setMessage(null);

    const response = await fetch(`/api/sites/${siteId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo publicar");
      setLoading(false);
      return;
    }

    setMessage("Publicado");
    setLoading(false);
  }

  return (
    <div className="stack">
      <button type="button" className="btn-secondary" disabled={loading} onClick={() => void publish()}>
        {loading ? "Publicando..." : "Publicar ahora"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}

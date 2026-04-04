"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProRequestButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRequest() {
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/account/pro-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const data = (await response.json()) as { error?: string; created?: boolean };

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo solicitar Pro");
      setLoading(false);
      return;
    }

    setMessage(data.created ? "Solicitud enviada. Te contactaremos pronto." : "Ya tienes una solicitud pendiente.");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="stack stack-md">
      <button type="button" className="btn-primary" onClick={handleRequest} disabled={loading}>
        {loading ? "Enviando..." : "Solicitar Pro"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}

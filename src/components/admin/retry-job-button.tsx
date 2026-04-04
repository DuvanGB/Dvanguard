"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryJobButton({ jobId, disabled }: { jobId: string; disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setMessage(null);

    const response = await fetch(`/api/admin/ai-jobs/${jobId}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const data = (await response.json()) as { error?: string; retryJobId?: string };

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo reintentar");
      setLoading(false);
      return;
    }

    setMessage(`Reintento creado: ${data.retryJobId}`);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="stack stack-xs">
      <button type="button" className="btn-secondary" onClick={handleRetry} disabled={disabled || loading}>
        {loading ? "Reintentando..." : "Reintentar"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}

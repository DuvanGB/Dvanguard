"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewProRequestButton({ requestId, decision }: { requestId: string; decision: "approved" | "rejected" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReview() {
    setLoading(true);
    setMessage(null);

    const response = await fetch(`/api/admin/pro-requests/${requestId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision })
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo procesar solicitud");
      setLoading(false);
      return;
    }

    setMessage(decision === "approved" ? "Aprobado" : "Rechazado");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="stack stack-sm">
      <button className="btn-secondary" type="button" onClick={handleReview} disabled={loading}>
        {loading ? "Procesando..." : decision === "approved" ? "Aprobar" : "Rechazar"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}

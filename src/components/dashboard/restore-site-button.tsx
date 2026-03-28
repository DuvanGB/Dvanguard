"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  siteId: string;
};

export function RestoreSiteButton({ siteId }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function restore() {
    setMessage(null);
    const response = await fetch(`/api/sites/${siteId}/restore`, {
      method: "POST"
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo restaurar el sitio");
      return;
    }

    setMessage("Sitio restaurado");
    startTransition(() => router.refresh());
  }

  return (
    <div className="dashboard-toggle-stack">
      <button type="button" className="btn-secondary" onClick={() => void restore()} disabled={isPending}>
        {isPending ? "Restaurando..." : "Restaurar"}
      </button>
      {message ? <small className="muted">{message}</small> : null}
    </div>
  );
}

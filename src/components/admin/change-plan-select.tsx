"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePlanSelect({ userId, currentPlan }: { userId: string; currentPlan: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState(currentPlan);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function applyPlan() {
    setSaving(true);
    setMessage(null);

    const response = await fetch(`/api/admin/users/${userId}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planCode: plan })
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cambiar plan");
      setSaving(false);
      return;
    }

    setMessage("Plan actualizado");
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: "0.35rem" }}>
      <select value={plan} onChange={(event) => setPlan(event.target.value)}>
        <option value="free">free</option>
        <option value="pro">pro</option>
      </select>
      <button type="button" className="btn-secondary" onClick={applyPlan} disabled={saving}>
        {saving ? "Guardando..." : "Aplicar"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}

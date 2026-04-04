"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePlanSelect({ userId, currentPlan }: { userId: string; currentPlan: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const planCode = event.target.value;
    if (planCode === currentPlan) return;

    setSaving(true);
    setFeedback(null);
    clearTimeout(timerRef.current);

    const response = await fetch(`/api/admin/users/${userId}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planCode })
    });

    const data = (await response.json()) as { error?: string };
    setSaving(false);

    if (!response.ok) {
      setFeedback({ type: "error", text: data.error ?? "Error" });
      return;
    }

    setFeedback({ type: "ok", text: "Listo" });
    timerRef.current = setTimeout(() => setFeedback(null), 2500);
    router.refresh();
  }

  return (
    <div className="admin-plan-select-wrap">
      <select
        defaultValue={currentPlan}
        onChange={handleChange}
        disabled={saving}
        className={`admin-plan-select ${saving ? "admin-plan-select-saving" : ""}`}
      >
        <option value="free">free</option>
        <option value="pro">pro</option>
      </select>
      {saving && (
        <span className="admin-plan-feedback admin-plan-feedback-saving">
          <span className="material-symbols-outlined">sync</span>
        </span>
      )}
      {feedback && (
        <span className={`admin-plan-feedback admin-plan-feedback-${feedback.type}`}>
          <span className="material-symbols-outlined">
            {feedback.type === "ok" ? "check_circle" : "error"}
          </span>
        </span>
      )}
    </div>
  );
}

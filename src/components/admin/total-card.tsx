import type { AdminCardTone } from "@/lib/data/admin/common";

export function TotalCard({
  label,
  value,
  icon,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  icon: string;
  tone?: AdminCardTone;
}) {
  return (
    <div className={`admin-total-card admin-total-${tone}`}>
      <div className="admin-total-icon-box">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="admin-total-info">
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

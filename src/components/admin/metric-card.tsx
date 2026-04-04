import type { AdminCardTone } from "@/lib/data/admin/common";

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  featured = false
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: string;
  tone?: AdminCardTone;
  featured?: boolean;
}) {
  return (
    <article className={`admin-metric-card admin-metric-${tone}${featured ? " admin-metric-featured" : ""}`}>
      <div className="admin-metric-card-top">
        <p>{label}</p>
        {icon ? <span className="material-symbols-outlined admin-metric-icon">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : <small>&nbsp;</small>}
    </article>
  );
}

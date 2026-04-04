export function AdminCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="admin-skeleton-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="admin-skeleton-card">
          <div className="admin-skeleton-line admin-skeleton-line-sm" />
          <div className="admin-skeleton-line admin-skeleton-line-lg" />
          <div className="admin-skeleton-line admin-skeleton-line-sm" />
        </div>
      ))}
    </div>
  );
}

export function AdminTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="admin-panel stack">
      <div className="admin-skeleton-line admin-skeleton-line-md" style={{ width: "40%" }} />
      <div className="admin-skeleton-table">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="admin-skeleton-row">
            <div className="admin-skeleton-line admin-skeleton-line-sm" style={{ width: "20%" }} />
            <div className="admin-skeleton-line admin-skeleton-line-sm" style={{ width: "30%" }} />
            <div className="admin-skeleton-line admin-skeleton-line-sm" style={{ width: "25%" }} />
            <div className="admin-skeleton-line admin-skeleton-line-sm" style={{ width: "15%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPageSkeleton() {
  return (
    <div className="stack">
      <AdminCardSkeleton />
      <AdminCardSkeleton count={4} />
      <div className="admin-mid-grid">
        <AdminTableSkeleton />
        <div className="admin-panel stack">
          <div className="admin-skeleton-line admin-skeleton-line-md" style={{ width: "50%" }} />
          <AdminCardSkeleton count={3} />
        </div>
      </div>
    </div>
  );
}

export function AdminListSkeleton() {
  return (
    <div className="admin-page-stack">
      <div className="admin-panel stack">
        <div className="admin-skeleton-row">
          <div className="admin-skeleton-line admin-skeleton-line-md" style={{ width: "30%" }} />
          <div className="admin-skeleton-line admin-skeleton-line-md" style={{ width: "20%" }} />
        </div>
      </div>
      <AdminTableSkeleton rows={8} />
    </div>
  );
}

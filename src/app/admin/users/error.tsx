"use client";

export default function AdminUsersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="admin-error-panel">
      <span className="material-symbols-outlined" style={{ fontSize: "2.2rem", color: "var(--error)" }}>
        group_off
      </span>
      <h2>Error al cargar usuarios</h2>
      <p>{error.message || "No se pudieron cargar los usuarios. Intenta de nuevo."}</p>
      <button onClick={reset}>
        <span className="material-symbols-outlined" style={{ fontSize: "1rem", verticalAlign: "middle", marginRight: "0.3rem" }}>
          refresh
        </span>
        Reintentar
      </button>
    </div>
  );
}

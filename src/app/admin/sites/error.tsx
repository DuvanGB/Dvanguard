"use client";

export default function AdminSitesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="admin-error-panel">
      <span className="material-symbols-outlined" style={{ fontSize: "2.2rem", color: "var(--error)" }}>
        language
      </span>
      <h2>Error al cargar sitios</h2>
      <p>{error.message || "No se pudieron cargar los sitios. Intenta de nuevo."}</p>
      <button onClick={reset}>
        <span className="material-symbols-outlined" style={{ fontSize: "1rem", verticalAlign: "middle", marginRight: "0.3rem" }}>
          refresh
        </span>
        Reintentar
      </button>
    </div>
  );
}

"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="admin-error-panel">
      <span className="material-symbols-outlined" style={{ fontSize: "2.2rem", color: "var(--error)" }}>
        error_outline
      </span>
      <h2>Error al cargar datos</h2>
      <p>{error.message || "Ocurrió un error inesperado. Intenta de nuevo."}</p>
      <button onClick={reset}>
        <span className="material-symbols-outlined" style={{ fontSize: "1rem", verticalAlign: "middle", marginRight: "0.3rem" }}>
          refresh
        </span>
        Reintentar
      </button>
    </div>
  );
}

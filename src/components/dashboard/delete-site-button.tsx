"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  siteId: string;
  siteName: string;
};

export function DeleteSiteButton({ siteId, siteName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canDelete = useMemo(() => confirmationName.trim() === siteName.trim(), [confirmationName, siteName]);

  async function handleDelete() {
    if (!canDelete) return;
    setMessage(null);

    const response = await fetch(`/api/sites/${siteId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationName })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo eliminar el sitio");
      return;
    }

    startTransition(() => {
      setOpen(false);
      setConfirmationName("");
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="dashboard-site-action-btn dashboard-site-action-danger" onClick={() => setOpen(true)} title="Eliminar sitio">
        <span className="material-symbols-outlined">delete</span>
      </button>

      {open ? (
        <div className="danger-modal-overlay" role="dialog" aria-modal="true" aria-label={`Eliminar ${siteName}`}>
          <div className="danger-modal-card">
            <div className="stack">
              <strong>Eliminar sitio</strong>
              <p className="muted">
                Para confirmar, escribe manualmente el nombre del sitio: <strong>{siteName}</strong>
              </p>
            </div>

            <label className="stack" style={{ gap: "0.35rem" }}>
              <span>Nombre del sitio</span>
              <input
                value={confirmationName}
                onChange={(event) => setConfirmationName(event.target.value)}
                onPaste={(event) => event.preventDefault()}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
                    event.preventDefault();
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            {message ? <small className="danger-text">{message}</small> : null}

            <div className="danger-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setOpen(false);
                  setConfirmationName("");
                  setMessage(null);
                }}
              >
                Cancelar
              </button>
              <button type="button" className="btn-danger-solid" onClick={() => void handleDelete()} disabled={!canDelete || isPending}>
                {isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

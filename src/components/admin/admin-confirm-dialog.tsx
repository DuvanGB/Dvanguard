"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "neutral";
  onConfirm: () => void;
  onCancel: () => void;
};

export function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  onConfirm,
  onCancel
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onCancel();
    },
    [onCancel]
  );

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    function handleCancel(e: Event) {
      e.preventDefault();
      onCancel();
    }

    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onCancel]);

  return (
    <dialog ref={dialogRef} className="admin-confirm-dialog" onClick={handleBackdropClick}>
      <div className="admin-confirm-dialog-content">
        <div className={`admin-confirm-dialog-icon admin-confirm-dialog-icon-${tone}`}>
          <span className="material-symbols-outlined">
            {tone === "danger" ? "delete_forever" : tone === "warning" ? "warning" : "help"}
          </span>
        </div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        <div className="admin-confirm-dialog-actions">
          <button type="button" className="admin-confirm-dialog-btn-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`admin-confirm-dialog-btn-confirm admin-confirm-dialog-btn-${tone}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return { open, confirm, handleConfirm, handleCancel };
}

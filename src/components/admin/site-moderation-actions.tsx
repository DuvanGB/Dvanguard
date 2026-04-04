"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminConfirmDialog, useConfirmDialog } from "@/components/admin/admin-confirm-dialog";
import { AdminSitePublicationToggle } from "@/components/admin/admin-site-publication-toggle";

type Props = {
  siteId: string;
  status: string;
  subdomain: string;
  primaryDomain?: string | null;
};

export function SiteModerationActions({ siteId, status, subdomain, primaryDomain }: Props) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<"delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dialog = useConfirmDialog();

  const publicUrl = primaryDomain
    ? `https://${primaryDomain}`
    : `/public-sites/${subdomain}`;

  async function runDelete() {
    const confirmed = await dialog.confirm();
    if (!confirmed) return;

    setLoadingAction("delete");
    setMessage(null);

    const response = await fetch(`/api/admin/sites/${siteId}`, {
      method: "DELETE"
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo eliminar el sitio");
      setLoadingAction(null);
      return;
    }

    setMessage("Sitio eliminado");
    setLoadingAction(null);
    router.refresh();
  }

  return (
    <div className="stack stack-sm">
      <div className="admin-action-row">
        <AdminSitePublicationToggle siteId={siteId} enabled={status !== "archived"} />
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="admin-icon-btn admin-icon-btn-neutral"
          title="Abrir sitio"
        >
          <span className="material-symbols-outlined">open_in_new</span>
        </a>
        <button
          type="button"
          className="admin-icon-btn admin-icon-btn-danger"
          onClick={runDelete}
          disabled={Boolean(loadingAction)}
          title="Eliminar permanentemente"
        >
          <span className="material-symbols-outlined">
            {loadingAction === "delete" ? "hourglass_empty" : "delete_forever"}
          </span>
        </button>
      </div>
      {message ? <small>{message}</small> : null}
      <AdminConfirmDialog
        open={dialog.open}
        title="¿Eliminar este sitio?"
        description="Esta acción es irreversible. El sitio y todos sus datos serán eliminados permanentemente."
        confirmLabel="Eliminar"
        onConfirm={dialog.handleConfirm}
        onCancel={dialog.handleCancel}
      />
    </div>
  );
}

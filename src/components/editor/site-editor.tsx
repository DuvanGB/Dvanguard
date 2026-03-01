"use client";

import { useMemo, useState } from "react";

import { SiteRenderer } from "@/components/runtime/site-renderer";
import { type SiteSpec } from "@/lib/site-spec";

type Props = {
  siteId: string;
  initialSpec: SiteSpec;
};

export function SiteEditor({ siteId, initialSpec }: Props) {
  const [siteSpec, setSiteSpec] = useState<SiteSpec>(initialSpec);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const heroTitle = useMemo(
    () => String(siteSpec.pages[0]?.sections.find((section) => section.type === "hero")?.props?.title ?? ""),
    [siteSpec]
  );

  function updateHeroTitle(value: string) {
    setSiteSpec((prev) => ({
      ...prev,
      pages: prev.pages.map((page, pageIndex) =>
        pageIndex === 0
          ? {
              ...page,
              sections: page.sections.map((section) =>
                section.type === "hero" ? { ...section, props: { ...section.props, title: value } } : section
              )
            }
          : page
      )
    }));
  }

  function toggleSection(sectionId: string) {
    setSiteSpec((prev) => ({
      ...prev,
      pages: prev.pages.map((page, pageIndex) =>
        pageIndex === 0
          ? {
              ...page,
              sections: page.sections.map((section) =>
                section.id === sectionId ? { ...section, enabled: !section.enabled } : section
              )
            }
          : page
      )
    }));
  }

  async function saveDraft() {
    setSaving(true);
    setMessage(null);

    const response = await fetch(`/api/sites/${siteId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteSpec })
    });

    const data = (await response.json()) as { error?: string; versionId?: string };

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo guardar borrador");
      setSaving(false);
      return;
    }

    setMessage(`Borrador guardado (version_id: ${data.versionId})`);
    setSaving(false);
  }

  async function publish() {
    setPublishing(true);
    setMessage(null);

    const response = await fetch(`/api/sites/${siteId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo publicar");
      setPublishing(false);
      return;
    }

    setMessage("Sitio publicado correctamente");
    setPublishing(false);
  }

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <section className="card stack">
        <h2>Editor rápido (MVP)</h2>
        <label>
          Color primario
          <input
            type="color"
            value={siteSpec.theme.primary}
            onChange={(event) =>
              setSiteSpec((prev) => ({ ...prev, theme: { ...prev.theme, primary: event.target.value } }))
            }
          />
        </label>
        <label>
          Título hero
          <input value={heroTitle} onChange={(event) => updateHeroTitle(event.target.value)} />
        </label>

        <div className="stack">
          <strong>Secciones activas</strong>
          {siteSpec.pages[0]?.sections.map((section) => (
            <label key={section.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                style={{ width: "auto" }}
                type="checkbox"
                checked={section.enabled}
                onChange={() => toggleSection(section.id)}
              />
              {section.type}
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn-secondary" type="button" onClick={saveDraft} disabled={saving}>
            {saving ? "Guardando..." : "Guardar borrador"}
          </button>
          <button className="btn-primary" type="button" onClick={publish} disabled={publishing}>
            {publishing ? "Publicando..." : "Publicar"}
          </button>
        </div>
        {message ? <p>{message}</p> : null}
      </section>

      <section className="card stack">
        <h2>Vista previa</h2>
        <SiteRenderer spec={siteSpec} />
      </section>
    </div>
  );
}

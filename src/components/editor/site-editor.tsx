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
  const heroSubtitle = useMemo(
    () => String(siteSpec.pages[0]?.sections.find((section) => section.type === "hero")?.props?.subtitle ?? ""),
    [siteSpec]
  );
  const contactTitle = useMemo(
    () => String(siteSpec.pages[0]?.sections.find((section) => section.type === "contact")?.props?.title ?? ""),
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

  function updateSectionProp(sectionType: "hero" | "contact", propName: string, value: string) {
    setSiteSpec((prev) => ({
      ...prev,
      pages: prev.pages.map((page, pageIndex) =>
        pageIndex === 0
          ? {
              ...page,
              sections: page.sections.map((section) =>
                section.type === sectionType
                  ? {
                      ...section,
                      props: { ...section.props, [propName]: value }
                    }
                  : section
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

  function moveSection(sectionId: string, direction: "up" | "down") {
    setSiteSpec((prev) => {
      const page = prev.pages[0];
      if (!page) return prev;

      const index = page.sections.findIndex((section) => section.id === sectionId);
      if (index < 0) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= page.sections.length) return prev;

      const sections = [...page.sections];
      const [moved] = sections.splice(index, 1);
      sections.splice(targetIndex, 0, moved);

      return {
        ...prev,
        pages: prev.pages.map((currentPage, pageIndex) =>
          pageIndex === 0
            ? {
                ...currentPage,
                sections
              }
            : currentPage
        )
      };
    });
  }

  function applyThemePreset(preset: "ocean" | "sunset" | "mono") {
    const presetTheme =
      preset === "ocean"
        ? { primary: "#0f172a", secondary: "#0ea5e9", background: "#f0f9ff" }
        : preset === "sunset"
          ? { primary: "#7c2d12", secondary: "#f97316", background: "#fff7ed" }
          : { primary: "#111111", secondary: "#525252", background: "#fafafa" };

    setSiteSpec((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        ...presetTheme
      }
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
          Preset de estilo
          <select onChange={(event) => applyThemePreset(event.target.value as "ocean" | "sunset" | "mono")} defaultValue="">
            <option value="" disabled>
              Elegir preset
            </option>
            <option value="ocean">Ocean</option>
            <option value="sunset">Sunset</option>
            <option value="mono">Mono</option>
          </select>
        </label>
        <label>
          Título hero
          <input value={heroTitle} onChange={(event) => updateHeroTitle(event.target.value)} />
        </label>
        <label>
          Subtítulo hero
          <input value={heroSubtitle} onChange={(event) => updateSectionProp("hero", "subtitle", event.target.value)} />
        </label>
        <label>
          Título contacto
          <input value={contactTitle} onChange={(event) => updateSectionProp("contact", "title", event.target.value)} />
        </label>

        <div className="stack">
          <strong>Secciones activas</strong>
          {siteSpec.pages[0]?.sections.map((section, index, sections) => (
            <div
              key={section.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                padding: "0.5rem"
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  style={{ width: "auto" }}
                  type="checkbox"
                  checked={section.enabled}
                  onChange={() => toggleSection(section.id)}
                />
                {section.type}
              </label>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => moveSection(section.id, "up")}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => moveSection(section.id, "down")}
                  disabled={index === sections.length - 1}
                >
                  ↓
                </button>
              </div>
            </div>
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

"use client";

import { useEffect, useMemo, useState } from "react";

import { SiteRenderer, type EditorViewport } from "@/components/runtime/site-renderer";
import type { SiteSectionV2, SiteSpecV2 } from "@/lib/site-spec-v2";

type Props = {
  siteId: string;
  initialSpec: SiteSpecV2;
};

type EditorSaveState = "idle" | "saving" | "saved" | "error";

type SiteAsset = {
  id: string;
  kind: "uploaded" | "external";
  storage_path: string | null;
  public_url: string;
  mime_type: string | null;
  size_bytes: number | null;
  alt_text: string | null;
  created_at: string;
};

const SECTION_LIBRARY: Array<SiteSectionV2["type"]> = ["hero", "catalog", "testimonials", "contact"];

export function SiteEditor({ siteId, initialSpec }: Props) {
  const [siteSpec, setSiteSpec] = useState<SiteSpecV2>(initialSpec);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [lastPersistedHash, setLastPersistedHash] = useState(() => hashSpec(initialSpec));
  const [viewport, setViewport] = useState<EditorViewport>("desktop");

  const [assets, setAssets] = useState<SiteAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsMessage, setAssetsMessage] = useState<string | null>(null);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [externalAltText, setExternalAltText] = useState("");
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  const homepage = useMemo(() => siteSpec.pages.find((page) => page.slug === "/") ?? siteSpec.pages[0] ?? null, [siteSpec]);
  const currentHash = useMemo(() => hashSpec(siteSpec), [siteSpec]);
  const isDirty = currentHash !== lastPersistedHash;
  const savedAgoLabel = useSavedAgoLabel(lastSavedAt);

  useEffect(() => {
    void loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  useEffect(() => {
    if (!isDirty || publishing) {
      if (!isDirty && saveState === "saved") {
        setSaveState("idle");
      }
      return;
    }

    const specToSave = siteSpec;
    setSaveState("saving");

    const timeout = setTimeout(async () => {
      const result = await persistSpec(specToSave, "auto_save");
      if (!result.ok) {
        setSaveState("error");
        setMessage(result.error);
        return;
      }

      setSaveState("saved");
      setLastPersistedHash(result.hash);
      setLastSavedAt(Date.now());
    }, 2500);

    return () => clearTimeout(timeout);
  }, [isDirty, publishing, saveState, siteSpec]);

  function setHomepageSections(updater: (sections: SiteSectionV2[]) => SiteSectionV2[]) {
    if (!homepage) return;
    setSiteSpec((prev) => ({
      ...prev,
      pages: prev.pages.map((page) =>
        page.id === homepage.id
          ? {
              ...page,
              sections: updater(page.sections)
            }
          : page
      )
    }));
  }

  function updateSection(sectionId: string, updater: (section: SiteSectionV2) => SiteSectionV2) {
    setHomepageSections((sections) => sections.map((section) => (section.id === sectionId ? updater(section) : section)));
  }

  function toggleSection(sectionId: string) {
    updateSection(sectionId, (section) => ({ ...section, enabled: !section.enabled }));
  }

  function removeSection(sectionId: string) {
    setHomepageSections((sections) => sections.filter((section) => section.id !== sectionId));
  }

  function addSection(type: SiteSectionV2["type"]) {
    const nextIndex = (homepage?.sections.filter((section) => section.type === type).length ?? 0) + 1;
    const section = createDefaultSection(type, nextIndex);
    setHomepageSections((sections) => [...sections, section]);
  }

  function canAddSection(type: SiteSectionV2["type"]) {
    const sections = homepage?.sections ?? [];
    if (type === "hero") return !sections.some((section) => section.type === "hero");
    if (type === "contact") return !sections.some((section) => section.type === "contact");
    return true;
  }

  function moveSectionByIds(activeId: string, overId: string) {
    setHomepageSections((sections) => {
      const oldIndex = sections.findIndex((section) => section.id === activeId);
      const newIndex = sections.findIndex((section) => section.id === overId);
      if (oldIndex < 0 || newIndex < 0) return sections;
      const moved = [...sections];
      const [item] = moved.splice(oldIndex, 1);
      if (!item) return sections;
      moved.splice(newIndex, 0, item);
      return moved;
    });
  }

  function moveSectionByOffset(sectionId: string, offset: -1 | 1) {
    setHomepageSections((sections) => {
      const currentIndex = sections.findIndex((section) => section.id === sectionId);
      if (currentIndex < 0) return sections;

      const nextIndex = currentIndex + offset;
      if (nextIndex < 0 || nextIndex >= sections.length) return sections;

      const moved = [...sections];
      const [item] = moved.splice(currentIndex, 1);
      if (!item) return sections;
      moved.splice(nextIndex, 0, item);
      return moved;
    });
  }

  function updateThemeField<K extends keyof SiteSpecV2["theme"]>(field: K, value: SiteSpecV2["theme"][K]) {
    setSiteSpec((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        [field]: value
      }
    }));
  }

  function updateCatalogItem(
    sectionId: string,
    itemId: string,
    field: "name" | "description" | "price" | "image_url",
    value: string
  ) {
    updateSection(sectionId, (section) => {
      if (section.type !== "catalog") return section;

      return {
        ...section,
        props: {
          ...section.props,
          items: section.props.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
        }
      };
    });
  }

  function addCatalogItem(sectionId: string) {
    updateSection(sectionId, (section) => {
      if (section.type !== "catalog" || section.props.items.length >= 8) return section;

      const nextIndex = section.props.items.length + 1;
      return {
        ...section,
        props: {
          ...section.props,
          items: [
            ...section.props.items,
            {
              id: `item-${Date.now()}`,
              name: `Item ${nextIndex}`,
              description: "Descripción breve",
              price: "",
              image_url: ""
            }
          ]
        }
      };
    });
  }

  function removeCatalogItem(sectionId: string, itemId: string) {
    updateSection(sectionId, (section) => {
      if (section.type !== "catalog" || section.props.items.length <= 1) return section;
      return {
        ...section,
        props: {
          ...section.props,
          items: section.props.items.filter((item) => item.id !== itemId)
        }
      };
    });
  }

  function updateTestimonialItem(sectionId: string, itemId: string, field: "quote" | "author" | "role", value: string) {
    updateSection(sectionId, (section) => {
      if (section.type !== "testimonials") return section;
      return {
        ...section,
        props: {
          ...section.props,
          items: section.props.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
        }
      };
    });
  }

  function addTestimonialItem(sectionId: string) {
    updateSection(sectionId, (section) => {
      if (section.type !== "testimonials" || section.props.items.length >= 6) return section;

      const nextIndex = section.props.items.length + 1;
      return {
        ...section,
        props: {
          ...section.props,
          items: [
            ...section.props.items,
            {
              id: `test-${Date.now()}`,
              quote: "Testimonio",
              author: `Cliente ${nextIndex}`,
              role: ""
            }
          ]
        }
      };
    });
  }

  function removeTestimonialItem(sectionId: string, itemId: string) {
    updateSection(sectionId, (section) => {
      if (section.type !== "testimonials" || section.props.items.length <= 1) return section;
      return {
        ...section,
        props: {
          ...section.props,
          items: section.props.items.filter((item) => item.id !== itemId)
        }
      };
    });
  }

  function updateVariant(sectionId: string, variant: string) {
    updateSection(sectionId, (section) => {
      if (section.type === "hero") {
        return { ...section, variant: variant as (typeof section)["variant"] };
      }
      if (section.type === "catalog") {
        return { ...section, variant: variant as (typeof section)["variant"] };
      }
      if (section.type === "testimonials") {
        return { ...section, variant: variant as (typeof section)["variant"] };
      }
      return { ...section, variant: variant as (typeof section)["variant"] };
    });
  }

  async function persistSpec(specToPersist: SiteSpecV2, source: "auto_save" | "manual_checkpoint" | "manual") {
    const invalidImage = hasInvalidImageUrl(specToPersist);
    if (invalidImage) {
      return {
        ok: false as const,
        error: "Hay una URL de imagen inválida. Usa formato http:// o https://"
      };
    }

    const hash = hashSpec(specToPersist);
    const response = await fetch(`/api/sites/${siteId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteSpec: specToPersist, source })
    });

    const data = (await response.json()) as { error?: string; versionId?: string; deduped?: boolean };

    if (!response.ok || !data.versionId) {
      return {
        ok: false as const,
        error: data.error ?? "No se pudo guardar la versión"
      };
    }

    return {
      ok: true as const,
      versionId: data.versionId,
      deduped: data.deduped ?? false,
      hash
    };
  }

  async function saveCheckpoint() {
    setMessage(null);
    setSaveState("saving");
    const result = await persistSpec(siteSpec, "manual_checkpoint");
    if (!result.ok) {
      setSaveState("error");
      setMessage(result.error);
      return;
    }

    setSaveState("saved");
    setLastPersistedHash(result.hash);
    setLastSavedAt(Date.now());
    setMessage(`Checkpoint guardado (version_id: ${result.versionId})${result.deduped ? " sin cambios nuevos" : ""}`);
  }

  async function publish() {
    setPublishing(true);
    setMessage(null);

    const persisted = await persistSpec(siteSpec, "manual_checkpoint");
    if (!persisted.ok) {
      setMessage(persisted.error);
      setSaveState("error");
      setPublishing(false);
      return;
    }

    const response = await fetch(`/api/sites/${siteId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId: persisted.versionId })
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo publicar");
      setPublishing(false);
      return;
    }

    setLastPersistedHash(persisted.hash);
    setLastSavedAt(Date.now());
    setSaveState("saved");
    setMessage("Sitio publicado correctamente");
    setPublishing(false);
  }

  async function loadAssets() {
    setAssetsLoading(true);
    const response = await fetch(`/api/sites/${siteId}/assets`);
    const data = (await response.json()) as { error?: string; items?: SiteAsset[] };
    if (!response.ok) {
      setAssetsMessage(data.error ?? "No se pudo cargar la librería de imágenes.");
      setAssetsLoading(false);
      return;
    }
    setAssets(data.items ?? []);
    setAssetsLoading(false);
  }

  async function handleUploadAsset(file: File | null) {
    if (!file) return;
    setUploadingAsset(true);
    setAssetsMessage(null);

    const form = new FormData();
    form.set("file", file);

    const response = await fetch(`/api/sites/${siteId}/assets/upload`, {
      method: "POST",
      body: form
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setAssetsMessage(data.error ?? "No se pudo subir la imagen.");
      setUploadingAsset(false);
      return;
    }

    setAssetsMessage("Imagen subida correctamente.");
    setUploadingAsset(false);
    await loadAssets();
  }

  async function addExternalAsset() {
    if (!externalUrl.trim()) return;
    setAssetsMessage(null);

    const response = await fetch(`/api/sites/${siteId}/assets/external`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: externalUrl.trim(),
        altText: externalAltText.trim() || undefined
      })
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setAssetsMessage(data.error ?? "No se pudo registrar la URL externa.");
      return;
    }

    setExternalUrl("");
    setExternalAltText("");
    setAssetsMessage("URL externa agregada.");
    await loadAssets();
  }

  async function deleteAsset(assetId: string) {
    const response = await fetch(`/api/sites/${siteId}/assets/${assetId}`, {
      method: "DELETE"
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setAssetsMessage(data.error ?? "No se pudo eliminar el asset.");
      return;
    }

    setAssetsMessage("Asset eliminado.");
    await loadAssets();
  }

  function renderAssetPicker(onSelect: (url: string) => void) {
    if (!assets.length) return null;

    return (
      <select
        defaultValue=""
        onChange={(event) => {
          const selected = assets.find((asset) => asset.id === event.target.value);
          if (selected) onSelect(selected.public_url);
          event.currentTarget.value = "";
        }}
      >
        <option value="">Usar imagen de librería...</option>
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.kind === "uploaded" ? "Archivo" : "URL"} • {new Date(asset.created_at).toLocaleDateString()}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <section className="card stack">
        <h2>Editor Visual v2.1</h2>
        {!homepage ? <p>No hay una página inicial para editar.</p> : null}

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <span className="btn-secondary" style={{ cursor: "default" }}>
            Autosave activo
          </span>
          {saveState === "saving" ? <span>Guardando...</span> : null}
          {saveState === "saved" && savedAgoLabel ? <span>Guardado {savedAgoLabel}</span> : null}
          {saveState === "error" ? <span>Error al guardar</span> : null}
          {saveState === "idle" && !isDirty ? <span>Sin cambios</span> : null}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className={viewport === "desktop" ? "btn-primary" : "btn-secondary"} onClick={() => setViewport("desktop")}>
            Desktop
          </button>
          <button type="button" className={viewport === "mobile" ? "btn-primary" : "btn-secondary"} onClick={() => setViewport("mobile")}>
            Mobile
          </button>
        </div>
      </section>

      <section className="editor-layout">
        <aside className="card stack editor-pane">
          <h3>Biblioteca de secciones</h3>
          <div className="stack">
            {SECTION_LIBRARY.map((type) => (
              <button
                key={type}
                type="button"
                className="btn-secondary"
                onClick={() => addSection(type)}
                disabled={!canAddSection(type)}
              >
                Agregar {type}
              </button>
            ))}
          </div>

          <h3>Media manager</h3>
          <label>
            Subir imagen
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void handleUploadAsset(event.target.files?.[0] ?? null)}
              disabled={uploadingAsset}
            />
          </label>
          <label>
            URL externa
            <input value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://..." />
          </label>
          <label>
            Alt text (opcional)
            <input value={externalAltText} onChange={(event) => setExternalAltText(event.target.value)} />
          </label>
          <button type="button" className="btn-secondary" onClick={addExternalAsset}>
            Registrar URL externa
          </button>
          {assetsLoading ? <small>Cargando assets...</small> : null}
          {assetsMessage ? <small>{assetsMessage}</small> : null}
          <div className="asset-grid">
            {assets.map((asset) => (
              <article key={asset.id} className="card stack">
                <img src={asset.public_url} alt={asset.alt_text ?? "asset"} style={{ width: "100%", borderRadius: "0.5rem" }} />
                <small>{asset.kind === "uploaded" ? "Subida" : "Externa"}</small>
                <button type="button" className="btn-secondary" onClick={() => void deleteAsset(asset.id)}>
                  Eliminar
                </button>
              </article>
            ))}
          </div>
        </aside>

        <section className="card stack editor-pane">
          <h3>Contenido y estilo</h3>

          <label>
            Color primario
            <input type="color" value={siteSpec.theme.primary} onChange={(event) => updateThemeField("primary", event.target.value)} />
          </label>
          <label>
            Color secundario
            <input type="color" value={siteSpec.theme.secondary} onChange={(event) => updateThemeField("secondary", event.target.value)} />
          </label>
          <label>
            Fondo
            <input type="color" value={siteSpec.theme.background} onChange={(event) => updateThemeField("background", event.target.value)} />
          </label>
          <label>
            Tipografía títulos
            <input value={siteSpec.theme.font_heading} onChange={(event) => updateThemeField("font_heading", event.target.value)} />
          </label>
          <label>
            Tipografía cuerpo
            <input value={siteSpec.theme.font_body} onChange={(event) => updateThemeField("font_body", event.target.value)} />
          </label>
          <label>
            Radio de bordes
            <select
              value={siteSpec.theme.radius}
              onChange={(event) => updateThemeField("radius", event.target.value as SiteSpecV2["theme"]["radius"])}
            >
              <option value="sm">sm</option>
              <option value="md">md</option>
              <option value="lg">lg</option>
            </select>
          </label>

          {(homepage?.sections ?? []).map((section) => (
            <article
              key={section.id}
              className="card stack"
              draggable
              onDragStart={() => {
                setDraggingSectionId(section.id);
                setDragOverSectionId(section.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (dragOverSectionId !== section.id) {
                  setDragOverSectionId(section.id);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggingSectionId && draggingSectionId !== section.id) {
                  moveSectionByIds(draggingSectionId, section.id);
                }
                setDraggingSectionId(null);
                setDragOverSectionId(null);
              }}
              onDragEnd={() => {
                setDraggingSectionId(null);
                setDragOverSectionId(null);
              }}
              style={{
                opacity: draggingSectionId === section.id ? 0.65 : 1,
                outline: dragOverSectionId === section.id ? "2px dashed var(--color-primary)" : "none"
              }}
            >
              <button type="button" className="btn-secondary" style={{ width: "fit-content", cursor: "grab" }}>
                Arrastrar sección
              </button>
              <div className="stack">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}>
                    <strong>{section.type}</strong>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="button" className="btn-secondary" onClick={() => moveSectionByOffset(section.id, -1)}>
                        ↑
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => moveSectionByOffset(section.id, 1)}>
                        ↓
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => removeSection(section.id)}>
                        Quitar
                      </button>
                    </div>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={() => toggleSection(section.id)}
                      style={{ width: "auto" }}
                    />
                    Activa
                  </label>

                  <label>
                    Variante
                    <select value={section.variant} onChange={(event) => updateVariant(section.id, event.target.value)}>
                      {section.type === "hero" ? (
                        <>
                          <option value="centered">centered</option>
                          <option value="split">split</option>
                          <option value="image-left">image-left</option>
                        </>
                      ) : null}
                      {section.type === "catalog" ? (
                        <>
                          <option value="grid">grid</option>
                          <option value="cards">cards</option>
                          <option value="list">list</option>
                        </>
                      ) : null}
                      {section.type === "testimonials" ? (
                        <>
                          <option value="cards">cards</option>
                          <option value="minimal">minimal</option>
                          <option value="spotlight">spotlight</option>
                        </>
                      ) : null}
                      {section.type === "contact" ? (
                        <>
                          <option value="simple">simple</option>
                          <option value="highlight">highlight</option>
                          <option value="compact">compact</option>
                        </>
                      ) : null}
                    </select>
                  </label>

                  {section.type === "hero" ? (
                    <>
                      <label>
                        Headline
                        <input
                          value={section.props.headline}
                          onChange={(event) =>
                            updateSection(section.id, (s) =>
                              s.type === "hero" ? { ...s, props: { ...s.props, headline: event.target.value } } : s
                            )
                          }
                        />
                      </label>
                      <label>
                        Subheadline
                        <input
                          value={section.props.subheadline}
                          onChange={(event) =>
                            updateSection(section.id, (s) =>
                              s.type === "hero" ? { ...s, props: { ...s.props, subheadline: event.target.value } } : s
                            )
                          }
                        />
                      </label>
                      <label>
                        CTA label
                        <input
                          value={section.props.cta_label}
                          onChange={(event) =>
                            updateSection(section.id, (s) =>
                              s.type === "hero" ? { ...s, props: { ...s.props, cta_label: event.target.value } } : s
                            )
                          }
                        />
                      </label>
                      <label>
                        Imagen URL
                        <input
                          value={section.props.image_url ?? ""}
                          onChange={(event) =>
                            updateSection(section.id, (s) =>
                              s.type === "hero" ? { ...s, props: { ...s.props, image_url: event.target.value } } : s
                            )
                          }
                        />
                      </label>
                      {renderAssetPicker((url) =>
                        updateSection(section.id, (s) =>
                          s.type === "hero" ? { ...s, props: { ...s.props, image_url: url } } : s
                        )
                      )}
                    </>
                  ) : null}

                  {section.type === "catalog" ? (
                    <>
                      <label>
                        Título
                        <input
                          value={section.props.title}
                          onChange={(event) =>
                            updateSection(section.id, (s) =>
                              s.type === "catalog" ? { ...s, props: { ...s.props, title: event.target.value } } : s
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => addCatalogItem(section.id)}
                        disabled={section.props.items.length >= 8}
                      >
                        Agregar item
                      </button>
                      {section.props.items.map((item) => (
                        <div key={item.id} className="card stack">
                          <label>
                            Nombre
                            <input value={item.name} onChange={(event) => updateCatalogItem(section.id, item.id, "name", event.target.value)} />
                          </label>
                          <label>
                            Descripción
                            <input
                              value={item.description}
                              onChange={(event) => updateCatalogItem(section.id, item.id, "description", event.target.value)}
                            />
                          </label>
                          <label>
                            Precio
                            <input value={item.price ?? ""} onChange={(event) => updateCatalogItem(section.id, item.id, "price", event.target.value)} />
                          </label>
                          <label>
                            Imagen URL
                            <input
                              value={item.image_url ?? ""}
                              onChange={(event) => updateCatalogItem(section.id, item.id, "image_url", event.target.value)}
                            />
                          </label>
                          {renderAssetPicker((url) => updateCatalogItem(section.id, item.id, "image_url", url))}
                          <button type="button" className="btn-secondary" onClick={() => removeCatalogItem(section.id, item.id)}>
                            Eliminar item
                          </button>
                        </div>
                      ))}
                    </>
                  ) : null}

                  {section.type === "testimonials" ? (
                    <>
                      <label>
                        Título
                        <input
                          value={section.props.title}
                          onChange={(event) =>
                            updateSection(section.id, (s) =>
                              s.type === "testimonials" ? { ...s, props: { ...s.props, title: event.target.value } } : s
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => addTestimonialItem(section.id)}
                        disabled={section.props.items.length >= 6}
                      >
                        Agregar testimonio
                      </button>
                      {section.props.items.map((item) => (
                        <div key={item.id} className="card stack">
                          <label>
                            Cita
                            <input
                              value={item.quote}
                              onChange={(event) => updateTestimonialItem(section.id, item.id, "quote", event.target.value)}
                            />
                          </label>
                          <label>
                            Autor
                            <input
                              value={item.author}
                              onChange={(event) => updateTestimonialItem(section.id, item.id, "author", event.target.value)}
                            />
                          </label>
                          <label>
                            Rol
                            <input
                              value={item.role ?? ""}
                              onChange={(event) => updateTestimonialItem(section.id, item.id, "role", event.target.value)}
                            />
                          </label>
                          <button type="button" className="btn-secondary" onClick={() => removeTestimonialItem(section.id, item.id)}>
                            Eliminar testimonio
                          </button>
                        </div>
                      ))}
                    </>
                  ) : null}

                  {section.type === "contact" ? (
                    <>
                      <label>
                        Título
                        <input
                          value={section.props.title}
                          onChange={(event) =>
                            updateSection(section.id, (s) =>
                              s.type === "contact" ? { ...s, props: { ...s.props, title: event.target.value } } : s
                            )
                          }
                        />
                      </label>
                      <label>
                        Descripción
                        <input
                          value={section.props.description}
                          onChange={(event) =>
                            updateSection(section.id, (s) =>
                              s.type === "contact" ? { ...s, props: { ...s.props, description: event.target.value } } : s
                            )
                          }
                        />
                      </label>
                      <label>
                        WhatsApp
                        <input
                          value={section.props.whatsapp_phone ?? ""}
                          onChange={(event) =>
                            updateSection(section.id, (s) =>
                              s.type === "contact" ? { ...s, props: { ...s.props, whatsapp_phone: event.target.value } } : s
                            )
                          }
                        />
                      </label>
                      <label>
                        Label WhatsApp
                        <input
                          value={section.props.whatsapp_label ?? ""}
                          onChange={(event) =>
                            updateSection(section.id, (s) =>
                              s.type === "contact" ? { ...s, props: { ...s.props, whatsapp_label: event.target.value } } : s
                            )
                          }
                        />
                      </label>
                      <label>
                        Dirección
                        <input
                          value={section.props.address ?? ""}
                          onChange={(event) =>
                            updateSection(section.id, (s) =>
                              s.type === "contact" ? { ...s, props: { ...s.props, address: event.target.value } } : s
                            )
                          }
                        />
                      </label>
                    </>
                  ) : null}
              </div>
            </article>
          ))}

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="btn-secondary" type="button" onClick={() => void saveCheckpoint()}>
              Guardar checkpoint
            </button>
            <button className="btn-primary" type="button" onClick={() => void publish()} disabled={publishing}>
              {publishing ? "Publicando..." : "Publicar"}
            </button>
          </div>
          {message ? <p>{message}</p> : null}
        </section>

        <section className="card stack editor-pane">
          <h3>Preview realtime</h3>
          <SiteRenderer spec={siteSpec} viewport={viewport} />
        </section>
      </section>
    </div>
  );
}

function createDefaultSection(type: SiteSectionV2["type"], index: number): SiteSectionV2 {
  const id = `${type}-${Date.now()}-${index}`;

  if (type === "hero") {
    return {
      id,
      type: "hero",
      enabled: true,
      variant: "centered",
      props: {
        headline: "Tu propuesta de valor",
        subheadline: "Describe aquí por qué tu negocio es la mejor opción.",
        cta_label: "Hablar por WhatsApp",
        image_url: ""
      }
    };
  }

  if (type === "catalog") {
    return {
      id,
      type: "catalog",
      enabled: true,
      variant: "cards",
      props: {
        title: "Catálogo",
        items: [
          {
            id: `item-${Date.now()}`,
            name: "Producto o servicio",
            description: "Descripción breve",
            price: "",
            image_url: ""
          }
        ]
      }
    };
  }

  if (type === "testimonials") {
    return {
      id,
      type: "testimonials",
      enabled: true,
      variant: "cards",
      props: {
        title: "Testimonios",
        items: [
          {
            id: `test-${Date.now()}`,
            quote: "Excelente experiencia.",
            author: "Cliente",
            role: ""
          }
        ]
      }
    };
  }

  return {
    id,
    type: "contact",
    enabled: true,
    variant: "simple",
    props: {
      title: "Contáctanos",
      description: "Escríbenos y te respondemos pronto.",
      whatsapp_phone: "",
      whatsapp_label: "Escribir por WhatsApp",
      address: ""
    }
  };
}

function hasInvalidImageUrl(spec: SiteSpecV2) {
  const sections = spec.pages[0]?.sections ?? [];
  const isValid = (value: string | undefined) => !value || /^https?:\/\//i.test(value);

  for (const section of sections) {
    if (section.type === "hero" && !isValid(section.props.image_url)) {
      return true;
    }

    if (section.type === "catalog") {
      for (const item of section.props.items) {
        if (!isValid(item.image_url)) {
          return true;
        }
      }
    }
  }

  return false;
}

function hashSpec(spec: SiteSpecV2) {
  return JSON.stringify(spec);
}

function useSavedAgoLabel(lastSavedAt: number | null) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!lastSavedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  if (!lastSavedAt) return null;
  const diffSec = Math.max(0, Math.floor((now - lastSavedAt) / 1000));
  if (diffSec < 2) return "justo ahora";
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  return `hace ${diffMin}m`;
}

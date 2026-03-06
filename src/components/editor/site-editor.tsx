"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CanvasBlock, CanvasLayoutRect, SiteSectionV3, SiteSpecV3 } from "@/lib/site-spec-v3";

type Props = {
  siteId: string;
  initialSpec: SiteSpecV3;
};

type EditorSaveState = "idle" | "saving" | "saved" | "error";
type EditorViewport = "desktop" | "mobile";
type DragMode = "move" | "resize";

type SelectedBlock = {
  sectionId: string;
  blockId: string;
};

type DragState = {
  mode: DragMode;
  sectionId: string;
  blockId: string;
  startX: number;
  startY: number;
  initialRect: CanvasLayoutRect;
};

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

const PREVIEW_WIDTH: Record<EditorViewport, number> = {
  desktop: 1120,
  mobile: 390
};

const SECTION_LIBRARY: Array<SiteSectionV3["type"]> = ["hero", "catalog", "testimonials", "contact"];
const BLOCK_LIBRARY: Array<CanvasBlock["type"]> = ["text", "image", "button", "shape", "container"];

export function SiteEditor({ siteId, initialSpec }: Props) {
  const [siteSpec, setSiteSpec] = useState<SiteSpecV3>(initialSpec);
  const [viewport, setViewport] = useState<EditorViewport>("desktop");
  const [selected, setSelected] = useState<SelectedBlock | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [lastPersistedHash, setLastPersistedHash] = useState(() => hashSpec(initialSpec));
  const [message, setMessage] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);

  const [assets, setAssets] = useState<SiteAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsMessage, setAssetsMessage] = useState<string | null>(null);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [externalAltText, setExternalAltText] = useState("");

  const currentHash = useMemo(() => hashSpec(siteSpec), [siteSpec]);
  const isDirty = currentHash !== lastPersistedHash;
  const savedAgoLabel = useSavedAgoLabel(lastSavedAt);
  const home = useMemo(() => siteSpec.pages.find((page) => page.slug === "/") ?? siteSpec.pages[0] ?? null, [siteSpec]);
  const selectedSection = home?.sections.find((section) => section.id === selected?.sectionId) ?? null;
  const selectedBlock = selectedSection?.blocks.find((block) => block.id === selected?.blockId) ?? null;

  useEffect(() => {
    void loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  useEffect(() => {
    if (!isDirty || publishing) {
      if (!isDirty && saveState === "saved") setSaveState("idle");
      return;
    }

    const timeout = setTimeout(async () => {
      setSaveState("saving");
      const result = await persistSpec(siteSpec, "canvas_auto_save");
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

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;

      const section = home?.sections.find((item) => item.id === drag.sectionId);
      if (!section) return;

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      const maxW = PREVIEW_WIDTH[viewport];
      const maxH = viewport === "mobile" ? section.height.mobile : section.height.desktop;

      if (drag.mode === "move") {
        const nextRect = clampRect(
          {
            ...drag.initialRect,
            x: drag.initialRect.x + deltaX,
            y: drag.initialRect.y + deltaY
          },
          maxW,
          maxH
        );
        updateBlockRect(drag.sectionId, drag.blockId, nextRect);
        return;
      }

      const resized = clampRect(
        {
          ...drag.initialRect,
          w: drag.initialRect.w + deltaX,
          h: drag.initialRect.h + deltaY
        },
        maxW,
        maxH
      );
      updateBlockRect(drag.sectionId, drag.blockId, resized);
    };

    const onMouseUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [home?.sections, viewport]);

  function setHomeSections(updater: (sections: SiteSectionV3[]) => SiteSectionV3[]) {
    if (!home) return;

    setSiteSpec((prev) => ({
      ...prev,
      pages: prev.pages.map((page) =>
        page.id === home.id
          ? {
              ...page,
              sections: updater(page.sections)
            }
          : page
      )
    }));
  }

  function updateSection(sectionId: string, updater: (section: SiteSectionV3) => SiteSectionV3) {
    setHomeSections((sections) => sections.map((section) => (section.id === sectionId ? updater(section) : section)));
  }

  function updateBlock(sectionId: string, blockId: string, updater: (block: CanvasBlock) => CanvasBlock) {
    updateSection(sectionId, (section) => ({
      ...section,
      blocks: section.blocks.map((block) => (block.id === blockId ? updater(block) : block))
    }));
  }

  function updateBlockRect(sectionId: string, blockId: string, nextRect: CanvasLayoutRect) {
    updateBlock(sectionId, blockId, (block) => ({
      ...block,
      layout: {
        ...block.layout,
        [viewport]: nextRect
      }
    }));
  }

  function addSection(type: SiteSectionV3["type"]) {
    const index = (home?.sections.filter((item) => item.type === type).length ?? 0) + 1;
    const section = createDefaultSection(type, index);
    setHomeSections((sections) => [...sections, section]);
  }

  function removeSection(sectionId: string) {
    setHomeSections((sections) => sections.filter((section) => section.id !== sectionId));
    if (selected?.sectionId === sectionId) setSelected(null);
  }

  function addBlock(sectionId: string, type: CanvasBlock["type"]) {
    const section = home?.sections.find((item) => item.id === sectionId);
    if (!section) return;

    const index = section.blocks.length + 1;
    const block = createDefaultBlock(sectionId, type, index, viewport);
    updateSection(sectionId, (current) => ({
      ...current,
      blocks: [...current.blocks, block]
    }));
    setSelected({ sectionId, blockId: block.id });
  }

  function deleteSelectedBlock() {
    if (!selected) return;
    updateSection(selected.sectionId, (section) => ({
      ...section,
      blocks: section.blocks.filter((block) => block.id !== selected.blockId)
    }));
    setSelected(null);
  }

  function duplicateSelectedBlock() {
    if (!selected || !selectedBlock) return;
    const cloned = structuredClone(selectedBlock);
    cloned.id = `${selectedBlock.id}-copy-${Date.now()}`;
    const rect = getBlockRect(cloned, viewport);
    cloned.layout = {
      ...cloned.layout,
      [viewport]: {
        ...rect,
        x: rect.x + 16,
        y: rect.y + 16,
        z: rect.z + 1
      }
    };

    updateSection(selected.sectionId, (section) => ({
      ...section,
      blocks: [...section.blocks, cloned]
    }));

    setSelected({ sectionId: selected.sectionId, blockId: cloned.id });
  }

  function startDragging(event: React.MouseEvent, sectionId: string, block: CanvasBlock, mode: DragMode) {
    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      mode,
      sectionId,
      blockId: block.id,
      startX: event.clientX,
      startY: event.clientY,
      initialRect: getBlockRect(block, viewport)
    };
    setSelected({ sectionId, blockId: block.id });
  }

  async function persistSpec(specToPersist: SiteSpecV3, source: "canvas_auto_save" | "canvas_manual_checkpoint" | "manual") {
    if (hasInvalidImageUrl(specToPersist)) {
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

    const result = await persistSpec(siteSpec, "canvas_manual_checkpoint");
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

    const persisted = await persistSpec(siteSpec, "canvas_manual_checkpoint");
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

  function applyAssetToSelected(url: string) {
    if (!selected || !selectedBlock || selectedBlock.type !== "image") return;
    updateBlock(selected.sectionId, selected.blockId, (block) =>
      block.type === "image" ? { ...block, content: { ...block.content, url } } : block
    );
  }

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <section className="card stack">
        <h2>Canvas Editor v3</h2>
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
          <h3>Secciones</h3>
          <div className="stack">
            {SECTION_LIBRARY.map((type) => (
              <button key={type} type="button" className="btn-secondary" onClick={() => addSection(type)}>
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
          <h3>Inspector</h3>

          <label>
            Color primario
            <input
              type="color"
              value={siteSpec.theme.primary}
              onChange={(event) => setSiteSpec((prev) => ({ ...prev, theme: { ...prev.theme, primary: event.target.value } }))}
            />
          </label>
          <label>
            Color secundario
            <input
              type="color"
              value={siteSpec.theme.secondary}
              onChange={(event) => setSiteSpec((prev) => ({ ...prev, theme: { ...prev.theme, secondary: event.target.value } }))}
            />
          </label>
          <label>
            Fondo
            <input
              type="color"
              value={siteSpec.theme.background}
              onChange={(event) => setSiteSpec((prev) => ({ ...prev, theme: { ...prev.theme, background: event.target.value } }))}
            />
          </label>

          {selectedSection ? (
            <>
              <strong>Sección seleccionada: {selectedSection.type}</strong>
              <label>
                Variante
                <select
                  value={selectedSection.variant}
                  onChange={(event) =>
                    updateSection(selectedSection.id, (section) => ({
                      ...section,
                      variant: event.target.value as SiteSectionV3["variant"]
                    }))
                  }
                >
                  <option value="centered">centered</option>
                  <option value="split">split</option>
                  <option value="image-left">image-left</option>
                  <option value="grid">grid</option>
                  <option value="cards">cards</option>
                  <option value="list">list</option>
                  <option value="minimal">minimal</option>
                  <option value="spotlight">spotlight</option>
                  <option value="simple">simple</option>
                  <option value="highlight">highlight</option>
                  <option value="compact">compact</option>
                </select>
              </label>
              {selectedSection.type === "hero" && selectedSection.variant === "centered" ? (
                <small>
                  Esta variante puede ocultar el bloque de imagen principal. Puedes activar su visibilidad desde la lista de
                  bloques.
                </small>
              ) : null}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {BLOCK_LIBRARY.map((type) => (
                  <button key={type} type="button" className="btn-secondary" onClick={() => addBlock(selectedSection.id, type)}>
                    + {type}
                  </button>
                ))}
                <button type="button" className="btn-secondary" onClick={() => removeSection(selectedSection.id)}>
                  Eliminar sección
                </button>
              </div>
              <div className="card stack">
                <small>Bloques de la sección</small>
                {selectedSection.blocks.map((block) => (
                  <div key={block.id} style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" className="btn-secondary" onClick={() => setSelected({ sectionId: selectedSection.id, blockId: block.id })}>
                      {block.type} {block.visible ? "" : "(oculto)"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        updateBlock(selectedSection.id, block.id, (item) => ({
                          ...item,
                          visible: !item.visible
                        }))
                      }
                    >
                      {block.visible ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <small>Haz click sobre un bloque en el preview para editarlo.</small>
          )}

          {selected && selectedBlock ? (
            <div className="card stack">
              <strong>Bloque: {selectedBlock.type}</strong>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" className="btn-secondary" onClick={duplicateSelectedBlock}>
                  Duplicar
                </button>
                <button type="button" className="btn-secondary" onClick={deleteSelectedBlock}>
                  Eliminar
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    updateBlock(selected.sectionId, selected.blockId, (block) => ({ ...block, visible: !block.visible }))
                  }
                >
                  {selectedBlock.visible ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              <label>
                X
                <input
                  type="number"
                  value={getBlockRect(selectedBlock, viewport).x}
                  onChange={(event) =>
                    updateBlockRect(selected.sectionId, selected.blockId, {
                      ...getBlockRect(selectedBlock, viewport),
                      x: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  value={getBlockRect(selectedBlock, viewport).y}
                  onChange={(event) =>
                    updateBlockRect(selected.sectionId, selected.blockId, {
                      ...getBlockRect(selectedBlock, viewport),
                      y: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                W
                <input
                  type="number"
                  value={getBlockRect(selectedBlock, viewport).w}
                  onChange={(event) =>
                    updateBlockRect(selected.sectionId, selected.blockId, {
                      ...getBlockRect(selectedBlock, viewport),
                      w: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                H
                <input
                  type="number"
                  value={getBlockRect(selectedBlock, viewport).h}
                  onChange={(event) =>
                    updateBlockRect(selected.sectionId, selected.blockId, {
                      ...getBlockRect(selectedBlock, viewport),
                      h: Number(event.target.value)
                    })
                  }
                />
              </label>

              <label>
                Tamaño texto
                <input
                  type="number"
                  value={selectedBlock.style.fontSize ?? ""}
                  onChange={(event) =>
                    updateBlock(selected.sectionId, selected.blockId, (block) => ({
                      ...block,
                      style: {
                        ...block.style,
                        fontSize: Number(event.target.value) || undefined
                      }
                    }))
                  }
                />
              </label>
              <label>
                Color texto
                <input
                  type="color"
                  value={selectedBlock.style.color ?? "#0f172a"}
                  onChange={(event) =>
                    updateBlock(selected.sectionId, selected.blockId, (block) => ({
                      ...block,
                      style: {
                        ...block.style,
                        color: event.target.value
                      }
                    }))
                  }
                />
              </label>
              <label>
                Fondo
                <input
                  type="color"
                  value={selectedBlock.style.bgColor ?? "#ffffff"}
                  onChange={(event) =>
                    updateBlock(selected.sectionId, selected.blockId, (block) => ({
                      ...block,
                      style: {
                        ...block.style,
                        bgColor: event.target.value
                      }
                    }))
                  }
                />
              </label>
              <label>
                Opacidad
                <input
                  type="number"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={selectedBlock.style.opacity ?? 1}
                  onChange={(event) =>
                    updateBlock(selected.sectionId, selected.blockId, (block) => ({
                      ...block,
                      style: {
                        ...block.style,
                        opacity: Number(event.target.value)
                      }
                    }))
                  }
                />
              </label>

              {selectedBlock.type === "text" ? (
                <label>
                  Texto
                  <textarea
                    rows={4}
                    value={selectedBlock.content.text}
                    onChange={(event) =>
                      updateBlock(selected.sectionId, selected.blockId, (block) =>
                        block.type === "text"
                          ? {
                              ...block,
                              content: { ...block.content, text: event.target.value }
                            }
                          : block
                      )
                    }
                  />
                </label>
              ) : null}

              {selectedBlock.type === "image" ? (
                <>
                  <label>
                    Imagen URL
                    <input
                      value={selectedBlock.content.url ?? ""}
                      onChange={(event) =>
                        updateBlock(selected.sectionId, selected.blockId, (block) =>
                          block.type === "image"
                            ? {
                                ...block,
                                content: { ...block.content, url: event.target.value }
                              }
                            : block
                        )
                      }
                    />
                  </label>
                  <label>
                    Alt text
                    <input
                      value={selectedBlock.content.alt ?? ""}
                      onChange={(event) =>
                        updateBlock(selected.sectionId, selected.blockId, (block) =>
                          block.type === "image"
                            ? {
                                ...block,
                                content: { ...block.content, alt: event.target.value }
                              }
                            : block
                        )
                      }
                    />
                  </label>
                  {assets.length ? (
                    <select defaultValue="" onChange={(event) => applyAssetToSelected(assets.find((asset) => asset.id === event.target.value)?.public_url ?? "")}>
                      <option value="">Usar imagen de librería...</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.kind === "uploaded" ? "Archivo" : "URL"} • {new Date(asset.created_at).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </>
              ) : null}

              {selectedBlock.type === "button" ? (
                <>
                  <label>
                    Label
                    <input
                      value={selectedBlock.content.label}
                      onChange={(event) =>
                        updateBlock(selected.sectionId, selected.blockId, (block) =>
                          block.type === "button"
                            ? {
                                ...block,
                                content: { ...block.content, label: event.target.value }
                              }
                            : block
                        )
                      }
                    />
                  </label>
                  <label>
                    Acción
                    <select
                      value={selectedBlock.content.action}
                      onChange={(event) =>
                        updateBlock(selected.sectionId, selected.blockId, (block) =>
                          block.type === "button"
                            ? {
                                ...block,
                                content: { ...block.content, action: event.target.value as "whatsapp" | "link" }
                              }
                            : block
                        )
                      }
                    >
                      <option value="whatsapp">whatsapp</option>
                      <option value="link">link</option>
                    </select>
                  </label>
                  {selectedBlock.content.action === "link" ? (
                    <label>
                      URL
                      <input
                        value={selectedBlock.content.href ?? ""}
                        onChange={(event) =>
                          updateBlock(selected.sectionId, selected.blockId, (block) =>
                            block.type === "button"
                              ? {
                                  ...block,
                                  content: { ...block.content, href: event.target.value }
                                }
                              : block
                          )
                        }
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

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
          <h3>Preview canvas</h3>
          <div
            style={{
              width: PREVIEW_WIDTH[viewport],
              maxWidth: "100%",
              margin: "0 auto",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              overflow: "hidden",
              background: siteSpec.theme.background
            }}
          >
            {(home?.sections ?? [])
              .filter((section) => section.enabled)
              .map((section) => (
                <article
                  key={section.id}
                  style={{
                    position: "relative",
                    minHeight: viewport === "mobile" ? section.height.mobile : section.height.desktop,
                    borderBottom: `1px solid ${siteSpec.theme.secondary}30`
                  }}
                  onClick={() => setSelected((prev) => (prev?.sectionId === section.id ? prev : { sectionId: section.id, blockId: section.blocks[0]?.id ?? "" }))}
                >
                  {section.blocks
                    .filter((block) => block.visible)
                    .map((block) => {
                      const rect = getBlockRect(block, viewport);
                      const isSelected = selected?.sectionId === section.id && selected?.blockId === block.id;

                      return (
                        <div
                          key={block.id}
                          style={{
                            position: "absolute",
                            left: rect.x,
                            top: rect.y,
                            width: rect.w,
                            height: rect.h,
                            zIndex: rect.z,
                            borderRadius: block.style.radius ?? 0,
                            color: block.style.color,
                            background: block.style.bgColor,
                            borderStyle: block.style.borderWidth ? "solid" : undefined,
                            borderWidth: block.style.borderWidth,
                            borderColor: block.style.borderColor,
                            opacity: block.style.opacity,
                            fontSize: block.style.fontSize,
                            fontWeight: block.style.fontWeight,
                            textAlign: block.style.textAlign as "left" | "center" | "right" | undefined,
                            overflow: "hidden",
                            outline: isSelected ? "2px solid #0ea5e9" : "1px dashed transparent",
                            boxSizing: "border-box",
                            cursor: "move",
                            padding: block.type === "text" ? 8 : 0
                          }}
                          onMouseDown={(event) => startDragging(event, section.id, block, "move")}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected({ sectionId: section.id, blockId: block.id });
                          }}
                        >
                          {block.type === "text" ? block.content.text : null}
                          {block.type === "image" ? (
                            <img
                              src={block.content.url || "https://placehold.co/800x520?text=Imagen"}
                              alt={block.content.alt ?? "Imagen"}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : null}
                          {block.type === "button" ? (
                            <button type="button" style={{ width: "100%", height: "100%", border: "none", background: "transparent", color: "inherit" }}>
                              {block.content.label}
                            </button>
                          ) : null}
                          {block.type === "shape" ? <div style={{ width: "100%", height: "100%" }} /> : null}
                          {block.type === "container" ? <div style={{ width: "100%", height: "100%" }} /> : null}
                          {isSelected ? (
                            <div
                              onMouseDown={(event) => startDragging(event, section.id, block, "resize")}
                              style={{
                                position: "absolute",
                                right: 2,
                                bottom: 2,
                                width: 14,
                                height: 14,
                                borderRadius: 4,
                                background: "#0ea5e9",
                                cursor: "nwse-resize"
                              }}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                </article>
              ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function createDefaultSection(type: SiteSectionV3["type"], index: number): SiteSectionV3 {
  const id = `${type}-${Date.now()}-${index}`;

  if (type === "hero") {
    return {
      id,
      type: "hero",
      enabled: true,
      variant: "centered",
      height: { desktop: 520, mobile: 540 },
      blocks: [
        createDefaultBlock(id, "text", 1, "desktop"),
        createDefaultBlock(id, "button", 2, "desktop")
      ]
    };
  }

  if (type === "catalog") {
    return {
      id,
      type: "catalog",
      enabled: true,
      variant: "cards",
      height: { desktop: 620, mobile: 900 },
      blocks: [createDefaultBlock(id, "container", 1, "desktop")]
    };
  }

  if (type === "testimonials") {
    return {
      id,
      type: "testimonials",
      enabled: true,
      variant: "cards",
      height: { desktop: 520, mobile: 700 },
      blocks: [createDefaultBlock(id, "text", 1, "desktop")]
    };
  }

  return {
    id,
    type: "contact",
    enabled: true,
    variant: "simple",
    height: { desktop: 360, mobile: 420 },
    blocks: [createDefaultBlock(id, "text", 1, "desktop"), createDefaultBlock(id, "button", 2, "desktop")]
  };
}

function createDefaultBlock(sectionId: string, type: CanvasBlock["type"], index: number, viewport: EditorViewport): CanvasBlock {
  const desktop = { x: 40 + index * 12, y: 50 + index * 12, w: 260, h: 90, z: index + 1 };
  const mobile = { x: 24, y: 40 + index * 14, w: 300, h: 86, z: index + 1 };
  const layout = viewport === "mobile" ? { desktop, mobile } : { desktop };

  if (type === "text") {
    return {
      id: `${sectionId}-text-${Date.now()}`,
      type: "text",
      visible: true,
      layout,
      style: { fontSize: 22, fontWeight: 700, color: "#0f172a" },
      content: { text: "Texto editable" }
    };
  }

  if (type === "image") {
    return {
      id: `${sectionId}-image-${Date.now()}`,
      type: "image",
      visible: true,
      layout: {
        ...layout,
        desktop: { ...desktop, h: 180 },
        mobile: { ...mobile, h: 150 }
      },
      style: { radius: 12 },
      content: { url: "", alt: "" }
    };
  }

  if (type === "button") {
    return {
      id: `${sectionId}-button-${Date.now()}`,
      type: "button",
      visible: true,
      layout: {
        ...layout,
        desktop: { ...desktop, w: 220, h: 50 },
        mobile: { ...mobile, w: 220, h: 48 }
      },
      style: { bgColor: "#0c4a6e", color: "#ffffff", radius: 12, fontWeight: 700, textAlign: "center" },
      content: { label: "Botón", action: "whatsapp" }
    };
  }

  if (type === "shape") {
    return {
      id: `${sectionId}-shape-${Date.now()}`,
      type: "shape",
      visible: true,
      layout,
      style: { bgColor: "#e2e8f0", radius: 12 },
      content: { shape: "rect" }
    };
  }

  return {
    id: `${sectionId}-container-${Date.now()}`,
    type: "container",
    visible: true,
    layout: {
      ...layout,
      desktop: { ...desktop, w: 300, h: 260 },
      mobile: { ...mobile, w: 320, h: 220 }
    },
    style: { bgColor: "#ffffff", borderColor: "#cbd5e1", borderWidth: 1, radius: 14 },
    content: {}
  };
}

function getBlockRect(block: CanvasBlock, viewport: EditorViewport) {
  if (viewport === "mobile" && block.layout.mobile) return block.layout.mobile;
  return block.layout.desktop;
}

function clampRect(rect: CanvasLayoutRect, maxW: number, maxH: number): CanvasLayoutRect {
  const w = Math.max(40, Math.min(rect.w, maxW));
  const h = Math.max(24, Math.min(rect.h, maxH));
  const x = Math.max(0, Math.min(rect.x, maxW - w));
  const y = Math.max(0, Math.min(rect.y, maxH - h));
  return { ...rect, x, y, w, h };
}

function hasInvalidImageUrl(spec: SiteSpecV3) {
  for (const page of spec.pages) {
    for (const section of page.sections) {
      for (const block of section.blocks) {
        if (block.type !== "image") continue;
        const url = block.content.url?.trim();
        if (!url) continue;
        if (!/^https?:\/\//i.test(url)) return true;
      }
    }
  }
  return false;
}

function hashSpec(spec: SiteSpecV3) {
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

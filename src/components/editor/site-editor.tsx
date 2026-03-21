"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import type { CanvasBlock, CanvasLayoutRect, SiteSectionV3, SiteSpecV3 } from "@/lib/site-spec-v3";
import { CANVAS_BASE_WIDTH, fontFamilies, normalizeSiteSpecV3 } from "@/lib/site-spec-v3";
import type { TemplateId } from "@/lib/templates/types";

type Props = {
  siteId: string;
  siteName: string;
  subdomain: string;
  initialSpec: SiteSpecV3;
  initialMigrated?: boolean;
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
  initialRectPx: CanvasLayoutRect;
  sectionWidth: number;
  sectionHeight: number;
};

type SectionDragState = {
  sectionId: string;
  startY: number;
  initialHeight: number;
  sectionWidth: number;
  viewport: EditorViewport;
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

type TemplateCard = {
  id: TemplateId;
  name: string;
  description: string;
  tags: string[];
  family: SiteSpecV3["template"]["family"];
  site_type: "informative" | "commerce_lite";
  preview_label: string;
  theme: SiteSpecV3["theme"];
  variants: Record<SiteSectionV3["type"], SiteSectionV3["variant"]>;
};

const MIN_BLOCK_SIZE = {
  w: 40,
  h: 24
};

const SECTION_LIBRARY: Array<SiteSectionV3["type"]> = ["hero", "catalog", "testimonials", "contact"];
const BLOCK_LIBRARY: Array<CanvasBlock["type"]> = ["text", "image", "button", "product", "shape", "container"];

export function SiteEditor({ siteId, siteName, subdomain, initialSpec, initialMigrated }: Props) {
  const normalized = useMemo(() => normalizeSiteSpecV3(initialSpec) ?? { spec: initialSpec, migrated: false }, [initialSpec]);
  const [siteSpec, setSiteSpec] = useState<SiteSpecV3>(normalized.spec);
  const [wasMigrated] = useState(() => initialMigrated ?? normalized.migrated);
  const [viewport, setViewport] = useState<EditorViewport>("desktop");
  const [selected, setSelected] = useState<SelectedBlock | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [lastPersistedHash, setLastPersistedHash] = useState(() => hashSpec(normalized.spec));
  const [message, setMessage] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const sectionDragRef = useRef<SectionDragState | null>(null);
  const migrationRunRef = useRef(false);
  const [leftTab, setLeftTab] = useState<"templates" | "sections" | "layers">("templates");
  const [rightTab, setRightTab] = useState<"content" | "style" | "position">("content");
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(CANVAS_BASE_WIDTH.desktop);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const [assets, setAssets] = useState<SiteAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsMessage, setAssetsMessage] = useState<string | null>(null);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [externalAltText, setExternalAltText] = useState("");
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesMessage, setTemplatesMessage] = useState<string | null>(null);
  const [blockTargetSectionId, setBlockTargetSectionId] = useState<string | null>(null);
  const [sectionAddType, setSectionAddType] = useState<SiteSectionV3["type"]>(SECTION_LIBRARY[0]);
  const [blockAddType, setBlockAddType] = useState<CanvasBlock["type"]>(BLOCK_LIBRARY[0]);
  const [draggingBlockType, setDraggingBlockType] = useState<CanvasBlock["type"] | null>(null);
  const [canvasDropSectionId, setCanvasDropSectionId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  const currentHash = useMemo(() => hashSpec(siteSpec), [siteSpec]);
  const isDirty = currentHash !== lastPersistedHash;
  const savedAgoLabel = useSavedAgoLabel(lastSavedAt);
  const home = useMemo(() => siteSpec.pages.find((page) => page.slug === "/") ?? siteSpec.pages[0] ?? null, [siteSpec]);
  const selectedSection = home?.sections.find((section) => section.id === selected?.sectionId) ?? null;
  const selectedBlock = selectedSection?.blocks.find((block) => block.id === selected?.blockId) ?? null;
  const activeSectionId = selected?.sectionId ?? selectedSectionId ?? home?.sections[0]?.id ?? null;
  const activeSection = home?.sections.find((section) => section.id === activeSectionId) ?? null;
  const blockTargetSection =
    (blockTargetSectionId && home?.sections.find((section) => section.id === blockTargetSectionId)) ?? selectedSection ?? home?.sections[0] ?? null;
  const headerVariant = siteSpec.header?.variant ?? "none";

  useEffect(() => {
    if (!home?.sections?.length) return;
    if (!blockTargetSectionId || !home.sections.some((section) => section.id === blockTargetSectionId)) {
      setBlockTargetSectionId(selectedSection?.id ?? home.sections[0]?.id ?? null);
    }
  }, [blockTargetSectionId, home?.sections, selectedSection?.id]);

  useEffect(() => {
    void loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const node = canvasRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setCanvasWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!wasMigrated) return;
    if (migrationRunRef.current) return;
    migrationRunRef.current = true;
    let cancelled = false;

    const run = async () => {
      setSaveState("saving");
      const result = await persistSpec(siteSpec, "canvas_manual_checkpoint");
      if (cancelled) return;
      if (!result.ok) {
        setSaveState("error");
        setMessage(result.error);
        return;
      }
      setLastPersistedHash(result.hash);
      setLastSavedAt(Date.now());
      setSaveState("saved");
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [siteSpec, wasMigrated]);

  useEffect(() => {
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteSpec.site_type]);

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
      const sectionDrag = sectionDragRef.current;
      if (sectionDrag) {
        const deltaY = event.clientY - sectionDrag.startY;
        const nextHeight = Math.max(200, sectionDrag.initialHeight + deltaY);
        const nextRatio = clampRatio(nextHeight / sectionDrag.sectionWidth);
        updateSection(sectionDrag.sectionId, (section) => ({
          ...section,
          height_ratio: {
            ...section.height_ratio,
            [sectionDrag.viewport]: nextRatio
          }
        }));
        return;
      }

      const drag = dragStateRef.current;
      if (!drag) return;

      const section = home?.sections.find((item) => item.id === drag.sectionId);
      if (!section) return;

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      const sectionWidth = drag.sectionWidth;
      const sectionHeight = drag.sectionHeight;

      if (drag.mode === "move") {
        const nextRectPx = clampRectPx(
          {
            ...drag.initialRectPx,
            x: drag.initialRectPx.x + deltaX,
            y: drag.initialRectPx.y + deltaY
          },
          sectionWidth,
          sectionHeight
        );
        updateBlockRect(drag.sectionId, drag.blockId, rectPxToPercent(nextRectPx, sectionWidth, sectionHeight));
        return;
      }

      const resizedPx = clampRectPx(
        {
          ...drag.initialRectPx,
          w: drag.initialRectPx.w + deltaX,
          h: drag.initialRectPx.h + deltaY
        },
        sectionWidth,
        sectionHeight
      );
      updateBlockRect(drag.sectionId, drag.blockId, rectPxToPercent(resizedPx, sectionWidth, sectionHeight));
    };

    const onMouseUp = () => {
      dragStateRef.current = null;
      sectionDragRef.current = null;
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

  function updateHeaderVariant(nextVariant: "none" | "hamburger-side" | "hamburger-overlay" | "top-bar") {
    setSiteSpec((prev) => ({
      ...prev,
      header: {
        variant: nextVariant,
        brand: prev.header?.brand ?? siteName,
        links: buildHeaderLinksForEditor(prev)
      }
    }));
  }

  function updateBlock(sectionId: string, blockId: string, updater: (block: CanvasBlock) => CanvasBlock) {
    updateSection(sectionId, (section) => ({
      ...section,
      blocks: section.blocks.map((block) => (block.id === blockId ? updater(block) : block))
    }));
  }

  function updateBlockRect(sectionId: string, blockId: string, nextRect: CanvasLayoutRect) {
    const section = home?.sections.find((item) => item.id === sectionId);
    if (!section) return;
    const sectionWidth = canvasWidth;
    const sectionHeight = getSectionHeightPx(section, viewport, sectionWidth);
    const clamped = clampRectPercent(nextRect, sectionWidth, sectionHeight);
    updateBlock(sectionId, blockId, (block) => ({
      ...block,
      layout: {
        ...block.layout,
        [viewport]: clamped
      }
    }));
  }

function addSection(type: SiteSectionV3["type"]) {
  const index = (home?.sections.filter((item) => item.type === type).length ?? 0) + 1;
  const section = createDefaultSection(type, index, siteSpec.site_type);
  setHomeSections((sections) => [...sections, section]);
  setSelectedSectionId(section.id);
  setBlockTargetSectionId(section.id);
}

  function reorderSections(sourceId: string, targetId: string) {
    setHomeSections((sections) => {
      const sourceIndex = sections.findIndex((section) => section.id === sourceId);
      const targetIndex = sections.findIndex((section) => section.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return sections;
      const next = [...sections];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function removeSection(sectionId: string) {
    setHomeSections((sections) => sections.filter((section) => section.id !== sectionId));
    if (selected?.sectionId === sectionId) setSelected(null);
  }

  function removeLastSectionOfType(type: SiteSectionV3["type"]) {
    const sections = home?.sections ?? [];
    const target = [...sections].reverse().find((section) => section.type === type);
    if (!target) return;
    removeSection(target.id);
  }

  function addBlock(sectionId: string, type: CanvasBlock["type"]) {
    const section = home?.sections.find((item) => item.id === sectionId);
    if (!section) return;

    const index = section.blocks.length + 1;
    const block = createDefaultBlock(sectionId, type, index, section.height_ratio);
    updateSection(sectionId, (current) => ({
      ...current,
      blocks: [...current.blocks, block]
    }));
    setSelected({ sectionId, blockId: block.id });
    setSelectedSectionId(sectionId);
    setBlockTargetSectionId(sectionId);
  }

  function addBlockAtPosition(
    sectionId: string,
    type: CanvasBlock["type"],
    xPx: number,
    yPx: number,
    sectionWidth: number,
    sectionHeight: number
  ) {
    const section = home?.sections.find((item) => item.id === sectionId);
    if (!section) return;

    const index = section.blocks.length + 1;
    const block = createDefaultBlock(sectionId, type, index, section.height_ratio);
    const baseRectPx = rectPercentToPx(getBlockRect(block, viewport), sectionWidth, sectionHeight);
    const desired = {
      ...baseRectPx,
      x: xPx - baseRectPx.w / 2,
      y: yPx - baseRectPx.h / 2
    };
    const clamped = clampRectPx(desired, sectionWidth, sectionHeight);
    const layout = {
      ...block.layout,
      [viewport]: rectPxToPercent(clamped, sectionWidth, sectionHeight)
    };
    const nextBlock = { ...block, layout };

    updateSection(sectionId, (current) => ({
      ...current,
      blocks: [...current.blocks, nextBlock]
    }));
    setSelected({ sectionId, blockId: nextBlock.id });
    setSelectedSectionId(sectionId);
    setBlockTargetSectionId(sectionId);
  }

  function removeLastBlockOfType(sectionId: string, type: CanvasBlock["type"]) {
    const section = home?.sections.find((item) => item.id === sectionId);
    if (!section) return;
    const target = [...section.blocks].reverse().find((block) => block.type === type);
    if (!target) return;
    updateSection(sectionId, (current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== target.id)
    }));
    if (selected?.blockId === target.id) {
      setSelected(null);
    }
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
    setBlockTargetSectionId(selected.sectionId);
  }

  function bringSelectedToFront() {
    if (!selected || !selectedBlock || !home) return;
    const section = home.sections.find((item) => item.id === selected.sectionId);
    if (!section) return;
    const maxZ = Math.max(...section.blocks.map((block) => getBlockRect(block, viewport).z));
    const rect = getBlockRect(selectedBlock, viewport);
    updateBlockRect(selected.sectionId, selected.blockId, { ...rect, z: maxZ + 1 });
  }

  function sendSelectedToBack() {
    if (!selected || !selectedBlock || !home) return;
    const section = home.sections.find((item) => item.id === selected.sectionId);
    if (!section) return;
    const minZ = Math.min(...section.blocks.map((block) => getBlockRect(block, viewport).z));
    const rect = getBlockRect(selectedBlock, viewport);
    updateBlockRect(selected.sectionId, selected.blockId, { ...rect, z: Math.max(1, minZ - 1) });
  }

  function startDragging(event: React.MouseEvent, sectionId: string, block: CanvasBlock, mode: DragMode) {
    event.preventDefault();
    event.stopPropagation();

    const section = home?.sections.find((item) => item.id === sectionId);
    if (!section) return;
    const sectionWidth = canvasWidth;
    const sectionHeight = getSectionHeightPx(section, viewport, sectionWidth);

    dragStateRef.current = {
      mode,
      sectionId,
      blockId: block.id,
      startX: event.clientX,
      startY: event.clientY,
      initialRectPx: rectPercentToPx(getBlockRect(block, viewport), sectionWidth, sectionHeight),
      sectionWidth,
      sectionHeight
    };
    setSelected({ sectionId, blockId: block.id });
    setSelectedSectionId(sectionId);
    setBlockTargetSectionId(sectionId);
  }

  function startSectionResize(event: React.MouseEvent, section: SiteSectionV3) {
    event.preventDefault();
    event.stopPropagation();
    const sectionWidth = canvasWidth;
    const sectionHeight = getSectionHeightPx(section, viewport, sectionWidth);
    sectionDragRef.current = {
      sectionId: section.id,
      startY: event.clientY,
      initialHeight: sectionHeight,
      sectionWidth,
      viewport
    };
    setSelectedSectionId(section.id);
    setSelected(null);
    setBlockTargetSectionId(section.id);
  }

  async function persistSpec(specToPersist: SiteSpecV3, source: "canvas_auto_save" | "canvas_manual_checkpoint" | "manual") {
    const normalizedSpec = sanitizeSpecForSave(specToPersist);

    if (hasInvalidImageUrl(normalizedSpec)) {
      return {
        ok: false as const,
        error: "Hay una URL de imagen inválida. Usa formato http:// o https://"
      };
    }

    const hash = hashSpec(normalizedSpec);
    const response = await fetch(`/api/sites/${siteId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteSpec: normalizedSpec, source })
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

  async function loadTemplates() {
    setTemplatesLoading(true);
    setTemplatesMessage(null);
    const response = await fetch(`/api/templates?siteType=${siteSpec.site_type}`);
    const data = (await response.json()) as { items?: TemplateCard[]; error?: string };
    if (!response.ok) {
      setTemplatesMessage(data.error ?? "No se pudo cargar las plantillas.");
      setTemplatesLoading(false);
      return;
    }
    setTemplates(Array.isArray(data.items) ? data.items : []);
    setTemplatesLoading(false);
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
    if (!selected || !selectedBlock) return;
    updateBlock(selected.sectionId, selected.blockId, (block) => {
      if (block.type === "image") {
        return { ...block, content: { ...block.content, url } };
      }
      if (block.type === "product") {
        return { ...block, content: { ...block.content, image_url: url } };
      }
      return block;
    });
  }


  function applyTemplateStyleOnly(template: TemplateCard) {
    setSiteSpec((prev) => ({
      ...prev,
      template: { id: template.id, family: template.family },
      theme: template.theme,
      pages: prev.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) => {
          const nextVariant = template.variants?.[section.type];
          return nextVariant ? { ...section, variant: nextVariant } : section;
        })
      }))
    }));
  }

  const saveStatus =
    saveState === "saving"
      ? "Guardando..."
      : saveState === "saved" && savedAgoLabel
        ? `Guardado ${savedAgoLabel}`
        : saveState === "error"
          ? "Error al guardar"
          : !isDirty
            ? "Sin cambios"
            : "Pendiente";

  const activeTemplateId = siteSpec.template.id;
  const fontOptions = fontFamilies;
  const isFontFamily = (value: string): value is (typeof fontFamilies)[number] =>
    (fontFamilies as readonly string[]).includes(value);

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-topbar-left">
          <div className="editor-brand">DVanguard</div>
          <div className="editor-meta">
            <strong>{siteName}</strong>
            <span>/{subdomain}</span>
          </div>
        </div>
        <div className="editor-topbar-center">
          <span className={`editor-status ${saveState}`}>Autosave · {saveStatus}</span>
          <div className="editor-toggle">
            <button type="button" className={viewport === "desktop" ? "btn-primary" : "btn-secondary"} onClick={() => setViewport("desktop")}>
              Desktop
            </button>
            <button type="button" className={viewport === "mobile" ? "btn-primary" : "btn-secondary"} onClick={() => setViewport("mobile")}>
              Mobile
            </button>
          </div>
        </div>
        <div className="editor-topbar-actions">
          <Link href="/dashboard" className="btn-secondary">
            Dashboard
          </Link>
          <button className="btn-secondary" type="button" onClick={() => void saveCheckpoint()}>
            Guardar
          </button>
          <button className="btn-primary" type="button" onClick={() => void publish()} disabled={publishing}>
            {publishing ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </header>

      {message ? <div className="editor-alert">{message}</div> : null}

      <section className="editor-body">
        <aside className="editor-rail">
          <div className="editor-tabs">
            <button type="button" className={leftTab === "templates" ? "tab active" : "tab"} onClick={() => setLeftTab("templates")}>
              Templates
            </button>
            <button type="button" className={leftTab === "sections" ? "tab active" : "tab"} onClick={() => setLeftTab("sections")}>
              Secciones
            </button>
            <button type="button" className={leftTab === "layers" ? "tab active" : "tab"} onClick={() => setLeftTab("layers")}>
              Capas
            </button>
          </div>

          <div className="editor-rail-content">
            {leftTab === "templates" ? (
              <div className="stack">
                <p className="muted">Cambia el look sin alterar tu layout.</p>
                {templatesLoading ? <small>Cargando plantillas...</small> : null}
                {templatesMessage ? <small>{templatesMessage}</small> : null}
                <div className="template-grid">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={`template-card ${activeTemplateId === template.id ? "active" : ""}`}
                      onClick={() => applyTemplateStyleOnly(template)}
                    >
                      <div className="template-chip" style={{ background: template.theme.background, color: template.theme.primary }}>
                        {template.preview_label}
                      </div>
                      <strong>{template.name}</strong>
                      <p>{template.description}</p>
                      {template.tags?.length ? (
                        <div className="template-tags">
                          {template.tags.map((tag) => (
                            <span key={tag} className="template-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {leftTab === "sections" ? (
              <div className="stack">
                <div className="stack">
                  <strong>Secciones del sitio</strong>
                  {(home?.sections ?? []).map((section) => (
                    <div
                      key={section.id}
                      className={`editor-section-card ${dragOverSectionId === section.id ? "drag-over" : ""}`}
                      draggable
                      onDragStart={(event) => {
                        setDraggingSectionId(section.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", section.id);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverSectionId(section.id);
                      }}
                      onDragLeave={() => setDragOverSectionId(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceId = event.dataTransfer.getData("text/plain");
                        if (sourceId) {
                          reorderSections(sourceId, section.id);
                        }
                        setDragOverSectionId(null);
                        setDraggingSectionId(null);
                      }}
                      onDragEnd={() => {
                        setDragOverSectionId(null);
                        setDraggingSectionId(null);
                      }}
                    >
                      <div className="editor-section-header">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setSelectedSectionId(section.id);
                            if (section.blocks[0]?.id) {
                              setSelected({ sectionId: section.id, blockId: section.blocks[0].id });
                            } else {
                              setSelected(null);
                            }
                            setBlockTargetSectionId(section.id);
                          }}
                        >
                          {section.type}
                        </button>
                        <div className="editor-section-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Agregar sección ${section.type}`}
                            onClick={() => addSection(section.type)}
                          >
                            <PlusIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={section.enabled ? "Ocultar sección" : "Mostrar sección"}
                            onClick={() =>
                              updateSection(section.id, (current) => ({
                                ...current,
                                enabled: !current.enabled
                              }))
                            }
                          >
                            {section.enabled ? <EyeIcon /> : <EyeOffIcon />}
                          </button>
                          <button type="button" className="icon-btn danger" aria-label="Eliminar sección" onClick={() => removeSection(section.id)}>
                            <MinusIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {home ? (
                    <div className="editor-section-add-row">
                      <div className="section-add-header">
                        <span className="muted">Agregar sección</span>
                        <div className="editor-section-add-actions">
                          <button type="button" className="icon-btn" aria-label="Agregar sección" onClick={() => addSection(sectionAddType)}>
                            <PlusIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            aria-label="Eliminar última sección del tipo seleccionado"
                            onClick={() => removeLastSectionOfType(sectionAddType)}
                          >
                            <MinusIcon />
                          </button>
                        </div>
                      </div>
                      <div className="section-type-options">
                        {SECTION_LIBRARY.map((type) => (
                          <label key={type} className={`section-type-option ${sectionAddType === type ? "active" : ""}`}>
                            <input
                              type="radio"
                              name="section-add-type"
                              value={type}
                              checked={sectionAddType === type}
                              onChange={() => setSectionAddType(type)}
                            />
                            <span>{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {blockTargetSection ? (
                  <div className="stack">
                    <strong>Agregar bloque</strong>
                    <label>
                      Sección destino
                      <select value={blockTargetSection.id} onChange={(event) => setBlockTargetSectionId(event.target.value)}>
                        {(home?.sections ?? []).map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="editor-section-add-row">
                      <div className="section-add-header">
                        <span className="muted">Tipo de bloque</span>
                        <div className="editor-section-add-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Agregar bloque"
                            onClick={() => addBlock(blockTargetSection.id, blockAddType)}
                          >
                            <PlusIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            aria-label="Eliminar último bloque del tipo seleccionado"
                            onClick={() => removeLastBlockOfType(blockTargetSection.id, blockAddType)}
                          >
                            <MinusIcon />
                          </button>
                        </div>
                      </div>
                      <div className="muted" style={{ fontSize: "0.72rem" }}>
                        Arrastra un bloque al canvas para añadirlo.
                      </div>
                      <div className="section-type-options">
                        {BLOCK_LIBRARY.map((type) => (
                          <label
                            key={type}
                            className={`section-type-option block-type-option ${blockAddType === type ? "active" : ""}`}
                            draggable
                            onDragStart={(event) => {
                              setBlockAddType(type);
                              setDraggingBlockType(type);
                              event.dataTransfer.effectAllowed = "copy";
                              event.dataTransfer.setData("application/x-block-type", type);
                              event.dataTransfer.setData("text/plain", type);
                            }}
                            onDragEnd={() => {
                              setDraggingBlockType(null);
                              setCanvasDropSectionId(null);
                            }}
                          >
                            <input
                              type="radio"
                              name="block-add-type"
                              value={type}
                              checked={blockAddType === type}
                              onChange={() => setBlockAddType(type)}
                            />
                            <span>{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="stack">
                  <strong>Media</strong>
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
                      <article key={asset.id} className="asset-card">
                        <img src={asset.public_url} alt={asset.alt_text ?? "asset"} />
                        <div className="asset-meta">
                          <small>{asset.kind === "uploaded" ? "Subida" : "Externa"}</small>
                          <button type="button" onClick={() => void deleteAsset(asset.id)}>
                            Eliminar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {leftTab === "layers" ? (
              <div className="stack">
                {(home?.sections ?? []).map((section) => (
                  <div key={section.id} className="stack">
                    <strong>{section.type}</strong>
                    {section.blocks
                      .slice()
                      .sort((a, b) => getBlockRect(b, viewport).z - getBlockRect(a, viewport).z)
                      .map((block) => (
                        <div key={block.id} className="editor-layer-row">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              setSelectedSectionId(section.id);
                              setSelected({ sectionId: section.id, blockId: block.id });
                              setBlockTargetSectionId(section.id);
                            }}
                          >
                            {block.type}
                          </button>
                          <div className="editor-section-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={block.visible ? "Ocultar bloque" : "Mostrar bloque"}
                              onClick={() =>
                                updateBlock(section.id, block.id, (current) => ({
                                  ...current,
                                  visible: !current.visible
                                }))
                              }
                            >
                              {block.visible ? <EyeIcon /> : <EyeOffIcon />}
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              aria-label="Eliminar bloque"
                              onClick={() =>
                                updateSection(section.id, (current) => ({
                                  ...current,
                                  blocks: current.blocks.filter((item) => item.id !== block.id)
                                }))
                              }
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        <section className="editor-canvas-area">
          <div className="editor-canvas-shell">
            <div
              className="editor-canvas"
              ref={canvasRef}
              style={{
                width: "100%",
                background: siteSpec.theme.background,
                fontFamily: siteSpec.theme.font_body
              }}
            >
              {(home?.sections ?? [])
                .filter((section) => section.enabled)
                .map((section) => {
                  const sectionWidth = canvasWidth;
                  const sectionHeight = getSectionHeightPx(section, viewport, sectionWidth);

                  return (
                    <article
                      key={section.id}
                      className={`canvas-section ${activeSectionId === section.id ? "selected" : ""} ${
                        canvasDropSectionId === section.id ? "drop-target" : ""
                      }`}
                      style={{
                        minHeight: sectionHeight,
                        height: sectionHeight
                      }}
                      onDragOver={(event) => {
                        if (!draggingBlockType) return;
                        event.preventDefault();
                        setCanvasDropSectionId(section.id);
                      }}
                      onDragLeave={() => {
                        if (canvasDropSectionId === section.id) {
                          setCanvasDropSectionId(null);
                        }
                      }}
                      onDrop={(event) => {
                        if (!draggingBlockType) return;
                        event.preventDefault();
                        const rect = event.currentTarget.getBoundingClientRect();
                        const x = event.clientX - rect.left;
                        const y = event.clientY - rect.top;
                        addBlockAtPosition(section.id, draggingBlockType, x, y, sectionWidth, sectionHeight);
                        setDraggingBlockType(null);
                        setCanvasDropSectionId(null);
                      }}
                      onClick={() => {
                        setSelectedSectionId(section.id);
                        setSelected(null);
                        setBlockTargetSectionId(section.id);
                      }}
                    >
                      {section.blocks
                        .filter((block) => block.visible)
                        .map((block) => {
                          const rect = rectPercentToPx(getBlockRect(block, viewport), sectionWidth, sectionHeight);
                          const isSelected = selected?.sectionId === section.id && selected?.blockId === block.id;

                          return (
                            <div
                              key={block.id}
                              className={`canvas-block ${isSelected ? "selected" : ""}`}
                              style={{
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
                                fontFamily: block.style.fontFamily ?? siteSpec.theme.font_body,
                                textAlign: block.style.textAlign as "left" | "center" | "right" | undefined,
                                padding: block.type === "text" ? 8 : 0,
                                overflow: isSelected ? "visible" : "hidden"
                              }}
                              onMouseDown={(event) => startDragging(event, section.id, block, "move")}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedSectionId(section.id);
                                setSelected({ sectionId: section.id, blockId: block.id });
                                setBlockTargetSectionId(section.id);
                              }}
                            >
                              {block.type === "text" ? block.content.text : null}
                              {block.type === "image" ? (
                                <img
                                  src={block.content.url || "https://placehold.co/800x520?text=Imagen"}
                                  alt={block.content.alt ?? "Imagen"}
                                  style={{ width: "100%", height: "100%", objectFit: block.content.fit ?? "contain" }}
                                />
                              ) : null}
                              {block.type === "button" ? <button type="button">{block.content.label}</button> : null}
                              {block.type === "product" ? (
                                <div className="canvas-product">
                                  <div className="canvas-product-image" />
                                  <strong>{block.content.name}</strong>
                                  {block.content.price !== undefined ? <span>${block.content.price}</span> : null}
                                </div>
                              ) : null}
                              {block.type === "shape" ? <div className="canvas-shape" /> : null}
                              {block.type === "container" ? <div className="canvas-container" /> : null}
                              {isSelected ? (
                                <>
                                  <div
                                    className="canvas-resize-handle"
                                    onMouseDown={(event) => startDragging(event, section.id, block, "resize")}
                                  />
                                  <div
                                    className="canvas-toolbar"
                                    onClick={(event) => event.stopPropagation()}
                                    onMouseDown={(event) => event.stopPropagation()}
                                  >
                                    <button type="button" onClick={duplicateSelectedBlock}>
                                      Duplicar
                                    </button>
                                    <button type="button" onClick={deleteSelectedBlock}>
                                      Eliminar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateBlock(selected.sectionId, selected.blockId, (current) => ({
                                          ...current,
                                          visible: !current.visible
                                        }))
                                      }
                                    >
                                      {selectedBlock?.visible ? "Ocultar" : "Mostrar"}
                                    </button>
                                    <button type="button" onClick={bringSelectedToFront}>
                                      Frente
                                    </button>
                                    <button type="button" onClick={sendSelectedToBack}>
                                      Fondo
                                    </button>
                                  </div>
                                </>
                              ) : null}
                            </div>
                          );
                        })}
                      {activeSectionId === section.id ? (
                        <div
                          className="canvas-section-resize"
                          onMouseDown={(event) => startSectionResize(event, section)}
                        />
                      ) : null}
                    </article>
                  );
                })}
            </div>
          </div>
        </section>

        <aside className="editor-inspector">

          <div className="editor-tabs">
            <button type="button" className={rightTab === "content" ? "tab active" : "tab"} onClick={() => setRightTab("content")}>
              Contenido
            </button>
            <button type="button" className={rightTab === "style" ? "tab active" : "tab"} onClick={() => setRightTab("style")}>
              Estilo
            </button>
            <button type="button" className={rightTab === "position" ? "tab active" : "tab"} onClick={() => setRightTab("position")}>
              Posición
            </button>
          </div>

          <div className="editor-inspector-content">
            {rightTab === "content" ? (
              <div className="stack">
                <div className="stack">
                  <strong>Navegación</strong>
                  <label>
                    Menú
                    <select
                      value={headerVariant}
                      onChange={(event) =>
                        updateHeaderVariant(event.target.value as "none" | "hamburger-side" | "hamburger-overlay" | "top-bar")
                      }
                    >
                      <option value="none">Sin menú</option>
                      <option value="hamburger-side">Hamburguesa lateral</option>
                      <option value="hamburger-overlay">Hamburguesa overlay</option>
                      <option value="top-bar">Top bar</option>
                    </select>
                  </label>
                </div>
                {selected && selectedBlock ? (
                  <div className="stack">
                    <strong>Bloque: {selectedBlock.type}</strong>
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
                          <label>
                            Ajuste de imagen
                            <select
                              value={selectedBlock.content.fit ?? "contain"}
                              onChange={(event) =>
                                updateBlock(selected.sectionId, selected.blockId, (block) =>
                                  block.type === "image"
                                    ? {
                                        ...block,
                                        content: { ...block.content, fit: event.target.value as "cover" | "contain" }
                                      }
                                    : block
                                )
                              }
                            >
                              <option value="contain">Contener</option>
                              <option value="cover">Cubrir</option>
                            </select>
                          </label>
                          {assets.length ? (
                            <select
                              defaultValue=""
                              onChange={(event) => applyAssetToSelected(assets.find((asset) => asset.id === event.target.value)?.public_url ?? "")}
                            >
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

                      {selectedBlock.type === "product" ? (
                        <>
                          <label>
                            Nombre
                            <input
                              value={selectedBlock.content.name}
                              onChange={(event) =>
                                updateBlock(selected.sectionId, selected.blockId, (block) =>
                                  block.type === "product"
                                    ? {
                                        ...block,
                                        content: { ...block.content, name: event.target.value }
                                      }
                                    : block
                                )
                              }
                            />
                          </label>
                          <label>
                            Descripción
                            <textarea
                              rows={3}
                              value={selectedBlock.content.description ?? ""}
                              onChange={(event) =>
                                updateBlock(selected.sectionId, selected.blockId, (block) =>
                                  block.type === "product"
                                    ? {
                                        ...block,
                                        content: { ...block.content, description: event.target.value }
                                      }
                                    : block
                                )
                              }
                            />
                          </label>
                          <label>
                            Precio
                            <input
                              type="number"
                              value={selectedBlock.content.price ?? ""}
                              onChange={(event) =>
                                updateBlock(selected.sectionId, selected.blockId, (block) =>
                                  block.type === "product"
                                    ? {
                                        ...block,
                                        content: {
                                          ...block.content,
                                          price: event.target.value ? Number(event.target.value) : undefined
                                        }
                                      }
                                    : block
                                )
                              }
                            />
                          </label>
                          <label>
                            Moneda
                            <input
                              value={selectedBlock.content.currency ?? ""}
                              onChange={(event) =>
                                updateBlock(selected.sectionId, selected.blockId, (block) =>
                                  block.type === "product"
                                    ? {
                                        ...block,
                                        content: { ...block.content, currency: event.target.value }
                                      }
                                    : block
                                )
                              }
                            />
                          </label>
                          <label>
                            Imagen URL
                            <input
                              value={selectedBlock.content.image_url ?? ""}
                              onChange={(event) =>
                                updateBlock(selected.sectionId, selected.blockId, (block) =>
                                  block.type === "product"
                                    ? {
                                        ...block,
                                        content: { ...block.content, image_url: event.target.value }
                                      }
                                    : block
                                )
                              }
                            />
                          </label>
                          <label>
                            SKU (opcional)
                            <input
                              value={selectedBlock.content.sku ?? ""}
                              onChange={(event) =>
                                updateBlock(selected.sectionId, selected.blockId, (block) =>
                                  block.type === "product"
                                    ? {
                                        ...block,
                                        content: { ...block.content, sku: event.target.value }
                                      }
                                    : block
                                )
                              }
                            />
                          </label>
                          {assets.length ? (
                            <select
                              defaultValue=""
                              onChange={(event) => applyAssetToSelected(assets.find((asset) => asset.id === event.target.value)?.public_url ?? "")}
                            >
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
                  </div>
                ) : (
                  <p className="muted">Selecciona un bloque en el canvas para editar su contenido.</p>
                )}
              </div>
            ) : null}

                {rightTab === "style" ? (
                  <div className="stack">
                    {selected && selectedBlock ? (
                      <div className="stack">
                        <strong>Estilo del bloque</strong>
                        <small className="muted">Estos cambios afectan solo el bloque seleccionado.</small>
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
                          Fondo del bloque
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
                      <label>
                        Radio
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={selectedBlock.style.radius ?? 0}
                            onChange={(event) =>
                              updateBlock(selected.sectionId, selected.blockId, (block) => ({
                                ...block,
                                style: {
                                  ...block.style,
                                  radius: Math.min(200, Math.max(0, Number(event.target.value)))
                                }
                              }))
                            }
                        />
                      </label>
                      {selectedBlock.type === "text" ? (
                        <label>
                          Tipografía
                            <select
                              value={selectedBlock.style.fontFamily ?? "__body"}
                              onChange={(event) => {
                                const value = event.target.value;
                                let nextFontFamily: (typeof fontFamilies)[number] | undefined;
                                if (value === "__body") {
                                  nextFontFamily = undefined;
                                } else if (value === "__heading") {
                                  nextFontFamily = isFontFamily(siteSpec.theme.font_heading) ? siteSpec.theme.font_heading : undefined;
                                } else if (isFontFamily(value)) {
                                  nextFontFamily = value;
                                }
                                updateBlock(selected.sectionId, selected.blockId, (block) =>
                                  block.type === "text"
                                    ? {
                                        ...block,
                                        style: {
                                          ...block.style,
                                        fontFamily: nextFontFamily
                                        }
                                      }
                                    : block
                                );
                              }}
                          >
                            <option value="__body">Cuerpo (predeterminado)</option>
                            <option value="__heading">Títulos (tema)</option>
                            {fontOptions.map((font) => (
                              <option key={font} value={font}>
                                {font}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="stack">
                    <strong>Tema del sitio</strong>
                    <small className="muted">Estos cambios afectan el fondo y colores globales del sitio.</small>
                    <label>
                      Tipografía de títulos
                      <select
                        value={siteSpec.theme.font_heading}
                        onChange={(event) =>
                          setSiteSpec((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, font_heading: event.target.value }
                          }))
                        }
                      >
                        {fontOptions.map((font) => (
                          <option key={font} value={font}>
                            {font}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tipografía del cuerpo
                      <select
                        value={siteSpec.theme.font_body}
                        onChange={(event) =>
                          setSiteSpec((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, font_body: event.target.value }
                          }))
                        }
                      >
                        {fontOptions.map((font) => (
                          <option key={font} value={font}>
                            {font}
                          </option>
                        ))}
                      </select>
                    </label>
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
                        Fondo del sitio
                        <input
                          type="color"
                          value={siteSpec.theme.background}
                          onChange={(event) => setSiteSpec((prev) => ({ ...prev, theme: { ...prev.theme, background: event.target.value } }))}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                {rightTab === "position" ? (
                  selected && selectedBlock ? (
                    <div className="stack">
                      <strong>Posición</strong>
                      <small className="muted">Valores en porcentaje respecto a la sección.</small>
                      <label>
                        X (%)
                        <input
                          type="number"
                          step="0.1"
                          value={getBlockRect(selectedBlock, viewport).x}
                          onChange={(event) => {
                            const sectionWidth = canvasWidth;
                            const sectionHeight = selectedSection
                              ? getSectionHeightPx(selectedSection, viewport, sectionWidth)
                              : sectionWidth;
                            const next = clampRectPercent(
                              {
                                ...getBlockRect(selectedBlock, viewport),
                                x: Number(event.target.value)
                              },
                              sectionWidth,
                              sectionHeight
                            );
                            updateBlockRect(selected.sectionId, selected.blockId, next);
                          }}
                        />
                      </label>
                      <label>
                        Y (%)
                        <input
                          type="number"
                          step="0.1"
                          value={getBlockRect(selectedBlock, viewport).y}
                          onChange={(event) => {
                            const sectionWidth = canvasWidth;
                            const sectionHeight = selectedSection
                              ? getSectionHeightPx(selectedSection, viewport, sectionWidth)
                              : sectionWidth;
                            const next = clampRectPercent(
                              {
                                ...getBlockRect(selectedBlock, viewport),
                                y: Number(event.target.value)
                              },
                              sectionWidth,
                              sectionHeight
                            );
                            updateBlockRect(selected.sectionId, selected.blockId, next);
                          }}
                        />
                      </label>
                      <label>
                        W (%)
                        <input
                          type="number"
                          step="0.1"
                          value={getBlockRect(selectedBlock, viewport).w}
                          onChange={(event) => {
                            const sectionWidth = canvasWidth;
                            const sectionHeight = selectedSection
                              ? getSectionHeightPx(selectedSection, viewport, sectionWidth)
                              : sectionWidth;
                            const next = clampRectPercent(
                              {
                                ...getBlockRect(selectedBlock, viewport),
                                w: Number(event.target.value)
                              },
                              sectionWidth,
                              sectionHeight
                            );
                            updateBlockRect(selected.sectionId, selected.blockId, next);
                          }}
                        />
                      </label>
                      <label>
                        H (%)
                        <input
                          type="number"
                          step="0.1"
                          value={getBlockRect(selectedBlock, viewport).h}
                          onChange={(event) => {
                            const sectionWidth = canvasWidth;
                            const sectionHeight = selectedSection
                              ? getSectionHeightPx(selectedSection, viewport, sectionWidth)
                              : sectionWidth;
                            const next = clampRectPercent(
                              {
                                ...getBlockRect(selectedBlock, viewport),
                                h: Number(event.target.value)
                              },
                              sectionWidth,
                              sectionHeight
                            );
                            updateBlockRect(selected.sectionId, selected.blockId, next);
                          }}
                        />
                      </label>
                      <label>
                        Z
                        <input
                          type="number"
                          value={getBlockRect(selectedBlock, viewport).z}
                          onChange={(event) =>
                            updateBlockRect(selected.sectionId, selected.blockId, {
                              ...getBlockRect(selectedBlock, viewport),
                              z: Number(event.target.value)
                            })
                          }
                        />
                      </label>
                    </div>
                  ) : (
                    <p className="muted">Selecciona un bloque para editar su posición.</p>
                  )
                ) : null}
              </div>
        </aside>
      </section>
    </div>
  );
}

function createDefaultSection(
  type: SiteSectionV3["type"],
  index: number,
  siteType: "informative" | "commerce_lite"
): SiteSectionV3 {
  const id = `${type}-${Date.now()}-${index}`;

  if (type === "hero") {
    return {
      id,
      type: "hero",
      enabled: true,
      variant: "centered",
      height_ratio: {
        desktop: ratioFromPx(520, "desktop"),
        mobile: ratioFromPx(540, "mobile")
      },
      blocks: [
        createDefaultBlock(id, "text", 1, {
          desktop: ratioFromPx(520, "desktop"),
          mobile: ratioFromPx(540, "mobile")
        })
      ]
    };
  }

  if (type === "catalog") {
    return {
      id,
      type: "catalog",
      enabled: true,
      variant: "cards",
      height_ratio: {
        desktop: ratioFromPx(620, "desktop"),
        mobile: ratioFromPx(900, "mobile")
      },
      blocks:
        siteType === "commerce_lite"
          ? [
              createDefaultBlock(id, "product", 1, {
                desktop: ratioFromPx(620, "desktop"),
                mobile: ratioFromPx(900, "mobile")
              }),
              createDefaultBlock(id, "product", 2, {
                desktop: ratioFromPx(620, "desktop"),
                mobile: ratioFromPx(900, "mobile")
              }),
              createDefaultBlock(id, "product", 3, {
                desktop: ratioFromPx(620, "desktop"),
                mobile: ratioFromPx(900, "mobile")
              })
            ]
          : [
              createDefaultBlock(id, "container", 1, {
                desktop: ratioFromPx(620, "desktop"),
                mobile: ratioFromPx(900, "mobile")
              })
            ]
    };
  }

  if (type === "testimonials") {
    return {
      id,
      type: "testimonials",
      enabled: true,
      variant: "cards",
      height_ratio: {
        desktop: ratioFromPx(520, "desktop"),
        mobile: ratioFromPx(700, "mobile")
      },
      blocks: [
        createDefaultBlock(id, "text", 1, {
          desktop: ratioFromPx(520, "desktop"),
          mobile: ratioFromPx(700, "mobile")
        })
      ]
    };
  }

  return {
    id,
    type: "contact",
    enabled: true,
    variant: "simple",
    height_ratio: {
      desktop: ratioFromPx(360, "desktop"),
      mobile: ratioFromPx(420, "mobile")
    },
    blocks: [
      createDefaultBlock(id, "text", 1, {
        desktop: ratioFromPx(360, "desktop"),
        mobile: ratioFromPx(420, "mobile")
      }),
      createDefaultBlock(id, "button", 2, {
        desktop: ratioFromPx(360, "desktop"),
        mobile: ratioFromPx(420, "mobile")
      })
    ]
  };
}

function createDefaultBlock(
  sectionId: string,
  type: CanvasBlock["type"],
  index: number,
  sectionRatios: { desktop: number; mobile: number }
): CanvasBlock {
  const desktop = { x: 40 + index * 12, y: 50 + index * 12, w: 260, h: 90, z: index + 1 };
  const mobile = { x: 24, y: 40 + index * 14, w: 300, h: 86, z: index + 1 };
  const layout = {
    desktop: rectFromPx(desktop, "desktop", sectionRatios.desktop),
    mobile: rectFromPx(mobile, "mobile", sectionRatios.mobile)
  };

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
        desktop: rectFromPx({ ...desktop, h: 180 }, "desktop", sectionRatios.desktop),
        mobile: rectFromPx({ ...mobile, h: 150 }, "mobile", sectionRatios.mobile)
      },
      style: { radius: 12 },
      content: { url: "", alt: "", fit: "contain" }
    };
  }

  if (type === "button") {
    return {
      id: `${sectionId}-button-${Date.now()}`,
      type: "button",
      visible: true,
      layout: {
        desktop: rectFromPx({ ...desktop, w: 220, h: 50 }, "desktop", sectionRatios.desktop),
        mobile: rectFromPx({ ...mobile, w: 220, h: 48 }, "mobile", sectionRatios.mobile)
      },
      style: { bgColor: "#0c4a6e", color: "#ffffff", radius: 12, fontWeight: 700, textAlign: "center" },
      content: { label: "Botón", action: "whatsapp" }
    };
  }

  if (type === "product") {
    return {
      id: `${sectionId}-product-${Date.now()}`,
      type: "product",
      visible: true,
      layout: {
        desktop: rectFromPx({ ...desktop, w: 300, h: 360 }, "desktop", sectionRatios.desktop),
        mobile: rectFromPx({ ...mobile, w: 320, h: 320 }, "mobile", sectionRatios.mobile)
      },
      style: { bgColor: "#ffffff", borderColor: "#e2e8f0", borderWidth: 1, radius: 16 },
      content: {
        name: `Producto ${index}`,
        price: 0,
        currency: "COP",
        image_url: "",
        description: "Descripción breve del producto."
      }
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
      desktop: rectFromPx({ ...desktop, w: 300, h: 260 }, "desktop", sectionRatios.desktop),
      mobile: rectFromPx({ ...mobile, w: 320, h: 220 }, "mobile", sectionRatios.mobile)
    },
    style: { bgColor: "#ffffff", borderColor: "#cbd5e1", borderWidth: 1, radius: 14 },
    content: {}
  };
}

function getBlockRect(block: CanvasBlock, viewport: EditorViewport) {
  if (viewport === "mobile" && block.layout.mobile) return block.layout.mobile;
  return block.layout.desktop;
}

function getSectionHeightPx(section: SiteSectionV3, viewport: EditorViewport, width: number) {
  const ratio = viewport === "mobile" ? section.height_ratio.mobile : section.height_ratio.desktop;
  return Math.max(1, width * ratio);
}

function rectFromPx(
  rect: { x: number; y: number; w: number; h: number; z: number },
  viewport: EditorViewport,
  sectionRatio: number
): CanvasLayoutRect {
  const baseWidth = CANVAS_BASE_WIDTH[viewport];
  const baseHeight = baseWidth * sectionRatio;
  return rectPxToPercent(rect, baseWidth, baseHeight);
}

function rectPercentToPx(rect: CanvasLayoutRect, width: number, height: number) {
  return {
    x: (rect.x / 100) * width,
    y: (rect.y / 100) * height,
    w: (rect.w / 100) * width,
    h: (rect.h / 100) * height,
    z: rect.z
  };
}

function rectPxToPercent(rect: { x: number; y: number; w: number; h: number; z: number }, width: number, height: number): CanvasLayoutRect {
  return {
    x: clampPercent((rect.x / width) * 100),
    y: clampPercent((rect.y / height) * 100),
    w: clampPercent((rect.w / width) * 100),
    h: clampPercent((rect.h / height) * 100),
    z: rect.z
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, round(value, 3)));
}

function clampRectPx(rect: CanvasLayoutRect, maxW: number, maxH: number): CanvasLayoutRect {
  const w = Math.max(MIN_BLOCK_SIZE.w, Math.min(rect.w, maxW));
  const h = Math.max(MIN_BLOCK_SIZE.h, Math.min(rect.h, maxH));
  const x = Math.max(0, Math.min(rect.x, maxW - w));
  const y = Math.max(0, Math.min(rect.y, maxH - h));
  return { ...rect, x, y, w, h };
}

function clampRectPercent(rect: CanvasLayoutRect, width: number, height: number) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const minW = (MIN_BLOCK_SIZE.w / safeWidth) * 100;
  const minH = (MIN_BLOCK_SIZE.h / safeHeight) * 100;
  const w = Math.max(minW, Math.min(rect.w, 100));
  const h = Math.max(minH, Math.min(rect.h, 100));
  const x = Math.max(0, Math.min(rect.x, 100 - w));
  const y = Math.max(0, Math.min(rect.y, 100 - h));
  return { ...rect, x, y, w, h };
}

function ratioFromPx(value: number, viewport: EditorViewport) {
  return round(value / CANVAS_BASE_WIDTH[viewport], 4);
}

function clampRatio(value: number) {
  return Math.max(0.2, Math.min(3, round(value, 4)));
}

function round(value: number, decimals = 3) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// (image auto-fit removed: images should adapt to container size)

function hasInvalidImageUrl(spec: SiteSpecV3) {
  for (const page of spec.pages) {
    for (const section of page.sections) {
      for (const block of section.blocks) {
        if (block.type === "image") {
          const url = block.content.url?.trim();
          if (!url) continue;
          if (!/^https?:\/\//i.test(url)) return true;
        }
        if (block.type === "product") {
          const url = block.content.image_url?.trim();
          if (!url) continue;
          if (!/^https?:\/\//i.test(url)) return true;
        }
      }
    }
  }
  return false;
}

function sanitizeSpecForSave(spec: SiteSpecV3): SiteSpecV3 {
  const next = structuredClone(spec);
  for (const page of next.pages) {
    for (const section of page.sections) {
      for (const block of section.blocks) {
        const style = block.style ?? {};
        if (style.radius !== undefined) {
          style.radius = Math.min(200, Math.max(0, style.radius));
        }
        if (style.borderWidth !== undefined) {
          style.borderWidth = Math.min(12, Math.max(0, style.borderWidth));
        }
        if (style.opacity !== undefined) {
          style.opacity = Math.min(1, Math.max(0.1, style.opacity));
        }
        if (style.fontSize !== undefined) {
          style.fontSize = Math.min(120, Math.max(10, style.fontSize));
        }
        if (style.fontWeight !== undefined) {
          style.fontWeight = Math.min(900, Math.max(100, style.fontWeight));
        }
        block.style = style;
      }
    }
  }
  return next;
}

function buildHeaderLinksForEditor(spec: SiteSpecV3) {
  const home = spec.pages.find((page) => page.slug === "/") ?? spec.pages[0];
  if (!home) return [];
  const labels: Record<SiteSectionV3["type"], string> = {
    hero: "Inicio",
    catalog: "Catálogo",
    testimonials: "Testimonios",
    contact: "Contacto"
  };
  return home.sections.filter((section) => section.enabled).map((section) => ({
    label: labels[section.type] ?? section.type,
    href: `#${section.id}`
  }));
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

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M3 5l16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.4 7.5C4 9.3 2 12 2 12s3.5 6 10 6c2.2 0 4.1-.5 5.7-1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9.8 9.8A3.2 3.2 0 0 0 12 15.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 7h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9 7V5h6v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M7 7l1 12h8l1-12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

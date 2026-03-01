"use client";

import { useMemo, useState } from "react";

import { SiteRenderer } from "@/components/runtime/site-renderer";
import type { SiteSectionV2, SiteSpecV2 } from "@/lib/site-spec-v2";

type Props = {
  siteId: string;
  initialSpec: SiteSpecV2;
};

export function SiteEditor({ siteId, initialSpec }: Props) {
  const [siteSpec, setSiteSpec] = useState<SiteSpecV2>(initialSpec);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const homepage = useMemo(() => siteSpec.pages.find((page) => page.slug === "/") ?? siteSpec.pages[0] ?? null, [siteSpec]);

  function updateSection(sectionId: string, updater: (section: SiteSectionV2) => SiteSectionV2) {
    if (!homepage) return;

    setSiteSpec((prev) => ({
      ...prev,
      pages: prev.pages.map((page) =>
        page.id === homepage.id
          ? {
              ...page,
              sections: page.sections.map((section) => (section.id === sectionId ? updater(section) : section))
            }
          : page
      )
    }));
  }

  function toggleSection(sectionId: string) {
    updateSection(sectionId, (section) => ({ ...section, enabled: !section.enabled }));
  }

  function moveSection(sectionId: string, direction: "up" | "down") {
    if (!homepage) return;

    setSiteSpec((prev) => {
      const page = prev.pages.find((item) => item.id === homepage.id);
      if (!page) return prev;

      const index = page.sections.findIndex((section) => section.id === sectionId);
      if (index < 0) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= page.sections.length) return prev;

      const reordered = [...page.sections];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);

      return {
        ...prev,
        pages: prev.pages.map((item) => (item.id === page.id ? { ...item, sections: reordered } : item))
      };
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

  function updateCatalogItem(sectionId: string, itemId: string, field: "name" | "description" | "price" | "image_url", value: string) {
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
              image_url: "https://placehold.co/600x400?text=Nuevo+Item"
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
    updateSection(sectionId, (section) => ({
      ...section,
      variant: variant as SiteSectionV2["variant"]
    }));
  }

  async function saveDraft() {
    setSaving(true);
    setMessage(null);

    const invalidImage = hasInvalidImageUrl(siteSpec);
    if (invalidImage) {
      setMessage("Hay una URL de imagen inválida. Usa formato http:// o https://");
      setSaving(false);
      return;
    }

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
        <h2>Editor visual v2</h2>
        {!homepage ? <p>No hay una página inicial para editar.</p> : null}

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
          <select value={siteSpec.theme.radius} onChange={(event) => updateThemeField("radius", event.target.value as SiteSpecV2["theme"]["radius"])}>
            <option value="sm">sm</option>
            <option value="md">md</option>
            <option value="lg">lg</option>
          </select>
        </label>

        {(homepage?.sections ?? []).map((section, index, allSections) => (
          <article key={section.id} className="card stack">
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}>
              <strong>{section.type}</strong>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <button type="button" className="btn-secondary" onClick={() => moveSection(section.id, "up")} disabled={index === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => moveSection(section.id, "down")}
                  disabled={index === allSections.length - 1}
                >
                  ↓
                </button>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" checked={section.enabled} onChange={() => toggleSection(section.id)} style={{ width: "auto" }} />
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
                  <input value={section.props.headline} onChange={(event) => updateSection(section.id, (s) => s.type === "hero" ? { ...s, props: { ...s.props, headline: event.target.value } } : s)} />
                </label>
                <label>
                  Subheadline
                  <input value={section.props.subheadline} onChange={(event) => updateSection(section.id, (s) => s.type === "hero" ? { ...s, props: { ...s.props, subheadline: event.target.value } } : s)} />
                </label>
                <label>
                  CTA label
                  <input value={section.props.cta_label} onChange={(event) => updateSection(section.id, (s) => s.type === "hero" ? { ...s, props: { ...s.props, cta_label: event.target.value } } : s)} />
                </label>
                <label>
                  Imagen URL
                  <input value={section.props.image_url ?? ""} onChange={(event) => updateSection(section.id, (s) => s.type === "hero" ? { ...s, props: { ...s.props, image_url: event.target.value } } : s)} />
                </label>
              </>
            ) : null}

            {section.type === "catalog" ? (
              <>
                <label>
                  Título
                  <input value={section.props.title} onChange={(event) => updateSection(section.id, (s) => s.type === "catalog" ? { ...s, props: { ...s.props, title: event.target.value } } : s)} />
                </label>
                <button type="button" className="btn-secondary" onClick={() => addCatalogItem(section.id)} disabled={section.props.items.length >= 8}>
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
                      <input value={item.description} onChange={(event) => updateCatalogItem(section.id, item.id, "description", event.target.value)} />
                    </label>
                    <label>
                      Precio
                      <input value={item.price ?? ""} onChange={(event) => updateCatalogItem(section.id, item.id, "price", event.target.value)} />
                    </label>
                    <label>
                      Imagen URL
                      <input value={item.image_url ?? ""} onChange={(event) => updateCatalogItem(section.id, item.id, "image_url", event.target.value)} />
                    </label>
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
                  <input value={section.props.title} onChange={(event) => updateSection(section.id, (s) => s.type === "testimonials" ? { ...s, props: { ...s.props, title: event.target.value } } : s)} />
                </label>
                <button type="button" className="btn-secondary" onClick={() => addTestimonialItem(section.id)} disabled={section.props.items.length >= 6}>
                  Agregar testimonio
                </button>
                {section.props.items.map((item) => (
                  <div key={item.id} className="card stack">
                    <label>
                      Cita
                      <input value={item.quote} onChange={(event) => updateTestimonialItem(section.id, item.id, "quote", event.target.value)} />
                    </label>
                    <label>
                      Autor
                      <input value={item.author} onChange={(event) => updateTestimonialItem(section.id, item.id, "author", event.target.value)} />
                    </label>
                    <label>
                      Rol
                      <input value={item.role ?? ""} onChange={(event) => updateTestimonialItem(section.id, item.id, "role", event.target.value)} />
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
                  <input value={section.props.title} onChange={(event) => updateSection(section.id, (s) => s.type === "contact" ? { ...s, props: { ...s.props, title: event.target.value } } : s)} />
                </label>
                <label>
                  Descripción
                  <input value={section.props.description} onChange={(event) => updateSection(section.id, (s) => s.type === "contact" ? { ...s, props: { ...s.props, description: event.target.value } } : s)} />
                </label>
                <label>
                  WhatsApp
                  <input value={section.props.whatsapp_phone ?? ""} onChange={(event) => updateSection(section.id, (s) => s.type === "contact" ? { ...s, props: { ...s.props, whatsapp_phone: event.target.value } } : s)} />
                </label>
                <label>
                  Label WhatsApp
                  <input value={section.props.whatsapp_label ?? ""} onChange={(event) => updateSection(section.id, (s) => s.type === "contact" ? { ...s, props: { ...s.props, whatsapp_label: event.target.value } } : s)} />
                </label>
                <label>
                  Dirección
                  <input value={section.props.address ?? ""} onChange={(event) => updateSection(section.id, (s) => s.type === "contact" ? { ...s, props: { ...s.props, address: event.target.value } } : s)} />
                </label>
              </>
            ) : null}
          </article>
        ))}

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

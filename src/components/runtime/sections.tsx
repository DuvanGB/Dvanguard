import { useMemo } from "react";
import type { MouseEvent } from "react";

import type { CanvasBlock, SiteSectionV3 } from "@/lib/site-spec-v3";

type Theme = {
  primary: string;
  secondary: string;
  background: string;
  font_heading: string;
  font_body: string;
  radius: "sm" | "md" | "lg";
};

export type SectionRenderProps = {
  section: SiteSectionV3;
  viewport: "desktop" | "mobile";
  theme: Theme;
  whatsappLink?: string;
  onAddToCart?: (item: ProductCartItem) => void;
  onTrackCtaClick?: (sectionId: string) => void;
  onTrackWhatsappClick?: (sectionId: string) => void;
  onSelectBlock?: (sectionId: string, blockId: string) => void;
  selectedBlockId?: string | null;
  editable?: boolean;
};

export type ProductCartItem = {
  blockId: string;
  name: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  description?: string;
};

export function CanvasSection({
  section,
  viewport,
  theme,
  whatsappLink,
  onAddToCart,
  onTrackCtaClick,
  onTrackWhatsappClick,
  onSelectBlock,
  selectedBlockId,
  editable
}: SectionRenderProps) {
  const visibleBlocks = useMemo(() => section.blocks.filter((block) => block.visible), [section.blocks]);
  const sectionRatio = viewport === "mobile" ? section.height_ratio.mobile : section.height_ratio.desktop;

  return (
    <section
      data-section-id={section.id}
      id={section.id}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${1}/${sectionRatio}`,
        borderBottom: `1px solid ${theme.secondary}25`,
        overflow: "hidden"
      }}
    >
      {visibleBlocks
        .sort((a, b) => getBlockLayout(a, viewport).z - getBlockLayout(b, viewport).z)
        .map((block) => (
          <CanvasBlockRenderer
            key={block.id}
            block={block}
            sectionId={section.id}
            viewport={viewport}
            whatsappLink={whatsappLink}
            onAddToCart={onAddToCart}
            onTrackCtaClick={onTrackCtaClick}
            onTrackWhatsappClick={onTrackWhatsappClick}
            onSelectBlock={onSelectBlock}
            isSelected={selectedBlockId === block.id}
            editable={editable}
          />
        ))}
    </section>
  );
}

function CanvasBlockRenderer({
  block,
  sectionId,
  viewport,
  whatsappLink,
  onAddToCart,
  onTrackCtaClick,
  onTrackWhatsappClick,
  onSelectBlock,
  isSelected,
  editable
}: {
  block: CanvasBlock;
  sectionId: string;
  viewport: "desktop" | "mobile";
  whatsappLink?: string;
  onAddToCart?: (item: ProductCartItem) => void;
  onTrackCtaClick?: (sectionId: string) => void;
  onTrackWhatsappClick?: (sectionId: string) => void;
  onSelectBlock?: (sectionId: string, blockId: string) => void;
  isSelected: boolean;
  editable?: boolean;
}) {
  const rect = getBlockLayout(block, viewport);
  const style = {
    position: "absolute" as const,
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
    zIndex: rect.z,
    borderRadius: block.style?.radius ?? 0,
    color: block.style?.color,
    background: block.style?.bgColor,
    borderStyle: block.style?.borderWidth ? "solid" : undefined,
    borderWidth: block.style?.borderWidth,
    borderColor: block.style?.borderColor,
    opacity: block.style?.opacity,
    fontSize: block.style?.fontSize,
    fontWeight: block.style?.fontWeight,
    fontFamily: block.style?.fontFamily,
    textAlign: block.style?.textAlign as "left" | "center" | "right" | undefined,
    boxSizing: "border-box" as const,
    outline: editable && isSelected ? "2px solid #0ea5e9" : "none",
    cursor: editable ? "pointer" : "default"
  };

  if (block.type === "text") {
    if (!block.content || typeof block.content.text !== "string") return null;
    return (
      <div style={{ ...style, padding: 8 }} onClick={() => onSelectBlock?.(sectionId, block.id)}>
        {block.content.text}
      </div>
    );
  }

  if (block.type === "image") {
    if (!block.content) return null;
    const src = block.content.url || "https://placehold.co/800x520?text=Imagen";
    const fit = block.content.fit ?? "contain";
    return (
      <img
        src={src}
        alt={block.content.alt ?? "Imagen"}
        style={{ ...style, objectFit: fit as "cover" | "contain" }}
        onClick={() => onSelectBlock?.(sectionId, block.id)}
      />
    );
  }

  if (block.type === "button") {
    if (!block.content) return null;
    const href =
      block.content.action === "whatsapp"
        ? whatsappLink
        : block.content.href && /^https?:\/\//i.test(block.content.href)
          ? block.content.href
          : undefined;

    const handleClick = () => {
      if (editable) {
        onSelectBlock?.(sectionId, block.id);
        return;
      }
      if (block.content.action === "whatsapp") {
        onTrackWhatsappClick?.(sectionId);
      } else {
        onTrackCtaClick?.(sectionId);
      }
    };

    if (!href) {
      return (
        <button type="button" style={{ ...style, border: "none" }} onClick={handleClick}>
          {block.content.label}
        </button>
      );
    }

    return (
      <a href={href} target="_blank" rel="noreferrer" style={{ ...style, textDecoration: "none", display: "grid", placeItems: "center" }} onClick={handleClick}>
        {block.content.label}
      </a>
    );
  }

  if (block.type === "product") {
    if (!block.content) return null;
    const handleAdd = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (editable) {
        onSelectBlock?.(sectionId, block.id);
        return;
      }
      onAddToCart?.({
        blockId: block.id,
        name: block.content.name,
        price: block.content.price,
        currency: block.content.currency,
        imageUrl: block.content.image_url,
        description: block.content.description
      });
    };

    const priceLabel = formatPrice(block.content.price, block.content.currency);

    return (
      <div
        style={{
          ...style,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}
        onClick={() => onSelectBlock?.(sectionId, block.id)}
      >
        <div style={{ flex: "0 0 auto", borderRadius: block.style.radius ?? 12, overflow: "hidden" }}>
          <img
            src={block.content.image_url || "https://placehold.co/640x420?text=Producto"}
            alt={block.content.name}
            style={{ width: "100%", height: 160, objectFit: "cover" }}
          />
        </div>
        <strong style={{ fontSize: 18 }}>{block.content.name}</strong>
        {block.content.description ? <span style={{ fontSize: 14, color: "#475569" }}>{block.content.description}</span> : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          <span style={{ fontWeight: 700 }}>{priceLabel}</span>
          <button type="button" onClick={handleAdd} style={{ padding: "0.45rem 0.8rem", borderRadius: 999, border: "none", background: "#0c4a6e", color: "#fff" }}>
            Agregar
          </button>
        </div>
      </div>
    );
  }

  if (block.type === "shape") {
    if (!block.content) return null;
    const shapeStyle =
      block.content.shape === "circle"
        ? { borderRadius: "999px" }
        : block.content.shape === "pill"
          ? { borderRadius: "999px" }
          : { borderRadius: block.style.radius ?? 8 };

    return <div style={{ ...style, ...shapeStyle }} onClick={() => onSelectBlock?.(sectionId, block.id)} />;
  }

  return <div style={{ ...style }} onClick={() => onSelectBlock?.(sectionId, block.id)} />;
}

function formatPrice(value?: number, currency?: string) {
  if (value === undefined || value === null) return "Consultar";
  const normalizedCurrency = currency?.trim() || "COP";
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return `${normalizedCurrency} ${value}`;
  }
}

export function getBlockLayout(block: CanvasBlock, viewport: "desktop" | "mobile") {
  if (viewport === "mobile" && block.layout.mobile) {
    return block.layout.mobile;
  }
  return block.layout.desktop;
}

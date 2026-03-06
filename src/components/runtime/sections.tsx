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
  onTrackCtaClick?: (sectionId: string) => void;
  onTrackWhatsappClick?: (sectionId: string) => void;
  onSelectBlock?: (sectionId: string, blockId: string) => void;
  selectedBlockId?: string | null;
  editable?: boolean;
};

export function CanvasSection({
  section,
  viewport,
  theme,
  whatsappLink,
  onTrackCtaClick,
  onTrackWhatsappClick,
  onSelectBlock,
  selectedBlockId,
  editable
}: SectionRenderProps) {
  const sectionHeight = viewport === "mobile" ? section.height.mobile : section.height.desktop;

  return (
    <section
      data-section-id={section.id}
      style={{
        position: "relative",
        minHeight: sectionHeight,
        borderBottom: `1px solid ${theme.secondary}25`,
        overflow: "hidden"
      }}
    >
      {section.blocks
        .filter((block) => block.visible)
        .sort((a, b) => blockRect(a, viewport).z - blockRect(b, viewport).z)
        .map((block) => (
          <CanvasBlockRenderer
            key={block.id}
            block={block}
            sectionId={section.id}
            viewport={viewport}
            whatsappLink={whatsappLink}
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
  onTrackCtaClick?: (sectionId: string) => void;
  onTrackWhatsappClick?: (sectionId: string) => void;
  onSelectBlock?: (sectionId: string, blockId: string) => void;
  isSelected: boolean;
  editable?: boolean;
}) {
  const rect = blockRect(block, viewport);
  const style = {
    position: "absolute" as const,
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
    boxSizing: "border-box" as const,
    outline: editable && isSelected ? "2px solid #0ea5e9" : "none",
    cursor: editable ? "pointer" : "default"
  };

  if (block.type === "text") {
    return (
      <div style={{ ...style, padding: 8 }} onClick={() => onSelectBlock?.(sectionId, block.id)}>
        {block.content.text}
      </div>
    );
  }

  if (block.type === "image") {
    const src = block.content.url || "https://placehold.co/800x520?text=Imagen";
    return (
      <img
        src={src}
        alt={block.content.alt ?? "Imagen"}
        style={{ ...style, objectFit: "cover" as const }}
        onClick={() => onSelectBlock?.(sectionId, block.id)}
      />
    );
  }

  if (block.type === "button") {
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

  if (block.type === "shape") {
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

export function blockRect(block: CanvasBlock, viewport: "desktop" | "mobile") {
  if (viewport === "mobile" && block.layout.mobile) {
    return block.layout.mobile;
  }
  return block.layout.desktop;
}

type Props = {
  markdown: string;
  className?: string;
  stripFirstHeading?: boolean;
};

function renderInline(text: string) {
  return text;
}

export function MarkdownLite({ markdown, className, stripFirstHeading = false }: Props) {
  const lines = markdown.split(/\r?\n/);
  const blocks: Array<{ type: "h1" | "h2" | "h3" | "p" | "ul"; text?: string; items?: string[] }> = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (!listBuffer.length) return;
    blocks.push({ type: "ul", items: listBuffer });
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2).trim());
      continue;
    }

    flushList();

    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      continue;
    }

    blocks.push({ type: "p", text: line });
  }

  flushList();

  const renderedBlocks = stripFirstHeading && blocks[0]?.type === "h1" ? blocks.slice(1) : blocks;

  return (
    <div className={className}>
      {renderedBlocks.map((block, index) => {
        if (block.type === "h1") return <h1 key={index}>{renderInline(block.text ?? "")}</h1>;
        if (block.type === "h2") return <h2 key={index}>{renderInline(block.text ?? "")}</h2>;
        if (block.type === "h3") return <h3 key={index}>{renderInline(block.text ?? "")}</h3>;
        if (block.type === "ul") {
          return (
            <ul key={index}>
              {(block.items ?? []).map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{renderInline(block.text ?? "")}</p>;
      })}
    </div>
  );
}

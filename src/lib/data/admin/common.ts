export type AdminCardTone = "neutral" | "positive" | "warning" | "danger" | "accent";

export function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${value}%`;
}

export function formatLatency(p50: number | null, p95: number | null) {
  const left = p50 === null ? "-" : `${p50}ms`;
  const right = p95 === null ? "-" : `${p95}ms`;
  return `${left} / ${right}`;
}

export function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function parsePagination(input: { page?: string | null; pageSize?: string | null }) {
  const rawPage = Number(input.page ?? "1");
  const rawPageSize = Number(input.pageSize ?? "20");

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 100) : 20;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return { page, pageSize, from, to };
}

export function parseRange(range: string | null | undefined) {
  if (range === "24h") {
    return { label: "24h", from: new Date(Date.now() - 24 * 60 * 60 * 1000) };
  }
  if (range === "30d") {
    return { label: "30d", from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  }
  if (range === "1y") {
    return { label: "1y", from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
  }
  if (range === "all") {
    return { label: "all", from: new Date(0) };
  }

  return { label: "7d", from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
}

export function percentile(values: number[], p: number) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  const bounded = Math.max(0, Math.min(sorted.length - 1, index));
  return sorted[bounded];
}

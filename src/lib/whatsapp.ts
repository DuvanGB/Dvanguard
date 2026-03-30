export function sanitizeWhatsappPhone(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutLetters = trimmed.replace(/[A-Za-z]/g, "");
  const compact = withoutLetters.replace(/[\s().-]/g, "");
  const normalized = compact.startsWith("+") ? compact : `+${compact.replace(/^\++/, "")}`;
  const plus = normalized.startsWith("+") ? "+" : "";
  const digits = normalized.replace(/\D/g, "");
  return `${plus}${digits}`;
}

export function validateWhatsappPhone(value?: string | null) {
  const normalized = sanitizeWhatsappPhone(value);
  return /^\+\d{8,15}$/.test(normalized);
}

export function normalizeWhatsappPhone(value?: string | null) {
  const normalized = sanitizeWhatsappPhone(value);
  return validateWhatsappPhone(normalized) ? normalized : undefined;
}

const E164_WHATSAPP_REGEX = /^\+\d{8,15}$/;

export function sanitizeWhatsappPhone(value?: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  let normalized = trimmed
    .replace(/\s+/g, "")
    .replace(/[().-]/g, "")
    .replace(/^(00)(?=\d)/, "+");

  if (!normalized.startsWith("+") && /^\d+$/.test(normalized)) {
    normalized = `+${normalized}`;
  }

  if (normalized.startsWith("+")) {
    return `+${normalized.slice(1).replace(/[^0-9A-Za-z]/g, "")}`;
  }

  return normalized.replace(/[^0-9A-Za-z]/g, "");
}

export function validateWhatsappPhone(value?: string | null) {
  return E164_WHATSAPP_REGEX.test(sanitizeWhatsappPhone(value));
}

export function normalizeWhatsappPhone(value?: string | null) {
  const sanitized = sanitizeWhatsappPhone(value);
  return validateWhatsappPhone(sanitized) ? sanitized : sanitized;
}

export function extractWhatsappPhone(value?: string | null) {
  const sanitized = sanitizeWhatsappPhone(value);
  return validateWhatsappPhone(sanitized) ? sanitized : undefined;
}

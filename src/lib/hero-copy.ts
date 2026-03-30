type HeroCopyInput = {
  businessName: string;
  offerSummary: string;
  targetAudience: string;
  businessType: "informative" | "commerce_lite";
};

export function buildHeroHeadline(input: HeroCopyInput) {
  const focus = extractCommercialFocus(input.offerSummary);
  if (input.businessType === "commerce_lite") {
    if (focus) return `${capitalizePhrase(focus)} con atención ágil`;
    return "Compra con claridad y atención rápida";
  }

  if (focus) return `${capitalizePhrase(focus)} con una propuesta clara`;
  return "Haz que tu propuesta se entienda al instante";
}

export function buildHeroSubheadline(input: HeroCopyInput) {
  const normalizedOffer = normalizeHeroOffer(input);
  return `${normalizedOffer}${normalizedOffer.endsWith(".") ? "" : "."} Para ${input.targetAudience.toLowerCase()}.`.slice(0, 220);
}

export function normalizeHeroOffer(input: HeroCopyInput) {
  const compact = input.offerSummary.trim().replace(/\s+/g, " ");
  if (compact && !looksLikeIntentPrompt(compact) && !containsProductPlaceholderNames(compact)) {
    return compact;
  }

  if (input.businessType === "commerce_lite") {
    return `${input.businessName} ofrece una selección clara de productos para ${input.targetAudience.toLowerCase()}, con atención ágil, catálogo fácil de recorrer y contacto directo para cerrar ventas.`;
  }

  return `${input.businessName} presenta una propuesta clara para ${input.targetAudience.toLowerCase()}, con beneficios entendibles y contacto directo para avanzar rápido.`;
}

function extractCommercialFocus(value: string) {
  const compact = value.trim().replace(/\s+/g, " ");
  const lowered = compact.toLowerCase();
  const patterns = [
    /venta de ([a-záéíóúñ0-9\s]{4,80}?)(?: para| con|\.|,|$)/i,
    /ofrece(?: una)? ([a-záéíóúñ0-9\s]{4,80}?)(?: para| con|\.|,|$)/i,
    /cat[aá]logo de ([a-záéíóúñ0-9\s]{4,80}?)(?: para| con|\.|,|$)/i,
    /soluciones de ([a-záéíóúñ0-9\s]{4,80}?)(?: para| con|\.|,|$)/i
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (match?.[1]) {
      const candidate = sanitizeFocus(match[1]);
      if (candidate) return candidate;
    }
  }

  if (/equipos de oficina/i.test(lowered)) return "equipos de oficina";
  if (/ropa para mascotas/i.test(lowered)) return "ropa para mascotas";
  if (/ropa deportiva/i.test(lowered)) return "ropa deportiva";
  if (/asesor[ií]a/i.test(lowered)) return "asesoría profesional";
  return null;
}

function sanitizeFocus(value: string) {
  const compact = value
    .replace(/\b(producto|productos|servicio|servicios|negocio)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact || compact.length < 4 || containsProductPlaceholderNames(compact)) return null;
  return compact;
}

function capitalizePhrase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function looksLikeIntentPrompt(value: string) {
  const lower = value.trim().toLowerCase();
  return /^(necesito|quiero|busco|me gustar[ií]a|deseo|crear|hacer|montar|armar)\b/.test(lower) ||
    /quiero una p[aá]gina|necesito una web|crear un negocio|crear una tienda|hacer una web/.test(lower);
}

function containsProductPlaceholderNames(value: string) {
  return /\bproducto\s*(estrella|\d+)\b/i.test(value);
}

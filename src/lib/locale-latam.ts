export const DEFAULT_LATAM_COUNTRY = "CO";
export const DEFAULT_LATAM_LOCALE = "es-419";

type LatamOptions = {
  countryCode?: string | null;
};

export function resolveLatamCountry(countryCode?: string | null) {
  const normalized = (countryCode ?? DEFAULT_LATAM_COUNTRY).trim().toUpperCase();
  return normalized || DEFAULT_LATAM_COUNTRY;
}

export function resolveLatamLocale(countryCode?: string | null) {
  const country = resolveLatamCountry(countryCode);
  return `es-${country}`;
}

export function formatDateLatam(value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions & LatamOptions) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const { countryCode, ...formatOptions } = options ?? {};
  return new Intl.DateTimeFormat(resolveLatamLocale(countryCode), {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...formatOptions
  }).format(date);
}

export function formatCurrencyLatam(
  amount: number,
  currency = "COP",
  options?: Intl.NumberFormatOptions & LatamOptions
) {
  const { countryCode, ...formatOptions } = options ?? {};
  return new Intl.NumberFormat(resolveLatamLocale(countryCode), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...formatOptions
  }).format(amount);
}

export function getCountryDisplayName(countryCode?: string | null) {
  const normalized = resolveLatamCountry(countryCode);

  try {
    const displayNames = new Intl.DisplayNames([DEFAULT_LATAM_LOCALE], { type: "region" });
    return displayNames.of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

export function getSiteTypeLabel(siteType: "informative" | "commerce_lite") {
  return siteType === "commerce_lite" ? "Comercio ligero" : "Informativo";
}

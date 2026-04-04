import { cookies } from "next/headers";

import type { PlatformScope } from "@/lib/platform-config";

export type AppLocale = "es" | "en";

export const LOCALE_COOKIE = "dvg-locale";
export const DEFAULT_LOCALE: AppLocale = "es";

/**
 * Parse Accept-Language header and return the best matching locale.
 * Any Spanish variant (es, es-CO, es-MX, es-AR, …) → "es".
 * Everything else → "en".
 */
export function detectLocale(acceptLanguage: string | null): AppLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const segments = acceptLanguage
    .split(",")
    .map((s) => {
      const [lang, qStr] = s.trim().split(";q=");
      return { lang: lang.trim().toLowerCase(), q: qStr ? parseFloat(qStr) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of segments) {
    if (lang.startsWith("es")) return "es";
    if (lang.startsWith("en")) return "en";
  }

  return DEFAULT_LOCALE;
}

/**
 * Read the persisted locale from cookies (server-side).
 */
export async function getLocaleFromCookies(): Promise<AppLocale> {
  const jar = await cookies();
  const value = jar.get(LOCALE_COOKIE)?.value;
  if (value === "es" || value === "en") return value;
  return DEFAULT_LOCALE;
}

/**
 * Map an AppLocale to the PlatformScope used by getPlatformCopyMap / getPlatformSetting.
 */
export function localeToScope(locale: AppLocale): PlatformScope {
  if (locale === "es") return { countryCode: "CO", localeCode: "es-CO" };
  return { countryCode: null, localeCode: "en" };
}

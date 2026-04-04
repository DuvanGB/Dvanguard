import Link from "next/link";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getPlatformCopyMap, getPlatformSetting, PLATFORM_SETTING_KEYS } from "@/lib/platform-config";
import { getLocaleFromCookies, localeToScope } from "@/lib/locale";

export async function PlatformFooter() {
  const admin = getSupabaseAdminClient();
  const locale = await getLocaleFromCookies();
  const scope = localeToScope(locale);

  const [copy, waNumber] = await Promise.all([
    getPlatformCopyMap(admin, ["footer.rights", "footer.privacy", "footer.terms"], scope),
    getPlatformSetting(admin, PLATFORM_SETTING_KEYS.marketingWhatsappNumber, scope)
  ]);

  const whatsapp = (waNumber as string) || "573203460370";

  return (
    <footer className="platform-footer">
      <div className="platform-footer-inner">
        <div className="platform-footer-brand">
          <span className="platform-footer-logo">DVanguard AI</span>
          <p className="platform-footer-copy">{copy["footer.rights"]}</p>
        </div>
        <div className="platform-footer-links">
          <Link href="/privacy">{copy["footer.privacy"]}</Link>
          <Link href="/terms">{copy["footer.terms"]}</Link>
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="platform-footer-wa"
          >
            <span className="material-symbols-outlined">chat</span>
            WhatsApp
          </a>
        </div>
      </div>
    </footer>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";
import { designFontVariables } from "@/lib/design-fonts";
import { ThemeProvider } from "@/components/theme-provider";
import { getLocaleFromCookies } from "@/lib/locale";

export const metadata: Metadata = {
  title: "DVanguard | AI Website Builder",
  description: "Crea tu sitio web con IA — Create your website with AI."
};

const themeScript = `(function(){try{var t=localStorage.getItem("dvg-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);return;}var m=window.matchMedia&&window.matchMedia("(prefers-color-scheme:dark)").matches;document.documentElement.setAttribute("data-theme",m?"dark":"light");}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocaleFromCookies();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={designFontVariables}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

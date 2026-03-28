import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";
import { designFontVariables } from "@/lib/design-fonts";

export const metadata: Metadata = {
  title: "DVanguard | AI Website Builder",
  description: "Describe tu negocio y genera tu web en minutos."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className={designFontVariables}>{children}</body>
    </html>
  );
}

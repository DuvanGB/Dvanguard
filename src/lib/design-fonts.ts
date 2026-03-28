import {
  Bebas_Neue,
  Cormorant_Garamond,
  DM_Sans,
  DM_Serif_Display,
  Inter,
  Lato,
  Manrope,
  Montserrat,
  Mulish,
  Nunito,
  Open_Sans,
  Oswald,
  Outfit,
  Playfair_Display,
  Poppins,
  Source_Sans_3,
  Space_Grotesk,
  Syne
} from "next/font/google";

const playfairDisplay = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair-display", weight: ["400", "500", "600", "700", "800", "900"] });
const lato = Lato({ subsets: ["latin"], variable: "--font-lato", weight: ["400", "700", "900"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", weight: ["400", "500", "600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700", "800"] });
const cormorantGaramond = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-cormorant-garamond", weight: ["300", "400", "500", "600", "700"] });
const mulish = Mulish({ subsets: ["latin"], variable: "--font-mulish", weight: ["400", "500", "600", "700", "800"] });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ["400", "500", "600", "700", "800"] });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", weight: ["400", "500", "600", "700", "800"] });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne", weight: ["400", "500", "600", "700", "800"] });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", weight: ["400", "500", "600", "700", "800"] });
const bebasNeue = Bebas_Neue({ subsets: ["latin"], variable: "--font-bebas-neue", weight: ["400"] });
const dmSerifDisplay = DM_Serif_Display({ subsets: ["latin"], variable: "--font-dm-serif-display", weight: ["400"] });
const poppins = Poppins({ subsets: ["latin"], variable: "--font-poppins", weight: ["400", "500", "600", "700", "800"] });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", weight: ["400", "500", "600", "700", "800"] });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "500", "600", "700", "800"] });
const sourceSans3 = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans-3", weight: ["400", "500", "600", "700"] });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald", weight: ["400", "500", "600", "700"] });
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans", weight: ["400", "500", "600", "700", "800"] });

export const designFontVariables = [
  playfairDisplay.variable,
  lato.variable,
  spaceGrotesk.variable,
  inter.variable,
  cormorantGaramond.variable,
  mulish.variable,
  outfit.variable,
  dmSans.variable,
  syne.variable,
  manrope.variable,
  bebasNeue.variable,
  dmSerifDisplay.variable,
  poppins.variable,
  montserrat.variable,
  nunito.variable,
  sourceSans3.variable,
  oswald.variable,
  openSans.variable
].join(" ");

export const fontTokenStacks = {
  "Playfair Display": `var(${playfairDisplay.variable}), Georgia, serif`,
  Lato: `var(${lato.variable}), system-ui, sans-serif`,
  "Space Grotesk": `var(${spaceGrotesk.variable}), system-ui, sans-serif`,
  Inter: `var(${inter.variable}), system-ui, sans-serif`,
  "Cormorant Garamond": `var(${cormorantGaramond.variable}), Georgia, serif`,
  Mulish: `var(${mulish.variable}), system-ui, sans-serif`,
  Outfit: `var(${outfit.variable}), system-ui, sans-serif`,
  "DM Sans": `var(${dmSans.variable}), system-ui, sans-serif`,
  Syne: `var(${syne.variable}), system-ui, sans-serif`,
  Manrope: `var(${manrope.variable}), system-ui, sans-serif`,
  "Bebas Neue": `var(${bebasNeue.variable}), Impact, sans-serif`,
  "DM Serif Display": `var(${dmSerifDisplay.variable}), Georgia, serif`,
  Poppins: `var(${poppins.variable}), system-ui, sans-serif`,
  Montserrat: `var(${montserrat.variable}), system-ui, sans-serif`,
  Nunito: `var(${nunito.variable}), system-ui, sans-serif`,
  "Source Sans Pro": `var(${sourceSans3.variable}), system-ui, sans-serif`,
  Oswald: `var(${oswald.variable}), system-ui, sans-serif`,
  "Open Sans": `var(${openSans.variable}), system-ui, sans-serif`
} as const;

export type SupportedFontToken = keyof typeof fontTokenStacks;

export function resolveFontStack(token?: string | null, fallback: SupportedFontToken = "DM Sans") {
  if (token && token in fontTokenStacks) {
    return fontTokenStacks[token as SupportedFontToken];
  }
  return fontTokenStacks[fallback];
}

import type { CanvasBlock, SiteSectionV3, SiteThemeV31 } from "@/lib/site-spec-v3";
import { resolveFontStack } from "@/lib/design-fonts";

export function getBodyFontFamily(theme: SiteThemeV31) {
  return resolveFontStack(theme.typography.body_font, "DM Sans");
}

export function getHeadingFontFamily(theme: SiteThemeV31) {
  return resolveFontStack(theme.typography.heading_font, "Outfit");
}

export function getFontFamilyForBlock(theme: SiteThemeV31, block: CanvasBlock) {
  if (block.style.fontFamily) {
    return resolveFontStack(block.style.fontFamily, "DM Sans");
  }
  if (block.type === "text" && /headline|title|name/i.test(block.id)) {
    return getHeadingFontFamily(theme);
  }
  if (block.type === "button") {
    return getHeadingFontFamily(theme);
  }
  return getBodyFontFamily(theme);
}

export function getSectionAppearance(theme: SiteThemeV31, section: SiteSectionV3, index: number) {
  const { palette, style_tokens } = theme;
  const alternating = index % 2 === 1;

  if (section.type === "hero") {
    if (style_tokens.hero_treatment === "fullbleed-dark") {
      return { background: palette.background, borderColor: palette.border };
    }
    if (style_tokens.hero_treatment === "fullbleed-light") {
      return { background: palette.surface, borderColor: palette.border };
    }
    if (style_tokens.hero_treatment === "editorial-overlap") {
      return {
        background: `linear-gradient(140deg, ${palette.background} 0%, ${palette.surface} 48%, ${palette.background} 100%)`,
        borderColor: palette.border
      };
    }
    if (style_tokens.hero_treatment === "centered-cinematic") {
      return {
        background: `radial-gradient(circle at top, ${palette.accent}22 0%, ${palette.background} 45%, ${palette.background} 100%)`,
        borderColor: palette.border
      };
    }
    return {
      background: `linear-gradient(135deg, ${palette.surface} 0%, ${palette.background} 100%)`,
      borderColor: palette.border
    };
  }

  if (style_tokens.section_rhythm === "layered") {
    return {
      background: alternating ? palette.surface : palette.background,
      borderColor: palette.border
    };
  }

  if (style_tokens.section_rhythm === "alternating") {
    return {
      background: alternating ? `${palette.surface}` : `${palette.background}`,
      borderColor: palette.border
    };
  }

  return { background: palette.background, borderColor: palette.border };
}

export function getBlockRadius(theme: SiteThemeV31, fallback = 0) {
  switch (theme.style_tokens.image_treatment) {
    case "raw":
      return 0;
    case "rounded-sm":
      return fallback || 14;
    case "rounded-lg":
      return Math.max(fallback, 24);
    case "masked-organic":
      return Math.max(fallback, 28);
    default:
      return fallback;
  }
}

export function getCardSurface(theme: SiteThemeV31) {
  return {
    background: theme.palette.surface,
    borderColor: theme.palette.border,
    color: theme.palette.text_primary
  };
}

export function getButtonAppearance(theme: SiteThemeV31) {
  const { palette, cta } = theme;
  const padding = cta.size === "lg" ? "0.8rem 1.2rem" : cta.size === "sm" ? "0.45rem 0.8rem" : "0.62rem 1rem";
  const base = {
    padding,
    borderRadius: cta.variant === "pill" ? 999 : 14,
    fontWeight: 700,
    letterSpacing: getLetterSpacingValue(theme),
    textTransform: cta.uppercase ? ("uppercase" as const) : ("none" as const)
  };

  if (cta.variant === "ghost") {
    return {
      ...base,
      background: "transparent",
      color: palette.primary,
      border: `1px solid ${palette.border}`
    };
  }
  if (cta.variant === "underline") {
    return {
      ...base,
      background: "transparent",
      color: palette.primary,
      border: "none",
      borderRadius: 0,
      padding: 0,
      textDecoration: "underline"
    };
  }
  return {
    ...base,
    background: palette.accent,
    color: isDarkColor(palette.accent) ? "#ffffff" : "#111827",
    border: cta.variant === "pill" ? "none" : `1px solid ${palette.accent}`
  };
}

export function getTextScale(theme: SiteThemeV31) {
  return theme.typography.scale === "editorial" ? 1.12 : theme.typography.scale === "compact" ? 0.94 : 1;
}

export function getLetterSpacingValue(theme: SiteThemeV31) {
  return theme.typography.letter_spacing === "wide" ? "0.08em" : theme.typography.letter_spacing === "tight" ? "-0.03em" : "0em";
}

export function getSectionPadding(theme: SiteThemeV31) {
  return theme.style_tokens.spacing_scale === "spacious" ? 28 : theme.style_tokens.spacing_scale === "tight" ? 8 : 16;
}

function isDarkColor(color: string) {
  const hex = color.replace("#", "");
  const normalized = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.46;
}

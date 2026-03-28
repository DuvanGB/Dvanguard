import { createHash } from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envText = fs.readFileSync(".env.local", "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
  const idx = line.indexOf("=");
  env[line.slice(0, idx)] = line.slice(idx + 1);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars in .env.local");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const CANVAS_BASE_WIDTH = { desktop: 1120, mobile: 390 };
const LEGACY_FONT_MAP = {
  Poppins: "Outfit",
  Montserrat: "Space Grotesk",
  Nunito: "DM Sans",
  "Source Sans Pro": "DM Sans",
  Oswald: "Bebas Neue",
  "Open Sans": "DM Sans"
};
const SUPPORTED_FONTS = new Set([
  "Playfair Display",
  "Lato",
  "Space Grotesk",
  "Inter",
  "Cormorant Garamond",
  "Mulish",
  "Outfit",
  "DM Sans",
  "Syne",
  "Manrope",
  "Bebas Neue",
  "DM Serif Display",
  "Poppins",
  "Montserrat",
  "Nunito",
  "Source Sans Pro",
  "Oswald",
  "Open Sans"
]);

function normalizeFontFamilyToken(value, fallback = "body") {
  if (value && SUPPORTED_FONTS.has(value)) return value;
  if (value && LEGACY_FONT_MAP[value]) return LEGACY_FONT_MAP[value];
  return fallback === "heading" ? "Outfit" : "DM Sans";
}

function isDarkColor(color) {
  const hex = expandHex(color);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.46;
}

function expandHex(color) {
  const hex = String(color || "").replace("#", "");
  if (hex.length === 3) {
    return hex.split("").map((char) => char + char).join("");
  }
  return hex.padEnd(6, "0").slice(0, 6);
}

function mixHex(base, target, weight) {
  const from = expandHex(base);
  const to = expandHex(target);
  const safeWeight = Math.max(0, Math.min(1, weight));
  const mixed = [0, 2, 4]
    .map((index) => {
      const start = parseInt(from.slice(index, index + 2), 16);
      const end = parseInt(to.slice(index, index + 2), 16);
      return Math.round(start + (end - start) * safeWeight)
        .toString(16)
        .padStart(2, "0");
    })
    .join("");
  return `#${mixed}`;
}

function deriveVisualThemeFromLegacy(theme) {
  const headingFont = normalizeFontFamilyToken(theme.font_heading, "heading");
  const bodyFont = normalizeFontFamilyToken(theme.font_body, "body");
  const darkBackground = isDarkColor(theme.background);
  return {
    palette: {
      background: theme.background,
      surface: darkBackground ? mixHex(theme.background, "#ffffff", 0.06) : "#ffffff",
      border: darkBackground ? mixHex(theme.background, "#ffffff", 0.14) : mixHex(theme.secondary, "#ffffff", 0.72),
      primary: theme.primary,
      accent: theme.secondary,
      text_primary: darkBackground ? "#f8fafc" : theme.primary,
      text_muted: darkBackground ? "#cbd5e1" : mixHex(theme.primary, "#94a3b8", 0.45)
    },
    typography: {
      heading_font: headingFont,
      body_font: bodyFont,
      scale: headingFont === "Playfair Display" || headingFont === "Cormorant Garamond" ? "editorial" : "balanced",
      heading_weight: headingFont === "Cormorant Garamond" ? 400 : 700,
      letter_spacing: headingFont === "Bebas Neue" ? "wide" : headingFont === "Space Grotesk" ? "tight" : "normal"
    },
    style_tokens: {
      spacing_scale: theme.radius === "lg" ? "spacious" : theme.radius === "sm" ? "tight" : "comfortable",
      border_style: theme.radius === "sm" ? "strong" : "subtle",
      section_rhythm: darkBackground ? "layered" : "alternating",
      hero_treatment: darkBackground ? "fullbleed-dark" : headingFont === "Playfair Display" || headingFont === "Cormorant Garamond" ? "editorial-overlap" : "split-asymmetric",
      image_treatment: theme.radius === "lg" ? "rounded-lg" : theme.radius === "sm" ? "raw" : "rounded-sm"
    },
    cta: {
      variant: theme.radius === "lg" ? "pill" : "filled",
      size: "md",
      uppercase: headingFont === "Bebas Neue"
    }
  };
}

function round(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, round(value, 4)));
}

function rectPxToPercent(rect, width, height) {
  return {
    x: clampPercent((rect.x / width) * 100),
    y: clampPercent((rect.y / height) * 100),
    w: clampPercent((rect.w / width) * 100),
    h: clampPercent((rect.h / height) * 100),
    z: rect.z
  };
}

function toRatio(height, width) {
  return round(height / width, 4);
}

function upgradeSpec(spec) {
  const next = structuredClone(spec);
  if (next.schema_version !== "3.0") return next;

  if (next.pages?.[0]?.sections?.[0]?.height) {
    next.pages = next.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => {
        const desktopHeight = section.height.desktop;
        const mobileHeight = section.height.mobile;
        return {
          id: section.id,
          type: section.type,
          enabled: section.enabled,
          variant: section.variant,
          height_ratio: {
            desktop: toRatio(desktopHeight, CANVAS_BASE_WIDTH.desktop),
            mobile: toRatio(mobileHeight, CANVAS_BASE_WIDTH.mobile)
          },
          blocks: section.blocks.map((block) => ({
            ...block,
            layout: {
              desktop: rectPxToPercent(block.layout.desktop, CANVAS_BASE_WIDTH.desktop, desktopHeight),
              mobile: block.layout.mobile
                ? rectPxToPercent(block.layout.mobile, CANVAS_BASE_WIDTH.mobile, mobileHeight)
                : undefined
            }
          }))
        };
      })
    }));
  }

  next.schema_version = "3.1";
  next.theme = deriveVisualThemeFromLegacy(next.theme);
  return next;
}

function hashSpec(spec) {
  return createHash("sha256").update(JSON.stringify(spec)).digest("hex");
}

async function main() {
  let from = 0;
  const size = 500;
  const rows = [];
  while (true) {
    const { data, error } = await admin
      .from("site_versions")
      .select("id, site_id, version, site_spec_json, content_hash")
      .range(from, from + size - 1);

    if (error) {
      throw new Error(`Failed to fetch site versions: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    rows.push(
      ...data.filter((row) => String(row.site_spec_json?.schema_version || "") === "3.0")
    );
    if (data.length < size) break;
    from += size;
  }

  console.log(`found:${rows.length}`);
  let updated = 0;

  for (const row of rows) {
    const upgraded = upgradeSpec(row.site_spec_json);
    const contentHash = hashSpec(upgraded);
    const { error } = await admin
      .from("site_versions")
      .update({ site_spec_json: upgraded, content_hash: contentHash })
      .eq("id", row.id);

    if (error) {
      throw new Error(`Failed to update version ${row.id}: ${error.message}`);
    }
    updated += 1;
    console.log(`updated:${updated}:${row.id}`);
  }

  console.log(`done:${updated}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

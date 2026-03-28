"use client";

import { useState, type CSSProperties } from "react";

import type { SiteThemeV31 } from "@/lib/site-spec-v3";
import { getBodyFontFamily, getHeadingFontFamily } from "@/lib/site-theme";

type HeaderLink = {
  label: string;
  href: string;
};

export function getSiteHeaderPreviewHeight(variant: "none" | "hamburger-side" | "hamburger-overlay" | "top-bar") {
  return variant === "none" ? 0 : 68;
}

export function SiteHeader({
  variant,
  brand,
  links,
  theme,
  preview = false
}: {
  variant: "none" | "hamburger-side" | "hamburger-overlay" | "top-bar";
  brand: string;
  links: HeaderLink[];
  theme: SiteThemeV31;
  preview?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (variant === "none") return null;

  const headerStyle: CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1.5rem",
    minHeight: `${getSiteHeaderPreviewHeight(variant)}px`,
    background: theme.palette.background,
    borderBottom: `1px solid ${theme.palette.border}`,
    color: theme.palette.text_primary
  };

  const brandStyle: CSSProperties = {
    fontFamily: getHeadingFontFamily(theme),
    fontWeight: theme.typography.heading_weight,
    fontSize: "1.1rem",
    color: theme.palette.text_primary,
    letterSpacing: theme.typography.letter_spacing === "wide" ? "0.08em" : theme.typography.letter_spacing === "tight" ? "-0.03em" : "0"
  };

  if (variant === "top-bar") {
    return (
      <div style={{ position: "relative", zIndex: 30 }}>
        <header style={headerStyle}>
          <span style={brandStyle}>{brand}</span>
          <nav style={{ display: "flex", gap: "1rem", fontSize: "0.95rem", flexWrap: "wrap", justifyContent: "flex-end", fontFamily: getBodyFontFamily(theme) }}>
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(event) => {
                  if (preview) {
                    event.preventDefault();
                  }
                }}
                style={{ color: theme.palette.text_primary, textDecoration: "none", fontWeight: 600 }}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </header>
      </div>
    );
  }

  const toggleButton = (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      style={{
        border: `1px solid ${theme.palette.border}`,
        background: "transparent",
        borderRadius: 999,
        padding: "0.4rem 0.65rem",
        color: theme.palette.text_primary,
        display: "grid",
        placeItems: "center",
        cursor: "pointer"
      }}
      aria-label="Abrir menú"
    >
      ☰
    </button>
  );

  return (
    <div style={{ position: "relative", zIndex: 30 }}>
      <header style={headerStyle}>
        {toggleButton}
        <span style={brandStyle}>{brand}</span>
        <div style={{ width: 40 }} />
      </header>
      {open ? (
        <div
          style={{
            position: preview ? "absolute" : "fixed",
            inset: 0,
            background: variant === "hamburger-overlay" ? "rgba(15, 23, 42, 0.65)" : "transparent",
            zIndex: 80
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: variant === "hamburger-side" ? 0 : "10%",
              right: variant === "hamburger-side" ? "auto" : "10%",
              width: variant === "hamburger-side" ? "72%" : "80%",
              maxWidth: 360,
              height: "100%",
              background: theme.palette.surface,
              padding: "1.5rem",
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.25)"
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <strong style={brandStyle}>{brand}</strong>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ border: "none", background: "transparent", fontSize: "1.2rem", cursor: "pointer", color: theme.palette.text_primary }}
              >
                ✕
              </button>
            </div>
            <nav style={{ display: "grid", gap: "0.75rem" }}>
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(event) => {
                    if (preview) {
                      event.preventDefault();
                    }
                    setOpen(false);
                  }}
                  style={{
                    color: theme.palette.text_primary,
                    textDecoration: "none",
                    fontWeight: 600,
                    padding: "0.5rem 0.25rem"
                  }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}

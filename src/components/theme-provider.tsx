"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

type ThemeMode = "auto" | "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "auto",
  resolved: "light",
  setMode: () => {},
  cycle: () => {}
});

export function useTheme() {
  return useContext(ThemeContext);
}

function resolveAutoTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeRaw] = useState<ThemeMode>("auto");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("dvg-theme") as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "auto") {
      setModeRaw(stored);
    }
  }, []);

  useEffect(() => {
    const r = mode === "auto" ? resolveAutoTheme() : mode;
    setResolved(r);
    applyTheme(r);

    if (mode === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        const next = e.matches ? "dark" : "light";
        setResolved(next);
        applyTheme(next);
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeRaw(m);
    localStorage.setItem("dvg-theme", m);
  }, []);

  const cycle = useCallback(() => {
    setMode(mode === "auto" ? "light" : mode === "light" ? "dark" : "auto");
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, cycle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, cycle } = useTheme();
  const icon = mode === "auto" ? "routine" : mode === "light" ? "light_mode" : "dark_mode";
  const label = mode === "auto" ? "Auto" : mode === "light" ? "Claro" : "Oscuro";

  return (
    <button
      type="button"
      onClick={cycle}
      className={`theme-toggle ${className ?? ""}`}
      title={`Tema: ${label}`}
      aria-label={`Cambiar tema (actual: ${label})`}
    >
      <span className="material-symbols-outlined">{icon}</span>
    </button>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-provider";

const navLinks = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/dashboard", label: "Dashboard", icon: "insights" },
  { href: "/pricing", label: "Planes", icon: "payments" },
];

export function PlatformNav({ isAuthenticated = false, isStatic = false, hideLinks = false }: { isAuthenticated?: boolean; isStatic?: boolean; hideLinks?: boolean }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop / Tablet top bar */}
      <header className={`platform-topbar glass-panel${isStatic ? " platform-topbar-static" : ""}`}>
        <nav className="platform-topbar-inner">
          <div className="platform-topbar-left">
            <Link href="/" className="platform-logo">
              <span className="material-symbols-outlined platform-logo-icon">navigation</span>
              DVanguard
            </Link>
            {!hideLinks && (
            <div className="platform-nav-links">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`platform-nav-link ${pathname === l.href ? "active" : ""}`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
            )}
          </div>
          <div className="platform-topbar-right">
            <ThemeToggle />
            {!hideLinks && (isAuthenticated ? (
              <Link href="/dashboard" className="btn-primary platform-nav-cta">
                Dashboard
              </Link>
            ) : (
              <Link href="/signin" className="btn-primary platform-nav-cta">
                Comenzar
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* Mobile bottom nav */}
      {!hideLinks && (
      <nav className="platform-bottom-nav">
        {navLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`platform-bottom-link ${pathname === l.href ? "active" : ""}`}
          >
            <span className="material-symbols-outlined">{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
        <Link
          href="/billing"
          className={`platform-bottom-link ${pathname === "/billing" ? "active" : ""}`}
        >
          <span className="material-symbols-outlined">settings</span>
          <span>Cuenta</span>
        </Link>
      </nav>
      )}
    </>
  );
}

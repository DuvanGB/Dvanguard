"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/settings", label: "Ajustes" },
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/pro-requests", label: "Solicitudes Pro" },
  { href: "/admin/sites", label: "Sitios" },
  { href: "/admin/ai-jobs", label: "Jobs IA" }
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={pathname === link.href ? "admin-nav-link admin-nav-link-active" : "admin-nav-link"}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

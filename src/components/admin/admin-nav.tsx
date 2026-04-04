"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Resumen", icon: "dashboard" },
  { href: "/admin/settings", label: "Ajustes", icon: "settings" },
  { href: "/admin/users", label: "Usuarios", icon: "group" },
  { href: "/admin/sites", label: "Sitios", icon: "language" },
  { href: "/admin/ai-jobs", label: "Jobs IA", icon: "memory" }
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
          <span className="material-symbols-outlined">{link.icon}</span>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

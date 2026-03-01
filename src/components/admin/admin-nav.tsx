import Link from "next/link";

const links = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/pro-requests", label: "Solicitudes Pro" },
  { href: "/admin/sites", label: "Sitios" },
  { href: "/admin/ai-jobs", label: "Jobs IA" }
];

export function AdminNav() {
  return (
    <nav style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="btn-secondary">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

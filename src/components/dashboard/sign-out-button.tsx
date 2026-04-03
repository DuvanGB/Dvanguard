"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await fetch("/api/account/signout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="btn-secondary sign-out-btn"
    >
      <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
        logout
      </span>
      {loading ? "Cerrando…" : "Cerrar sesión"}
    </button>
  );
}

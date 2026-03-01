"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

export function CreateSiteForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subdomain, siteType: "informative" })
    });

    const data = (await response.json()) as { error?: string; site?: { id: string } };
    if (!response.ok || !data.site) {
      setError(data.error ?? "No se pudo crear el sitio");
      setLoading(false);
      return;
    }

    router.push(`/onboarding?siteId=${data.site.id}`);
  }

  return (
    <form className="stack card" onSubmit={handleSubmit}>
      <h3>Crear nuevo sitio</h3>
      <label>
        Nombre
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        Subdominio
        <input
          value={subdomain}
          onChange={(event) => setSubdomain(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="mi-negocio"
          required
        />
      </label>
      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? "Creando..." : "Crear sitio"}
      </button>
      {error ? <p>{error}</p> : null}
    </form>
  );
}

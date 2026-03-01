"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

type JobResponse = {
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  versionId?: string;
  error?: string;
};

export function OnboardingForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const disabled = useMemo(() => loading || prompt.trim().length < 10, [loading, prompt]);

  async function pollJob(currentJobId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetch(`/api/ai/jobs/${currentJobId}`);
      const data = (await response.json()) as { status: string; output?: { versionId?: string }; error?: string };

      if (data.status === "done") {
        router.push(`/sites/${siteId}`);
        return;
      }

      if (data.status === "failed") {
        setError(data.error ?? "La generación de IA falló");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    setError("La generación tardó demasiado. Intenta de nuevo.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, prompt })
    });

    const data = (await response.json()) as JobResponse;

    if (!response.ok) {
      setError(data.error ?? "No se pudo procesar la solicitud");
      setLoading(false);
      return;
    }

    setJobId(data.jobId);

    if (data.status === "done") {
      router.push(`/sites/${siteId}`);
      return;
    }

    await pollJob(data.jobId);
    setLoading(false);
  }

  return (
    <form className="stack card" onSubmit={handleSubmit}>
      <h2>Describe tu negocio</h2>
      <textarea
        rows={6}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Ejemplo: Necesito una página para vender ropa deportiva moderna con botón a WhatsApp"
      />
      <button type="submit" className="btn-primary" disabled={disabled}>
        {loading ? "Generando preview..." : "Generar sitio"}
      </button>
      {jobId ? <small>job_id: {jobId}</small> : null}
      {error ? <p>{error}</p> : null}
    </form>
  );
}

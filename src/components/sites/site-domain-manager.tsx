"use client";

import { useMemo, useState } from "react";

import type { SiteDomainRecord } from "@/lib/site-domains";
import { pickPrimaryDomain } from "@/lib/site-domains";

type Props = {
  siteId: string;
  initialDomains: SiteDomainRecord[];
  compact?: boolean;
};

export function SiteDomainManager({ siteId, initialDomains, compact = false }: Props) {
  const [domains, setDomains] = useState(initialDomains);
  const [hostname, setHostname] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const activeDomain = useMemo(() => pickPrimaryDomain(domains), [domains]);

  async function refreshDomains() {
    const response = await fetch(`/api/sites/${siteId}/domains`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? "No se pudieron recargar los dominios");
    }
    setDomains(payload.domains ?? []);
  }

  async function addDomain() {
    if (!hostname.trim()) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/sites/${siteId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo agregar el dominio");
      }
      await refreshDomains();
      setHostname("");
      setMessage("Dominio agregado. Revisa el estado DNS y verifica cuando termine la propagación.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo agregar el dominio");
    } finally {
      setLoading(false);
    }
  }

  async function verifyDomain(domainId: string) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/domains/${domainId}/verify`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo verificar el dominio");
      }
      await refreshDomains();
      setMessage("Estado del dominio actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo verificar el dominio");
    } finally {
      setLoading(false);
    }
  }

  async function markPrimary(domainId: string) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/domains/${domainId}/primary`, { method: "PATCH" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo marcar como primario");
      }
      await refreshDomains();
      setMessage("Dominio principal actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo marcar como primario");
    } finally {
      setLoading(false);
    }
  }

  async function removeDomain(domainId: string) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/domains/${domainId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo quitar el dominio");
      }
      await refreshDomains();
      setMessage("Dominio eliminado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo quitar el dominio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`stack ${compact ? "stack-md" : "stack-md"}`}>
      <div className="stack stack-sm">
        <strong>Dominio propio</strong>
        <small className="muted">
          {activeDomain ? "Dominio propio conectado y activo." : "Puedes conectar tu dominio cuando quieras desde aquí."}
        </small>
        <div className="flex-wrap">
          <input
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            placeholder="midominio.com"
            style={{ flex: "1 1 240px" }}
          />
          <button type="button" className="btn-secondary" onClick={() => void addDomain()} disabled={loading}>
            Agregar dominio
          </button>
        </div>
      </div>

      {domains.length ? (
        <div className="stack stack-md">
          {domains.map((domain) => {
            const verificationEnvelope = domain.verification_json as {
              domain?: { verification?: Array<Record<string, unknown>> };
            };
            const verification = Array.isArray(verificationEnvelope.domain?.verification) ? verificationEnvelope.domain.verification : [];

            return (
              <article key={domain.id} className="dashboard-site-card" style={{ padding: compact ? "0.85rem" : "1rem" }}>
                <div className="flex-between" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
                  <div className="stack stack-xs">
                    <strong>{domain.hostname}</strong>
                    <small className="muted">
                      Estado: {domain.status}
                      {domain.is_primary ? " · principal" : ""}
                    </small>
                  </div>
                  <div className="flex-wrap">
                    {domain.status !== "active" ? (
                      <button type="button" className="btn-secondary" onClick={() => void verifyDomain(domain.id)} disabled={loading}>
                        Verificar
                      </button>
                    ) : null}
                    {!domain.is_primary && domain.status === "active" ? (
                      <button type="button" className="btn-secondary" onClick={() => void markPrimary(domain.id)} disabled={loading}>
                        Usar principal
                      </button>
                    ) : null}
                    <button type="button" className="btn-secondary" onClick={() => void removeDomain(domain.id)} disabled={loading}>
                      Quitar
                    </button>
                  </div>
                </div>

                {verification.length ? (
                  <div className="stack stack-xs" style={{ marginTop: "0.75rem" }}>
                    <small className="muted">Configuración DNS sugerida</small>
                    {verification.map((item, index) => (
                      <code key={`${domain.id}-${index}`} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {(item.type ?? "registro").toString()}: {(item.domain ?? domain.hostname).toString()} → {(item.value ?? "").toString()}
                      </code>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {message ? <small className="muted">{message}</small> : null}
    </div>
  );
}

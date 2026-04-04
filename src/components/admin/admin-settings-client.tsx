"use client";

import { useMemo, useState, useTransition } from "react";

import { MarkdownLite } from "@/components/content/markdown-lite";
import type { PlanDefinitionRecord } from "@/lib/billing/plans";
import type { LegalDocumentRecord, LegalDocumentVersionRecord } from "@/lib/legal-documents";
import type { PlatformCopyRecord, PlatformSettingRecord } from "@/lib/platform-config";

type Props = {
  initialSettings: PlatformSettingRecord[];
  initialCopyEntries: PlatformCopyRecord[];
  initialPlans: PlanDefinitionRecord[];
  initialLegalDocuments: LegalDocumentRecord[];
  initialLegalVersions: LegalDocumentVersionRecord[];
};

type TabId = "legal" | "billing" | "pricing" | "copy" | "policies";

function formatScope(countryCode: string | null, localeCode: string | null) {
  return `${countryCode ?? "global"} / ${localeCode ?? "global"}`;
}

export function AdminSettingsClient({
  initialSettings,
  initialCopyEntries,
  initialPlans,
  initialLegalDocuments,
  initialLegalVersions
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("legal");
  const [settings, setSettings] = useState(initialSettings);
  const [copyEntries, setCopyEntries] = useState(initialCopyEntries);
  const [plans, setPlans] = useState(initialPlans);
  const [legalDocuments] = useState(initialLegalDocuments);
  const [legalVersions] = useState(initialLegalVersions);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const policySettings = useMemo(
    () => settings.filter((item) => item.setting_key.startsWith("trash.") || item.setting_key.startsWith("plans.") || item.setting_key.startsWith("onboarding.")),
    [settings]
  );
  const billingSettings = useMemo(() => settings.filter((item) => item.setting_key.startsWith("billing.")), [settings]);

  function updateSettingLocal(id: string, nextValue: string) {
    setSettings((current) =>
      current.map((item) => (item.id === id ? { ...item, value_json: nextValue } : item))
    );
  }

  function updateCopyLocal(id: string, nextValue: string) {
    setCopyEntries((current) => current.map((item) => (item.id === id ? { ...item, value_text: nextValue } : item)));
  }

  function updatePlanLocal(code: PlanDefinitionRecord["code"], patch: Partial<PlanDefinitionRecord>) {
    setPlans((current) => current.map((plan) => (plan.code === code ? { ...plan, ...patch } : plan)));
  }

  async function saveSetting(setting: PlatformSettingRecord) {
    startTransition(async () => {
      try {
        let parsedValue: unknown = setting.value_json;
        if (typeof setting.value_json === "string") {
          try {
            parsedValue = JSON.parse(setting.value_json);
          } catch {
            parsedValue = setting.value_json;
          }
        }

        const response = await fetch("/api/admin/platform/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: setting.setting_key,
            value: parsedValue,
            description: setting.description,
            countryCode: setting.country_code,
            localeCode: setting.locale_code
          })
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo guardar el ajuste.");
        }

        setMessage(`Ajuste guardado: ${setting.setting_key}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo guardar el ajuste.");
      }
    });
  }

  async function saveCopy(entry: PlatformCopyRecord) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/platform/copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: entry.entry_key,
            value: entry.value_text,
            description: entry.description,
            countryCode: entry.country_code,
            localeCode: entry.locale_code
          })
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo guardar el copy.");
        }

        setMessage(`Copy guardado: ${entry.entry_key}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo guardar el copy.");
      }
    });
  }

  async function savePlan(plan: PlanDefinitionRecord) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/plan-definitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: plan.code,
            name: plan.name,
            description: plan.description,
            bullets: plan.bullets,
            monthlyPriceCents: plan.monthlyPriceCents,
            yearlyPriceCents: plan.yearlyPriceCents,
            ctaLabel: plan.ctaLabel,
            maxAiGenerationsPerMonth: plan.maxAiGenerationsPerMonth,
            maxPublishedSites: plan.maxPublishedSites
          })
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo guardar el plan.");
        }

        setMessage(`Plan guardado: ${plan.code}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo guardar el plan.");
      }
    });
  }

  async function createLegalDraft(formData: FormData) {
    startTransition(async () => {
      try {
        const payload = {
          slug: String(formData.get("slug") ?? ""),
          versionLabel: String(formData.get("versionLabel") ?? ""),
          title: String(formData.get("title") ?? ""),
          bodyMarkdown: String(formData.get("bodyMarkdown") ?? ""),
          countryCode: String(formData.get("countryCode") ?? "") || null,
          localeCode: String(formData.get("localeCode") ?? "") || null
        };
        const response = await fetch("/api/admin/legal-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(body.error ?? "No se pudo crear la versión legal.");
        }
        setMessage(`Borrador legal creado para ${payload.slug}.`);
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo crear la versión legal.");
      }
    });
  }

  async function publishVersion(versionId: string) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/legal-documents/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId })
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(body.error ?? "No se pudo publicar la versión legal.");
        }
        setMessage("Versión legal publicada.");
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo publicar la versión legal.");
      }
    });
  }

  return (
    <div className="stack">
      <div className="flex-wrap">
        {[
          ["legal", "Legal"],
          ["billing", "Billing"],
          ["pricing", "Pricing"],
          ["copy", "Copy"],
          ["policies", "Políticas"]
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? "btn-primary" : "btn-secondary"}
            onClick={() => setActiveTab(id as TabId)}
          >
            {label}
          </button>
        ))}
      </div>

      {message ? <small className="muted">{message}</small> : null}

      {activeTab === "billing" ? (
        <section className="card stack">
          <h3>Ajustes de billing</h3>
          {billingSettings.map((setting) => (
            <article key={setting.id} className="card stack">
              <strong>{setting.setting_key}</strong>
              <small className="muted">{formatScope(setting.country_code, setting.locale_code)}</small>
              <textarea
                rows={3}
                value={typeof setting.value_json === "string" ? setting.value_json : JSON.stringify(setting.value_json, null, 2)}
                onChange={(event) => updateSettingLocal(setting.id, event.target.value)}
              />
              {setting.description ? <small className="muted">{setting.description}</small> : null}
              <button type="button" className="btn-secondary" disabled={isPending} onClick={() => void saveSetting(setting)}>
                Guardar ajuste
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {activeTab === "policies" ? (
        <section className="card stack">
          <h3>Políticas y defaults</h3>
          {policySettings.map((setting) => (
            <article key={setting.id} className="card stack">
              <strong>{setting.setting_key}</strong>
              <small className="muted">{formatScope(setting.country_code, setting.locale_code)}</small>
              <textarea
                rows={3}
                value={typeof setting.value_json === "string" ? setting.value_json : JSON.stringify(setting.value_json, null, 2)}
                onChange={(event) => updateSettingLocal(setting.id, event.target.value)}
              />
              {setting.description ? <small className="muted">{setting.description}</small> : null}
              <button type="button" className="btn-secondary" disabled={isPending} onClick={() => void saveSetting(setting)}>
                Guardar ajuste
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {activeTab === "copy" ? (
        <section className="card stack">
          <h3>Copy visible</h3>
          {copyEntries.map((entry) => (
            <article key={entry.id} className="card stack">
              <strong>{entry.entry_key}</strong>
              <small className="muted">{formatScope(entry.country_code, entry.locale_code)}</small>
              <textarea rows={3} value={entry.value_text} onChange={(event) => updateCopyLocal(entry.id, event.target.value)} />
              {entry.description ? <small className="muted">{entry.description}</small> : null}
              <button type="button" className="btn-secondary" disabled={isPending} onClick={() => void saveCopy(entry)}>
                Guardar copy
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {activeTab === "pricing" ? (
        <section className="stack">
          {plans.map((plan) => (
            <article key={plan.code} className="card stack">
              <h3>{plan.code.toUpperCase()}</h3>
              <label>
                Nombre
                <input value={plan.name} onChange={(event) => updatePlanLocal(plan.code, { name: event.target.value })} />
              </label>
              <label>
                Descripción
                <textarea value={plan.description ?? ""} onChange={(event) => updatePlanLocal(plan.code, { description: event.target.value })} />
              </label>
              <label>
                Bullets
                <textarea
                  value={plan.bullets.join("\n")}
                  onChange={(event) =>
                    updatePlanLocal(plan.code, {
                      bullets: event.target.value
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean)
                    })
                  }
                />
              </label>
              <div className="catalog-grid">
                <label>
                  Precio mensual (centavos)
                  <input
                    value={plan.monthlyPriceCents ?? ""}
                    onChange={(event) => updatePlanLocal(plan.code, { monthlyPriceCents: event.target.value ? Number(event.target.value) : null })}
                  />
                </label>
                <label>
                  Precio anual (centavos)
                  <input
                    value={plan.yearlyPriceCents ?? ""}
                    onChange={(event) => updatePlanLocal(plan.code, { yearlyPriceCents: event.target.value ? Number(event.target.value) : null })}
                  />
                </label>
                <label>
                  CTA
                  <input value={plan.ctaLabel ?? ""} onChange={(event) => updatePlanLocal(plan.code, { ctaLabel: event.target.value })} />
                </label>
                <label>
                  Límite IA / mes
                  <input
                    value={plan.maxAiGenerationsPerMonth}
                    onChange={(event) => updatePlanLocal(plan.code, { maxAiGenerationsPerMonth: Number(event.target.value || 0) })}
                  />
                </label>
                <label>
                  Sitios publicados
                  <input
                    value={plan.maxPublishedSites}
                    onChange={(event) => updatePlanLocal(plan.code, { maxPublishedSites: Number(event.target.value || 0) })}
                  />
                </label>
              </div>
              <button type="button" className="btn-secondary" disabled={isPending} onClick={() => void savePlan(plan)}>
                Guardar plan
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {activeTab === "legal" ? (
        <section className="stack">
          {legalDocuments.map((document) => {
            const versions = legalVersions.filter((version) => version.document_id === document.id);
            const latest = versions[0] ?? null;

            return (
              <article key={document.id} className="card stack">
                <div className="stack stack-sm">
                  <h3>{document.title}</h3>
                  <p className="muted">{document.description}</p>
                </div>

                <form
                  className="stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createLegalDraft(new FormData(event.currentTarget));
                  }}
                >
                  <input type="hidden" name="slug" value={document.slug} />
                  <div className="catalog-grid">
                    <label>
                      Versión
                      <input name="versionLabel" defaultValue={latest?.version_label ?? ""} />
                    </label>
                    <label>
                      Título
                      <input name="title" defaultValue={latest?.title ?? document.title} />
                    </label>
                    <label>
                      País
                      <input name="countryCode" defaultValue={latest?.country_code ?? "CO"} />
                    </label>
                    <label>
                      Locale
                      <input name="localeCode" defaultValue={latest?.locale_code ?? "es-CO"} />
                    </label>
                  </div>
                  <label>
                    Markdown
                    <textarea name="bodyMarkdown" rows={10} defaultValue={latest?.body_markdown ?? ""} />
                  </label>
                  <button type="submit" className="btn-secondary" disabled={isPending}>
                    Crear borrador
                  </button>
                </form>

                <div className="catalog-grid">
                  {versions.map((version) => (
                    <article key={version.id} className="card stack">
                      <strong>
                        {version.version_label} · {version.status}
                      </strong>
                      <small className="muted">{formatScope(version.country_code, version.locale_code)}</small>
                      <small className="muted">
                        {version.published_at ? `Publicado: ${new Date(version.published_at).toLocaleDateString("es-CO")}` : "Sin publicar"}
                      </small>
                      <MarkdownLite markdown={version.body_markdown} className="stack" />
                      {version.status !== "published" ? (
                        <button type="button" className="btn-secondary" disabled={isPending} onClick={() => void publishVersion(version.id)}>
                          Publicar versión
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}

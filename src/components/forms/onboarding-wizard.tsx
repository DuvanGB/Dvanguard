"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { BusinessBriefDraft, OnboardingInputMode } from "@/lib/onboarding/types";
import type { TemplateId } from "@/lib/templates/types";

type RefineResponse = {
  briefDraft: BusinessBriefDraft;
  confidence: number;
  completenessScore?: number;
  warnings: string[];
  provider?: "llm" | "heuristic";
  recommendedTemplateId: TemplateId;
  recommendedTemplateIds: TemplateId[];
  error?: string;
  issues?: Array<{ message?: string }>;
};

type GenerateResponse = {
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  versionId?: string;
  error?: string;
};

type Props = {
  siteId: string;
  maxInputChars: number;
  voiceLocale: string;
};

type TemplateCard = {
  id: TemplateId;
  name: string;
  description: string;
  family: string;
  site_type: "informative" | "commerce_lite";
  preview_label: string;
  theme: {
    primary: string;
    secondary: string;
    background: string;
  };
};

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const SECTION_OPTIONS: Array<BusinessBriefDraft["section_preferences"][number]> = [
  "hero",
  "catalog",
  "testimonials",
  "contact"
];

export function OnboardingWizard({ siteId, maxInputChars, voiceLocale }: Props) {
  const router = useRouter();
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [inputMode, setInputMode] = useState<OnboardingInputMode>("text");
  const [rawInput, setRawInput] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceEvent, setVoiceEvent] = useState<"unsupported" | "permission_denied" | null>(null);
  const [briefDraft, setBriefDraft] = useState<BusinessBriefDraft | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [completenessScore, setCompletenessScore] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [refineProvider, setRefineProvider] = useState<"llm" | "heuristic" | null>(null);
  const [recommendedTemplateId, setRecommendedTemplateId] = useState<TemplateId | null>(null);
  const [recommendedTemplateIds, setRecommendedTemplateIds] = useState<TemplateId[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId | null>(null);
  const [templateOptions, setTemplateOptions] = useState<TemplateCard[]>([]);
  const [loadingRefine, setLoadingRefine] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRefine = useMemo(() => rawInput.trim().length >= 10 && rawInput.length <= maxInputChars, [rawInput, maxInputChars]);

  useEffect(() => {
    const ctor = getRecognitionCtor();
    setVoiceSupported(Boolean(ctor));
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (step !== 2 || !briefDraft) return;

    void loadTemplates(briefDraft.business_type, selectedTemplateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, briefDraft?.business_type]);

  async function pollJob(currentJobId: string) {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const response = await fetch(`/api/ai/jobs/${currentJobId}`);
      const data = (await response.json()) as { status: string; error?: string };

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

  function toggleSection(section: BusinessBriefDraft["section_preferences"][number]) {
    setBriefDraft((prev) => {
      if (!prev) return prev;
      const exists = prev.section_preferences.includes(section);

      if (exists) {
        const next = prev.section_preferences.filter((item) => item !== section);
        return {
          ...prev,
          section_preferences: next.length ? next : prev.section_preferences
        };
      }

      return {
        ...prev,
        section_preferences: [...prev.section_preferences, section]
      };
    });
  }

  function handleInputModeChange(mode: OnboardingInputMode) {
    setInputMode(mode);
    if (mode === "voice" && !voiceSupported) {
      setVoiceEvent("unsupported");
      setError("Tu navegador no soporta dictado por voz. Puedes continuar con texto.");
    } else {
      setError(null);
    }
  }

  function startVoiceCapture() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setVoiceSupported(false);
      setVoiceEvent("unsupported");
      setError("Este navegador no soporta reconocimiento de voz. Usa texto.");
      return;
    }

    setError(null);
    const recognition = new Ctor();
    recognition.lang = voiceLocale;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0]?.transcript ?? "";
      }
      setRawInput(transcript.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceEvent("permission_denied");
        setError("Permiso de micrófono denegado. Puedes continuar escribiendo el texto.");
      } else {
        setError("No se pudo capturar audio. Intenta de nuevo o usa texto.");
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch {
      setError("No se pudo iniciar el dictado. Intenta nuevamente.");
      setListening(false);
    }
  }

  function stopVoiceCapture() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function handleRefine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingRefine(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          rawInput,
          inputMode,
          voiceEvent: voiceEvent ?? undefined
        })
      });

      const data = (await response.json()) as RefineResponse;
      if (!response.ok || !data.briefDraft) {
        const issueMessage = data.issues?.[0]?.message;
        setError(data.error ?? issueMessage ?? "No se pudo refinar la propuesta");
        setLoadingRefine(false);
        return;
      }

      setBriefDraft(data.briefDraft);
      setConfidence(data.confidence);
      setCompletenessScore(typeof data.completenessScore === "number" ? data.completenessScore : null);
      setWarnings(data.warnings ?? []);
      setRefineProvider(data.provider ?? null);
      setRecommendedTemplateId(data.recommendedTemplateId);
      setRecommendedTemplateIds(data.recommendedTemplateIds ?? []);
      setStep(2);

      await loadTemplates(data.briefDraft.business_type, data.recommendedTemplateId);
      setLoadingRefine(false);
    } catch {
      setError("No se pudo refinar la propuesta en este momento. Intenta de nuevo.");
      setLoadingRefine(false);
    }
  }

  async function handleGenerate() {
    if (!briefDraft || !selectedTemplateId) return;

    setLoadingGenerate(true);
    setError(null);
    setStep(3);

    try {
      const response = await fetch("/api/onboarding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          inputMode,
          briefDraft,
          templateId: selectedTemplateId,
          recommendedTemplateId: recommendedTemplateId ?? undefined,
          refineConfidence: confidence ?? undefined,
          warnings
        })
      });

      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || !data.jobId) {
        setError(data.error ?? "No se pudo generar el sitio");
        setLoadingGenerate(false);
        setStep(2);
        return;
      }

      setJobId(data.jobId);
      if (data.status === "done") {
        router.push(`/sites/${siteId}`);
        return;
      }

      await pollJob(data.jobId);
      setLoadingGenerate(false);
    } catch {
      setError("No se pudo iniciar la generación. Intenta nuevamente.");
      setLoadingGenerate(false);
      setStep(2);
    }
  }

  async function loadTemplates(
    siteType: BusinessBriefDraft["business_type"],
    preferredTemplateId?: TemplateId | null
  ) {
    try {
      const templatesResponse = await fetch(`/api/templates?siteType=${siteType}`);
      const templatesData = (await templatesResponse.json()) as { items?: TemplateCard[] };
      const items = Array.isArray(templatesData.items) ? templatesData.items : [];
      setTemplateOptions(items);

      if (!items.length) {
        setSelectedTemplateId(null);
        return;
      }

      const preferred =
        preferredTemplateId && items.some((template) => template.id === preferredTemplateId)
          ? preferredTemplateId
          : null;

      const currentSelected =
        selectedTemplateId && items.some((template) => template.id === selectedTemplateId)
          ? selectedTemplateId
          : null;

      setSelectedTemplateId(preferred ?? currentSelected ?? items[0].id);
    } catch {
      setTemplateOptions([]);
      setSelectedTemplateId(null);
      setError("No se pudieron cargar plantillas. Reintenta.");
    }
  }

  return (
    <div className="stack">
      <section className="card stack">
        <strong>Paso {step} de 3</strong>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <span className="btn-secondary" style={{ opacity: step >= 1 ? 1 : 0.5 }}>
            1. Captura
          </span>
          <span className="btn-secondary" style={{ opacity: step >= 2 ? 1 : 0.5 }}>
            2. Refinar
          </span>
          <span className="btn-secondary" style={{ opacity: step >= 3 ? 1 : 0.5 }}>
            3. Generar
          </span>
        </div>
      </section>

      {step === 1 ? (
        <form className="card stack" onSubmit={handleRefine}>
          <h2>Cuéntanos tu negocio</h2>
          <p>Puedes escribir o dictar. Siempre podrás corregir antes de generar.</p>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={inputMode === "text" ? "btn-primary" : "btn-secondary"}
              onClick={() => handleInputModeChange("text")}
            >
              Texto
            </button>
            <button
              type="button"
              className={inputMode === "voice" ? "btn-primary" : "btn-secondary"}
              onClick={() => handleInputModeChange("voice")}
            >
              Voz
            </button>
          </div>

          {inputMode === "voice" ? (
            <div className="stack">
              {voiceSupported ? (
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button type="button" className="btn-secondary" onClick={startVoiceCapture} disabled={listening}>
                    {listening ? "Escuchando..." : "Iniciar dictado"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={stopVoiceCapture} disabled={!listening}>
                    Detener
                  </button>
                </div>
              ) : (
                <small>Voz no disponible en este navegador. Continúa con texto.</small>
              )}
            </div>
          ) : null}

          <label>
            Descripción del negocio
            <textarea
              rows={7}
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              maxLength={maxInputChars}
              placeholder="Ejemplo: vendo ropa deportiva para mujeres jóvenes con foco en WhatsApp y estilo moderno."
            />
          </label>
          <small>
            {rawInput.length}/{maxInputChars} caracteres
          </small>

          <button type="submit" className="btn-primary" disabled={!canRefine || loadingRefine}>
            {loadingRefine ? "Refinando propuesta..." : "Continuar"}
          </button>
        </form>
      ) : null}

      {step === 2 && briefDraft ? (
        <section className="card stack">
          <h2>Revisar propuesta IA</h2>
          {confidence !== null ? <small>Confianza estimada: {Math.round(confidence * 100)}%</small> : null}
          {completenessScore !== null ? <small>Completitud del brief: {Math.round(completenessScore)}%</small> : null}
          {refineProvider ? (
            <small>Proveedor refine: {refineProvider === "llm" ? "LLM (OpenAI)" : "Heurístico (fallback)"}</small>
          ) : null}
          {warnings.length ? (
            <div className="stack">
              <strong>Recomendaciones</strong>
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <label>
            Nombre del negocio
            <input
              value={briefDraft.business_name}
              onChange={(event) => setBriefDraft((prev) => (prev ? { ...prev, business_name: event.target.value } : prev))}
            />
          </label>

          <label>
            Tipo de sitio
            <select
              value={briefDraft.business_type}
              onChange={(event) =>
                setBriefDraft((prev) =>
                  prev ? { ...prev, business_type: event.target.value as BusinessBriefDraft["business_type"] } : prev
                )
              }
            >
              <option value="informative">informative</option>
              <option value="commerce_lite">commerce_lite</option>
            </select>
          </label>

          <label>
            Resumen de oferta
            <textarea
              rows={4}
              value={briefDraft.offer_summary}
              onChange={(event) => setBriefDraft((prev) => (prev ? { ...prev, offer_summary: event.target.value } : prev))}
            />
          </label>

          <label>
            Público objetivo
            <input
              value={briefDraft.target_audience}
              onChange={(event) => setBriefDraft((prev) => (prev ? { ...prev, target_audience: event.target.value } : prev))}
            />
          </label>

          <label>
            Tono
            <input value={briefDraft.tone} onChange={(event) => setBriefDraft((prev) => (prev ? { ...prev, tone: event.target.value } : prev))} />
          </label>

          <label>
            CTA principal
            <input
              value={briefDraft.primary_cta}
              onChange={(event) => setBriefDraft((prev) => (prev ? { ...prev, primary_cta: event.target.value } : prev))}
            />
          </label>

          <label>
            Preset visual
            <select
              value={briefDraft.style_preset}
              onChange={(event) =>
                setBriefDraft((prev) =>
                  prev ? { ...prev, style_preset: event.target.value as BusinessBriefDraft["style_preset"] } : prev
                )
              }
            >
              <option value="ocean">ocean</option>
              <option value="sunset">sunset</option>
              <option value="mono">mono</option>
            </select>
          </label>

          <div className="stack">
            <strong>Secciones preferidas</strong>
            {SECTION_OPTIONS.map((section) => (
              <label key={section} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  style={{ width: "auto" }}
                  type="checkbox"
                  checked={briefDraft.section_preferences.includes(section)}
                  onChange={() => toggleSection(section)}
                />
                {section}
              </label>
            ))}
          </div>

          <div className="stack">
            <strong>Plantilla visual</strong>
            <small>Selecciona una plantilla base para generar el preview.</small>
            <div className="catalog-grid">
              {templateOptions.map((template) => {
                const selected = selectedTemplateId === template.id;
                const recommended = recommendedTemplateIds.includes(template.id);
                return (
                  <button
                    key={template.id}
                    type="button"
                    className="card"
                    onClick={() => setSelectedTemplateId(template.id)}
                    style={{
                      textAlign: "left",
                      border: selected ? "2px solid var(--brand)" : "1px solid var(--border)",
                      cursor: "pointer",
                      background: template.theme.background,
                      color: template.theme.primary
                    }}
                  >
                    <strong>{template.name}</strong>
                    <p style={{ margin: "0.35rem 0" }}>{template.description}</p>
                    <small>{template.preview_label}</small>
                    {recommended ? (
                      <small style={{ display: "block", marginTop: "0.35rem" }}>Recomendada por IA</small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              Volver
            </button>
            <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loadingGenerate || !selectedTemplateId}>
              {loadingGenerate ? "Generando..." : "Generar preview"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="card stack">
          <h2>Generando tu sitio</h2>
          <p>Estamos creando la versión inicial de tu web.</p>
          {jobId ? <small>job_id: {jobId}</small> : null}
          {loadingGenerate ? <small>Esto puede tardar hasta 20 segundos.</small> : null}
        </section>
      ) : null}

      {error ? <p>{error}</p> : null}
    </div>
  );
}

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const customWindow = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return customWindow.SpeechRecognition ?? customWindow.webkitSpeechRecognition ?? null;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { SiteRenderer } from "@/components/runtime/site-renderer";
import type { BusinessBriefDraft, OnboardingInputMode } from "@/lib/onboarding/types";
import type { SiteSpecV3 } from "@/lib/site-spec-v3";
import type { TemplateId } from "@/lib/templates/types";

type RefineResponse = {
  briefDraft: BusinessBriefDraft;
  confidence: number;
  completenessScore?: number;
  warnings: string[];
  provider?: "llm" | "heuristic";
  recommendedTemplateId: TemplateId | null;
  recommendedTemplateIds: TemplateId[];
  error?: string;
  issues?: Array<{ message?: string }>;
};

type GenerateResponse = {
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  jobType?: "visual_home_generation";
  error?: string;
};

type JobStatusResponse = {
  status: "queued" | "processing" | "done" | "failed";
  stage?: string | null;
  progressPercent?: number | null;
  message?: string | null;
  snapshot?: SiteSpecV3 | null;
  fallbackUsed?: boolean;
  error?: string;
};

type Props = {
  siteId: string;
  siteName?: string;
  maxInputChars: number;
  voiceLocale: string;
};

type TemplateCard = {
  id: TemplateId;
  name: string;
  description: string;
  tags: string[];
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

export function OnboardingWizard({ siteId, siteName, maxInputChars, voiceLocale }: Props) {
  const router = useRouter();
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [inputMode, setInputMode] = useState<OnboardingInputMode>("text");
  const [rawInput, setRawInput] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceEvent, setVoiceEvent] = useState<"unsupported" | "permission_denied" | null>(null);
  const [briefDraft, setBriefDraft] = useState<BusinessBriefDraft | null>(null);
  const [whatsappPhoneInput, setWhatsappPhoneInput] = useState("");
  const [whatsappMessageInput, setWhatsappMessageInput] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [completenessScore, setCompletenessScore] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [refineProvider, setRefineProvider] = useState<"llm" | "heuristic" | null>(null);
  const [recommendedTemplateId, setRecommendedTemplateId] = useState<TemplateId | null>(null);
  const [templateOptions, setTemplateOptions] = useState<TemplateCard[]>([]);
  const [loadingRefine, setLoadingRefine] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse["status"] | null>(null);
  const [generationStage, setGenerationStage] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationSnapshot, setGenerationSnapshot] = useState<SiteSpecV3 | null>(null);
  const [generationFallbackUsed, setGenerationFallbackUsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRefine = useMemo(() => rawInput.trim().length >= 10 && rawInput.length <= maxInputChars, [rawInput, maxInputChars]);
  const recommendedTemplateLabel = useMemo(
    () => templateOptions.find((template) => template.id === recommendedTemplateId)?.name ?? null,
    [recommendedTemplateId, templateOptions]
  );
  useEffect(() => {
    const ctor = getRecognitionCtor();
    setVoiceSupported(Boolean(ctor));
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!briefDraft) return;
    void loadTemplates(briefDraft.business_type, recommendedTemplateId);
  }, [briefDraft?.business_type, recommendedTemplateId]);

  function buildFinalBrief(currentBrief: BusinessBriefDraft): BusinessBriefDraft {
    return {
      ...currentBrief,
      business_name: currentBrief.business_name.trim() || siteName?.trim() || currentBrief.business_name,
      whatsapp_phone: whatsappPhoneInput.trim() || undefined,
      whatsapp_message: whatsappMessageInput.trim() || undefined
    };
  }

  async function pollJob(currentJobId: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await fetch(`/api/ai/jobs/${currentJobId}`);
      const data = (await response.json()) as JobStatusResponse;

      setJobStatus(data.status);
      setGenerationStage(data.stage ?? null);
      setGenerationMessage(data.message ?? null);
      setGenerationProgress(typeof data.progressPercent === "number" ? data.progressPercent : 0);
      setGenerationSnapshot(data.snapshot ?? null);
      setGenerationFallbackUsed(Boolean(data.fallbackUsed));

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

      const nextBrief = siteName?.trim()
        ? { ...data.briefDraft, business_name: siteName.trim() }
        : data.briefDraft;

      setBriefDraft(nextBrief);
      setWhatsappPhoneInput(nextBrief.whatsapp_phone ?? "");
      setWhatsappMessageInput(nextBrief.whatsapp_message ?? "");
      setConfidence(data.confidence);
      setCompletenessScore(typeof data.completenessScore === "number" ? data.completenessScore : null);
      setWarnings(data.warnings ?? []);
      setRefineProvider(data.provider ?? null);
      setRecommendedTemplateId(data.recommendedTemplateId);
      setRecommendedTemplateId(data.recommendedTemplateId);
      setStep(2);

      await loadTemplates(nextBrief.business_type, data.recommendedTemplateId);
      setLoadingRefine(false);
    } catch {
      setError("No se pudo refinar la propuesta en este momento. Intenta de nuevo.");
      setLoadingRefine(false);
    }
  }

  async function handleGenerate() {
    if (!briefDraft) return;

    setLoadingGenerate(true);
    setError(null);
    setStep(3);
    setJobStatus("queued");
    setGenerationProgress(6);
    setGenerationStage("brief_analysis");
    setGenerationMessage("Analizando tu negocio");
    setGenerationSnapshot(null);
    setGenerationFallbackUsed(false);
    try {
      const response = await fetch("/api/onboarding/generate-v3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          inputMode,
          briefDraft: buildFinalBrief(briefDraft),
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
      await pollJob(data.jobId);
      setLoadingGenerate(false);
    } catch {
      setError("No se pudo iniciar la generación. Intenta nuevamente.");
      setLoadingGenerate(false);
      setStep(2);
    }
  }

  async function loadTemplates(siteType: BusinessBriefDraft["business_type"], preferredTemplateId?: TemplateId | null) {
    try {
      const templatesResponse = await fetch(`/api/templates?siteType=${siteType}`);
      const templatesData = (await templatesResponse.json()) as { items?: TemplateCard[] };
      const items = Array.isArray(templatesData.items) ? templatesData.items : [];
      setTemplateOptions(items);
    } catch {
      setTemplateOptions([]);
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
            <small>Proveedor refine: {refineProvider === "llm" ? "LLM" : "Heurístico (fallback)"}</small>
          ) : null}

          <div className="card stack" style={{ background: "var(--surface)" }}>
            <strong>Cómo se generará tu propuesta</strong>
            <p style={{ margin: 0 }}>
              La IA va a proponerte primero un layout personalizado para tu negocio. Después de verlo podrás comparar
              alternativas por template si quieres explorar otros estilos.
            </p>
            {recommendedTemplateLabel && refineProvider === "llm" ? (
              <small>Si luego quieres comparar, la IA sugiere empezar por: {recommendedTemplateLabel}.</small>
            ) : (
              <small>Los templates quedarán disponibles después de generar, como alternativas opcionales.</small>
            )}
          </div>

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
            Número WhatsApp (con país)
            <input
              value={whatsappPhoneInput}
              onChange={(event) => setWhatsappPhoneInput(event.target.value)}
              placeholder="+573001234567"
            />
          </label>
          {whatsappPhoneInput.trim().length > 0 && !/^\+\d{8,15}$/.test(whatsappPhoneInput.trim()) ? (
            <small className="muted">Formato esperado: +573001234567</small>
          ) : null}
          {!whatsappPhoneInput.trim() ? <small className="muted">Si no agregas número, el CTA WhatsApp no funcionará.</small> : null}

          <label>
            Mensaje prellenado (opcional)
            <textarea
              rows={2}
              value={whatsappMessageInput}
              onChange={(event) => setWhatsappMessageInput(event.target.value)}
              placeholder="Hola, vi tu web y quiero más info."
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

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              Volver
            </button>
            <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loadingGenerate}>
              {loadingGenerate ? "Generando..." : "Generar propuesta IA"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="card stack">
          <h2>Generando tu sitio</h2>
          <p>La IA está construyendo una propuesta visual principal para tu homepage.</p>
          {jobId ? <small>job_id: {jobId}</small> : null}

          <div className="stack" style={{ gap: "0.75rem" }}>
            <div
              style={{
                width: "100%",
                height: "0.7rem",
                borderRadius: "999px",
                background: "var(--surface)"
              }}
            >
              <div
                style={{
                  width: `${Math.max(6, generationProgress)}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background: "linear-gradient(90deg, var(--brand), #38bdf8)",
                  transition: "width 0.35s ease"
                }}
              />
            </div>
            <strong>{generationMessage ?? "Preparando generación visual..."}</strong>
            <small>
              {labelForStage(generationStage)} {generationProgress ? `· ${generationProgress}%` : ""}
            </small>
            {generationFallbackUsed ? (
              <small>Modo visual actual: fallback determinista. La propuesta sigue siendo editable y usable.</small>
            ) : (
              <small>La propuesta se construye por etapas para que puedas verla nacer en tiempo real.</small>
            )}
          </div>

          <div className="stack" style={{ gap: "0.6rem" }}>
            <strong>Timeline</strong>
            {[
              ["brief_analysis", "Analizando tu negocio"],
              ["visual_direction", "Definiendo dirección visual"],
              ["layout_seed", "Armando layout inicial"],
              ["content_polish", "Aplicando contenido y estilo"],
              ["finalizing", "Preparando preview editable"]
            ].map(([key, label]) => {
              const active = generationStage === key;
              const completed = stageOrder(generationStage) > stageOrder(key) || (jobStatus === "done" && generationStage === key);
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                    opacity: active || completed ? 1 : 0.55
                  }}
                >
                  <span
                    style={{
                      width: "0.8rem",
                      height: "0.8rem",
                      borderRadius: "999px",
                      background: completed ? "var(--brand)" : active ? "#38bdf8" : "var(--border)"
                    }}
                  />
                  <span>{label}</span>
                </div>
              );
            })}
          </div>

          <div className="card onboarding-generation-preview">
            {generationSnapshot ? (
              <div className="onboarding-generation-preview-frame">
                <div className="onboarding-generation-preview-canvas">
                  <SiteRenderer spec={generationSnapshot} viewport="desktop" enableCart={false} />
                </div>
              </div>
            ) : (
              <div
                style={{
                  minHeight: "420px",
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
                  borderRadius: "1rem"
                }}
              >
                <p style={{ margin: 0 }}>Preparando el primer snapshot visual...</p>
              </div>
            )}
          </div>

        </section>
      ) : null}

      {error ? <p>{error}</p> : null}
    </div>
  );
}

function stageOrder(stage: string | null | undefined) {
  return {
    brief_analysis: 1,
    visual_direction: 2,
    layout_seed: 3,
    content_polish: 4,
    finalizing: 5
  }[stage ?? ""] ?? 0;
}

function labelForStage(stage: string | null | undefined) {
  return {
    brief_analysis: "Analizando tu negocio",
    visual_direction: "Definiendo dirección visual",
    layout_seed: "Armando layout inicial",
    content_polish: "Aplicando contenido y estilo",
    finalizing: "Preparando preview editable"
  }[stage ?? ""] ?? "Iniciando generación";
}

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const customWindow = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return customWindow.SpeechRecognition ?? customWindow.webkitSpeechRecognition ?? null;
}

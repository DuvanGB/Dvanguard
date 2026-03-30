"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ModuleTour } from "@/components/guided/module-tour";
import { SiteRenderer } from "@/components/runtime/site-renderer";
import {
  buildRegenerationBriefBase,
  buildRegenerationSummaryLine,
  extractCurrentSiteContentForRegeneration
} from "@/lib/ai/regeneration-context";
import type { BusinessBriefDraft, HeroSuggestion, MissingBriefField, OnboardingInputMode } from "@/lib/onboarding/types";
import type { SiteSpecV3 } from "@/lib/site-spec-v3";
import { normalizeWhatsappPhone, validateWhatsappPhone } from "@/lib/whatsapp";

type RefineResponse = {
  briefDraft: BusinessBriefDraft;
  confidence: number;
  completenessScore?: number;
  warnings: string[];
  provider?: "llm" | "heuristic";
  followUpQuestion?: string | null;
  missingFields: MissingBriefField[];
  heroSuggestion?: HeroSuggestion | null;
  heroConfidence?: number | null;
  error?: string;
  issues?: Array<{ message?: string }>;
};

type GenerateResponse = {
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  jobType?: "visual_home_generation";
  error?: string;
};

type RegenerationRefineResponse = {
  assistantSummary: string;
  followUpQuestion: string | null;
  refinedPrompt: string;
  provider?: "llm" | "heuristic";
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
  generationMode?: "new" | "regenerate";
  initialSpec?: SiteSpecV3;
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

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

export function OnboardingWizard({ siteId, siteName, maxInputChars, voiceLocale, generationMode = "new", initialSpec }: Props) {
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
  const [ctaManuallyEdited, setCtaManuallyEdited] = useState(false);
  const [whatsappMessageManuallyEdited, setWhatsappMessageManuallyEdited] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [completenessScore, setCompletenessScore] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<MissingBriefField[]>([]);
  const [heroSuggestion, setHeroSuggestion] = useState<HeroSuggestion | null>(null);
  const [heroConfidence, setHeroConfidence] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const [regenerationFeedback, setRegenerationFeedback] = useState("");
  const [regenerationFeedbackSummary, setRegenerationFeedbackSummary] = useState<string | null>(null);
  const [regenerationFollowUpQuestion, setRegenerationFollowUpQuestion] = useState<string | null>(null);
  const [loadingRefine, setLoadingRefine] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse["status"] | null>(null);
  const [generationStage, setGenerationStage] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationSnapshot, setGenerationSnapshot] = useState<SiteSpecV3 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRefine = useMemo(() => rawInput.trim().length >= 10 && rawInput.length <= maxInputChars, [rawInput, maxInputChars]);
  const canSendFollowUp = Boolean(followUpQuestion && followUpInput.trim().length >= 2 && !loadingRefine);
  const canGenerate = Boolean(briefDraft && !loadingGenerate);
  const canAnalyzeRegeneration = Boolean(regenerationFeedback.trim().length >= 8 && !loadingRefine);
  const regenerationSiteContent = useMemo(
    () => (generationMode === "regenerate" && initialSpec ? extractCurrentSiteContentForRegeneration({ siteSpec: initialSpec }) : null),
    [generationMode, initialSpec]
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
    if (generationMode !== "regenerate" || !initialSpec) return;
    const bootstrap = buildRegenerationBriefBase(initialSpec, siteName);
    setRawInput(bootstrap.rawInput);
    setBriefDraft(bootstrap.briefDraft);
    setWhatsappPhoneInput(bootstrap.briefDraft.whatsapp_phone ?? "");
    setWhatsappMessageInput(bootstrap.briefDraft.whatsapp_message ?? "");
    setWarnings(["Estamos partiendo del contenido actual de tu sitio para proponer una nueva dirección visual sin perder tu información."]);
    setMissingFields([]);
    setHeroSuggestion(buildHeroSuggestionClient(bootstrap.briefDraft));
    setHeroConfidence(0.82);
    setFollowUpQuestion(null);
    setChatMessages([
      {
        role: "assistant",
        content:
          "Voy a conservar tu contenido actual y usar tu feedback para empujar una versión más rica y mejor organizada. Cuéntame qué quieres mejorar en esta iteración."
      }
    ]);
    setRegenerationFeedbackSummary(null);
    setRegenerationFollowUpQuestion(null);
    setStep(2);
  }, [generationMode, initialSpec, siteName]);

  useEffect(() => {
    if (!briefDraft || ctaManuallyEdited) return;
    const suggestedCta = suggestPrimaryCtaClient({
      businessType: briefDraft.business_type,
      rawInput,
      offerSummary: briefDraft.offer_summary,
      hasWhatsappPhone: Boolean(whatsappPhoneInput.trim())
    });
    if (briefDraft.primary_cta !== suggestedCta) {
      setBriefDraft((prev) => (prev ? { ...prev, primary_cta: suggestedCta } : prev));
    }
  }, [briefDraft, ctaManuallyEdited, rawInput, whatsappPhoneInput]);

  useEffect(() => {
    if (!briefDraft || whatsappMessageManuallyEdited) return;
    if (!whatsappPhoneInput.trim()) {
      if (whatsappMessageInput) setWhatsappMessageInput("");
      return;
    }
    const suggestedMessage = suggestWhatsappMessageClient({
      businessName: briefDraft.business_name,
      businessType: briefDraft.business_type,
      offerSummary: briefDraft.offer_summary,
      primaryCta: briefDraft.primary_cta
    });
    if (whatsappMessageInput !== suggestedMessage) {
      setWhatsappMessageInput(suggestedMessage);
    }
  }, [briefDraft, whatsappMessageInput, whatsappMessageManuallyEdited, whatsappPhoneInput]);

  function buildFinalBrief(currentBrief: BusinessBriefDraft): BusinessBriefDraft {
    return {
      ...currentBrief,
      business_name: currentBrief.business_name.trim() || siteName?.trim() || currentBrief.business_name,
      whatsapp_phone: normalizeWhatsappPhone(whatsappPhoneInput) || undefined,
      whatsapp_message: whatsappMessageInput.trim() || undefined
    };
  }

  function applyRefineDraft(nextDraft: BusinessBriefDraft) {
    const siteBoundDraft = siteName?.trim() ? { ...nextDraft, business_name: siteName.trim() } : nextDraft;
    const preservedPrimaryCta =
      ctaManuallyEdited && briefDraft?.primary_cta?.trim() ? briefDraft.primary_cta : siteBoundDraft.primary_cta;
    const preservedWhatsappMessage =
      whatsappMessageManuallyEdited ? whatsappMessageInput.trim() : siteBoundDraft.whatsapp_message?.trim() || "";

    setBriefDraft({
      ...siteBoundDraft,
      primary_cta: preservedPrimaryCta,
      whatsapp_message: preservedWhatsappMessage || undefined
    });
    setWhatsappPhoneInput(siteBoundDraft.whatsapp_phone ?? "");
    setWhatsappMessageInput(preservedWhatsappMessage);
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

  async function requestRefine(nextFollowUpAnswer?: string) {
    const response = await fetch("/api/onboarding/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId,
        rawInput,
        inputMode,
        currentBrief: briefDraft ?? undefined,
        followUpAnswer: nextFollowUpAnswer ?? undefined,
        voiceEvent: voiceEvent ?? undefined
      })
    });

    return (await response.json()) as RefineResponse & { ok?: boolean };
  }

  async function handleRefine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingRefine(true);
    setError(null);

    try {
      const data = await requestRefine();
      if (!data.briefDraft) {
        const issueMessage = data.issues?.[0]?.message;
        setError(data.error ?? issueMessage ?? "No se pudo refinar la propuesta");
        setLoadingRefine(false);
        return;
      }

      setCtaManuallyEdited(false);
      setWhatsappMessageManuallyEdited(false);
      applyRefineDraft(data.briefDraft);
      setConfidence(data.confidence);
      setCompletenessScore(typeof data.completenessScore === "number" ? data.completenessScore : null);
      setWarnings(data.warnings ?? []);
      setMissingFields(data.missingFields ?? []);
      setHeroSuggestion(data.heroSuggestion ?? null);
      setHeroConfidence(typeof data.heroConfidence === "number" ? data.heroConfidence : null);
      setFollowUpQuestion(data.followUpQuestion ?? null);
      setChatMessages(data.followUpQuestion ? [{ role: "assistant", content: data.followUpQuestion }] : []);
      setFollowUpInput("");
      setStep(2);
      setLoadingRefine(false);
    } catch {
      setError("No se pudo refinar la propuesta en este momento. Intenta de nuevo.");
      setLoadingRefine(false);
    }
  }

  async function handleFollowUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!followUpQuestion || !followUpInput.trim()) return;

    const answer = followUpInput.trim();
    setLoadingRefine(true);
    setError(null);
    setChatMessages((prev) => [...prev, { role: "user", content: answer }]);
    setFollowUpInput("");

    try {
      const data = await requestRefine(answer);
      if (!data.briefDraft) {
        const issueMessage = data.issues?.[0]?.message;
        setError(data.error ?? issueMessage ?? "No se pudo actualizar el brief");
        setLoadingRefine(false);
        return;
      }

      applyRefineDraft(data.briefDraft);
      setConfidence(data.confidence);
      setCompletenessScore(typeof data.completenessScore === "number" ? data.completenessScore : null);
      setWarnings(data.warnings ?? []);
      setMissingFields(data.missingFields ?? []);
      setHeroSuggestion(data.heroSuggestion ?? null);
      setHeroConfidence(typeof data.heroConfidence === "number" ? data.heroConfidence : null);
      setFollowUpQuestion(data.followUpQuestion ?? null);
      if (data.followUpQuestion) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.followUpQuestion ?? "" }]);
      }
      setLoadingRefine(false);
    } catch {
      setError("No se pudo continuar el refine en este momento. Intenta de nuevo.");
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

    try {
      const response = await fetch("/api/onboarding/generate-v3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          inputMode,
          briefDraft: buildFinalBrief(briefDraft),
          refineConfidence: confidence ?? undefined,
          warnings,
          generationMode,
          regenerationFeedback:
            generationMode === "regenerate"
              ? buildRegenerationFeedbackPayload(regenerationFeedback, chatMessages, regenerationFeedbackSummary)
              : undefined
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

  function buildRegenerationRefineContext() {
    const currentBrief = briefDraft ? buildFinalBrief(briefDraft) : undefined;
    return {
      siteId,
      currentBrief,
      currentSiteSummary:
        briefDraft && regenerationSiteContent
          ? buildRegenerationSummaryLine({
              businessName: briefDraft.business_name,
              siteType: briefDraft.business_type,
              currentSiteContent: regenerationSiteContent
            })
          : undefined,
      sectionList: regenerationSiteContent?.sectionsPresent ?? [],
      productCount: regenerationSiteContent?.products.length ?? 0,
      imageCount: regenerationSiteContent?.imageCount ?? 0
    };
  }

  async function requestRegenerationRefine(feedbackPrompt: string) {
    const response = await fetch("/api/onboarding/regenerate-refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...buildRegenerationRefineContext(),
        feedbackPrompt
      })
    });

    return { ok: response.ok, data: (await response.json()) as RegenerationRefineResponse };
  }

  async function handleRegenerationFeedbackAnalyze() {
    const feedback = regenerationFeedback.trim();
    if (!feedback) return;

    setLoadingRefine(true);
    setError(null);

    try {
      const result = await requestRegenerationRefine(feedback);
      if (!result.ok || !result.data.assistantSummary) {
        setError(result.data.error ?? "No se pudo analizar esta mejora. Intenta de nuevo.");
        setLoadingRefine(false);
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: feedback },
        { role: "assistant", content: result.data.assistantSummary },
        ...(result.data.followUpQuestion ? [{ role: "assistant" as const, content: result.data.followUpQuestion }] : [])
      ]);
      setRegenerationFeedbackSummary(result.data.refinedPrompt || result.data.assistantSummary);
      setRegenerationFollowUpQuestion(result.data.followUpQuestion ?? null);
      setRegenerationFeedback("");
      setLoadingRefine(false);
    } catch {
      setError("No se pudo analizar esta mejora con IA en este momento. Intenta de nuevo.");
      setLoadingRefine(false);
    }
  }

  async function handleRegenerationFollowUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!regenerationFollowUpQuestion || !followUpInput.trim()) return;

    const answer = followUpInput.trim();
    setLoadingRefine(true);
    setError(null);
    setChatMessages((prev) => [...prev, { role: "user", content: answer }]);
    setFollowUpInput("");

    try {
      const composedPrompt =
        buildRegenerationFeedbackPayload(answer, chatMessages, regenerationFeedbackSummary) ?? answer;
      const result = await requestRegenerationRefine(composedPrompt);
      if (!result.ok || !result.data.assistantSummary) {
        setError(result.data.error ?? "No se pudo procesar tu respuesta. Intenta de nuevo.");
        setLoadingRefine(false);
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.data.assistantSummary },
        ...(result.data.followUpQuestion ? [{ role: "assistant" as const, content: result.data.followUpQuestion }] : [])
      ]);
      setRegenerationFeedbackSummary(result.data.refinedPrompt || result.data.assistantSummary);
      setRegenerationFollowUpQuestion(result.data.followUpQuestion ?? null);
      setLoadingRefine(false);
    } catch {
      setError("No se pudo procesar tu respuesta con IA en este momento. Intenta de nuevo.");
      setLoadingRefine(false);
    }
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="onboarding-header-row">
          <div className="stack" style={{ gap: "0.45rem" }}>
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
          </div>
          <ModuleTour
            module="onboarding"
            title="Cómo crear tu sitio con IA"
            description="Este flujo te ayuda a pasar de la idea del negocio a una propuesta visual editable en pocos pasos."
            compact
            steps={[
              {
                title: "Describe tu negocio",
                body: "Puedes escribir o dictar una primera idea. No hace falta que quede perfecta desde el inicio."
              },
              {
                title: "Refina con ayuda de la IA",
                body: "El sistema organiza la información importante y, si hace falta, te hará preguntas cortas para completar lo esencial."
              },
              {
                title: "Genera y sigue al editor",
                body: "Verás cómo se arma la propuesta visual y, al terminar, entrarás directo al editor para ajustarla."
              }
            ]}
          />
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
            {loadingRefine ? "Analizando negocio..." : "Continuar"}
          </button>
        </form>
      ) : null}

      {step === 2 && briefDraft ? (
        <section className="card stack">
          {generationMode === "regenerate" ? (
            <>
              <h2>Rediseñemos tu sitio actual</h2>
              <p>Vamos a conservar tu contenido actual y usar tu feedback para empujar una versión más rica, más profesional y mejor organizada.</p>

              {briefDraft && regenerationSiteContent ? (
                <div className="card stack" style={{ gap: "0.55rem" }}>
                  <strong>Resumen de la regeneración</strong>
                  <p className="muted" style={{ margin: 0 }}>
                    Esta regeneración preserva contenido, imágenes, CTA y estructura base. El objetivo es mejorar diseño, jerarquía y presentación visual.
                  </p>
                  <small>{buildRegenerationSummaryLine({ businessName: briefDraft.business_name, siteType: briefDraft.business_type, currentSiteContent: regenerationSiteContent })}</small>
                  <small className="muted">
                    Voy a usar tu información actual: {regenerationSiteContent.sectionsPresent.join(", ") || "sin secciones detectadas"}.
                  </small>
                </div>
              ) : null}

              <div className="card stack onboarding-chat-card">
                <strong>Chat de regeneración</strong>
                <p>Escribe qué te gustaría mejorar y la IA lo tomará como dirección para esta nueva iteración.</p>

                <div className="onboarding-chat-thread">
                  {chatMessages.length ? (
                    chatMessages.map((message, index) => (
                      <div key={`${message.role}-${index}`} className={`onboarding-chat-bubble ${message.role}`}>
                        <strong>{message.role === "assistant" ? "IA" : "Tú"}</strong>
                        <p>{message.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="onboarding-chat-empty">Todavía no hay instrucciones de mejora.</div>
                  )}
                </div>

                <label>
                  ¿Qué quieres mejorar o cambiar en esta versión?
                  <textarea
                    rows={3}
                    value={regenerationFeedback}
                    onChange={(event) => setRegenerationFeedback(event.target.value.slice(0, 500))}
                    maxLength={500}
                    placeholder="Ejemplo: quiero un hero más premium, más contraste visual y que el catálogo destaque mejor las imágenes."
                  />
                </label>
                <small>
                  {regenerationFeedback.length}/500 caracteres
                </small>

                <button type="button" className="btn-secondary" onClick={handleRegenerationFeedbackAnalyze} disabled={!canAnalyzeRegeneration}>
                  {loadingRefine ? "Analizando con IA..." : "Analizar mejora"}
                </button>

                {regenerationFollowUpQuestion ? (
                  <form className="stack" onSubmit={handleRegenerationFollowUpSubmit}>
                    <label>
                      Respuesta
                      <textarea rows={3} value={followUpInput} onChange={(event) => setFollowUpInput(event.target.value)} />
                    </label>
                    <button type="submit" className="btn-secondary" disabled={!followUpInput.trim() || loadingRefine}>
                      {loadingRefine ? "Analizando respuesta..." : "Guardar respuesta"}
                    </button>
                  </form>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h2>Refinemos la información clave</h2>
              <p>La idea aquí es reunir lo mínimo necesario para que la generación visual salga mejor desde el primer intento.</p>
              {confidence !== null ? <small>Confianza estimada: {Math.round(confidence * 100)}%</small> : null}
              {completenessScore !== null ? <small>Completitud del brief: {Math.round(completenessScore)}%</small> : null}

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

              <div className="onboarding-refine-grid">
                <div className="card stack onboarding-summary-card">
                  <strong>Resumen del brief</strong>

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
                    CTA principal
                    <input
                      value={briefDraft.primary_cta}
                      onChange={(event) => {
                        setCtaManuallyEdited(true);
                        setBriefDraft((prev) => (prev ? { ...prev, primary_cta: event.target.value } : prev));
                      }}
                    />
                  </label>

                  <label>
                    Número WhatsApp (con país)
                    <input value={whatsappPhoneInput} onChange={(event) => setWhatsappPhoneInput(event.target.value)} placeholder="+573001234567" />
                  </label>
                  {whatsappPhoneInput.trim().length > 0 && !validateWhatsappPhone(whatsappPhoneInput.trim()) ? (
                    <small className="muted">Formato esperado: +573001234567</small>
                  ) : null}

                  <label>
                    Mensaje prellenado (opcional)
                    <textarea
                      rows={2}
                      value={whatsappMessageInput}
                      onChange={(event) => {
                        setWhatsappMessageManuallyEdited(true);
                        setWhatsappMessageInput(event.target.value);
                      }}
                      placeholder="Hola, vi tu web y quiero más info."
                    />
                  </label>
                </div>

                <div className="card stack onboarding-chat-card">
                  <strong>Asistente de refine</strong>
                  <p>Si hace falta más contexto, la IA te hará preguntas cortas para mejorar la generación.</p>

                  {missingFields.length ? (
                    <small>Campos aún débiles: {missingFields.join(", ")}</small>
                  ) : (
                    <small>Ya tenemos suficiente información para generar una propuesta sólida.</small>
                  )}

                  <div className="card stack" style={{ gap: "0.5rem" }}>
                    <strong>Propuesta de hero</strong>
                    {heroConfidence !== null ? <small>Confianza del hero: {Math.round(heroConfidence * 100)}%</small> : null}
                    {heroSuggestion ? (
                      <>
                        <div className="stack" style={{ gap: "0.2rem" }}>
                          <small className="muted">Headline</small>
                          <strong>{heroSuggestion.headline}</strong>
                        </div>
                        <div className="stack" style={{ gap: "0.2rem" }}>
                          <small className="muted">Subheadline</small>
                          <p>{heroSuggestion.subheadline}</p>
                        </div>
                        <div className="stack" style={{ gap: "0.2rem" }}>
                          <small className="muted">CTA</small>
                          <strong>{heroSuggestion.primary_cta}</strong>
                        </div>
                        <div className="stack" style={{ gap: "0.2rem" }}>
                          <small className="muted">Dirección</small>
                          <p>{heroSuggestion.hero_direction}</p>
                        </div>
                      </>
                    ) : (
                      <p className="muted">Todavía no hay suficiente claridad para proponerte un hero fuerte. Vamos a pedir una precisión adicional por chat.</p>
                    )}
                  </div>

                  <div className="onboarding-chat-thread">
                    {chatMessages.length ? (
                      chatMessages.map((message, index) => (
                        <div key={`${message.role}-${index}`} className={`onboarding-chat-bubble ${message.role}`}>
                          <strong>{message.role === "assistant" ? "IA" : "Tú"}</strong>
                          <p>{message.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className="onboarding-chat-empty">No hay preguntas pendientes. Puedes generar cuando quieras.</div>
                    )}
                  </div>

                  {followUpQuestion ? (
                    <form className="stack" onSubmit={handleFollowUpSubmit}>
                      <label>
                        Respuesta
                        <textarea rows={3} value={followUpInput} onChange={(event) => setFollowUpInput(event.target.value)} />
                      </label>
                      <button type="submit" className="btn-secondary" disabled={!canSendFollowUp}>
                        {loadingRefine ? "Actualizando brief..." : "Responder y mejorar brief"}
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="btn-secondary" onClick={() => (generationMode === "regenerate" ? router.back() : setStep(1))}>
              Volver
            </button>
            <button type="button" className="btn-primary" onClick={handleGenerate} disabled={!canGenerate}>
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
            <small>La propuesta se construye por etapas para que puedas verla nacer en tiempo real.</small>
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

function buildRegenerationFeedbackPayload(
  draftFeedback: string,
  chatMessages: ChatMessage[],
  assistantSummary: string | null
) {
  const userMessages = chatMessages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean);
  const parts = [draftFeedback.trim(), ...userMessages, assistantSummary ?? ""].filter(Boolean);
  const compact = Array.from(new Set(parts)).join("\n");
  return compact || undefined;
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

function suggestPrimaryCtaClient(input: {
  businessType: BusinessBriefDraft["business_type"];
  rawInput: string;
  offerSummary: string;
  hasWhatsappPhone: boolean;
}) {
  const lower = `${input.rawInput} ${input.offerSummary}`.toLowerCase();
  if (input.businessType === "commerce_lite") {
    if (input.hasWhatsappPhone) {
      if (/cat[aá]logo|catalog/.test(lower)) return "Pedir catálogo por WhatsApp";
      if (/precio|cotiz|valor|presupuesto/.test(lower)) return "Cotizar por WhatsApp";
      return "Comprar por WhatsApp";
    }
    if (/cat[aá]logo|catalog/.test(lower)) return "Ver catálogo";
    return "Conocer productos";
  }
  if (input.hasWhatsappPhone) {
    if (/agenda|cita|consulta|asesor/.test(lower)) return "Agendar por WhatsApp";
    return "Hablar por WhatsApp";
  }
  if (/agenda|cita|consulta|asesor/.test(lower)) return "Agendar asesoría";
  return "Solicitar información";
}

function suggestWhatsappMessageClient(input: {
  businessName: string;
  businessType: BusinessBriefDraft["business_type"];
  offerSummary: string;
  primaryCta: string;
}) {
  const lower = `${input.offerSummary} ${input.primaryCta}`.toLowerCase();
  if (input.businessType === "commerce_lite") {
    if (/cotiz|precio|valor/.test(lower)) return `Hola, vi la página de ${input.businessName} y quiero cotizar uno de sus productos.`;
    if (/cat[aá]logo|catalog/.test(lower)) return `Hola, vi la página de ${input.businessName} y quiero ver el catálogo completo.`;
    return `Hola, vi la página de ${input.businessName} y quiero conocer disponibilidad y precios.`;
  }
  if (/agenda|cita|consulta|asesor/.test(lower)) return `Hola, vi la página de ${input.businessName} y quiero agendar una asesoría.`;
  return `Hola, vi la página de ${input.businessName} y quiero recibir más información.`;
}

function buildHeroSuggestionClient(brief: BusinessBriefDraft): HeroSuggestion {
  const headline =
    brief.business_type === "commerce_lite"
      ? `Descubre ${brief.business_name}`
      : `${brief.business_name}: ${brief.offer_summary.split(/[,.]/)[0] ?? "tu propuesta"}`;

  return {
    headline: headline.slice(0, 120),
    subheadline: `${brief.offer_summary}${brief.offer_summary.endsWith(".") ? "" : "."} Pensado para ${brief.target_audience.toLowerCase()}.`.slice(0, 220),
    primary_cta: brief.primary_cta,
    hero_direction:
      brief.business_type === "commerce_lite"
        ? "Hero comercial con beneficio principal visible y CTA de contacto inmediato."
        : "Hero de credibilidad con promesa clara, apoyo visual limpio y CTA principal único."
  };
}

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const customWindow = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return customWindow.SpeechRecognition ?? customWindow.webkitSpeechRecognition ?? null;
}

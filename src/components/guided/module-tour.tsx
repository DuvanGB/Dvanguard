"use client";

import { useEffect, useMemo, useState } from "react";

type ModuleTourName = "dashboard" | "onboarding" | "editor";

type TourStep = {
  title: string;
  body: string;
};

type Props = {
  module: ModuleTourName;
  title: string;
  description: string;
  steps: TourStep[];
  buttonLabel?: string;
  compact?: boolean;
};

type TourStatusResponse = {
  status: {
    completed: boolean;
    dismissed: boolean;
    lastSeenAt: string | null;
  } | null;
  error?: string;
};

export function ModuleTour({ module, title, description, steps, buttonLabel = "Ver guía", compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);

  const currentStep = steps[activeStep] ?? steps[0];
  const totalSteps = steps.length;
  const progressLabel = useMemo(() => `${activeStep + 1} / ${totalSteps}`, [activeStep, totalSteps]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/account/module-tour?module=${module}`);
        const data = (await response.json()) as TourStatusResponse;
        if (cancelled) return;
        const hasSeen = Boolean(data.status?.completed || data.status?.dismissed);
        setOpen(!hasSeen);
      } catch {
        if (!cancelled) setOpen(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [module]);

  async function persist(status: "completed" | "dismissed") {
    try {
      await fetch("/api/account/module-tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, status })
      });
    } catch {
      // best effort
    }
  }

  async function handleDismiss() {
    setOpen(false);
    setActiveStep(0);
    await persist("dismissed");
  }

  async function handleNext() {
    if (activeStep >= totalSteps - 1) {
      setOpen(false);
      setActiveStep(0);
      await persist("completed");
      return;
    }

    setActiveStep((prev) => prev + 1);
  }

  return (
    <>
      <button
        type="button"
        className={compact ? "btn-secondary btn-pill btn-sm" : "btn-secondary btn-pill"}
        onClick={() => {
          setActiveStep(0);
          setOpen(true);
        }}
        disabled={loading}
      >
        {buttonLabel}
      </button>

      {open ? (
        <div className="tour-overlay" role="dialog" aria-modal="true" aria-label={title}>
          <div className="tour-card">
            <div className="tour-badge">{module}</div>
            <h3>{title}</h3>
            <p>{description}</p>

            <div className="tour-progress">
              <span>{progressLabel}</span>
              <div className="tour-progress-bar">
                <div
                  className="tour-progress-value"
                  style={{ width: `${((activeStep + 1) / Math.max(1, totalSteps)) * 100}%` }}
                />
              </div>
            </div>

            <div className="tour-step-card">
              <strong>{currentStep.title}</strong>
              <p>{currentStep.body}</p>
            </div>

            <div className="tour-actions">
              <button type="button" className="btn-secondary" onClick={() => void handleDismiss()}>
                Omitir
              </button>
              <button type="button" className="btn-primary" onClick={() => void handleNext()}>
                {activeStep >= totalSteps - 1 ? "Finalizar" : "Siguiente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

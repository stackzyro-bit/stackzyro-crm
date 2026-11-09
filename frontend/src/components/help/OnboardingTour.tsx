import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTour } from "../../context/TourContext";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export function OnboardingTour() {
  const {
    isTourOpen,
    currentStepIndex,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
    finishTour,
  } = useTour();

  useEffect(() => {
    if (!isTourOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        skipTour();
      } else if (e.key === "ArrowRight") {
        nextStep();
      } else if (e.key === "ArrowLeft") {
        prevStep();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTourOpen, nextStep, prevStep, skipTour]);

  if (!isTourOpen || !currentStep) return null;

  const isLastStep = currentStepIndex === totalSteps - 1;
  const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/60 backdrop-blur-xs transition-opacity"
        onClick={skipTour}
        aria-hidden="true"
      />

      {/* Tour Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        className="pop-enter relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-pop"
      >
        {/* Top Progress Bar */}
        <div className="h-1.5 w-full bg-brand-100">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between border-b border-line bg-gradient-to-b from-[#faf8ff] to-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-4 ring-brand-50/60">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="purple">{currentStep.badge}</Badge>
                <span className="text-[11px] font-medium text-ink-400">
                  {currentStep.role === "admin" ? "Admin Onboarding" : "Staff Onboarding"}
                </span>
              </div>
              <h2
                id="tour-step-title"
                className="mt-1 text-[16px] font-bold tracking-tight text-ink-900"
              >
                {currentStep.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={skipTour}
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-canvas hover:text-ink-700"
            aria-label="Close tour"
            title="Skip tour (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">
              Focus Area: {currentStep.elementHint}
            </p>
            <p className="mt-0.5 text-xs text-ink-600">{currentStep.subtitle}</p>
          </div>

          <p className="text-[13px] leading-relaxed text-ink-700">{currentStep.description}</p>

          {currentStep.keyHighlights && currentStep.keyHighlights.length > 0 ? (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                Key Highlights
              </p>
              <div className="space-y-1.5">
                {currentStep.keyHighlights.map((highlight, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-ink-700">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between border-t border-line bg-canvas px-6 py-3.5">
          <button
            type="button"
            onClick={skipTour}
            className="text-xs font-medium text-ink-400 transition-colors hover:text-ink-700"
          >
            Skip walkthrough
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 ? (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
                onClick={prevStep}
              >
                Previous
              </Button>
            ) : null}

            {isLastStep ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={finishTour}
              >
                Finish & Explore
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                onClick={nextStep}
              >
                Next Step
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

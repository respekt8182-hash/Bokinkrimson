"use client";

// Client component for wizard stepper in the excursions module.
import { UnifiedStepper } from "@/components/ui/unified-stepper";

type StepStatus = "incomplete" | "partial" | "complete";

type WizardStep = {
  label: string;
  status: StepStatus;
};

type WizardStepperProps = {
  steps: WizardStep[];
  currentStep: number;
  onStepClick: (index: number) => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  backHref?: string;
  backLabel?: string;
};

export function WizardStepper({
  steps,
  currentStep,
  onStepClick,
  saveStatus,
  backHref = "/dashboard/excursions",
  backLabel = "Все экскурсии",
}: WizardStepperProps) {
  const unifiedSteps = steps.map((s) => ({
    label: s.label,
    done: s.status === "complete",
    status: s.status,
  }));
  const totalSteps = steps.length;
  const safeCurrentStep =
    totalSteps === 0 ? 0 : Math.min(Math.max(currentStep, 0), totalSteps - 1);
  const prevStepIndex = safeCurrentStep > 0 ? safeCurrentStep - 1 : null;
  const nextStepIndex =
    totalSteps > 0 && safeCurrentStep < totalSteps - 1 ? safeCurrentStep + 1 : null;
  const counter = totalSteps === 0 ? "0/0" : `${safeCurrentStep + 1}/${totalSteps}`;

  return (
    <nav
      className="rounded-2xl border border-olive/8 bg-white p-3 shadow-sm sm:p-4"
      aria-label="Навигация шагов экскурсии"
    >
      <UnifiedStepper
        steps={unifiedSteps}
        currentStep={safeCurrentStep}
        onStepClick={onStepClick}
        saveStatus={saveStatus}
        showProgress={false}
        compact
        nav={{
          backHref,
          backLabel,
          prevOnClick: prevStepIndex === null ? undefined : () => onStepClick(prevStepIndex),
          prevLabel: prevStepIndex === null ? undefined : steps[prevStepIndex]?.label,
          nextOnClick: nextStepIndex === null ? undefined : () => onStepClick(nextStepIndex),
          nextLabel: nextStepIndex === null ? undefined : steps[nextStepIndex]?.label,
          counter,
        }}
      />
    </nav>
  );
}

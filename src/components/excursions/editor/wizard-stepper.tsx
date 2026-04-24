"use client";

// Client component for wizard stepper in the excursions module.
import {
  CalendarDays,
  CircleCheckBig,
  ListChecks,
  MapPin,
  PenLine,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { UnifiedStepper, type UnifiedStepTone } from "@/components/ui/unified-stepper";

type StepStatus = "incomplete" | "partial" | "complete";

type WizardStep = {
  label: string;
  status: StepStatus;
};

type StepPresentation = {
  icon: LucideIcon;
  tone: UnifiedStepTone;
};

const STEP_PRESENTATIONS: StepPresentation[] = [
  { icon: PenLine, tone: "teal" },       // 0: Тип и описание
  { icon: MapPin, tone: "terra" },        // 1: География и маршрут
  { icon: ListChecks, tone: "gold" },     // 2: Программа
  { icon: CalendarDays, tone: "emerald" },// 3: Расписание и группа
  { icon: WalletCards, tone: "teal" },    // 4: Цена и условия
  { icon: CircleCheckBig, tone: "emerald" }, // 5: Медиа и контакты
];

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
  backLabel = "Все программы",
}: WizardStepperProps) {
  const totalSteps = steps.length;
  const safeCurrentStep = totalSteps === 0 ? 0 : Math.min(Math.max(currentStep, 0), totalSteps - 1);
  const prevStepIndex = safeCurrentStep > 0 ? safeCurrentStep - 1 : null;
  const nextStepIndex =
    totalSteps > 0 && safeCurrentStep < totalSteps - 1 ? safeCurrentStep + 1 : null;
  const counter = totalSteps === 0 ? "0/0" : `${safeCurrentStep + 1}/${totalSteps}`;
  const unifiedSteps = steps.map((step, index) => {
    const presentation = STEP_PRESENTATIONS[index % STEP_PRESENTATIONS.length];
    const isComplete = step.status === "complete";

    return {
      label: step.label,
      status: isComplete ? ("complete" as const) : ("incomplete" as const),
      done: isComplete && index !== safeCurrentStep,
      showCompletionBadge: isComplete,
      icon: presentation.icon,
      tone: presentation.tone,
    };
  });

  return (
    <nav
      aria-label="Навигация шагов программы"
      className="rounded-[28px] border border-olive/8 bg-white/95 p-2.5 shadow-[0_18px_36px_-28px_rgba(15,74,64,0.35)] sm:p-4"
    >
      <UnifiedStepper
        steps={unifiedSteps}
        currentStep={safeCurrentStep}
        onStepClick={onStepClick}
        saveStatus={saveStatus}
        showProgress={false}
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

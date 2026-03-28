"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import {
  BedDouble,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UnifiedStepTone = "teal" | "sky" | "terra" | "emerald" | "gold";
export type UnifiedStepIconName =
  | "building"
  | "shield-check"
  | "bed-double"
  | "sparkles"
  | "wallet-cards";

export type UnifiedStepItem = {
  label: string;
  done: boolean;
  /** Optional granular status. If omitted, inferred from `done`. */
  status?: "incomplete" | "partial" | "complete";
  /** Optional badge that marks all required data for the step as filled in. */
  showCompletionBadge?: boolean;
  /** If provided, step renders as a <Link>. Otherwise renders as a <button>. */
  href?: string;
  /** Optional icon shown instead of the numeric index. */
  icon?: LucideIcon;
  /** Serializable icon identifier for server-to-client step configs. */
  iconName?: UnifiedStepIconName;
  /** Optional accent palette for icon-driven steps. */
  tone?: UnifiedStepTone;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type UnifiedStepperProps = {
  steps: UnifiedStepItem[];
  currentStep: number;
  /** Used when steps are buttons. Ignored when steps have href. */
  onStepClick?: (index: number) => void;
  saveStatus?: SaveStatus;
  showProgress?: boolean;
  /** Reduces connector widths and step paddings for dense layouts. */
  compact?: boolean;
  /** Optional nav bar above steps: back link + prev/next arrows */
  nav?: {
    backHref?: string;
    backOnClick?: () => void;
    backLabel?: string;
    prevHref?: string;
    prevOnClick?: () => void;
    prevLabel?: string;
    nextHref?: string;
    nextOnClick?: () => void;
    nextLabel?: string;
    /** e.g. "1/6" shown between arrows */
    counter?: string;
  };
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCheck({ className }: { className?: string }) {
  return <AppIcon icon={Check} className={className} />;
}

function IconChevronLeft({ className }: { className?: string }) {
  return <AppIcon icon={ChevronLeft} className={className} />;
}

function IconChevronRight({ className }: { className?: string }) {
  return <AppIcon icon={ChevronRight} className={className} />;
}

function IconSpinner({ className }: { className?: string }) {
  return <AppIcon icon={LoaderCircle} className={cn("animate-spin", className)} />;
}

const STEP_ICON_BY_NAME: Record<UnifiedStepIconName, LucideIcon> = {
  building: Building2,
  "shield-check": ShieldCheck,
  "bed-double": BedDouble,
  sparkles: Sparkles,
  "wallet-cards": WalletCards,
};

type StepToneStyles = {
  activeTab: string;
  doneTab: string;
  hoverTab: string;
  activeCircle: string;
  doneCircle: string;
  inactiveCircle: string;
  activeLabel: string;
  doneLabel: string;
  inactiveLabel: string;
  underline: string;
  connectorStrong: string;
  connectorSoft: string;
};

const STEP_TONE_STYLES: Record<UnifiedStepTone, StepToneStyles> = {
  teal: {
    activeTab:
      "bg-primary/[0.08] shadow-[0_10px_28px_-18px] shadow-primary/55 ring-1 ring-primary/12",
    doneTab: "bg-primary/[0.045] ring-1 ring-primary/8 hover:bg-primary/[0.075]",
    hoverTab: "hover:bg-primary/[0.045]",
    activeCircle:
      "border border-primary/20 bg-gradient-to-br from-white via-foam to-primary/[0.14] text-primary shadow-md shadow-primary/20 ring-[3px] ring-primary/10",
    doneCircle:
      "border border-primary/14 bg-gradient-to-br from-primary/[0.18] via-primary/[0.09] to-sky-400/[0.16] text-primary shadow-md shadow-primary/16",
    inactiveCircle:
      "border border-primary/12 bg-gradient-to-br from-white to-primary/[0.06] text-primary/60 shadow-sm shadow-primary/8",
    activeLabel: "font-semibold text-primary",
    doneLabel: "font-bold text-primary/90",
    inactiveLabel: "font-medium text-primary/65",
    underline: "bg-gradient-to-r from-primary via-teal-500 to-sky-500",
    connectorStrong: "bg-gradient-to-r from-primary/45 to-sky-400/35",
    connectorSoft: "bg-primary/18",
  },
  sky: {
    activeTab: "bg-sky-50 shadow-[0_10px_28px_-18px] shadow-sky-300/45 ring-1 ring-sky-200/70",
    doneTab: "bg-sky-50/80 ring-1 ring-sky-200/60 hover:bg-sky-50",
    hoverTab: "hover:bg-sky-50/70",
    activeCircle:
      "border border-sky-200 bg-gradient-to-br from-white via-sky-50 to-cyan-100 text-sky-700 shadow-md shadow-sky-200/60 ring-[3px] ring-sky-200/55",
    doneCircle:
      "border border-sky-200/80 bg-gradient-to-br from-sky-100 to-cyan-100 text-sky-700 shadow-md shadow-sky-200/45",
    inactiveCircle:
      "border border-sky-100 bg-gradient-to-br from-white to-sky-50 text-sky-600/65 shadow-sm shadow-sky-100/50",
    activeLabel: "font-semibold text-sky-700",
    doneLabel: "font-bold text-sky-800",
    inactiveLabel: "font-medium text-sky-700/70",
    underline: "bg-gradient-to-r from-sky-500 to-cyan-400",
    connectorStrong: "bg-gradient-to-r from-sky-400/55 to-cyan-300/45",
    connectorSoft: "bg-sky-300/26",
  },
  terra: {
    activeTab: "bg-terra/[0.08] shadow-[0_10px_28px_-18px] shadow-terra/45 ring-1 ring-terra/12",
    doneTab: "bg-terra/[0.055] ring-1 ring-terra/10 hover:bg-terra/[0.085]",
    hoverTab: "hover:bg-terra/[0.05]",
    activeCircle:
      "border border-terra/20 bg-gradient-to-br from-white via-orange-50 to-terra/[0.16] text-terra shadow-md shadow-terra/20 ring-[3px] ring-terra/10",
    doneCircle:
      "border border-terra/16 bg-gradient-to-br from-terra/[0.16] via-orange-50 to-sage/[0.18] text-terra shadow-md shadow-terra/16",
    inactiveCircle:
      "border border-terra/12 bg-gradient-to-br from-white to-terra/[0.06] text-terra/65 shadow-sm shadow-terra/8",
    activeLabel: "font-semibold text-terra",
    doneLabel: "font-bold text-terra",
    inactiveLabel: "font-medium text-terra/72",
    underline: "bg-gradient-to-r from-terra to-orange-400",
    connectorStrong: "bg-gradient-to-r from-terra/45 to-orange-300/45",
    connectorSoft: "bg-terra/18",
  },
  emerald: {
    activeTab:
      "bg-emerald-50 shadow-[0_10px_28px_-18px] shadow-emerald-300/40 ring-1 ring-emerald-200/65",
    doneTab: "bg-emerald-50/80 ring-1 ring-emerald-200/55 hover:bg-emerald-50",
    hoverTab: "hover:bg-emerald-50/70",
    activeCircle:
      "border border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-primary/[0.12] text-emerald-700 shadow-md shadow-emerald-200/55 ring-[3px] ring-emerald-200/50",
    doneCircle:
      "border border-emerald-200/80 bg-gradient-to-br from-emerald-100 to-primary/[0.14] text-emerald-700 shadow-md shadow-emerald-200/40",
    inactiveCircle:
      "border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 text-emerald-700/65 shadow-sm shadow-emerald-100/45",
    activeLabel: "font-semibold text-emerald-700",
    doneLabel: "font-bold text-emerald-800",
    inactiveLabel: "font-medium text-emerald-700/72",
    underline: "bg-gradient-to-r from-emerald-500 to-primary",
    connectorStrong: "bg-gradient-to-r from-emerald-400/55 to-primary/35",
    connectorSoft: "bg-emerald-300/28",
  },
  gold: {
    activeTab: "bg-sage/16 shadow-[0_10px_28px_-18px] shadow-amber-300/45 ring-1 ring-sage/24",
    doneTab: "bg-sage/12 ring-1 ring-sage/18 hover:bg-sage/18",
    hoverTab: "hover:bg-sage/10",
    activeCircle:
      "border border-sage/35 bg-gradient-to-br from-white via-amber-50 to-sage/24 text-amber-700 shadow-md shadow-amber-200/55 ring-[3px] ring-sage/18",
    doneCircle:
      "border border-sage/30 bg-gradient-to-br from-sage/30 to-amber-100 text-amber-700 shadow-md shadow-amber-200/45",
    inactiveCircle:
      "border border-sage/20 bg-gradient-to-br from-white to-sage/12 text-amber-700/70 shadow-sm shadow-amber-100/50",
    activeLabel: "font-semibold text-amber-700",
    doneLabel: "font-bold text-amber-800",
    inactiveLabel: "font-medium text-amber-700/75",
    underline: "bg-gradient-to-r from-sage to-amber-400",
    connectorStrong: "bg-gradient-to-r from-sage/55 to-amber-300/45",
    connectorSoft: "bg-sage/28",
  },
};

function getStepToneStyles(tone?: UnifiedStepTone) {
  return tone ? STEP_TONE_STYLES[tone] : null;
}

// ─── Step visual ─────────────────────────────────────────────────────────────

function StepContent({
  index,
  label,
  isActive,
  isDone,
  isPartial,
  showCompletionBadge = false,
  icon: StepIcon,
  iconName,
  tone,
  compact = false,
}: {
  index: number;
  label: string;
  isActive: boolean;
  isDone: boolean;
  isPartial: boolean;
  showCompletionBadge?: boolean;
  icon?: LucideIcon;
  iconName?: UnifiedStepIconName;
  tone?: UnifiedStepTone;
  compact?: boolean;
}) {
  const toneStyles = getStepToneStyles(tone);
  const resolvedIcon = StepIcon ?? (iconName ? STEP_ICON_BY_NAME[iconName] : undefined);
  const usesIcon = resolvedIcon !== undefined;

  return (
    <>
      {/* Circle */}
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full text-xs font-bold",
          "transition-all duration-300 ease-out",
          compact ? "h-7 w-7 sm:h-6 sm:w-6" : "h-8 w-8 sm:h-7 sm:w-7",
          isDone
            ? (toneStyles?.doneCircle ??
                "bg-gradient-to-br from-sage to-amber-400 text-midnight shadow-lg shadow-sage/30 ring-2 ring-sage/20")
            : isPartial
              ? isActive
                ? "border-2 border-amber-500 bg-amber-50 text-amber-700 shadow-sm shadow-amber-500/20 ring-[3px] ring-amber-500/20"
                : "border border-amber-300 bg-amber-50/70 text-amber-700"
              : isActive
                ? (toneStyles?.activeCircle ??
                  "border-2 border-primary bg-white text-primary shadow-md shadow-primary/25 ring-[3px] ring-primary/15 stepper-active-pulse")
                : usesIcon
                  ? (toneStyles?.inactiveCircle ??
                    "border border-olive/[0.12] bg-white text-olive/45 shadow-sm shadow-olive/5")
                  : "border border-olive/[0.18] bg-white text-olive/35",
        )}
      >
        {resolvedIcon ? (
          <AppIcon
            icon={resolvedIcon}
            className={cn(
              compact ? "h-3.5 w-3.5 sm:h-3 sm:w-3" : "h-4 w-4 sm:h-3.5 sm:w-3.5",
              "stroke-[2.15] transition-transform duration-200",
              isActive && "scale-105",
            )}
          />
        ) : isDone ? (
          <IconCheck className="h-4 w-4 stroke-[2.5]" />
        ) : (
          <span className="leading-none">{index + 1}</span>
        )}

        {showCompletionBadge && (
          <span
            className={cn(
              "pointer-events-none absolute -right-1 -top-1 inline-flex items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-sm shadow-emerald-500/35",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
            aria-hidden="true"
          >
            <IconCheck className={cn(compact ? "h-2 w-2" : "h-2.5 w-2.5", "stroke-[3]")} />
          </span>
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          compact
            ? "whitespace-nowrap text-[11px] transition-colors duration-200"
            : "whitespace-nowrap text-xs transition-colors duration-200",
          isDone
            ? (toneStyles?.doneLabel ?? "font-bold text-midnight/80")
            : isPartial
              ? "font-semibold text-amber-700"
              : isActive
                ? (toneStyles?.activeLabel ?? "font-semibold text-primary")
                : (toneStyles?.inactiveLabel ?? "font-medium text-olive/38"),
        )}
      >
        {label}
      </span>

      {/* Active underline (desktop only) */}
      {isActive && (
        <div
          className={cn(
            "absolute -bottom-px left-2.5 right-2.5 hidden h-[2.5px] rounded-full sm:block",
            isDone
              ? (toneStyles?.underline ?? "bg-gradient-to-r from-sage to-amber-400")
              : isPartial
                ? "bg-amber-500"
                : (toneStyles?.underline ?? "bg-gradient-to-r from-primary to-teal-500"),
          )}
        />
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UnifiedStepper({
  steps,
  currentStep,
  onStepClick,
  saveStatus = "idle",
  showProgress = true,
  compact = false,
  nav,
}: UnifiedStepperProps) {
  const stepScrollerRef = useRef<HTMLDivElement | null>(null);
  const getStepState = (step: UnifiedStepItem): "incomplete" | "partial" | "complete" =>
    step.status ?? (step.done ? "complete" : "incomplete");

  const completedCount = steps.filter((s) => getStepState(s) === "complete").length;
  const safeCurrentStep =
    currentStep >= 0 && currentStep < steps.length ? currentStep : Math.max(steps.length - 1, 0);
  const activeStepItem = steps[safeCurrentStep];

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const scroller = stepScrollerRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) {
      return;
    }

    if (window.matchMedia("(min-width: 640px)").matches) {
      return;
    }

    const activeStep = scroller.querySelector<HTMLElement>("[data-step-active='true']");
    if (!activeStep) {
      return;
    }

    const visibilityPadding = 12;
    const scrollerBounds = scroller.getBoundingClientRect();
    const stepBounds = activeStep.getBoundingClientRect();
    const isFullyVisible =
      stepBounds.left >= scrollerBounds.left + visibilityPadding &&
      stepBounds.right <= scrollerBounds.right - visibilityPadding;

    if (isFullyVisible) {
      return;
    }

    activeStep.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "auto",
    });
  }, [safeCurrentStep, steps.length]);

  return (
    <div className="space-y-3">
      {activeStepItem ? (
        <div className="sm:hidden">
          <div className="rounded-[22px] border border-primary/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(232,245,241,0.92))] p-3 shadow-[0_20px_36px_-26px_rgba(15,118,110,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/60">
                  Этап {safeCurrentStep + 1}/{steps.length}
                </p>
                <p className="mt-1 truncate text-base font-semibold text-olive">
                  {activeStepItem.label}
                </p>
              </div>
              <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {completedCount}/{steps.length}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Top nav bar ── */}
      {nav && (
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Back link */}
          {nav.backHref ? (
            <Link
              href={nav.backHref}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5",
                "text-xs font-medium text-olive/55",
                "transition-all duration-150 hover:bg-olive/[0.06] hover:text-olive",
              )}
            >
              <IconChevronLeft className="h-4 w-4" />
              {nav.backLabel && (
                <span className="max-w-[7rem] truncate sm:max-w-none">{nav.backLabel}</span>
              )}
            </Link>
          ) : nav.backOnClick ? (
            <button
              type="button"
              onClick={nav.backOnClick}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5",
                "text-xs font-medium text-olive/55",
                "transition-all duration-150 hover:bg-olive/[0.06] hover:text-olive",
              )}
            >
              <IconChevronLeft className="h-4 w-4" />
              {nav.backLabel && (
                <span className="max-w-[7rem] truncate sm:max-w-none">{nav.backLabel}</span>
              )}
            </button>
          ) : (
            <span className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-lg text-olive/18 sm:h-8 sm:w-8">
              <IconChevronLeft className="h-4 w-4" />
            </span>
          )}

          {/* Prev / counter / Next */}
          <div className="flex items-center gap-0.5">
            {nav.prevHref ? (
              <Link
                href={nav.prevHref}
                title={nav.prevLabel}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg sm:h-8 sm:w-8",
                  "text-olive/50 transition-all duration-150",
                  "hover:bg-olive/[0.06] hover:text-olive",
                )}
              >
                <IconChevronLeft className="h-4 w-4" />
              </Link>
            ) : nav.prevOnClick ? (
              <button
                type="button"
                onClick={nav.prevOnClick}
                title={nav.prevLabel}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg sm:h-8 sm:w-8",
                  "text-olive/50 transition-all duration-150",
                  "hover:bg-olive/[0.06] hover:text-olive",
                )}
              >
                <IconChevronLeft className="h-4 w-4" />
              </button>
            ) : (
              <span className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-lg text-olive/18 sm:h-8 sm:w-8">
                <IconChevronLeft className="h-4 w-4" />
              </span>
            )}

            {nav.counter && (
              <span className="min-w-[2.8rem] rounded-full bg-olive/[0.04] px-2 py-1 text-center text-xs font-semibold tabular-nums text-olive/45">
                {nav.counter}
              </span>
            )}

            {nav.nextHref ? (
              <Link
                href={nav.nextHref}
                title={nav.nextLabel}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg sm:h-8 sm:w-8",
                  "text-olive/50 transition-all duration-150",
                  "hover:bg-olive/[0.06] hover:text-olive",
                )}
              >
                <IconChevronRight className="h-4 w-4" />
              </Link>
            ) : nav.nextOnClick ? (
              <button
                type="button"
                onClick={nav.nextOnClick}
                title={nav.nextLabel}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg sm:h-8 sm:w-8",
                  "text-olive/50 transition-all duration-150",
                  "hover:bg-olive/[0.06] hover:text-olive",
                )}
              >
                <IconChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <span className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-lg text-olive/18 sm:h-8 sm:w-8">
                <IconChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Divider (only when nav is shown) ── */}
      {nav && <div className="h-px bg-olive/[0.06]" />}

      {/* ── Step tabs ── */}
      <div
        ref={stepScrollerRef}
        className="custom-scrollbar -mx-1 snap-x snap-mandatory overflow-x-auto rounded-2xl bg-gradient-to-b from-sand/40 to-cream/60 px-1 pb-1 pt-1 ring-1 ring-olive/[0.06]"
      >
        <div className="flex min-w-max items-center gap-1 sm:min-w-0 sm:justify-center sm:gap-0">
          {steps.map((step, i) => {
            const state = getStepState(step);
            const isActive = i === safeCurrentStep;
            const isDone = state === "complete";
            const isPartial = state === "partial";
            const isLast = i === steps.length - 1;
            const toneStyles = getStepToneStyles(step.tone);
            const nextStep = isLast ? null : steps[i + 1];
            const nextState = nextStep ? getStepState(nextStep) : null;
            const nextToneStyles = getStepToneStyles(nextStep?.tone);
            const connectorToneStyles = isDone
              ? toneStyles
              : nextState === "complete"
                ? nextToneStyles
                : toneStyles;

            const sharedClass = cn(
              "group relative flex min-w-[104px] shrink-0 items-center justify-start rounded-xl transition-all duration-200 sm:min-w-0 sm:justify-center",
              compact
                ? "gap-2 px-2.5 py-1.5 sm:flex-col sm:items-center sm:gap-1 sm:px-2.5 sm:py-2"
                : "gap-2.5 px-3 py-2 sm:flex-col sm:items-center sm:gap-1.5 sm:px-4 sm:py-2.5",
              "transition-all duration-200",
              isActive
                ? isDone
                  ? (toneStyles?.doneTab ??
                    "bg-sage/10 shadow-[0_2px_12px_-3px] shadow-sage/25 ring-1 ring-sage/15")
                  : isPartial
                    ? "bg-amber-50 shadow-[0_2px_12px_-3px] shadow-amber-500/18 ring-1 ring-amber-400/15"
                    : (toneStyles?.activeTab ??
                      "bg-primary/[0.07] shadow-[0_2px_12px_-3px] shadow-primary/20 ring-1 ring-primary/10")
                : isDone
                  ? cn(toneStyles?.doneTab ?? "hover:bg-sage/[0.06]", "cursor-pointer")
                  : isPartial
                    ? "hover:bg-amber-50/70 cursor-pointer"
                    : cn(toneStyles?.hoverTab ?? "hover:bg-olive/[0.04]", "cursor-pointer"),
            );

            return (
              <div key={i} className="flex snap-start items-center">
                {step.href ? (
                  <Link
                    href={step.href}
                    aria-current={isActive ? "page" : undefined}
                    data-step-active={isActive ? "true" : undefined}
                    className={sharedClass}
                    title={step.label}
                  >
                    <StepContent
                      index={i}
                      label={step.label}
                      isActive={isActive}
                      isDone={isDone}
                      isPartial={isPartial}
                      showCompletionBadge={step.showCompletionBadge}
                      icon={step.icon}
                      iconName={step.iconName}
                      tone={step.tone}
                      compact={compact}
                    />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onStepClick?.(i)}
                    data-step-active={isActive ? "true" : undefined}
                    className={sharedClass}
                    title={step.label}
                  >
                    <StepContent
                      index={i}
                      label={step.label}
                      isActive={isActive}
                      isDone={isDone}
                      isPartial={isPartial}
                      showCompletionBadge={step.showCompletionBadge}
                      icon={step.icon}
                      iconName={step.iconName}
                      tone={step.tone}
                      compact={compact}
                    />
                  </button>
                )}

                {/* Connector */}
                {!isLast && (
                  <div
                    className={cn(
                      "hidden h-px shrink-0",
                      compact
                        ? "mx-0.5 w-2 sm:block md:w-2.5 lg:w-3 xl:w-4"
                        : "mx-1 w-4 sm:block md:w-6 lg:w-10",
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-colors duration-500",
                        isDone && nextState === "complete"
                          ? (connectorToneStyles?.connectorStrong ??
                              "bg-gradient-to-r from-sage/50 to-sage/35")
                          : isDone || nextState === "complete"
                            ? (connectorToneStyles?.connectorSoft ?? "bg-sage/25")
                            : isPartial && nextState === "partial"
                              ? "bg-amber-400/45"
                              : isPartial || nextState === "partial"
                                ? "bg-amber-300/30"
                                : "bg-olive/10",
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Progress bar + counter ── */}
      {showProgress && (
        <div className="flex items-center gap-3">
          <div className="relative flex flex-1 gap-1 overflow-hidden rounded-full bg-olive/[0.04] p-[3px]">
            {steps.map((step, i) => (
              <div
                key={i}
                className={cn(
                  "h-[4px] flex-1 rounded-full transition-all duration-500",
                  getStepState(step) === "complete"
                    ? "bg-gradient-to-r from-sage to-amber-400 shadow-sm shadow-sage/20"
                    : getStepState(step) === "partial"
                      ? "bg-amber-400"
                      : i === currentStep
                        ? "bg-primary/30"
                        : "bg-olive/[0.07]",
                )}
              />
            ))}
          </div>
          <span className="shrink-0 rounded-full bg-sage/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-midnight/50">
            {completedCount}/{steps.length}
          </span>
        </div>
      )}

      {/* ── Save status pill ── */}
      {saveStatus !== "idle" && saveStatus !== "error" && (
        <div className="flex justify-end">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              "transition-all duration-300",
              saveStatus === "saving" && "bg-olive/[0.07] text-olive/60",
              saveStatus === "saved" && "bg-sage/15 text-midnight/70",
            )}
          >
            {saveStatus === "saving" && <IconSpinner className="h-3 w-3 text-olive/50" />}
            {saveStatus === "saved" && <IconCheck className="h-3 w-3" />}
            <span>
              {saveStatus === "saving" && "Сохранение…"}
              {saveStatus === "saved" && "Сохранено"}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

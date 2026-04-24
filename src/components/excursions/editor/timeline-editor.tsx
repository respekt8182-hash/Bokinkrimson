"use client";

// Client component for timeline editor in the excursions module.
import { ArrowBigDown, ArrowBigUp, ChevronDown, Trash2 } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContentPhotoManager } from "@/components/excursions/editor/content-photo-manager";
import { TimelineStepIcon } from "@/components/ui/timeline-step-icon";
import { cn } from "@/lib/cn";
import {
  EXCURSION_PROGRAM_PHOTO_LIMIT,
  getTimelineStepPhotoUrls,
  type TimelineStep,
  TIMELINE_DURATION_OPTIONS,
  TIMELINE_ICONS,
  TIMELINE_ICON_LABELS,
} from "@/types/excursions";

const ALL_ICONS = TIMELINE_ICONS;
const EMPTY_DURATION_VALUE = "__empty__";

type TimelineEditorProps = {
  steps: TimelineStep[];
  onChange: (steps: TimelineStep[]) => void;
  onUploadPhotos: (stepIndex: number, files: FileList | null) => void;
  onMovePhoto: (stepIndex: number, photoIndex: number, direction: -1 | 1) => void;
  onRemovePhoto: (stepIndex: number, photoIndex: number) => void;
  disabled?: boolean;
  uploadingStepIndex?: number | null;
};

type StepFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
};

function newStep(index: number): TimelineStep {
  return {
    step: index + 1,
    time: "",
    duration: "30 мин",
    title: "",
    description: "",
    location: "",
    icon: "sightseeing",
    photoUrls: [],
  };
}

function renumber(steps: TimelineStep[]): TimelineStep[] {
  return steps.map((step, index) => ({ ...step, step: index + 1 }));
}

function normalizeStepTimeForInput(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return "";
  }

  const hourMinuteMatch = raw.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (hourMinuteMatch) {
    const hours = Math.max(0, Math.min(23, Number(hourMinuteMatch[1])));
    const minutes = Math.max(0, Math.min(59, Number(hourMinuteMatch[2])));
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const hourOnlyMatch = raw.match(/^(\d{1,2})$/);
  if (hourOnlyMatch) {
    const hours = Math.max(0, Math.min(23, Number(hourOnlyMatch[1])));
    return `${String(hours).padStart(2, "0")}:00`;
  }

  return "";
}

function getDurationOptions(currentValue: string) {
  const normalizedValue = currentValue.trim();
  const baseOptions = [
    { value: EMPTY_DURATION_VALUE, label: "Не указывать" },
    ...TIMELINE_DURATION_OPTIONS,
  ];

  if (!normalizedValue) {
    return baseOptions;
  }

  const hasCurrentValue = baseOptions.some((option) => option.value === normalizedValue);
  if (hasCurrentValue) {
    return baseOptions;
  }

  return [{ value: normalizedValue, label: normalizedValue }, ...baseOptions];
}

function StepField({ label, htmlFor, hint, className, children }: StepFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        {htmlFor ? (
          <label
            htmlFor={htmlFor}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/55"
          >
            {label}
          </label>
        ) : (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/55">
            {label}
          </p>
        )}
        {hint ? <span className="text-xs text-olive/42">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function TimelineEditor({
  steps,
  onChange,
  onUploadPhotos,
  onMovePhoto,
  onRemovePhoto,
  disabled = false,
  uploadingStepIndex = null,
}: TimelineEditorProps) {
  useEffect(() => {
    function closeAllIconPickers(except?: Element | null) {
      const openedPickers = document.querySelectorAll<HTMLElement>(
        "details.timeline-icon-picker[open]",
      );
      openedPickers.forEach((picker) => {
        if (except && picker === except) {
          return;
        }

        picker.removeAttribute("open");
      });
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      const currentPicker =
        target instanceof Element ? target.closest("details.timeline-icon-picker") : null;

      if (currentPicker) {
        closeAllIconPickers(currentPicker);
      } else {
        closeAllIconPickers();
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAllIconPickers();
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, []);

  function addStep() {
    onChange(renumber([...steps, newStep(steps.length)]));
  }

  function removeStep(index: number) {
    onChange(renumber(steps.filter((_, currentIndex) => currentIndex !== index)));
  }

  function moveUp(index: number) {
    if (index === 0) {
      return;
    }

    const next = [...steps];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(renumber(next));
  }

  function moveDown(index: number) {
    if (index === steps.length - 1) {
      return;
    }

    const next = [...steps];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(renumber(next));
  }

  function updateStep<K extends keyof TimelineStep>(index: number, key: K, value: TimelineStep[K]) {
    onChange(
      steps.map((step, currentIndex) =>
        currentIndex === index ? { ...step, [key]: value } : step,
      ),
    );
  }

  return (
    <div className="space-y-3">
      {steps.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-5 text-center text-sm text-[color:var(--text-muted)]">
          Добавьте шаги, чтобы собрать понятный маршрут экскурсии по порядку.
        </p>
      ) : null}

      <div className="relative space-y-3">
        {steps.length > 1 ? (
          <div className="absolute bottom-8 left-[19px] top-8 w-0.5 bg-[color:var(--border)]" />
        ) : null}

        {steps.map((step, index) => {
          const activeIcon = step.icon ?? "sightseeing";
          const durationOptions = getDurationOptions(step.duration ?? "");
          const stepPhotoUrls = getTimelineStepPhotoUrls(step);
          const titleId = `timeline-step-${index}-title`;
          const locationId = `timeline-step-${index}-location`;
          const timeId = `timeline-step-${index}-time`;
          const durationId = `timeline-step-${index}-duration`;
          const descriptionId = `timeline-step-${index}-description`;

          return (
            <div key={index} className="flex gap-3">
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-xs font-bold text-white">
                {step.step}
              </div>

              <div className="flex-1 rounded-2xl border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,247,242,0.92))] p-4 shadow-sm">
                {/* Header: type picker + action buttons */}
                <div className="mb-4 flex items-center gap-2">
                  <details className="timeline-icon-picker relative">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-olive/18 bg-white px-3 py-1.5 text-left transition hover:border-olive/28 hover:bg-[color:var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]/30 [&::-webkit-details-marker]:hidden">
                      <TimelineStepIcon icon={activeIcon} className="h-5 w-5" />
                      <span className="text-sm font-semibold text-olive">
                        {TIMELINE_ICON_LABELS[activeIcon]}
                      </span>
                      <span className="text-[color:var(--icon-nav)]">
                        <AppIcon icon={ChevronDown} className="h-4 w-4" />
                      </span>
                    </summary>

                    <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 grid max-h-72 w-[min(320px,calc(100vw-2rem))] grid-cols-2 gap-1.5 overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-white p-3 shadow-[0_16px_34px_rgba(20,30,30,0.16)]">
                      {ALL_ICONS.map((icon) => {
                        const isActive = activeIcon === icon;

                        return (
                          <button
                            key={icon}
                            type="button"
                            title={TIMELINE_ICON_LABELS[icon]}
                            className={cn(
                              "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition",
                              isActive
                                ? "border-[color:var(--primary)] bg-[color:var(--foam)] ring-1 ring-[color:var(--primary)]/25"
                                : "border-transparent hover:border-[color:var(--border)] hover:bg-[color:var(--surface)]",
                            )}
                            onClick={(event) => {
                              updateStep(index, "icon", icon);
                              event.currentTarget.closest("details")?.removeAttribute("open");
                            }}
                          >
                            <TimelineStepIcon icon={icon} className="h-5 w-5" />
                            <span className="min-w-0 truncate text-xs font-medium text-olive">
                              {TIMELINE_ICON_LABELS[icon]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </details>

                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={disabled || index === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-40"
                      title="Переместить вверх"
                      aria-label={`Переместить шаг ${step.step} вверх`}
                    >
                      <AppIcon icon={ArrowBigUp} className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={disabled || index === steps.length - 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-40"
                      title="Переместить вниз"
                      aria-label={`Переместить шаг ${step.step} вниз`}
                    >
                      <AppIcon icon={ArrowBigDown} className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      disabled={disabled}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--danger)] transition hover:bg-red-50 disabled:opacity-40"
                      title="Удалить шаг"
                      aria-label={`Удалить шаг ${step.step}`}
                    >
                      <AppIcon icon={Trash2} className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Fields in logical fill order */}
                <div className="space-y-3">
                  <StepField label="Что происходит" htmlFor={titleId}>
                    <Input
                      id={titleId}
                      value={step.title}
                      onChange={(event) => updateStep(index, "title", event.target.value)}
                      placeholder="Например: осмотр Ливадийского дворца"
                      maxLength={80}
                      className="py-3 text-base font-medium"
                    />
                  </StepField>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <StepField label="Во сколько" htmlFor={timeId} hint="Необязательно">
                      <Input
                        id={timeId}
                        type="time"
                        step={60}
                        value={normalizeStepTimeForInput(step.time)}
                        aria-label={`Время шага ${index + 1}`}
                        onChange={(event) => updateStep(index, "time", event.target.value)}
                        className="py-3 text-base font-medium [color-scheme:light]"
                      />
                    </StepField>

                    <StepField label="Длительность" htmlFor={durationId}>
                      <div className="relative">
                        <select
                          id={durationId}
                          value={
                            step.duration?.trim() ? step.duration.trim() : EMPTY_DURATION_VALUE
                          }
                          onChange={(event) =>
                            updateStep(
                              index,
                              "duration",
                              event.target.value === EMPTY_DURATION_VALUE ? "" : event.target.value,
                            )
                          }
                          className="h-[46px] w-full appearance-none rounded-xl border border-olive/18 bg-white px-3.5 pr-10 text-sm font-medium text-olive outline-none transition hover:border-olive/30 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        >
                          {durationOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-olive/45">
                          <AppIcon icon={ChevronDown} className="h-4 w-4" />
                        </span>
                      </div>
                    </StepField>
                  </div>

                  <StepField label="Где это проходит" htmlFor={locationId} hint="Необязательно">
                    <Input
                      id={locationId}
                      value={step.location ?? ""}
                      onChange={(event) => updateStep(index, "location", event.target.value)}
                      placeholder="Например: главный вход, причал или смотровая площадка"
                      maxLength={100}
                    />
                  </StepField>

                  <StepField
                    label="Подробности для гостя"
                    htmlFor={descriptionId}
                    hint="Необязательно"
                  >
                    <textarea
                      id={descriptionId}
                      value={step.description ?? ""}
                      onChange={(event) => updateStep(index, "description", event.target.value)}
                      placeholder="Что важно знать об этом шаге: сбор группы, билеты, свободное время, что взять с собой"
                      maxLength={300}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-[color:var(--border)] bg-white px-3.5 py-3 text-sm text-olive outline-none placeholder:text-olive/48 focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/20"
                    />
                  </StepField>

                  <ContentPhotoManager
                    title="Фото шага"
                    description="Эти фото показываются рядом с соответствующим шагом маршрута."
                    photoUrls={stepPhotoUrls}
                    limit={EXCURSION_PROGRAM_PHOTO_LIMIT}
                    addLabel="Добавить фото шага"
                    emptyText="Фото для этого шага пока не выбраны."
                    disabled={disabled}
                    isUploading={uploadingStepIndex === index}
                    onUpload={(files) => onUploadPhotos(index, files)}
                    onMove={(photoIndex, direction) => onMovePhoto(index, photoIndex, direction)}
                    onRemove={(photoIndex) => onRemovePhoto(index, photoIndex)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {steps.length < 20 ? (
        <Button
          type="button"
          variant="ghost"
          onClick={addStep}
          className="w-full border-dashed"
          disabled={disabled}
        >
          + Добавить шаг
        </Button>
      ) : null}
    </div>
  );
}

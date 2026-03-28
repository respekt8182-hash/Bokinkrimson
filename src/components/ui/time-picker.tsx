"use client";

import { ChevronDown, Clock3 } from "lucide-react";
import { cn } from "@/lib/cn";
import { AppIcon } from "@/components/ui/app-icon";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  size?: "default" | "sm";
  hoursOnly?: boolean;
};

type MinuteDialPickerProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

type TimeParts = {
  hour: number;
  minute: number;
};

type TimeDialMode = "hour" | "minute";

const QUICK_MINUTE_STEP = 5;
const DIAL_VIEWBOX_SIZE = 100;
const DIAL_CENTER = 50;
const DIAL_TRACK_RADIUS = 36;
const DIAL_HANDLE_RADIUS = 4.2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function padTimePart(value: number): string {
  return String(value).padStart(2, "0");
}

function formatTime(parts: TimeParts): string {
  return `${padTimePart(parts.hour)}:${padTimePart(parts.minute)}`;
}

function parseTime(value: string): TimeParts | null {
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function extractTimeDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

function parseTimeDigits(value: string): TimeParts | null {
  if (value.length !== 4) {
    return null;
  }

  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(2, 4));
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

function isHourMinuteShorthand(value: string): boolean {
  return value.length === 3 && (value[0] === "0" || Number(value.slice(0, 2)) > 23);
}

function parseHourMinuteShorthand(value: string): TimeParts | null {
  if (!isHourMinuteShorthand(value)) {
    return null;
  }

  const hour = Number(value[0]);
  const minute = Number(value.slice(1));
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

function formatTimeDraft(value: string): string {
  if (!value.length) {
    return "";
  }

  if (value.length <= 2) {
    return value;
  }

  if (isHourMinuteShorthand(value)) {
    return `${padTimePart(Number(value[0]))}:${value.slice(1)}`;
  }

  return `${value.slice(0, 2)}:${value.slice(2)}`;
}

function wrapStep(value: number, direction: 1 | -1, total: number, step = 1): number {
  return (value + direction * step + total * 10) % total;
}

function ClockIcon() {
  return <AppIcon icon={Clock3} className="h-5 w-5 text-white" />;
}

type TimeDialProps = {
  id: string;
  label: string;
  mode: TimeDialMode;
  value: number;
  isActive: boolean;
  disabled: boolean;
  onActivate: () => void;
  onChange: (value: number) => void;
  onStep: (direction: 1 | -1) => void;
  onTabSwitch: () => void;
};

function TimeDial({
  id,
  label,
  mode,
  value,
  isActive,
  disabled,
  onActivate,
  onChange,
  onStep,
  onTabSwitch,
}: TimeDialProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number } | null>(null);
  const max = mode === "hour" ? 23 : 59;
  const totalValues = max + 1;
  const stepAngle = 360 / totalValues;
  const angle = value * stepAngle;
  const circumference = 2 * Math.PI * DIAL_TRACK_RADIUS;
  const progressRatio = value / totalValues;
  const progressOffset = circumference * (1 - progressRatio);

  const handleX = DIAL_CENTER + Math.cos(((angle - 90) * Math.PI) / 180) * DIAL_TRACK_RADIUS;
  const handleY = DIAL_CENTER + Math.sin(((angle - 90) * Math.PI) / 180) * DIAL_TRACK_RADIUS;

  const valueFromPointer = useCallback(
    (clientX: number, clientY: number): number => {
      const root = rootRef.current;
      if (!root) {
        return value;
      }

      const rect = root.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      let degrees = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (degrees < 0) {
        degrees += 360;
      }

      const nextValue = Math.round(degrees / stepAngle) % totalValues;
      return clamp(nextValue, 0, max);
    },
    [max, stepAngle, totalValues, value],
  );

  const applyPointerSelection = useCallback(
    (clientX: number, clientY: number) => {
      onChange(valueFromPointer(clientX, clientY));
    },
    [onChange, valueFromPointer],
  );

  function stopDrag() {
    dragRef.current = null;
  }

  return (
    <div className="rounded-2xl border border-olive/12 bg-[radial-gradient(circle_at_32%_22%,rgba(15,118,110,0.12),transparent_58%),radial-gradient(circle_at_74%_80%,rgba(15,118,110,0.08),transparent_62%),rgba(255,255,255,0.96)] p-1.5 sm:p-2">
      <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-olive/55 sm:text-[11px]">
        {label}
      </p>

      <div
        id={id}
        ref={rootRef}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          "relative mx-auto aspect-square w-full max-w-[124px] overflow-hidden rounded-full border border-olive/12 bg-white/88 outline-none transition sm:max-w-[146px]",
          "focus-visible:ring-2 focus-visible:ring-primary/30",
          isActive ? "ring-2 ring-primary/24" : "",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-grab",
        )}
        style={{
          touchAction: "none",
          overscrollBehavior: "contain",
        }}
        onFocus={onActivate}
        onClick={onActivate}
        onPointerDown={(event) => {
          if (disabled) {
            return;
          }
          if (event.pointerType === "mouse" && event.button !== 0) {
            return;
          }

          onActivate();
          dragRef.current = { pointerId: event.pointerId };
          event.currentTarget.setPointerCapture(event.pointerId);
          applyPointerSelection(event.clientX, event.clientY);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) {
            return;
          }

          applyPointerSelection(event.clientX, event.clientY);
          event.preventDefault();
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) {
            return;
          }
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            // Ignore capture release failures.
          }
          stopDrag();
        }}
        onPointerCancel={() => {
          stopDrag();
        }}
        onLostPointerCapture={() => {
          stopDrag();
        }}
        onWheel={(event) => {
          // Wheel interaction is intentionally disabled for precision.
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            onTabSwitch();
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onStep(1);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onStep(-1);
          }
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              mode === "minute"
                ? "repeating-conic-gradient(rgba(58,43,35,0.16) 0 1deg, rgba(58,43,35,0) 1deg 6deg)"
                : "repeating-conic-gradient(rgba(58,43,35,0.16) 0 1deg, rgba(58,43,35,0) 1deg 15deg)",
            maskImage: "radial-gradient(circle, transparent 68%, black 69%)",
            WebkitMaskImage: "radial-gradient(circle, transparent 68%, black 69%)",
          }}
        />

        <svg
          viewBox={`0 0 ${DIAL_VIEWBOX_SIZE} ${DIAL_VIEWBOX_SIZE}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <circle
            cx={DIAL_CENTER}
            cy={DIAL_CENTER}
            r={DIAL_TRACK_RADIUS}
            fill="none"
            stroke="rgba(58,43,35,0.12)"
            strokeWidth="6.5"
          />
          <circle
            cx={DIAL_CENTER}
            cy={DIAL_CENTER}
            r={DIAL_TRACK_RADIUS}
            fill="none"
            stroke="rgba(15,118,110,0.9)"
            strokeWidth="6.5"
            strokeLinecap={value === 0 ? "butt" : "round"}
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            transform={`rotate(-90 ${DIAL_CENTER} ${DIAL_CENTER})`}
          />
          <line
            x1={DIAL_CENTER}
            y1={DIAL_CENTER}
            x2={handleX}
            y2={handleY}
            stroke="rgba(15,118,110,0.92)"
            strokeWidth="1.4"
          />
          <circle
            cx={handleX}
            cy={handleY}
            r={DIAL_HANDLE_RADIUS}
            fill="rgba(15,118,110,1)"
            stroke="rgba(255,255,255,0.95)"
            strokeWidth="1.5"
          />
        </svg>

        <div className="pointer-events-none absolute inset-[23%] grid place-items-center rounded-full border border-olive/12 bg-white/84 backdrop-blur-[3px]">
          <div className="text-center">
            <p className="[font-family:'JetBrains_Mono',ui-monospace,Menlo,Consolas,monospace] text-[24px] font-bold leading-none text-primary sm:text-[28px]">
              {padTimePart(value)}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-olive/55">
              {mode === "hour" ? "часы" : "мин"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MinuteDialPicker({
  value,
  onChange,
  disabled = false,
  ariaLabel = "Минуты",
  className,
}: MinuteDialPickerProps) {
  const dialId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const minuteInputRef = useRef<HTMLInputElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedValue = clamp(value, 0, 59);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [minuteDraft, setMinuteDraft] = useState<string | null>(null);
  const displayMinute = minuteDraft ?? padTimePart(normalizedValue);

  const closeDropdown = useCallback(() => {
    if (!isOpen) {
      return;
    }

    setIsClosing(true);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 220);
  }, [isOpen, setIsClosing, setIsOpen]);

  const openDropdown = useCallback(() => {
    if (disabled) {
      return;
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsClosing(false);
    setIsOpen(true);
  }, [disabled, setIsClosing, setIsOpen]);

  const toggleDropdown = useCallback(() => {
    if (isOpen) {
      closeDropdown();
      return;
    }
    openDropdown();
  }, [closeDropdown, isOpen, openDropdown]);

  const stepMinute = useCallback(
    (direction: 1 | -1, step = 1) => {
      onChange(wrapStep(normalizedValue, direction, 60, step));
    },
    [normalizedValue, onChange],
  );

  const commitMinuteInput = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 2);
      if (!digits.length) {
        return;
      }
      onChange(clamp(Number(digits), 0, 59));
    },
    [onChange],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!rootRef.current?.contains(target)) {
        closeDropdown();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeDropdown, isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <div
        role="combobox"
        aria-expanded={isOpen && !isClosing}
        aria-controls={`${dialId}-minutes`}
        aria-haspopup="dialog"
        aria-disabled={disabled}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          "group relative flex h-[62px] w-full items-center justify-between rounded-[14px] border-[1.5px] border-olive/18 bg-white px-3.5 py-2 text-left transition duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]",
          "hover:shadow-[0_2px_12px_rgba(15,118,110,0.08)]",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(15,118,110,0.22),0_4px_16px_rgba(15,118,110,0.1)]",
          isOpen && !isClosing
            ? "border-primary/40 shadow-[0_0_0_3px_rgba(15,118,110,0.22),0_4px_16px_rgba(15,118,110,0.1)]"
            : "",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
        onClick={(event) => {
          if (disabled) {
            return;
          }

          if (event.target instanceof HTMLInputElement) {
            if (!isOpen) {
              openDropdown();
            }
            return;
          }

          toggleDropdown();
        }}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }

          if (event.target instanceof HTMLInputElement) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleDropdown();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            closeDropdown();
            return;
          }

          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            if (!isOpen) {
              openDropdown();
            }
            stepMinute(event.key === "ArrowUp" ? 1 : -1);
          }
        }}
      >
        <span className="pointer-events-none absolute inset-0 rounded-[14px] bg-gradient-to-r from-primary/6 via-transparent to-primary/6 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="relative z-10 inline-flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary to-sun text-white shadow-[0_6px_18px_rgba(15,118,110,0.28)]">
            <ClockIcon />
          </span>
          <span className="inline-flex items-center gap-1 [font-family:'JetBrains_Mono',ui-monospace,Menlo,Consolas,monospace] text-[20px] font-semibold text-olive">
            <input
              ref={minuteInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={displayMinute}
              disabled={disabled}
              aria-label="Минуты"
              className="h-7 w-[2ch] bg-transparent text-right text-current outline-none"
              onFocus={() => {
                openDropdown();
                setMinuteDraft(padTimePart(normalizedValue));
              }}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setMinuteDraft(null);
                  stepMinute(1);
                  return;
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setMinuteDraft(null);
                  stepMinute(-1);
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (minuteDraft !== null) {
                    commitMinuteInput(minuteDraft);
                  }
                  setMinuteDraft(null);
                  closeDropdown();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setMinuteDraft(null);
                  closeDropdown();
                }
              }}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
                setMinuteDraft(digits);
                if (digits.length === 2) {
                  commitMinuteInput(digits);
                  setMinuteDraft(null);
                }
              }}
              onBlur={() => {
                if (minuteDraft !== null) {
                  commitMinuteInput(minuteDraft);
                }
                setMinuteDraft(null);
              }}
            />
            <span>мин</span>
          </span>
        </span>
        <span className="relative z-10 inline-flex h-8 w-8 items-center justify-center text-olive/70">
          <AppIcon
            icon={ChevronDown}
            className={cn(
              "h-4.5 w-4.5 transition-transform duration-300",
              isOpen && !isClosing ? "rotate-180" : "rotate-0",
            )}
          />
        </span>
      </div>

      {isOpen ? (
        <div
          id={`${dialId}-minutes`}
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+8px)] z-40 rounded-2xl border border-olive/12 bg-white p-2.5 shadow-[0_12px_48px_rgba(0,0,0,0.12)] transition-all duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] sm:p-3",
            isClosing
              ? "pointer-events-none -translate-y-2 scale-[0.97] opacity-0"
              : "translate-y-0 scale-100 opacity-100",
          )}
        >
          <TimeDial
            id={`${dialId}-minutes-dial`}
            label="Минуты"
            mode="minute"
            value={normalizedValue}
            isActive
            disabled={disabled}
            onActivate={() => {
              // Minute-only dial is always active.
            }}
            onChange={(nextValue) => onChange(clamp(nextValue, 0, 59))}
            onStep={(direction) => stepMinute(direction)}
            onTabSwitch={() => {
              // No secondary column in minute-only mode.
            }}
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-olive/14 bg-white text-xs font-semibold text-olive/75 transition hover:border-primary/30 hover:bg-primary/8 hover:text-primary"
              onClick={() => stepMinute(-1, QUICK_MINUTE_STEP)}
            >
              -5м
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-olive/14 bg-white text-xs font-semibold text-olive/75 transition hover:border-primary/30 hover:bg-primary/8 hover:text-primary"
              onClick={() => stepMinute(1, QUICK_MINUTE_STEP)}
            >
              +5м
            </button>
          </div>

          <button
            type="button"
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary to-sun px-4 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(15,118,110,0.3)] transition duration-200 hover:-translate-y-[1px] hover:shadow-[0_12px_28px_rgba(15,118,110,0.34)]"
            onClick={closeDropdown}
          >
            Готово
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function TimePicker({
  value,
  onChange,
  name,
  disabled = false,
  ariaLabel = "Выбор времени",
  className,
  size = "default",
  hoursOnly = false,
}: TimePickerProps) {
  const hourRef = useRef<HTMLInputElement | null>(null);
  const timeRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState<"hour" | "time" | null>(null);
  const [hourDraft, setHourDraft] = useState<string | null>(null);
  const [timeDraft, setTimeDraft] = useState<string | null>(null);

  const parsed = parseTime(value);
  const hourValue = parsed?.hour ?? 0;
  const minuteValue = parsed?.minute ?? 0;
  const parts = useMemo<TimeParts>(
    () => ({ hour: hourValue, minute: minuteValue }),
    [hourValue, minuteValue],
  );
  const isCompact = size === "sm";

  const displayHour = hourDraft ?? padTimePart(parts.hour);
  const normalizedValue = parsed ? formatTime(parts) : "";
  const syncedTimeDraft =
    timeDraft !== null && extractTimeDigits(normalizedValue) === timeDraft ? null : timeDraft;
  const displayTime = syncedTimeDraft === null ? normalizedValue : formatTimeDraft(syncedTimeDraft);
  const isFocused = focused !== null;

  const commitTimeDraft = useCallback(
    (raw: string | null): boolean => {
      const digits = extractTimeDigits(raw ?? "");

      if (!digits.length) {
        onChange("");
        return true;
      }

      if (digits.length <= 2) {
        const hour = Number(digits);
        if (Number.isNaN(hour) || hour > 23) {
          return false;
        }

        onChange(formatTime({ hour, minute: 0 }));
        return true;
      }

      if (digits.length === 3) {
        const shorthand = parseHourMinuteShorthand(digits);
        if (shorthand) {
          onChange(formatTime(shorthand));
          return true;
        }

        const hour = Number(digits.slice(0, 2));
        const minuteTens = Number(digits[2]);
        if (Number.isNaN(hour) || Number.isNaN(minuteTens) || hour > 23 || minuteTens > 5) {
          return false;
        }

        onChange(formatTime({ hour, minute: minuteTens * 10 }));
        return true;
      }

      const fullTime = parseTimeDigits(digits);
      if (!fullTime) {
        return false;
      }

      onChange(formatTime(fullTime));
      return true;
    },
    [onChange],
  );

  const stepTime = useCallback(
    (direction: 1 | -1) => {
      const current = parsed ?? { hour: 0, minute: 0 };
      const nextTotalMinutes =
        (current.hour * 60 + current.minute + direction + 24 * 60) % (24 * 60);

      onChange(
        formatTime({
          hour: Math.floor(nextTotalMinutes / 60),
          minute: nextTotalMinutes % 60,
        }),
      );
      setTimeDraft(null);
    },
    [onChange, parsed],
  );

  if (hoursOnly) {
    return (
      <div
        aria-label={ariaLabel}
        className={cn(
          "group relative flex items-center gap-3 rounded-[14px] border-[1.5px] border-olive/18 bg-white px-3.5 transition duration-200",
          "hover:border-olive/30 hover:shadow-[0_2px_12px_rgba(15,118,110,0.08)]",
          isFocused &&
            "border-primary/50 shadow-[0_0_0_3px_rgba(15,118,110,0.18),0_4px_16px_rgba(15,118,110,0.08)]",
          disabled && "cursor-not-allowed opacity-55",
          isCompact ? "h-[50px]" : "h-[62px]",
          className,
        )}
      >
        {name && <input type="hidden" name={name} value={value} />}

        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary to-sun text-white shadow-[0_4px_14px_rgba(15,118,110,0.28)]">
          <ClockIcon />
        </span>

        <span className="flex items-center gap-0.5 [font-family:'JetBrains_Mono',ui-monospace,Menlo,Consolas,monospace]">
          <input
            ref={hourRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={displayHour}
            disabled={disabled}
            aria-label="Часы"
            className={cn(
              "w-[2ch] rounded-md bg-transparent text-center text-[20px] font-semibold text-olive outline-none transition-colors duration-150 selection:bg-primary/20",
              "focus:text-primary",
              disabled && "cursor-not-allowed",
            )}
            onFocus={() => {
              setFocused("hour");
              setHourDraft(padTimePart(parts.hour));
            }}
            onBlur={() => {
              if (hourDraft !== null) {
                const digits = hourDraft.replace(/\D/g, "").slice(0, 2);
                if (!digits) {
                  onChange("");
                } else {
                  onChange(formatTime({ hour: clamp(Number(digits), 0, 23), minute: 0 }));
                }
              }
              setHourDraft(null);
              setFocused(null);
            }}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
              setHourDraft(digits);
              if (digits.length === 2) {
                onChange(formatTime({ hour: clamp(Number(digits), 0, 23), minute: 0 }));
                setHourDraft(null);
                hourRef.current?.blur();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                onChange(formatTime({ hour: wrapStep(parts.hour, 1, 24), minute: 0 }));
                setHourDraft(null);
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                onChange(formatTime({ hour: wrapStep(parts.hour, -1, 24), minute: 0 }));
                setHourDraft(null);
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (hourDraft !== null) {
                  const digits = hourDraft.replace(/\D/g, "").slice(0, 2);
                  if (!digits) {
                    onChange("");
                  } else {
                    onChange(formatTime({ hour: clamp(Number(digits), 0, 23), minute: 0 }));
                  }
                  setHourDraft(null);
                }
                hourRef.current?.blur();
              }
            }}
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <span
            className={cn(
              "select-none text-[20px] font-bold leading-none transition-colors duration-150",
              isFocused ? "text-primary/70" : "text-olive/40",
            )}
          >
            .00
          </span>
        </span>

        <span className="ml-auto text-[11px] font-medium text-olive/30 transition-opacity duration-200 group-hover:text-olive/50">
          00-23
        </span>
      </div>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "group relative flex items-center gap-3 rounded-[14px] border-[1.5px] border-olive/18 bg-white px-3.5 transition duration-200",
        "hover:border-olive/30 hover:shadow-[0_2px_12px_rgba(15,118,110,0.08)]",
        isFocused &&
          "border-primary/50 shadow-[0_0_0_3px_rgba(15,118,110,0.18),0_4px_16px_rgba(15,118,110,0.08)]",
        disabled && "cursor-not-allowed opacity-55",
        isCompact ? "h-[50px]" : "h-[62px]",
        className,
      )}
      onClick={(event) => {
        if (disabled) {
          return;
        }
        if (event.target instanceof HTMLInputElement) {
          return;
        }
        timeRef.current?.focus();
      }}
    >
      {name && <input type="hidden" name={name} value={value} />}

      {/* Icon */}
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary to-sun text-white shadow-[0_4px_14px_rgba(15,118,110,0.28)]">
        <ClockIcon />
      </span>

      {/* Segments */}
      <span className="min-w-0 flex-1 [font-family:'JetBrains_Mono',ui-monospace,Menlo,Consolas,monospace]">
        <input
          ref={timeRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9:]*"
          maxLength={5}
          enterKeyHint="done"
          autoComplete="off"
          placeholder="чч:мм"
          value={displayTime}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "w-full min-w-0 bg-transparent text-[20px] font-semibold text-olive outline-none transition-colors duration-150 selection:bg-primary/20",
            "focus:text-primary",
            disabled && "cursor-not-allowed",
          )}
          onFocus={(event) => {
            setFocused("time");
            event.currentTarget.select();
          }}
          onBlur={() => {
            if (timeDraft !== null) {
              commitTimeDraft(timeDraft);
            }
            setTimeDraft(null);
            setFocused(null);
          }}
          onChange={(event) => {
            const nextDigits = extractTimeDigits(event.target.value);
            setTimeDraft(nextDigits);

            if (!nextDigits.length) {
              onChange("");
              return;
            }

            const fullTime = parseTimeDigits(nextDigits);
            if (fullTime) {
              onChange(formatTime(fullTime));
              return;
            }

            const shorthand = parseHourMinuteShorthand(nextDigits);
            if (shorthand) {
              setTimeDraft(extractTimeDigits(formatTime(shorthand)));
              onChange(formatTime(shorthand));
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              stepTime(1);
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              stepTime(-1);
              return;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              commitTimeDraft(timeDraft ?? extractTimeDigits(normalizedValue));
              setTimeDraft(null);
              timeRef.current?.blur();
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setTimeDraft(null);
              timeRef.current?.blur();
            }
          }}
        />
      </span>

      {/* Subtle hint */}
      <span className="ml-auto text-[11px] font-medium text-olive/30 transition-opacity duration-200 group-hover:text-olive/50">
        чч:мм
      </span>
    </div>
  );
}

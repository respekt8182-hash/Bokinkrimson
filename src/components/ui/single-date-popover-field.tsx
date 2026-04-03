"use client";

// Reusable UI helper/component for single date popover field.
import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FieldAdornmentIcon } from "@/components/ui/field-adornment-icon";
import { cn } from "@/lib/cn";

type SingleDatePopoverFieldProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  helperText?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  buttonClassName?: string;
  monthCount?: number;
  mobilePanelStyle?: "sheet" | "dialog";
};

type CalendarCell = {
  iso: string | null;
  day: number | null;
  isWeekend: boolean;
};

type CalendarMonth = {
  key: string;
  label: string;
  cells: CalendarCell[];
};

const monthNamesNominative = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

const monthNamesGenitive = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

const weekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
const popoverExitDurationMs = 250;
const defaultCalendarMonthCount = 14;

const yearFormatter = new Intl.NumberFormat("ru-RU", {
  useGrouping: false,
});

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoParts(iso: string): { year: number; month: number; day: number } | null {
  const [yearRaw, monthRaw, dayRaw] = iso.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function getMonthKeyFromIso(iso: string): string | null {
  const parsed = parseIsoParts(iso);
  if (!parsed) {
    return null;
  }

  return getMonthKey(parsed.year, parsed.month - 1);
}

function buildCalendarMonths(startDate: Date, count: number): CalendarMonth[] {
  const months: CalendarMonth[] = [];

  for (let index = 0; index < count; index += 1) {
    const firstDay = new Date(startDate.getFullYear(), startDate.getMonth() + index, 1);
    const year = firstDay.getFullYear();
    const month = firstDay.getMonth();
    const monthKey = getMonthKey(year, month);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = (firstDay.getDay() + 6) % 7;
    const cells: CalendarCell[] = [];

    for (let blankIndex = 0; blankIndex < leadingBlanks; blankIndex += 1) {
      cells.push({
        iso: null,
        day: null,
        isWeekend: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const iso = toIsoDate(date);
      const weekday = (date.getDay() + 6) % 7;

      cells.push({
        iso,
        day,
        isWeekend: weekday >= 5,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({
        iso: null,
        day: null,
        isWeekend: false,
      });
    }

    months.push({
      key: monthKey,
      label: `${monthNamesNominative[month]} ${yearFormatter.format(year)}`,
      cells,
    });
  }

  return months;
}

function formatDateFieldValue(iso: string, placeholder: string): string {
  const parsed = parseIsoParts(iso);
  if (!parsed) {
    return placeholder;
  }

  return `${parsed.day} ${monthNamesGenitive[parsed.month - 1]} ${yearFormatter.format(parsed.year)}`;
}

export function SingleDatePopoverField({
  value,
  onChange,
  placeholder = "Выберите дату",
  helperText = "Выберите дату",
  minDate,
  maxDate,
  disabled = false,
  buttonClassName,
  monthCount = defaultCalendarMonthCount,
  mobilePanelStyle = "sheet",
}: SingleDatePopoverFieldProps) {
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);
  const calendarMonths = useMemo(
    () => buildCalendarMonths(monthStart, Math.max(1, monthCount)),
    [monthCount, monthStart],
  );
  const normalizedMinDate = parseIsoParts(minDate ?? "") ? (minDate as string) : "";
  const normalizedMaxDate = parseIsoParts(maxDate ?? "") ? (maxDate as string) : "";

  const [isOpen, setIsOpen] = useState(false);
  const [isPanelMounted, setIsPanelMounted] = useState(false);
  const [activeMonthKey, setActiveMonthKey] = useState<string>(
    getMonthKeyFromIso(value) ?? getMonthKeyFromIso(todayIso) ?? calendarMonths[0]?.key ?? "",
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const monthListRef = useRef<HTMLDivElement | null>(null);
  const monthSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closePanelTimerRef = useRef<number | null>(null);

  const fieldValue = useMemo(() => formatDateFieldValue(value, placeholder), [placeholder, value]);
  const isCompactMobilePanel = mobilePanelStyle === "dialog";

  const clearClosePanelTimer = useCallback(() => {
    if (closePanelTimerRef.current === null) {
      return;
    }

    window.clearTimeout(closePanelTimerRef.current);
    closePanelTimerRef.current = null;
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    clearClosePanelTimer();
    closePanelTimerRef.current = window.setTimeout(() => {
      setIsPanelMounted(false);
      closePanelTimerRef.current = null;
    }, popoverExitDurationMs);
  }, [clearClosePanelTimer]);

  const scrollToMonth = useCallback((monthKey: string, behavior: ScrollBehavior = "smooth") => {
    const target = monthSectionRefs.current[monthKey];
    const monthList = monthListRef.current;
    if (!target || !monthList) {
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const listRect = monthList.getBoundingClientRect();
    const nextTop = monthList.scrollTop + (targetRect.top - listRect.top);

    monthList.scrollTo({
      top: Math.max(0, nextTop - 4),
      behavior,
    });
  }, []);

  const syncActiveMonthFromScroll = useCallback(() => {
    const monthList = monthListRef.current;
    if (!monthList) {
      return;
    }

    const listTop = monthList.getBoundingClientRect().top;
    let nextActiveMonthKey = "";
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const month of calendarMonths) {
      const section = monthSectionRefs.current[month.key];
      if (!section) {
        continue;
      }

      const distance = Math.abs(section.getBoundingClientRect().top - listTop - 12);
      if (distance < closestDistance) {
        closestDistance = distance;
        nextActiveMonthKey = month.key;
      }
    }

    if (!nextActiveMonthKey) {
      return;
    }

    setActiveMonthKey((current) =>
      current === nextActiveMonthKey ? current : nextActiveMonthKey,
    );
  }, [calendarMonths]);

  const openPanel = useCallback(() => {
    const preferredMonthKey =
      getMonthKeyFromIso(value) ??
      getMonthKeyFromIso(normalizedMinDate) ??
      getMonthKeyFromIso(todayIso) ??
      calendarMonths[0]?.key ??
      "";
    if (preferredMonthKey) {
      setActiveMonthKey(preferredMonthKey);
    }
    clearClosePanelTimer();
    setIsPanelMounted(true);
    setIsOpen(true);
  }, [calendarMonths, clearClosePanelTimer, normalizedMinDate, todayIso, value]);

  const pickDate = useCallback(
    (iso: string) => {
      if (
        (normalizedMinDate && iso < normalizedMinDate) ||
        (normalizedMaxDate && iso > normalizedMaxDate)
      ) {
        return;
      }

      onChange(iso);
      closePanel();
    },
    [closePanel, normalizedMaxDate, normalizedMinDate, onChange],
  );

  useEffect(
    () => () => {
      clearClosePanelTimer();
    },
    [clearClosePanelTimer],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const preferredMonthKey =
      getMonthKeyFromIso(value) ??
      getMonthKeyFromIso(normalizedMinDate) ??
      getMonthKeyFromIso(todayIso) ??
      calendarMonths[0]?.key ??
      "";
    const raf = window.requestAnimationFrame(() => {
      if (preferredMonthKey) {
        scrollToMonth(preferredMonthKey, "auto");
      }
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [calendarMonths, isOpen, normalizedMinDate, scrollToMonth, todayIso, value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const monthList = monthListRef.current;
    if (!monthList) {
      return;
    }

    let frame = 0;
    const syncVisibleMonth = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncActiveMonthFromScroll();
      });
    };

    syncVisibleMonth();
    monthList.addEventListener("scroll", syncVisibleMonth, { passive: true });

    return () => {
      monthList.removeEventListener("scroll", syncVisibleMonth);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [isOpen, syncActiveMonthFromScroll]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (rootRef.current?.contains(target)) {
        return;
      }

      closePanel();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closePanel();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePanel, isOpen]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative",
        isOpen ? "z-[11000] [@media(min-width:768px)_and_(min-height:561px)]:z-[4000]" : "",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            closePanel();
            return;
          }

          openPanel();
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cn(
          "relative w-full rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-left text-sm text-olive outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/22 disabled:cursor-not-allowed disabled:bg-cream disabled:text-olive/45",
          buttonClassName,
        )}
      >
        <span className={cn("block truncate pr-12", value ? "text-olive" : "text-olive/48")}>
          {fieldValue}
        </span>
        <FieldAdornmentIcon icon={CalendarDays} />
      </button>

      {isPanelMounted ? (
        <>
          <button
            type="button"
            className={cn(
              "fixed inset-0 z-[10990] bg-primary/30",
              isOpen ? "popover-overlay-enter" : "popover-overlay-exit pointer-events-none",
            )}
            onClick={closePanel}
            aria-label="Закрыть календарь"
          />
          <div
            className={cn(
              "animated-popover fixed z-[11000] rounded-2xl border ring-olive/12 bg-white shadow-[0_18px_40px_-20px_rgba(15,118,110,0.55)] [@media(min-width:768px)_and_(min-height:561px)]:inset-x-auto [@media(min-width:768px)_and_(min-height:561px)]:left-1/2 [@media(min-width:768px)_and_(min-height:561px)]:top-1/2 [@media(min-width:768px)_and_(min-height:561px)]:bottom-auto [@media(min-width:768px)_and_(min-height:561px)]:w-[min(92vw,860px)] [@media(min-width:768px)_and_(min-height:561px)]:max-h-none [@media(min-width:768px)_and_(min-height:561px)]:max-w-[92vw] [@media(min-width:768px)_and_(min-height:561px)]:-translate-x-1/2 [@media(min-width:768px)_and_(min-height:561px)]:-translate-y-1/2 [@media(min-width:768px)_and_(min-height:561px)]:overflow-visible [@media(min-width:768px)_and_(min-height:561px)]:p-4",
              isCompactMobilePanel
                ? "left-1/2 top-1/2 w-[min(calc(100vw-5rem),13.5rem)] max-w-[calc(100vw-5rem)] max-h-[min(52dvh,17.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden p-1.5 min-[390px]:w-[min(calc(100vw-5.5rem),14.5rem)] min-[390px]:p-2"
                : "inset-x-2 top-2 bottom-2 w-auto max-w-none p-3",
              isOpen ? "popover-enter" : "popover-exit pointer-events-none",
            )}
          >
            <div className="grid gap-3 [@media(min-width:768px)_and_(min-height:561px)]:grid-cols-[180px_minmax(0,1fr)]">
              <aside className="hidden max-h-[420px] overflow-y-auto rounded-xl bg-cream/65 p-2 [@media(min-width:768px)_and_(min-height:561px)]:block">
                {calendarMonths.map((month) => (
                  <button
                    key={month.key}
                    type="button"
                    onClick={() => {
                      setActiveMonthKey(month.key);
                      scrollToMonth(month.key);
                    }}
                    className={cn(
                      "mb-1 block w-full rounded-lg px-2.5 py-2 text-left text-sm transition",
                      month.key === activeMonthKey
                        ? "bg-primary text-white"
                        : "text-olive/75 hover:bg-foam",
                    )}
                  >
                    {month.label}
                  </button>
                ))}
              </aside>

              <div className="min-w-0">
                <div
                  className={cn(
                    "flex items-center justify-between rounded-xl bg-cream/75 text-olive/80",
                    isCompactMobilePanel
                      ? "mb-1.5 gap-1.5 px-1.5 py-1 text-[9px] leading-tight"
                      : "mb-3 px-3 py-2 text-xs",
                  )}
                >
                  <span>{helperText}</span>
                  {value ? (
                    <button
                      type="button"
                      onClick={() => onChange("")}
                      className={cn(
                        "rounded-md text-olive/65 transition hover:bg-foam hover:text-olive",
                        isCompactMobilePanel ? "shrink-0 px-1 py-0.5 text-[9px]" : "px-2 py-0.5",
                      )}
                    >
                      Очистить
                    </button>
                  ) : null}
                </div>

                <div
                  ref={monthListRef}
                  className={cn(
                    "overflow-y-auto pr-1 [@media(min-width:768px)_and_(min-height:561px)]:max-h-[410px]",
                    isCompactMobilePanel
                      ? "max-h-[min(150px,calc(100dvh-180px))] min-[390px]:max-h-[min(165px,calc(100dvh-180px))]"
                      : "max-h-[min(410px,calc(100dvh-170px))]",
                  )}
                >
                  {calendarMonths.map((month) => (
                    <div
                      key={month.key}
                      ref={(node) => {
                        monthSectionRefs.current[month.key] = node;
                      }}
                      className={cn(isCompactMobilePanel ? "mb-2.5 last:mb-0" : "mb-5 last:mb-0")}
                    >
                      <h3
                        className={cn(
                          "font-semibold text-olive",
                          isCompactMobilePanel ? "text-[11px]" : "text-sm",
                        )}
                      >
                        {month.label}
                      </h3>
                      <div
                        className={cn(
                          "grid grid-cols-7 text-center uppercase tracking-wide text-olive/55",
                          isCompactMobilePanel
                            ? "mt-1 gap-0.5 text-[8px]"
                            : "mt-2 gap-1 text-[11px]",
                        )}
                      >
                        {weekdayLabels.map((weekday) => (
                          <span key={`${month.key}-${weekday}`}>{weekday}</span>
                        ))}
                      </div>
                      <div
                        className={cn(
                          "grid grid-cols-7",
                          isCompactMobilePanel ? "mt-0.5 gap-0.5" : "mt-1 gap-1",
                        )}
                      >
                        {month.cells.map((cell, cellIndex) => {
                          const iso = cell.iso;

                          if (!iso || !cell.day) {
                            return (
                              <span
                                key={`${month.key}-blank-${cellIndex}`}
                                className={cn(
                                  isCompactMobilePanel ? "h-6 rounded-md" : "h-9 rounded-lg",
                                )}
                                aria-hidden="true"
                              />
                            );
                          }

                          const isDisabled =
                            (normalizedMinDate && iso < normalizedMinDate) ||
                            (normalizedMaxDate && iso > normalizedMaxDate);
                          const isSelected = iso === value;

                          return (
                            <button
                              key={iso}
                              type="button"
                              disabled={Boolean(isDisabled)}
                              onClick={() => pickDate(iso)}
                              className={cn(
                                "transition-all duration-200 ease-out",
                                isCompactMobilePanel ? "h-6 text-[10px]" : "h-9 text-sm",
                                isSelected
                                  ? cn(
                                      isCompactMobilePanel ? "rounded-md" : "rounded-lg",
                                      "bg-primary font-semibold text-white shadow-[0_5px_14px_-8px_rgba(15,118,110,0.9)]",
                                    )
                                  : isDisabled
                                    ? cn(
                                        "cursor-not-allowed text-olive/28",
                                        isCompactMobilePanel ? "rounded-md" : "rounded-lg",
                                      )
                                    : cell.isWeekend
                                      ? cn(
                                          "text-terra hover:bg-cream",
                                          isCompactMobilePanel ? "rounded-md" : "rounded-lg",
                                        )
                                      : cn(
                                          "text-olive hover:bg-cream",
                                          isCompactMobilePanel ? "rounded-md" : "rounded-lg",
                                        ),
                                iso === todayIso && !isSelected ? "ring-1 ring-sage/45" : "",
                              )}
                            >
                              {cell.day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

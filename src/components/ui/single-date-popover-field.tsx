"use client";

// Reusable UI helper/component for single date popover field.
import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  rootClassName?: string;
  buttonLabel?: string;
  showAdornment?: boolean;
  allowClear?: boolean;
  monthCount?: number;
  mobilePanelStyle?: "sheet" | "dialog";
  desktopPanelStyle?: "dialog" | "popover";
  desktopPopoverAlign?: "left" | "right";
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
  rootClassName,
  buttonLabel,
  showAdornment = true,
  allowClear = true,
  monthCount = defaultCalendarMonthCount,
  mobilePanelStyle = "sheet",
  desktopPanelStyle = "dialog",
  desktopPopoverAlign = "left",
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const monthListRef = useRef<HTMLDivElement | null>(null);
  const monthSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closePanelTimerRef = useRef<number | null>(null);

  const fieldValue = useMemo(() => formatDateFieldValue(value, placeholder), [placeholder, value]);
  const isCompactMobilePanel = mobilePanelStyle === "dialog";
  const isSheetPanel = mobilePanelStyle === "sheet";
  const isDesktopPopover = desktopPanelStyle === "popover";
  const isCenteredCalendarDialog = isSheetPanel && !isDesktopPopover;
  const responsiveDesktopPrefix = isDesktopPopover ? "xl" : "md";
  const resolvedButtonText = buttonLabel ?? fieldValue;

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

      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
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

  useEffect(() => {
    if (!isPanelMounted) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isPanelMounted]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative",
        isOpen ? "z-[11000] [@media(min-width:768px)_and_(min-height:561px)]:z-[4000]" : "",
        rootClassName,
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
          !showAdornment ? "px-3" : "",
          buttonLabel ? "text-center" : "",
          buttonClassName,
        )}
      >
        <span
          className={cn(
            "block truncate",
            showAdornment ? "pr-12" : "",
            buttonLabel ? "text-center" : "",
            buttonLabel || value ? "text-olive" : "text-olive/48",
          )}
        >
          {resolvedButtonText}
        </span>
        {showAdornment ? <FieldAdornmentIcon icon={CalendarDays} /> : null}
      </button>

      {isPanelMounted && typeof document !== "undefined"
        ? createPortal(
            <>
          <button
            type="button"
            className={cn(
              isSheetPanel && isDesktopPopover
                ? "fixed inset-0 z-20 bg-primary/30 xl:hidden"
                : isCenteredCalendarDialog
                  ? "fixed inset-0 z-[10990] bg-primary/30"
                : "fixed inset-0 z-[10990] bg-primary/30",
              isOpen ? "popover-overlay-enter" : "popover-overlay-exit pointer-events-none",
            )}
            onClick={closePanel}
            aria-label="Закрыть календарь"
          />
          <div
            ref={panelRef}
            className={cn(
              "animated-popover fixed bg-white",
              isSheetPanel
                ? isDesktopPopover
                  ? cn(
                      "date-picker-sheet inset-x-2 bottom-2 top-auto z-30 max-h-[88dvh] overflow-hidden overscroll-y-contain rounded-2xl border border-sand p-3 shadow-[0_-8px_32px_-8px_rgba(15,118,110,0.28)] min-[480px]:inset-x-4 min-[480px]:bottom-3 sm:inset-x-5 sm:p-4 md:inset-x-8 md:bottom-4 md:max-h-[84dvh]",
                      "xl:absolute xl:bottom-auto xl:top-[calc(100%+8px)] xl:max-h-none xl:w-[min(92vw,840px)] xl:overflow-visible xl:rounded-2xl xl:p-4 xl:shadow-[0_18px_40px_-20px_rgba(15,118,110,0.55)]",
                      desktopPopoverAlign === "right"
                        ? "xl:left-auto xl:right-0"
                        : "xl:right-auto xl:left-0",
                    )
                  : "date-picker-dialog z-[11000] left-1/2 top-1/2 w-[min(calc(100vw-1rem),920px)] max-w-[calc(100vw-1rem)] max-h-[min(90dvh,760px)] overflow-hidden rounded-2xl border border-sand p-3 shadow-[0_18px_40px_-20px_rgba(15,118,110,0.55)] min-[480px]:w-[min(calc(100vw-2rem),920px)] min-[480px]:p-4 md:w-[min(calc(100vw-4rem),920px)] md:max-h-[84dvh]"
                : "date-picker-dialog z-[11000] left-1/2 top-1/2 w-[min(calc(100vw-5rem),13.5rem)] max-w-[calc(100vw-5rem)] max-h-[min(52dvh,17.5rem)] overflow-hidden rounded-2xl border ring-olive/12 p-1.5 shadow-[0_18px_40px_-20px_rgba(15,118,110,0.55)] min-[390px]:w-[min(calc(100vw-5.5rem),14.5rem)] min-[390px]:p-2",
              isOpen ? "popover-enter" : "popover-exit pointer-events-none",
            )}
          >
            {isSheetPanel && !isCenteredCalendarDialog ? (
              <div
                aria-hidden="true"
                className={cn(
                  "mx-auto mb-3 h-1 w-10 rounded-full bg-olive/20",
                  isDesktopPopover ? "xl:hidden" : "md:hidden",
                )}
              />
            ) : null}
            <div
              className={cn(
                "grid gap-3",
                isSheetPanel
                  ? responsiveDesktopPrefix === "xl"
                    ? "xl:grid-cols-[180px_minmax(0,1fr)]"
                    : "md:grid-cols-[180px_minmax(0,1fr)]"
                  : "",
              )}
            >
              <aside
                className={cn(
                  "hidden max-h-[420px] overflow-y-auto rounded-xl bg-cream/65 p-2",
                  isSheetPanel
                    ? responsiveDesktopPrefix === "xl"
                      ? "xl:block"
                      : "md:block"
                    : "",
                )}
              >
                {calendarMonths.map((month) => (
                  <button
                    key={month.key}
                    type="button"
                    onClick={() => {
                      setActiveMonthKey(month.key);
                      scrollToMonth(month.key);
                    }}
                    className={cn(
                      "mb-1 block w-full touch-manipulation rounded-lg px-2.5 py-2 text-left text-sm transition",
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
                    isSheetPanel
                      ? "mb-3 px-3 py-2 text-xs"
                      : "mb-1.5 gap-1.5 px-1.5 py-1 text-[9px] leading-tight",
                  )}
                >
                  <span>{helperText}</span>
                  {allowClear && value ? (
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
                    "overflow-y-auto pr-1",
                    isSheetPanel
                      ? responsiveDesktopPrefix === "xl"
                        ? "max-h-[68dvh] touch-pan-y overscroll-y-contain [-webkit-overflow-scrolling:touch] min-[480px]:max-h-[70dvh] md:max-h-[66dvh] xl:max-h-[410px]"
                        : "max-h-[68dvh] touch-pan-y overscroll-y-contain [-webkit-overflow-scrolling:touch] min-[480px]:max-h-[70dvh] md:max-h-[410px]"
                      : "max-h-[min(150px,calc(100dvh-180px))] min-[390px]:max-h-[min(165px,calc(100dvh-180px))] [@media(min-width:768px)_and_(min-height:561px)]:max-h-[410px]",
                  )}
                >
                  {calendarMonths.map((month) => (
                    <div
                      key={month.key}
                      ref={(node) => {
                        monthSectionRefs.current[month.key] = node;
                      }}
                      className={cn(isSheetPanel ? "mb-5 last:mb-0" : "mb-2.5 last:mb-0")}
                    >
                      <h3
                        className={cn(
                          "font-semibold text-olive",
                          isSheetPanel ? "text-sm" : "text-[11px]",
                        )}
                      >
                        {month.label}
                      </h3>
                      <div
                        className={cn(
                          "grid grid-cols-7 text-center uppercase tracking-wide text-olive/55",
                          isSheetPanel ? "mt-2 gap-1 text-[11px]" : "mt-1 gap-0.5 text-[8px]",
                        )}
                      >
                        {weekdayLabels.map((weekday) => (
                          <span key={`${month.key}-${weekday}`}>{weekday}</span>
                        ))}
                      </div>
                      <div
                        className={cn(
                          "grid grid-cols-7",
                          isSheetPanel ? "mt-1 gap-1" : "mt-0.5 gap-0.5",
                        )}
                      >
                        {month.cells.map((cell, cellIndex) => {
                          const iso = cell.iso;

                          if (!iso || !cell.day) {
                            return (
                              <span
                                key={`${month.key}-blank-${cellIndex}`}
                                className={cn(
                                  isSheetPanel
                                    ? responsiveDesktopPrefix === "xl"
                                      ? "h-10 rounded-lg min-[390px]:h-11 min-[480px]:h-12 xl:h-9"
                                      : "h-10 rounded-lg min-[390px]:h-11 min-[480px]:h-12 md:h-9"
                                    : "h-6 rounded-md",
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
                                isSheetPanel
                                  ? responsiveDesktopPrefix === "xl"
                                    ? "h-10 touch-manipulation text-sm min-[390px]:h-11 min-[480px]:h-12 xl:h-9"
                                    : "h-10 touch-manipulation text-sm min-[390px]:h-11 min-[480px]:h-12 md:h-9"
                                  : "h-6 text-[10px]",
                                isSelected
                                  ? cn(
                                      isSheetPanel ? "rounded-lg" : "rounded-md",
                                      "bg-primary font-semibold text-white shadow-[0_5px_14px_-8px_rgba(15,118,110,0.9)]",
                                    )
                                  : isDisabled
                                    ? cn(
                                      "cursor-not-allowed text-olive/28",
                                        isSheetPanel ? "rounded-lg" : "rounded-md",
                                      )
                                    : cell.isWeekend
                                      ? cn(
                                          "text-terra hover:bg-cream",
                                          isSheetPanel ? "rounded-lg" : "rounded-md",
                                        )
                                      : cn(
                                          "text-olive hover:bg-cream",
                                          isSheetPanel ? "rounded-lg" : "rounded-md",
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
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

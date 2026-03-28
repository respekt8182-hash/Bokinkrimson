"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { FieldAdornmentIcon } from "@/components/ui/field-adornment-icon";
import { cn } from "@/lib/cn";

type HousingSearchDateRangeFieldProps = {
  initialCheckIn: string;
  initialCheckOut: string;
  onRangeChange?: (range: DateRangeState) => void;
  autoSubmitOnComplete?: boolean;
  showHiddenInputs?: boolean;
  buttonClassName?: string;
};

type DateRangeState = {
  checkIn: string;
  checkOut: string;
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
const calendarMonthCount = 14;
const popoverExitDurationMs = 250;

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

function getNightsCount(checkIn: string, checkOut: string): number {
  const from = parseIsoParts(checkIn);
  const to = parseIsoParts(checkOut);

  if (!from || !to) {
    return 0;
  }

  const checkInUtc = Date.UTC(from.year, from.month - 1, from.day);
  const checkOutUtc = Date.UTC(to.year, to.month - 1, to.day);

  if (checkOutUtc <= checkInUtc) {
    return 0;
  }

  return Math.round((checkOutUtc - checkInUtc) / 86_400_000);
}

function pluralizeNights(value: number): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;

  if (abs > 10 && abs < 20) {
    return "ночей";
  }
  if (mod > 1 && mod < 5) {
    return "ночи";
  }
  if (mod === 1) {
    return "ночь";
  }

  return "ночей";
}

function formatDayMonth(iso: string, includeYear: boolean): string {
  const parsed = parseIsoParts(iso);
  if (!parsed) {
    return "";
  }

  const base = `${parsed.day} ${monthNamesGenitive[parsed.month - 1]}`;
  return includeYear ? `${base} ${yearFormatter.format(parsed.year)}` : base;
}

function formatDateFieldValue(checkIn: string, checkOut: string): string {
  if (!checkIn) {
    return "Даты";
  }

  if (!checkOut) {
    return formatDayMonth(checkIn, false) || "Даты";
  }

  const from = parseIsoParts(checkIn);
  const to = parseIsoParts(checkOut);
  if (!from || !to) {
    return "Даты";
  }

  const nights = getNightsCount(checkIn, checkOut);
  const nightsPart = `${nights} ${pluralizeNights(nights)}`;

  if (from.year === to.year && from.month === to.month) {
    return `${from.day} - ${to.day} ${monthNamesGenitive[to.month - 1]}, ${nightsPart}`;
  }

  const includeYear = from.year !== to.year;
  const fromPart = formatDayMonth(checkIn, includeYear);
  const toPart = formatDayMonth(checkOut, true);
  return `${fromPart} - ${toPart}, ${nightsPart}`;
}

function normalizeInitialRange(checkIn: string, checkOut: string): DateRangeState {
  const normalizedCheckIn = parseIsoParts(checkIn) ? checkIn : "";
  const normalizedCheckOut =
    normalizedCheckIn && parseIsoParts(checkOut) && checkOut > normalizedCheckIn ? checkOut : "";

  return {
    checkIn: normalizedCheckIn,
    checkOut: normalizedCheckOut,
  };
}

export function HousingSearchDateRangeField({
  initialCheckIn,
  initialCheckOut,
  onRangeChange,
  autoSubmitOnComplete = true,
  showHiddenInputs = true,
  buttonClassName,
}: HousingSearchDateRangeFieldProps) {
  // Client-only date picker inside server-rendered search form.
  // We keep local state and sync it back through hidden inputs.
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);
  const calendarMonths = useMemo(
    () => buildCalendarMonths(monthStart, calendarMonthCount),
    [monthStart],
  );
  const normalizedInitialRange = useMemo(
    () => normalizeInitialRange(initialCheckIn, initialCheckOut),
    [initialCheckIn, initialCheckOut],
  );
  const [range, setRange] = useState<DateRangeState>(normalizedInitialRange);
  const [isOpen, setIsOpen] = useState(false);
  const [isPanelMounted, setIsPanelMounted] = useState(false);
  // Prevents submitting the form before React flushes updated hidden inputs.
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [hoverDate, setHoverDate] = useState("");
  const [activeMonthKey, setActiveMonthKey] = useState<string>(
    getMonthKeyFromIso(normalizedInitialRange.checkIn) ??
      getMonthKeyFromIso(todayIso) ??
      calendarMonths[0]?.key ??
      "",
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const monthListRef = useRef<HTMLDivElement | null>(null);
  const monthSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closePanelTimerRef = useRef<number | null>(null);

  const fieldValue = useMemo(
    () => formatDateFieldValue(range.checkIn, range.checkOut),
    [range.checkIn, range.checkOut],
  );
  const previewCheckOut = useMemo(() => {
    if (range.checkOut) {
      return range.checkOut;
    }

    if (!range.checkIn || !hoverDate || hoverDate <= range.checkIn) {
      return "";
    }

    return hoverDate;
  }, [hoverDate, range.checkIn, range.checkOut]);

  const clearClosePanelTimer = useCallback(() => {
    if (closePanelTimerRef.current === null) {
      return;
    }

    window.clearTimeout(closePanelTimerRef.current);
    closePanelTimerRef.current = null;
  }, []);

  const submitSearchForm = useCallback(() => {
    const form = rootRef.current?.closest("form");
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setHoverDate("");
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

  const openPanel = useCallback(() => {
    const preferredMonthKey =
      getMonthKeyFromIso(range.checkIn) ?? getMonthKeyFromIso(todayIso) ?? calendarMonths[0]?.key ?? "";
    if (preferredMonthKey) {
      setActiveMonthKey(preferredMonthKey);
    }
    clearClosePanelTimer();
    setIsPanelMounted(true);
    setIsOpen(true);
  }, [calendarMonths, clearClosePanelTimer, range.checkIn, todayIso]);

  const pickDate = useCallback(
    (iso: string) => {
      if (iso < todayIso) {
        return;
      }

      if (!range.checkIn || range.checkOut) {
        setRange({
          checkIn: iso,
          checkOut: "",
        });
        setHoverDate("");
        return;
      }

      if (iso <= range.checkIn) {
        setRange({
          checkIn: iso,
          checkOut: "",
        });
        setHoverDate("");
        return;
      }

      setRange({
        checkIn: range.checkIn,
        checkOut: iso,
      });
      setHoverDate("");
      if (autoSubmitOnComplete) {
        // Submit is deferred to effect below to avoid stale checkOut in GET params.
        setPendingSubmit(true);
      }
      closePanel();
    },
    [autoSubmitOnComplete, closePanel, range.checkIn, range.checkOut, todayIso],
  );

  useEffect(() => {
    setRange(normalizedInitialRange);
  }, [normalizedInitialRange]);

  useEffect(() => {
    onRangeChange?.(range);
  }, [onRangeChange, range]);

  useEffect(() => {
    if (!activeMonthKey && calendarMonths[0]?.key) {
      setActiveMonthKey(calendarMonths[0].key);
    }
  }, [activeMonthKey, calendarMonths]);

  useEffect(() => {
    if (!pendingSubmit) {
      return;
    }
    if (!range.checkIn || !range.checkOut) {
      return;
    }

    setPendingSubmit(false);
    submitSearchForm();
  }, [pendingSubmit, range.checkIn, range.checkOut, submitSearchForm]);

  useEffect(() => {
    if (!isOpen || !range.checkIn || range.checkOut) {
      setHoverDate("");
    }
  }, [isOpen, range.checkIn, range.checkOut]);

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

    const raf = window.requestAnimationFrame(() => {
      if (activeMonthKey) {
        scrollToMonth(activeMonthKey, "auto");
      }
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [activeMonthKey, isOpen, scrollToMonth]);

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
    <div ref={rootRef} className={cn("relative", isOpen ? "z-[11000] xl:z-[4000]" : "")}>
      {showHiddenInputs && range.checkIn ? <input type="hidden" name="checkIn" value={range.checkIn} /> : null}
      {showHiddenInputs && range.checkOut ? <input type="hidden" name="checkOut" value={range.checkOut} /> : null}

      <button
        type="button"
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
          "relative h-[62px] w-full rounded-2xl border border-sand bg-white px-4 text-left text-olive transition hover:border-olive/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/35",
          buttonClassName,
        )}
      >
        <div className="truncate pr-12 text-sm font-semibold">{fieldValue}</div>
        <FieldAdornmentIcon icon={CalendarDays} shellClassName="right-3.5" />
      </button>

      {isPanelMounted ? (
        <>
          <button
            type="button"
            className={cn(
              "fixed inset-0 z-[10990] bg-primary/30 xl:hidden",
              isOpen ? "popover-overlay-enter" : "popover-overlay-exit pointer-events-none",
            )}
            onClick={closePanel}
            aria-label="Закрыть календарь"
          />
          <div
            className={cn(
              "animated-popover date-picker-sheet fixed inset-x-2 bottom-2 top-auto z-[11000] max-h-[88dvh] overflow-hidden overscroll-y-contain rounded-2xl border ring-olive/12 bg-white p-3 shadow-[0_-8px_32px_-8px_rgba(15,118,110,0.28)] min-[480px]:inset-x-4 min-[480px]:bottom-3 sm:inset-x-5 sm:p-4 md:inset-x-8 md:bottom-4 md:max-h-[84dvh] xl:absolute xl:left-0 xl:right-auto xl:top-[calc(100%+8px)] xl:bottom-auto xl:z-[4000] xl:w-[min(92vw,840px)] xl:max-h-none xl:overflow-visible xl:p-4 xl:shadow-[0_18px_40px_-20px_rgba(15,118,110,0.55)]",
              isOpen ? "popover-enter" : "popover-exit pointer-events-none",
            )}
          >
            <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-olive/20 xl:hidden" />
            <div className="grid gap-3 xl:grid-cols-[180px_minmax(0,1fr)]">
              <aside className="hidden max-h-[420px] overflow-y-auto rounded-xl bg-cream/65 p-2 xl:block">
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
                <div className="mb-3 flex items-center justify-between rounded-xl bg-cream/75 px-3 py-2 text-xs text-olive/80">
                  {range.checkIn && !range.checkOut ? (
                    <span>Выберите дату выезда</span>
                  ) : (
                    <span>Выберите даты проживания</span>
                  )}
                </div>

                <div
                  ref={monthListRef}
                  className="max-h-[68dvh] touch-pan-y overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch] min-[480px]:max-h-[70dvh] md:max-h-[66dvh] xl:max-h-[410px]"
                  onMouseLeave={() => {
                    if (range.checkIn && !range.checkOut) {
                      setHoverDate("");
                    }
                  }}
                >
                  {calendarMonths.map((month) => (
                    <div
                      key={month.key}
                      ref={(node) => {
                        monthSectionRefs.current[month.key] = node;
                      }}
                      className="mb-5 last:mb-0"
                    >
                      <h3 className="text-sm font-semibold text-olive">{month.label}</h3>
                      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-olive/55">
                        {weekdayLabels.map((weekday) => (
                          <span key={`${month.key}-${weekday}`}>{weekday}</span>
                        ))}
                      </div>
                      <div className="mt-1 grid grid-cols-7 gap-1">
                        {month.cells.map((cell, cellIndex) => {
                          const iso = cell.iso;

                          if (!iso || !cell.day) {
                            return (
                              <span
                                key={`${month.key}-blank-${cellIndex}`}
                                className="h-10 rounded-lg min-[390px]:h-11 min-[480px]:h-12 xl:h-9"
                                aria-hidden="true"
                              />
                            );
                          }

                          const isDisabled = iso < todayIso;
                          const isStart = iso === range.checkIn;
                          const isEnd = iso === previewCheckOut;
                          const hasRange = Boolean(
                            range.checkIn && previewCheckOut && previewCheckOut > range.checkIn,
                          );
                          const isMiddle = Boolean(
                            range.checkIn &&
                              previewCheckOut &&
                              iso > range.checkIn &&
                              iso < previewCheckOut,
                          );
                          const isRangeStart = isStart && hasRange;
                          const isRangeEnd = isEnd && hasRange;
                          const isSelected = isStart || isEnd;
                          const isPreviewEnd = !range.checkOut && isRangeEnd;

                          return (
                            <button
                              key={iso}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => pickDate(iso)}
                              onMouseEnter={() => {
                                if (!range.checkIn || range.checkOut || isDisabled) {
                                  return;
                                }
                                setHoverDate(iso > range.checkIn ? iso : "");
                              }}
                              onFocus={() => {
                                if (!range.checkIn || range.checkOut || isDisabled) {
                                  return;
                                }
                                setHoverDate(iso > range.checkIn ? iso : "");
                              }}
                              className={cn(
                                "h-10 touch-manipulation text-sm transition-all duration-200 ease-out min-[390px]:h-11 min-[480px]:h-12 xl:h-9",
                                isSelected
                                  ? isRangeStart
                                    ? "rounded-l-lg rounded-r-[4px] bg-primary font-semibold text-white shadow-[0_5px_14px_-8px_rgba(15,118,110,0.9)]"
                                    : isRangeEnd
                                      ? cn(
                                          "rounded-r-lg rounded-l-[4px] font-semibold text-white shadow-[0_5px_14px_-8px_rgba(15,118,110,0.9)]",
                                          isPreviewEnd ? "calendar-range-pulse bg-primary/92" : "bg-primary",
                                        )
                                      : "rounded-lg bg-primary font-semibold text-white shadow-[0_5px_14px_-8px_rgba(15,118,110,0.9)]"
                                  : isMiddle
                                    ? "rounded-none bg-foam text-olive"
                                    : isDisabled
                                      ? "cursor-not-allowed rounded-lg text-olive/28"
                                      : cell.isWeekend
                                        ? "rounded-lg text-terra hover:bg-cream"
                                        : "rounded-lg text-olive hover:bg-cream",
                                iso === todayIso && !isSelected && !isMiddle
                                  ? "ring-1 ring-sage/45"
                                  : "",
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

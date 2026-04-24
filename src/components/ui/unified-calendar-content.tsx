"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type CalendarRangeValue = {
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

type UnifiedCalendarCommonProps = {
  className?: string;
  monthCount?: number;
  minDate?: string;
  maxDate?: string;
  renderHeaderAside?: ReactNode;
  onComplete?: () => void;
};

type UnifiedCalendarRangeProps = UnifiedCalendarCommonProps & {
  mode: "range";
  value: CalendarRangeValue;
  onChange: (nextValue: CalendarRangeValue) => void;
  promptLabel?: string;
  rangeContinuationLabel?: string;
};

type UnifiedCalendarSingleProps = UnifiedCalendarCommonProps & {
  mode: "single";
  value: string;
  onChange: (nextValue: string) => void;
  promptLabel?: string;
};

export type UnifiedCalendarContentProps =
  | UnifiedCalendarRangeProps
  | UnifiedCalendarSingleProps;

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

const weekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
const defaultCalendarMonthCount = 14;

const yearFormatter = new Intl.NumberFormat("ru-RU", {
  useGrouping: false,
});

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoParts(iso: string): { year: number; month: number; day: number } | null {
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

  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day
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
      const weekday = (date.getDay() + 6) % 7;

      cells.push({
        iso: toIsoDate(date),
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
      key: getMonthKey(year, month),
      label: `${monthNamesNominative[month]} ${yearFormatter.format(year)}`,
      cells,
    });
  }

  return months;
}

function isIsoWithinBounds(iso: string, minDate: string, maxDate: string): boolean {
  if (minDate && iso < minDate) {
    return false;
  }

  if (maxDate && iso > maxDate) {
    return false;
  }

  return true;
}

function getRangePreviewEnd(value: CalendarRangeValue, hoverDate: string): string {
  if (value.checkOut) {
    return value.checkOut;
  }

  if (!value.checkIn || !hoverDate || hoverDate <= value.checkIn) {
    return "";
  }

  return hoverDate;
}

export function UnifiedCalendarContent(props: UnifiedCalendarContentProps) {
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const normalizedMinDate = useMemo(() => {
    const candidate = props.minDate ?? todayIso;
    return parseIsoParts(candidate) ? candidate : todayIso;
  }, [props.minDate, todayIso]);
  const normalizedMaxDate = useMemo(
    () => (parseIsoParts(props.maxDate ?? "") ? (props.maxDate as string) : ""),
    [props.maxDate],
  );
  const monthStart = useMemo(() => {
    const minDateParts = parseIsoParts(normalizedMinDate);
    if (minDateParts) {
      return new Date(minDateParts.year, minDateParts.month - 1, 1);
    }

    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [normalizedMinDate]);
  const calendarMonths = useMemo(
    () => buildCalendarMonths(monthStart, Math.max(1, props.monthCount ?? defaultCalendarMonthCount)),
    [monthStart, props.monthCount],
  );
  const selectedStartIso = props.mode === "range" ? props.value.checkIn : props.value;
  const preferredMonthKey =
    getMonthKeyFromIso(selectedStartIso) ??
    getMonthKeyFromIso(normalizedMinDate) ??
    calendarMonths[0]?.key ??
    "";
  const [activeMonthKey, setActiveMonthKey] = useState(
    preferredMonthKey,
  );
  const [hoverDate, setHoverDate] = useState("");
  const monthListRef = useRef<HTMLDivElement | null>(null);
  const monthSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const effectiveHoverDate =
    props.mode === "range" &&
    props.value.checkIn &&
    !props.value.checkOut &&
    hoverDate > props.value.checkIn
      ? hoverDate
      : "";
  const resolvedActiveMonthKey = activeMonthKey || preferredMonthKey;

  const previewRangeEnd =
    props.mode === "range" ? getRangePreviewEnd(props.value, effectiveHoverDate) : "";
  const headerLabel =
    props.mode === "range"
      ? props.value.checkIn && !props.value.checkOut
        ? (props.rangeContinuationLabel ?? "Выберите дату выезда")
        : (props.promptLabel ?? "Выберите даты проживания")
      : (props.promptLabel ?? "Выберите дату");

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

    setActiveMonthKey((current) => (current === nextActiveMonthKey ? current : nextActiveMonthKey));
  }, [calendarMonths]);

  const handleDateSelect = useCallback(
    (iso: string) => {
      if (!isIsoWithinBounds(iso, normalizedMinDate, normalizedMaxDate)) {
        return;
      }

      if (props.mode === "single") {
        props.onChange(iso);
        props.onComplete?.();
        return;
      }

      if (!props.value.checkIn || props.value.checkOut) {
        props.onChange({
          checkIn: iso,
          checkOut: "",
        });
        setHoverDate("");
        return;
      }

      if (iso <= props.value.checkIn) {
        props.onChange({
          checkIn: iso,
          checkOut: "",
        });
        setHoverDate("");
        return;
      }

      props.onChange({
        checkIn: props.value.checkIn,
        checkOut: iso,
      });
      setHoverDate("");
      props.onComplete?.();
    },
    [normalizedMaxDate, normalizedMinDate, props],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (preferredMonthKey) {
        scrollToMonth(preferredMonthKey, "auto");
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [preferredMonthKey, scrollToMonth]);

  useEffect(() => {
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
  }, [syncActiveMonthFromScroll]);

  return (
    <div className={cn("grid gap-3 xl:grid-cols-[180px_minmax(0,1fr)]", props.className)}>
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
              month.key === resolvedActiveMonthKey
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
          <span>{headerLabel}</span>
          {props.renderHeaderAside}
        </div>

        <div
          ref={monthListRef}
          className="max-h-[68dvh] touch-pan-y overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch] min-[480px]:max-h-[70dvh] md:max-h-[66dvh] xl:max-h-[410px]"
          onMouseLeave={() => {
            if (props.mode === "range" && props.value.checkIn && !props.value.checkOut) {
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

                  const isDisabled = !isIsoWithinBounds(iso, normalizedMinDate, normalizedMaxDate);
                  const isRangeStart =
                    props.mode === "range" && Boolean(props.value.checkIn && iso === props.value.checkIn);
                  const isRangeEnd =
                    props.mode === "range" && Boolean(previewRangeEnd && iso === previewRangeEnd);
                  const hasRange =
                    props.mode === "range" &&
                    Boolean(
                      props.value.checkIn &&
                        previewRangeEnd &&
                        previewRangeEnd > props.value.checkIn,
                    );
                  const isRangeMiddle =
                    props.mode === "range" &&
                    Boolean(
                      props.value.checkIn &&
                        previewRangeEnd &&
                        iso > props.value.checkIn &&
                        iso < previewRangeEnd,
                    );
                  const isSingleSelected = props.mode === "single" && iso === props.value;
                  const isSelected = isRangeStart || isRangeEnd || isSingleSelected;
                  const isPreviewEnd =
                    props.mode === "range" && !props.value.checkOut && isRangeEnd;

                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleDateSelect(iso)}
                      onMouseEnter={() => {
                        if (
                          props.mode !== "range" ||
                          !props.value.checkIn ||
                          props.value.checkOut ||
                          isDisabled
                        ) {
                          return;
                        }

                        setHoverDate(iso > props.value.checkIn ? iso : "");
                      }}
                      onFocus={() => {
                        if (
                          props.mode !== "range" ||
                          !props.value.checkIn ||
                          props.value.checkOut ||
                          isDisabled
                        ) {
                          return;
                        }

                        setHoverDate(iso > props.value.checkIn ? iso : "");
                      }}
                      className={cn(
                        "h-10 touch-manipulation text-sm transition-all duration-200 ease-out min-[390px]:h-11 min-[480px]:h-12 xl:h-9",
                        isSelected
                          ? isRangeStart && hasRange
                            ? "rounded-l-lg rounded-r-[4px] bg-primary font-semibold text-white shadow-[0_5px_14px_-8px_rgba(15,118,110,0.9)]"
                            : isRangeEnd && hasRange
                              ? cn(
                                  "rounded-r-lg rounded-l-[4px] font-semibold text-white shadow-[0_5px_14px_-8px_rgba(15,118,110,0.9)]",
                                  isPreviewEnd ? "calendar-range-pulse bg-primary/92" : "bg-primary",
                                )
                              : "rounded-lg bg-primary font-semibold text-white shadow-[0_5px_14px_-8px_rgba(15,118,110,0.9)]"
                          : isRangeMiddle
                            ? "rounded-none bg-foam text-olive"
                            : isDisabled
                              ? "cursor-not-allowed rounded-lg text-olive/28"
                              : cell.isWeekend
                                ? "rounded-lg text-terra hover:bg-cream"
                                : "rounded-lg text-olive hover:bg-cream",
                        iso === todayIso && !isSelected && !isRangeMiddle ? "ring-1 ring-sage/45" : "",
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
  );
}

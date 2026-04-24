"use client";

import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveFilterPanel } from "@/components/public/catalog-filter-shell";
import { FieldAdornmentIcon } from "@/components/ui/field-adornment-icon";
import {
  type CalendarRangeValue,
  UnifiedCalendarContent,
  parseIsoParts,
} from "@/components/ui/unified-calendar-content";
import { cn } from "@/lib/cn";

type HousingSearchDateRangeFieldProps = {
  initialCheckIn: string;
  initialCheckOut: string;
  onRangeChange?: (range: CalendarRangeValue) => void;
  autoSubmitOnComplete?: boolean;
  showHiddenInputs?: boolean;
  buttonClassName?: string;
};

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

const yearFormatter = new Intl.NumberFormat("ru-RU", {
  useGrouping: false,
});

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

function formatDateFieldValue(range: CalendarRangeValue): string {
  if (!range.checkIn) {
    return "Даты";
  }

  if (!range.checkOut) {
    return formatDayMonth(range.checkIn, false) || "Даты";
  }

  const from = parseIsoParts(range.checkIn);
  const to = parseIsoParts(range.checkOut);
  if (!from || !to) {
    return "Даты";
  }

  const nights = getNightsCount(range.checkIn, range.checkOut);
  const nightsPart = `${nights} ${pluralizeNights(nights)}`;

  if (from.year === to.year && from.month === to.month) {
    return `${from.day} - ${to.day} ${monthNamesGenitive[to.month - 1]}, ${nightsPart}`;
  }

  const includeYear = from.year !== to.year;
  const fromPart = formatDayMonth(range.checkIn, includeYear);
  const toPart = formatDayMonth(range.checkOut, true);
  return `${fromPart} - ${toPart}, ${nightsPart}`;
}

function normalizeInitialRange(checkIn: string, checkOut: string): CalendarRangeValue {
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
  const normalizedInitialRange = useMemo(
    () => normalizeInitialRange(initialCheckIn, initialCheckOut),
    [initialCheckIn, initialCheckOut],
  );
  const [range, setRange] = useState<CalendarRangeValue>(normalizedInitialRange);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const fieldValue = useMemo(() => formatDateFieldValue(range), [range]);

  useEffect(() => {
    setRange(normalizedInitialRange);
  }, [normalizedInitialRange]);

  useEffect(() => {
    onRangeChange?.(range);
  }, [onRangeChange, range]);

  const submitSearchForm = useCallback(() => {
    const form = rootRef.current?.closest("form");
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }, []);

  useEffect(() => {
    if (!pendingSubmit || !range.checkIn || !range.checkOut) {
      return;
    }

    setPendingSubmit(false);
    submitSearchForm();
  }, [pendingSubmit, range.checkIn, range.checkOut, submitSearchForm]);

  return (
    <div ref={rootRef}>
      {showHiddenInputs && range.checkIn ? <input type="hidden" name="checkIn" value={range.checkIn} /> : null}
      {showHiddenInputs && range.checkOut ? <input type="hidden" name="checkOut" value={range.checkOut} /> : null}

      <ResponsiveFilterPanel
        open={isOpen}
        title="Даты проживания"
        onClose={() => setIsOpen(false)}
        width={840}
        maxHeight={720}
        trigger={
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
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
        }
      >
        <UnifiedCalendarContent
          mode="range"
          value={range}
          onChange={setRange}
          onComplete={() => {
            setIsOpen(false);
            if (autoSubmitOnComplete) {
              setPendingSubmit(true);
            }
          }}
          renderHeaderAside={
            range.checkIn || range.checkOut ? (
              <button
                type="button"
                onClick={() => setRange({ checkIn: "", checkOut: "" })}
                className="rounded-md px-2 py-0.5 text-olive/65 transition hover:bg-foam hover:text-olive"
              >
                Очистить
              </button>
            ) : null
          }
        />
      </ResponsiveFilterPanel>
    </div>
  );
}

// Owner chessboard workspace:
// - occupancy board (bookings/check-in/cancel)
// - prices board (period pricing CRUD)
// - shared calendar navigation and drag-to-select interactions
"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Copy,
  ExternalLink,
  MoreVertical,
  type LucideIcon,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SingleDatePopoverField } from "@/components/ui/single-date-popover-field";
import { cn } from "@/lib/cn";
import type { SerializedRoomOccupancy } from "@/lib/occupancy";
import {
  addDays,
  defaultRoomPriceType,
  getRoomPriceShortUnit,
  getRoomPriceUnitText,
  normalizeRoomPriceType,
  parseIsoDate,
  toIsoDate,
  type RoomPriceType,
  type SerializedRoomPrice,
} from "@/lib/pricing";
import type { SerializedChessboardRoom } from "@/lib/rooms";

type ChessboardPropertyItem = {
  id: string;
  name: string | null;
  statusLabel: string;
  activeRoomsCount: number;
};

type PropertyChessboardWorkspaceProps = {
  properties: ChessboardPropertyItem[];
  initialPropertyId: string | null;
  returnHref?: string | null;
  returnLabel?: string;
  initialBoardMode?: "occupancy" | "prices";
  avoidDashboardBottomNav?: boolean;
};

type ChessboardDay = {
  iso: string;
  dayNumber: number;
  weekDayLabel: string;
  isWeekend: boolean;
  isWeekStart: boolean;
  isMonthStart: boolean;
};

type ChessboardMonthSegment = {
  key: string;
  label: string;
  compactLabel: string;
  daysCount: number;
};

type GroupedRoomBucket = {
  key: string;
  groupLabel: string;
  items: SerializedChessboardRoom[];
};

type GroupedRoomBucketWithOffset = GroupedRoomBucket & {
  rowOffset: number;
};

type RoomPagerEntry = {
  groupLabel: string;
  room: SerializedChessboardRoom;
};

type BookingFormState = {
  editingOccupancyId: string | null;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  status: "CONFIRMED" | "CHECKED_IN";
  adults: number;
  children: number;
  tag: string;
  color: string;
  roomId: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  source: string;
  description: string;
  createdAt: string | null;
};

type BoardMode = "occupancy" | "prices";

type DragSelectionState = {
  roomId: string;
  startIso: string;
  endIso: string;
};

type DragPointer = {
  clientX: number;
  clientY: number;
};

type PriceFormState = {
  roomId: string;
  dateFrom: string;
  dateTo: string;
  priceInput: string;
  priceType: RoomPriceType;
  currency: string;
  minGuestsInput: string;
  minNightsInput: string;
  extraBedPriceInput: string;
  editingPriceId: string | null;
};

type DuplicatePricesFormState = {
  sourceRoomId: string;
  targetRoomIds: string[];
  dateFrom: string;
  dateTo: string;
};

type CopyYearPricesFormState = {
  sourceYearInput: string;
  targetYearInput: string;
  replaceExisting: boolean;
};

type CalendarSyncStatus = "SUCCESS" | "PARTIAL" | "ERROR";

type CalendarSyncConfig = {
  roomId: string;
  exportUrl: string;
  importUrl: string;
  isImportEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: CalendarSyncStatus | null;
  lastSyncMessage: string | null;
  updatedAt: string;
  importSources: CalendarImportSourceConfig[];
};

type CalendarImportSourceConfig = {
  id: string;
  label: string;
  importUrl: string;
  isEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: CalendarSyncStatus | null;
  lastSyncMessage: string | null;
  updatedAt: string;
};

const dayLabels = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;
const monthLabels = [
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
const minVisibleDaysCount = 28;
const maxBoardRangeDaysCount = 370;
const mobileBoardRoomsPerPage = 6;
const mobileRoomsPerPage = 3;
const dayCellWidthDesktopPx = 44;
const dayCellWidthTabletPx = 42;
const dayCellWidthPortraitPx = 36;
const dayCellWidthMobilePx = 36;
const dayCellWidthLandscapePx = 36;
const LS = "[@media(orientation:landscape)_and_(max-height:560px)]";
const dragAutoScrollEdgePx = 72;
const dragAutoScrollMaxStepPx = 18;
const dragAutoExtendDays = 7;
const dragAutoExtendIntervalMs = 180;
const dragAutoExtendScrollEpsilonPx = 4;

function resolveDayCellWidthPx(): number {
  if (typeof window === "undefined") {
    return dayCellWidthDesktopPx;
  }

  if (window.matchMedia("(max-width: 767px) and (orientation: portrait)").matches) {
    return dayCellWidthPortraitPx;
  }
  if (window.matchMedia("(orientation: landscape) and (max-height: 560px)").matches) {
    return dayCellWidthLandscapePx;
  }
  if (window.matchMedia("(min-width: 768px)").matches) {
    return dayCellWidthDesktopPx;
  }
  if (window.matchMedia("(min-width: 640px)").matches) {
    return dayCellWidthTabletPx;
  }
  return dayCellWidthMobilePx;
}

function isMobilePortraitViewport(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(max-width: 767px) and (orientation: portrait)").matches;
}

const bookingColorOptions = [
  { id: "RED", label: "Красный" },
  { id: "ORANGE", label: "Оранжевый" },
  { id: "GREEN", label: "Зелёный" },
  { id: "VIOLET", label: "Фиолетовый" },
] as const;

// Chessboard-specific palette aligned with site olive/terra/sage tones.
const chessboardToneClasses = {
  checkedInBar: "border-[#0f7490]/70 bg-[#22b6c8]/78",
  confirmedGreenBar: "border-[#047857]/72 bg-[#10b981]/78",
  priceBar: "border-[#9a6245]/60 bg-[#d08b63]/76",
  selectedCell: "bg-sage/24",
  selectionRange: "border-terra/45 bg-sage/18 shadow-[inset_0_0_0_1px_rgba(15,118,110,0.16)]",
} as const;
const modalSectionToneBaseClass =
  "wizard-section-enter rounded-[24px] border p-3 sm:p-4";
const modalSectionClass = cn(
  modalSectionToneBaseClass,
  "border-olive/12 bg-[linear-gradient(180deg,rgba(248,242,232,0.86),rgba(255,255,255,0.98))] shadow-sm",
);
const modalPriceRoomSectionClass = cn(
  modalSectionToneBaseClass,
  "border-primary/18 bg-[linear-gradient(135deg,rgba(240,253,250,0.96),rgba(255,255,255,0.98)_52%,rgba(239,232,222,0.78))] shadow-[0_18px_38px_-30px_rgba(15,118,110,0.55)]",
);
const modalPricePeriodSectionClass = cn(
  modalSectionToneBaseClass,
  "border-sage/35 bg-[linear-gradient(135deg,rgba(250,248,245,0.98),rgba(255,255,255,0.96)_48%,rgba(242,196,77,0.22))] shadow-[0_18px_38px_-30px_rgba(180,83,9,0.35)]",
);
const modalPriceValueSectionClass = cn(
  modalSectionToneBaseClass,
  "border-terra/24 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(250,248,245,0.96)_45%,rgba(167,101,73,0.14))] shadow-[0_18px_38px_-30px_rgba(167,101,73,0.42)]",
);
const modalBookingPeriodSectionClass = cn(
  modalSectionToneBaseClass,
  "border-primary/20 bg-[linear-gradient(135deg,rgba(240,253,250,0.98),rgba(255,255,255,0.98)_46%,rgba(14,116,144,0.12))] shadow-[0_18px_38px_-30px_rgba(15,118,110,0.55)]",
);
const modalBookingPhoneSectionClass = cn(
  modalSectionToneBaseClass,
  "border-terra/24 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(250,248,245,0.95)_48%,rgba(167,101,73,0.16))] shadow-[0_18px_38px_-30px_rgba(167,101,73,0.42)]",
);
const modalBookingTimeSectionClass = cn(
  modalSectionToneBaseClass,
  "border-accent/20 bg-[linear-gradient(135deg,rgba(240,253,250,0.93),rgba(255,255,255,0.98)_50%,rgba(14,116,144,0.16))] shadow-[0_18px_38px_-30px_rgba(14,116,144,0.42)]",
);
const modalBookingGuestsSectionClass = cn(
  modalSectionToneBaseClass,
  "border-sage/35 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(250,248,245,0.96)_48%,rgba(242,196,77,0.2))] shadow-[0_18px_38px_-30px_rgba(180,83,9,0.34)]",
);
const modalTextInputClass =
  "min-h-11 rounded-2xl border-olive/15 bg-white shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)]";
const modalSelectClass =
  "w-full rounded-2xl border border-olive/15 bg-white px-3.5 py-3 text-sm text-olive shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/22";
const modalMetaLabelClass = "text-[11px] uppercase tracking-[0.14em] text-olive/50";
const modalMetaPrimaryLabelClass =
  "text-[11px] uppercase tracking-[0.14em] text-primary/70";
const modalMetaWarmLabelClass =
  "text-[11px] uppercase tracking-[0.14em] text-terra-ink/70";
const modalMetaGoldLabelClass =
  "text-[11px] uppercase tracking-[0.14em] text-warning/70";
const modalPickerCardClass =
  "h-full rounded-2xl border border-olive/14 bg-white px-3.5 py-3 shadow-[0_14px_28px_-24px_rgba(60,42,20,0.7)] transition group-hover:border-primary/30 group-focus-within:border-primary/40 group-focus-within:ring-2 group-focus-within:ring-primary/12";
const compactToolbarButtonClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-olive/14 bg-white px-3 py-0 text-[11px] font-semibold text-olive/72 transition hover:bg-cream hover:text-olive sm:h-8 sm:text-xs";
const compactToolbarPrimaryButtonClass =
  "h-9 rounded-lg px-3 py-0 text-[11px] shadow-none sm:h-8 sm:text-xs";
const compactToolbarNavShellClass =
  "inline-grid h-9 min-w-[196px] grid-cols-[32px_minmax(108px,1fr)_32px] items-center gap-1 rounded-lg border border-olive/12 bg-cream/55 p-0.5 sm:h-8 sm:min-w-[220px] sm:grid-cols-[30px_minmax(132px,1fr)_30px]";

function normalizeBookingColor(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase();
  return bookingColorOptions.some((option) => option.id === normalized) ? normalized : "RED";
}

function getOccupancyBarClasses(status: "CONFIRMED" | "CHECKED_IN", color: string | null): string {
  if (status === "CHECKED_IN") {
    return chessboardToneClasses.checkedInBar;
  }

  const normalized = normalizeBookingColor(color);
  switch (normalized) {
    case "ORANGE":
      return "border-amber-500/65 bg-amber-600/78";
    case "GREEN":
      return chessboardToneClasses.confirmedGreenBar;
    case "VIOLET":
      return "border-violet-500/68 bg-violet-600/78";
    case "RED":
    default:
      return "border-terra/58 bg-terra/78";
  }
}

function compareIsoDates(left: string, right: string): number {
  return left.localeCompare(right);
}

function maxIsoDate(left: string, right: string): string {
  return compareIsoDates(left, right) >= 0 ? left : right;
}

function minIsoDate(left: string, right: string): string {
  return compareIsoDates(left, right) <= 0 ? left : right;
}

function getYearStartIso(year: number): string {
  return `${year}-01-01`;
}

function getYearEndIso(year: number): string {
  return `${year}-12-31`;
}

function parseYearInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{4}$/.test(trimmed)) {
    return null;
  }

  const year = Number.parseInt(trimmed, 10);
  return year >= 2000 && year <= 2100 ? year : null;
}

function normalizeIsoRange(startIso: string, endIso: string): { dateFrom: string; dateTo: string } {
  return compareIsoDates(startIso, endIso) <= 0
    ? { dateFrom: startIso, dateTo: endIso }
    : { dateFrom: endIso, dateTo: startIso };
}

function isoDateInRange(dayIso: string, dateFrom: string, dateTo: string): boolean {
  return compareIsoDates(dateFrom, dayIso) <= 0 && compareIsoDates(dayIso, dateTo) <= 0;
}

function periodContainsDate(dateFrom: string, dateTo: string, dayIso: string): boolean {
  return compareIsoDates(dateFrom, dayIso) <= 0 && compareIsoDates(dayIso, dateTo) <= 0;
}

function buildVisibleDays(startIso: string, daysCount: number): ChessboardDay[] {
  const parsed = parseIsoDate(startIso);
  if (!parsed || daysCount <= 0) {
    return [];
  }

  return Array.from({ length: daysCount }).map((_, index) => {
    const date = addDays(parsed, index);
    const weekDayIndex = (date.getUTCDay() + 6) % 7;
    return {
      iso: toIsoDate(date),
      dayNumber: date.getUTCDate(),
      weekDayLabel: dayLabels[weekDayIndex],
      isWeekend: weekDayIndex >= 5,
      isWeekStart: weekDayIndex === 0 && index !== 0,
      isMonthStart: date.getUTCDate() === 1,
    };
  });
}

function formatPeriodHeader(days: ChessboardDay[]): string {
  if (days.length === 0) {
    return "";
  }

  const firstDate = parseIsoDate(days[0].iso);
  const lastDate = parseIsoDate(days[days.length - 1].iso);

  if (!firstDate || !lastDate) {
    return "";
  }

  const firstMonth = firstDate.getUTCMonth();
  const lastMonth = lastDate.getUTCMonth();
  const firstYear = firstDate.getUTCFullYear();
  const lastYear = lastDate.getUTCFullYear();

  if (firstMonth === lastMonth && firstYear === lastYear) {
    return `${monthLabels[firstMonth]} ${firstYear}`;
  }

  if (firstYear === lastYear) {
    return `${monthLabels[firstMonth]} - ${monthLabels[lastMonth]} ${firstYear}`;
  }

  return `${monthLabels[firstMonth]} ${firstYear} - ${monthLabels[lastMonth]} ${lastYear}`;
}

function formatCompactMonthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1))
    .toLocaleDateString("ru-RU", { month: "short" })
    .replace(".", "");
}

function buildMonthSegments(days: ChessboardDay[]): ChessboardMonthSegment[] {
  const segments: ChessboardMonthSegment[] = [];

  for (const day of days) {
    const parsed = parseIsoDate(day.iso);
    if (!parsed) {
      continue;
    }

    const year = parsed.getUTCFullYear();
    const monthIndex = parsed.getUTCMonth();
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const existingSegment = segments[segments.length - 1];

    if (existingSegment?.key === key) {
      existingSegment.daysCount += 1;
      continue;
    }

    segments.push({
      key,
      label: `${monthLabels[monthIndex]} ${year}`,
      compactLabel: formatCompactMonthLabel(year, monthIndex),
      daysCount: 1,
    });
  }

  return segments;
}

function formatDateLabel(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) {
    return iso;
  }
  return parsed.toLocaleDateString("ru-RU");
}

function formatDateRangeLabel(dateFromIso: string, dateToIso: string): string {
  if (dateFromIso === dateToIso) {
    return formatDateLabel(dateFromIso);
  }
  return `${formatDateLabel(dateFromIso)} - ${formatDateLabel(dateToIso)}`;
}

function getLocalTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToIsoDate(dateIso: string, days: number): string {
  const parsed = parseIsoDate(dateIso);
  if (!parsed) {
    return dateIso;
  }

  return toIsoDate(addDays(parsed, days));
}

function getInclusiveDateRangeDays(dateFromIso: string, dateToIso: string): number {
  const dateFrom = parseIsoDate(dateFromIso);
  const dateTo = parseIsoDate(dateToIso);
  if (!dateFrom || !dateTo || dateTo < dateFrom) {
    return 0;
  }

  return Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86400000) + 1;
}

function getDefaultPeriodEndIso(dateFromIso: string): string {
  return addDaysToIsoDate(dateFromIso, minVisibleDaysCount - 1);
}

function clampPeriodEndIso(
  dateFromIso: string,
  dateToIso: string,
): { dateToIso: string; wasClamped: boolean } {
  const daysCount = getInclusiveDateRangeDays(dateFromIso, dateToIso);
  if (daysCount <= maxBoardRangeDaysCount) {
    return { dateToIso, wasClamped: false };
  }

  return {
    dateToIso: addDaysToIsoDate(dateFromIso, maxBoardRangeDaysCount - 1),
    wasClamped: true,
  };
}

function clampPeriodStartIso(
  dateFromIso: string,
  dateToIso: string,
): { dateFromIso: string; wasClamped: boolean } {
  const daysCount = getInclusiveDateRangeDays(dateFromIso, dateToIso);
  if (daysCount <= maxBoardRangeDaysCount) {
    return { dateFromIso, wasClamped: false };
  }

  return {
    dateFromIso: addDaysToIsoDate(dateToIso, -(maxBoardRangeDaysCount - 1)),
    wasClamped: true,
  };
}

function getStayNights(dateFromIso: string, dateToIso: string): number {
  const dateFrom = parseIsoDate(dateFromIso);
  const dateTo = parseIsoDate(dateToIso);
  if (!dateFrom || !dateTo) {
    return 0;
  }

  const diffDays = Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86400000);
  return Math.max(1, diffDays);
}

function formatNightsLabel(nights: number): string {
  const abs = Math.abs(nights) % 100;
  const last = abs % 10;

  if (abs >= 11 && abs <= 14) {
    return `${nights} ночей`;
  }
  if (last === 1) {
    return `${nights} ночь`;
  }
  if (last >= 2 && last <= 4) {
    return `${nights} ночи`;
  }
  return `${nights} ночей`;
}

function formatTimeValueLabel(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "Не указано";
}

function formatTimeRangeLabel(timeFrom: string, timeTo: string): string {
  const normalizedFrom = timeFrom.trim();
  const normalizedTo = timeTo.trim();

  if (normalizedFrom && normalizedTo) {
    return `${normalizedFrom} - ${normalizedTo}`;
  }
  if (normalizedFrom) {
    return `Заезд с ${normalizedFrom}`;
  }
  if (normalizedTo) {
    return `Выезд до ${normalizedTo}`;
  }
  return "Весь день";
}

function formatCountLabel(value: number, forms: [string, string, string]): string {
  const abs = Math.abs(value) % 100;
  const last = abs % 10;

  if (abs >= 11 && abs <= 14) {
    return `${value} ${forms[2]}`;
  }
  if (last === 1) {
    return `${value} ${forms[0]}`;
  }
  if (last >= 2 && last <= 4) {
    return `${value} ${forms[1]}`;
  }
  return `${value} ${forms[2]}`;
}

function formatGuestPartyLabel(adults: number, children: number): string {
  const adultsLabel = formatCountLabel(adults, ["взрослый", "взрослых", "взрослых"]);

  if (children <= 0) {
    return adultsLabel;
  }

  const childrenLabel = formatCountLabel(children, ["ребенок", "ребенка", "детей"]);
  return `${adultsLabel} • ${childrenLabel}`;
}

function getBookingColorLabel(color: string | null | undefined): string {
  const normalized = normalizeBookingColor(color);
  return (
    bookingColorOptions.find((option) => option.id === normalized)?.label ??
    bookingColorOptions[0].label
  );
}

function getCalendarSyncStatusLabel(status: CalendarSyncStatus | null): string {
  switch (status) {
    case "SUCCESS":
      return "Успешно";
    case "PARTIAL":
      return "Частично";
    case "ERROR":
      return "Ошибка";
    default:
      return "Ожидает первой проверки";
  }
}

function getCalendarSyncStatusClass(status: CalendarSyncStatus | null): string {
  switch (status) {
    case "SUCCESS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PARTIAL":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ERROR":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-olive/12 bg-white text-olive/60";
  }
}

function formatCalendarSyncDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("ru-RU") : "Еще не запускалась";
}

function normalizeCalendarImportSources(config: CalendarSyncConfig): CalendarImportSourceConfig[] {
  if (Array.isArray(config.importSources) && config.importSources.length > 0) {
    return config.importSources;
  }

  if (!config.importUrl.trim()) {
    return [];
  }

  return [
    {
      id: "legacy",
      label: "Основной календарь",
      importUrl: config.importUrl,
      isEnabled: config.isImportEnabled,
      lastSyncedAt: config.lastSyncedAt,
      lastSyncStatus: config.lastSyncStatus,
      lastSyncMessage: config.lastSyncMessage,
      updatedAt: config.updatedAt,
    },
  ];
}

function buildInitialBookingForm(input: {
  defaultRoomId: string;
  dateFrom: string;
  dateTo: string;
}): BookingFormState {
  return {
    editingOccupancyId: null,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    timeFrom: "14:00",
    timeTo: "12:00",
    status: "CONFIRMED",
    adults: 2,
    children: 0,
    tag: "",
    color: "GREEN",
    roomId: input.defaultRoomId,
    contactName: "",
    phone: "",
    email: "",
    website: "",
    source: "",
    description: "",
    createdAt: null,
  };
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isWebsiteLike(value: string): boolean {
  const normalized = value.trim();
  return /^https?:\/\/\S+$/i.test(normalized) || /^www\.\S+$/i.test(normalized);
}

function parseGuestContacts(value: string | null): { email: string; website: string } {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return { email: "", website: "" };
  }

  const parts = normalized
    .split(/[|,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  let email = "";
  let website = "";

  for (const part of parts) {
    if (!email && isEmailLike(part)) {
      email = part;
      continue;
    }
    if (!website && isWebsiteLike(part)) {
      website = part;
    }
  }

  if (!email && !website) {
    if (isEmailLike(normalized)) {
      email = normalized;
    } else if (isWebsiteLike(normalized)) {
      website = normalized;
    }
  }

  return { email, website };
}

function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readResponseError(body: unknown, fallback: string): string {
  if (typeof body === "object" && body && "error" in body) {
    const value = (body as { error?: unknown }).error;
    if (typeof value === "string" && value.trim().length > 0) {
      const normalizedValue = value.toLowerCase();
      return normalizedValue.includes("миграц") && normalizedValue.includes("календар")
        ? "Синхронизация календарей пока недоступна. Попробуйте позже."
        : value;
    }
  }
  return fallback;
}

const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatPriceLabel(price: SerializedRoomPrice): string {
  const amount = ruNumberFormat.format(price.price);
  const unitSuffix = normalizeRoomPriceType(price.priceType) === "PER_PERSON" ? "/чел" : "";
  return `${amount} ${price.currency}${unitSuffix}`;
}

function formatPriceRestrictionLabel(price: SerializedRoomPrice): string {
  const parts = [
    price.minGuests === null ? null : `От ${price.minGuests} гостей`,
    price.minNights === null
      ? null
      : `от ${price.minNights} ${price.minNights === 1 ? "ночи" : "ночей"}`,
    price.extraBedPrice === null
      ? null
      : `доп. место ${ruNumberFormat.format(price.extraBedPrice)} ${price.currency}`,
  ].filter((item): item is string => Boolean(item));

  return parts.length > 0 ? parts.join(" · ") : "Любой состав и срок";
}

function truncateToLength(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function formatRoomMeta(room: SerializedChessboardRoom): string {
  const parts = [`${room.roomsCount} ком.`, `${room.beds + room.extraBeds} гост.`];

  if (room.areaSqm !== null) {
    parts.push(`${room.areaSqm}м²`);
  }

  return parts.join(" | ");
}

function getGroupShortLabel(groupLabel: string): string {
  const [, rawLabel = groupLabel] = groupLabel.split(":");
  return rawLabel.trim();
}

function buildCompactPreviewLabel(value: string, maxLetters = 3): string {
  const explicitRoomNumber = extractExplicitRoomNumber(value);
  if (explicitRoomNumber !== null) {
    return `#${explicitRoomNumber}`;
  }

  const normalized = value
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (normalized.length >= 2) {
    return normalized
      .slice(0, maxLetters)
      .map((word) => Array.from(word)[0] ?? "")
      .join("")
      .toUpperCase();
  }

  const fallback = Array.from(normalized[0] ?? value.trim())
    .slice(0, maxLetters)
    .join("")
    .toUpperCase();
  return fallback || "#";
}

function normalizeRoomSortText(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е");
}

function extractFloorNumber(title: string): number | null {
  const normalized = normalizeRoomSortText(title);
  const match = normalized.match(/(^|[^\d])(\d{1,3})\s*(?:-?\s*)?(?:этаж|эт\.?)/iu);
  if (!match?.[2]) {
    return null;
  }

  const floor = Number.parseInt(match[2], 10);
  return Number.isFinite(floor) ? floor : null;
}

function extractExplicitRoomNumber(title: string): number | null {
  const normalized = normalizeRoomSortText(title);
  const patterns = [
    /(?:№|#|n\s*|номер\s+|комната\s+|апартаменты\s+)(\d{1,4})/iu,
    /^(\d{1,4})(?=\s|$|[.,:;/-])/iu,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const rawNumber = match?.[1];
    if (!rawNumber) {
      continue;
    }

    const roomNumber = Number.parseInt(rawNumber, 10);
    if (Number.isFinite(roomNumber)) {
      return roomNumber;
    }
  }

  return null;
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: "asc" | "desc",
): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }

  return direction === "asc" ? left - right : right - left;
}

function compareRoomsForChessboard(
  left: SerializedChessboardRoom,
  right: SerializedChessboardRoom,
): number {
  const floorComparison = compareNullableNumbers(
    extractFloorNumber(left.title),
    extractFloorNumber(right.title),
    "asc",
  );
  if (floorComparison !== 0) {
    return floorComparison;
  }

  const explicitRoomNumberComparison = compareNullableNumbers(
    extractExplicitRoomNumber(left.title),
    extractExplicitRoomNumber(right.title),
    "desc",
  );
  if (explicitRoomNumberComparison !== 0) {
    return explicitRoomNumberComparison;
  }

  const leftCapacity = left.beds + left.extraBeds;
  const rightCapacity = right.beds + right.extraBeds;
  if (leftCapacity !== rightCapacity) {
    return rightCapacity - leftCapacity;
  }

  const leftArea = left.areaSqm ?? 0;
  const rightArea = right.areaSqm ?? 0;
  if (leftArea !== rightArea) {
    return rightArea - leftArea;
  }

  return left.title.localeCompare(right.title, "ru", {
    numeric: true,
    sensitivity: "base",
  });
}

function addGroupOffsets(
  groups: GroupedRoomBucket[],
  initialOffset = 0,
): GroupedRoomBucketWithOffset[] {
  let offset = initialOffset;

  return groups.map((group) => {
    const result = { ...group, rowOffset: offset };
    offset += group.items.length;
    return result;
  });
}

function buildBookingDescription(form: BookingFormState): string | null {
  const value = form.description.trim();
  return value ? truncateToLength(value, 250) : null;
}

function buildGuestContacts(form: BookingFormState): string | null {
  const email = normalizeOptionalText(form.email);
  const website = normalizeOptionalText(form.website);

  if (!email && !website) {
    return null;
  }

  return truncateToLength([email, website].filter(Boolean).join(" | "), 255);
}

type OverlayPickerFieldProps = {
  label: string;
  valueLabel: string;
  promptLabel: string;
  inputType: "date" | "time";
  inputValue: string;
  onChange: (value: string) => void;
  icon: LucideIcon;
  labelClassName?: string;
  iconShellClassName?: string;
  promptClassName?: string;
};

function OverlayPickerField({
  label,
  valueLabel,
  promptLabel,
  inputType,
  inputValue,
  onChange,
  icon,
  labelClassName,
  iconShellClassName,
  promptClassName,
}: OverlayPickerFieldProps) {
  return (
    <label className="group relative block">
      <div className={modalPickerCardClass}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={labelClassName ?? modalMetaLabelClass}>{label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-olive sm:text-[15px]">
              {valueLabel}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
              iconShellClassName,
            )}
          >
            <AppIcon icon={icon} className="h-4 w-4" />
          </span>
        </div>
        <span
          className={cn(
            "mt-3 inline-flex items-center rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-semibold text-primary/85",
            promptClassName,
          )}
        >
          {promptLabel}
        </span>
      </div>
      <Input
        type={inputType}
        value={inputValue}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="absolute inset-0 h-full cursor-pointer opacity-0"
      />
    </label>
  );
}

export function PropertyChessboardWorkspace({
  properties,
  initialPropertyId,
  returnHref = null,
  returnLabel = "Вернуться",
  initialBoardMode = "occupancy",
  avoidDashboardBottomNav = false,
}: PropertyChessboardWorkspaceProps) {
  const initialTodayIso = useMemo(() => getLocalTodayIso(), []);
  const initialPeriodEndIso = useMemo(
    () => getDefaultPeriodEndIso(initialTodayIso),
    [initialTodayIso],
  );
  // UI state (menus/modals), dataset state (rooms/occupancies), and edit forms live together
  // because all calendar interactions need synchronized updates.
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    initialPropertyId ?? properties[0]?.id ?? null,
  );
  const [periodStartIso, setPeriodStartIso] = useState(initialTodayIso);
  const [periodEndIso, setPeriodEndIso] = useState(initialPeriodEndIso);
  const [boardMode, setBoardMode] = useState<BoardMode>(initialBoardMode);
  const [isObjectMenuOpen, setIsObjectMenuOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isPriceExtraSectionOpen, setIsPriceExtraSectionOpen] = useState(false);
  const [isDuplicatePricesModalOpen, setIsDuplicatePricesModalOpen] = useState(false);
  const [isCopyYearPricesModalOpen, setIsCopyYearPricesModalOpen] = useState(false);
  const [isCalendarSyncModalOpen, setIsCalendarSyncModalOpen] = useState(false);
  const [isOccupancyActionsOpen, setIsOccupancyActionsOpen] = useState(false);
  const [isRoomOrderMode, setIsRoomOrderMode] = useState(false);
  const [rooms, setRooms] = useState<SerializedChessboardRoom[]>([]);
  const [occupanciesByRoom, setOccupanciesByRoom] = useState<
    Record<string, SerializedRoomOccupancy[]>
  >({});
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingOccupancies, setIsLoadingOccupancies] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [isReorderingRooms, setIsReorderingRooms] = useState(false);
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);
  const [messageError, setMessageError] = useState("");
  const [messageSuccess, setMessageSuccess] = useState("");
  const [bookingModalError, setBookingModalError] = useState("");
  const [occupancyActionsError, setOccupancyActionsError] = useState("");
  const [priceModalError, setPriceModalError] = useState("");
  const [duplicatePricesError, setDuplicatePricesError] = useState("");
  const [copyYearPricesError, setCopyYearPricesError] = useState("");
  const [calendarSyncError, setCalendarSyncError] = useState("");
  const [calendarSyncSuccess, setCalendarSyncSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [bookingForm, setBookingForm] = useState<BookingFormState | null>(null);
  const [activeOccupancy, setActiveOccupancy] = useState<SerializedRoomOccupancy | null>(null);
  const [priceForm, setPriceForm] = useState<PriceFormState | null>(null);
  const [duplicatePricesForm, setDuplicatePricesForm] = useState<DuplicatePricesFormState | null>(
    null,
  );
  const [copyYearPricesForm, setCopyYearPricesForm] = useState<CopyYearPricesFormState | null>(
    null,
  );
  const [dragSelection, setDragSelection] = useState<DragSelectionState | null>(null);
  const [isSavingOccupancyAction, setIsSavingOccupancyAction] = useState(false);
  const [isDuplicatingPrices, setIsDuplicatingPrices] = useState(false);
  const [isCopyingYearPrices, setIsCopyingYearPrices] = useState(false);
  const [isLoadingCalendarSync, setIsLoadingCalendarSync] = useState(false);
  const [isSavingCalendarSync, setIsSavingCalendarSync] = useState(false);
  const [isRunningCalendarSync, setIsRunningCalendarSync] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [mobileBoardRoomPage, setMobileBoardRoomPage] = useState(0);
  const [bookingRoomPage, setBookingRoomPage] = useState(0);
  const [expandedMobileRailKey, setExpandedMobileRailKey] = useState<string | null>(null);
  const [dayCellWidthPx, setDayCellWidthPx] = useState(dayCellWidthDesktopPx);
  const [visibleDaysCount, setVisibleDaysCount] = useState(minVisibleDaysCount);
  const [calendarSyncRoomId, setCalendarSyncRoomId] = useState<string>("");
  const [calendarSyncConfig, setCalendarSyncConfig] = useState<CalendarSyncConfig | null>(null);
  const [calendarSyncSources, setCalendarSyncSources] = useState<CalendarImportSourceConfig[]>([]);
  const [newCalendarSyncSourceName, setNewCalendarSyncSourceName] = useState("");
  const [newCalendarSyncSourceUrl, setNewCalendarSyncSourceUrl] = useState("");
  const objectMenuRef = useRef<HTMLDivElement | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const dragSelectionRef = useRef<DragSelectionState | null>(null);
  const dragAutoScrollPointerRef = useRef<DragPointer | null>(null);
  const dragAutoExtendAtRef = useRef(0);
  const isAutoExtendingDragPeriodRef = useRef(false);
  const dragBoardContextRef = useRef({
    boardMode,
    periodStartIso,
    periodEndIso,
    dayCellWidthPx,
  });

  useEffect(() => {
    setBoardMode(initialBoardMode);
    setDragSelection(null);
  }, [initialBoardMode]);

  useEffect(() => {
    dragSelectionRef.current = dragSelection;
  }, [dragSelection]);

  useEffect(() => {
    dragBoardContextRef.current = {
      boardMode,
      periodStartIso,
      periodEndIso,
      dayCellWidthPx,
    };
  }, [boardMode, dayCellWidthPx, periodEndIso, periodStartIso]);

  useEffect(() => {
    if (properties.length === 0) {
      setSelectedPropertyId(null);
      return;
    }

    if (!selectedPropertyId || !properties.some((item) => item.id === selectedPropertyId)) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  useEffect(() => {
    function handleOutsidePointerDown(event: PointerEvent) {
      if (!objectMenuRef.current) {
        return;
      }

      if (!objectMenuRef.current.contains(event.target as Node)) {
        setIsObjectMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function syncViewportContext() {
      setIsCoarsePointer(window.matchMedia("(pointer: coarse)").matches);
      setIsMobilePortrait(isMobilePortraitViewport());
      setDayCellWidthPx(resolveDayCellWidthPx());
    }

    syncViewportContext();
    window.addEventListener("resize", syncViewportContext);
    window.addEventListener("orientationchange", syncViewportContext);

    return () => {
      window.removeEventListener("resize", syncViewportContext);
      window.removeEventListener("orientationchange", syncViewportContext);
    };
  }, []);

  useEffect(() => {
    if (!avoidDashboardBottomNav || typeof document === "undefined") {
      return;
    }

    const hasOpenInteraction =
      isBookingModalOpen ||
      isCalendarSyncModalOpen ||
      isPriceModalOpen ||
      isDuplicatePricesModalOpen ||
      isCopyYearPricesModalOpen ||
      isOccupancyActionsOpen;

    document.body.classList.toggle("dashboard-interaction-open", hasOpenInteraction);

    return () => {
      document.body.classList.remove("dashboard-interaction-open");
    };
  }, [
    avoidDashboardBottomNav,
    isBookingModalOpen,
    isCalendarSyncModalOpen,
    isCopyYearPricesModalOpen,
    isDuplicatePricesModalOpen,
    isOccupancyActionsOpen,
    isPriceModalOpen,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const boardScroller = boardScrollRef.current;
    if (!(boardScroller instanceof HTMLDivElement) || rooms.length === 0) {
      setVisibleDaysCount((current) =>
        current === minVisibleDaysCount ? current : minVisibleDaysCount,
      );
      return;
    }
    const scrollerElement = boardScroller;

    function syncVisibleDaysCount() {
      const styles = window.getComputedStyle(scrollerElement);
      const sidebarWidthPx = Number.parseFloat(styles.getPropertyValue("--cb-sidebar-w")) || 0;
      const resolvedCellWidthPx =
        Number.parseFloat(styles.getPropertyValue("--cb-cell-w")) || dayCellWidthPx;

      if (resolvedCellWidthPx <= 0) {
        setVisibleDaysCount(minVisibleDaysCount);
        return;
      }

      const availableDaysWidthPx = Math.max(0, scrollerElement.clientWidth - sidebarWidthPx);
      const nextVisibleDaysCount = Math.max(
        minVisibleDaysCount,
        Math.ceil(availableDaysWidthPx / resolvedCellWidthPx),
      );

      setVisibleDaysCount((current) =>
        current === nextVisibleDaysCount ? current : nextVisibleDaysCount,
      );
    }

    syncVisibleDaysCount();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncVisibleDaysCount);
      window.addEventListener("orientationchange", syncVisibleDaysCount);
      return () => {
        window.removeEventListener("resize", syncVisibleDaysCount);
        window.removeEventListener("orientationchange", syncVisibleDaysCount);
      };
    }

    const resizeObserver = new ResizeObserver(syncVisibleDaysCount);
    resizeObserver.observe(scrollerElement);
    window.addEventListener("orientationchange", syncVisibleDaysCount);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("orientationchange", syncVisibleDaysCount);
    };
  }, [dayCellWidthPx, rooms.length, selectedPropertyId]);

  useEffect(() => {
    if (isAutoExtendingDragPeriodRef.current) {
      isAutoExtendingDragPeriodRef.current = false;
      return;
    }

    dragAutoScrollPointerRef.current = null;
    setDragSelection(null);
  }, [boardMode, selectedPropertyId, periodEndIso, periodStartIso]);

  const openModalFromSelection = useCallback(
    (selection: DragSelectionState) => {
      const { roomId, startIso, endIso } = selection;
      const { dateFrom, dateTo } = normalizeIsoRange(startIso, endIso);

      if (boardMode === "occupancy") {
        setBookingForm(
          buildInitialBookingForm({
            defaultRoomId: roomId,
            dateFrom,
            dateTo,
          }),
        );
        setBookingModalError("");
        setIsBookingModalOpen(true);
        setDragSelection(null);
        return;
      }

      const sourcePrice =
        dateFrom === dateTo
          ? (rooms
              .find((room) => room.id === roomId)
              ?.prices.find((item) => periodContainsDate(item.dateFrom, item.dateTo, dateFrom)) ??
            null)
          : null;
      setPriceForm({
        roomId: roomId,
        dateFrom: sourcePrice?.dateFrom ?? dateFrom,
        dateTo: sourcePrice?.dateTo ?? dateTo,
        priceInput: sourcePrice ? String(sourcePrice.price) : "",
        priceType: sourcePrice
          ? normalizeRoomPriceType(sourcePrice.priceType)
          : defaultRoomPriceType,
        currency: sourcePrice?.currency ?? "RUB",
        minGuestsInput:
          sourcePrice?.minGuests === null || sourcePrice?.minGuests === undefined
            ? ""
            : String(sourcePrice.minGuests),
        minNightsInput:
          sourcePrice?.minNights === null || sourcePrice?.minNights === undefined
            ? ""
            : String(sourcePrice.minNights),
        extraBedPriceInput:
          sourcePrice?.extraBedPrice === null || sourcePrice?.extraBedPrice === undefined
            ? ""
            : String(sourcePrice.extraBedPrice),
        editingPriceId: sourcePrice?.id ?? null,
      });
      setIsPriceExtraSectionOpen(Boolean(sourcePrice?.extraBedPrice));
      setPriceModalError("");
      setIsPriceModalOpen(true);
      setDragSelection(null);
    },
    [boardMode, rooms],
  );

  const hasDragSelection = dragSelection !== null;

  // Desktop flow: drag with mouse and release to open modal.
  useEffect(() => {
    if (!hasDragSelection || isCoarsePointer) {
      return;
    }

    function handleMouseUp() {
      const activeSelection = dragSelectionRef.current;
      dragAutoScrollPointerRef.current = null;
      if (activeSelection) {
        openModalFromSelection(activeSelection);
      }
    }

    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [hasDragSelection, isCoarsePointer, openModalFromSelection]);

  useEffect(() => {
    if (!hasDragSelection || isCoarsePointer || typeof window === "undefined") {
      return;
    }

    let animationFrameId = 0;

    function getScrollerMetric(scroller: HTMLDivElement, propertyName: string, fallback: number) {
      const parsed = Number.parseFloat(
        window.getComputedStyle(scroller).getPropertyValue(propertyName),
      );
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    function extendSelectionFromPointer(pointer: DragPointer) {
      const target = document.elementFromPoint(pointer.clientX, pointer.clientY);
      const cell = target instanceof Element ? target.closest('[data-chess-cell="1"]') : null;
      if (!(cell instanceof HTMLElement) || cell.dataset.interactive !== "1") {
        return;
      }

      const activeSelection = dragSelectionRef.current;
      const roomId = cell.dataset.roomId;
      const dayIso = cell.dataset.dayIso;
      if (!activeSelection || !roomId || !dayIso || activeSelection.roomId !== roomId) {
        return;
      }

      if (
        dragBoardContextRef.current.boardMode === "occupancy" &&
        cell.dataset.hasOccupancy === "1"
      ) {
        return;
      }

      setDragSelection((prev) => {
        if (!prev || prev.roomId !== roomId || prev.endIso === dayIso) {
          return prev;
        }

        return { ...prev, endIso: dayIso };
      });
    }

    function extendVisiblePeriod(direction: "left" | "right", now: number) {
      if (now - dragAutoExtendAtRef.current < dragAutoExtendIntervalMs) {
        return;
      }

      const context = dragBoardContextRef.current;
      const activeSelection = dragSelectionRef.current;
      if (!activeSelection) {
        return;
      }

      if (direction === "right") {
        const nextEndCandidate = addDaysToIsoDate(context.periodEndIso, dragAutoExtendDays);
        const clamped = clampPeriodEndIso(context.periodStartIso, nextEndCandidate);
        if (clamped.dateToIso === context.periodEndIso) {
          return;
        }

        dragAutoExtendAtRef.current = now;
        isAutoExtendingDragPeriodRef.current = true;
        dragBoardContextRef.current = {
          ...context,
          periodEndIso: clamped.dateToIso,
        };
        setPeriodEndIso(clamped.dateToIso);
        setDragSelection((prev) =>
          prev && prev.roomId === activeSelection.roomId
            ? { ...prev, endIso: maxIsoDate(prev.endIso, clamped.dateToIso) }
            : prev,
        );
        return;
      }

      const nextStartCandidate = addDaysToIsoDate(context.periodStartIso, -dragAutoExtendDays);
      const clamped = clampPeriodStartIso(nextStartCandidate, context.periodEndIso);
      if (clamped.dateFromIso === context.periodStartIso) {
        return;
      }

      dragAutoExtendAtRef.current = now;
      isAutoExtendingDragPeriodRef.current = true;
      dragBoardContextRef.current = {
        ...context,
        periodStartIso: clamped.dateFromIso,
      };
      setPeriodStartIso(clamped.dateFromIso);
      setDragSelection((prev) =>
        prev && prev.roomId === activeSelection.roomId
          ? { ...prev, endIso: minIsoDate(prev.endIso, clamped.dateFromIso) }
          : prev,
      );
    }

    function tick(now: number) {
      const scroller = boardScrollRef.current;
      const pointer = dragAutoScrollPointerRef.current;
      const activeSelection = dragSelectionRef.current;

      if (scroller && pointer && activeSelection) {
        const rect = scroller.getBoundingClientRect();
        const sidebarWidthPx = getScrollerMetric(scroller, "--cb-sidebar-w", 0);
        const horizontalLeftEdge = Math.min(rect.right, rect.left + sidebarWidthPx);
        const horizontalRightEdge = rect.right;
        const verticalTopEdge = rect.top;
        const verticalBottomEdge = rect.bottom;
        let scrollLeftDelta = 0;
        let scrollTopDelta = 0;

        if (pointer.clientX > horizontalRightEdge - dragAutoScrollEdgePx) {
          const strength =
            (pointer.clientX - (horizontalRightEdge - dragAutoScrollEdgePx)) / dragAutoScrollEdgePx;
          scrollLeftDelta = Math.ceil(Math.min(1, Math.max(0, strength)) * dragAutoScrollMaxStepPx);
        } else if (pointer.clientX < horizontalLeftEdge + dragAutoScrollEdgePx) {
          const strength =
            (horizontalLeftEdge + dragAutoScrollEdgePx - pointer.clientX) / dragAutoScrollEdgePx;
          scrollLeftDelta = -Math.ceil(
            Math.min(1, Math.max(0, strength)) * dragAutoScrollMaxStepPx,
          );
        }

        if (pointer.clientY > verticalBottomEdge - dragAutoScrollEdgePx) {
          const strength =
            (pointer.clientY - (verticalBottomEdge - dragAutoScrollEdgePx)) / dragAutoScrollEdgePx;
          scrollTopDelta = Math.ceil(Math.min(1, Math.max(0, strength)) * dragAutoScrollMaxStepPx);
        } else if (pointer.clientY < verticalTopEdge + dragAutoScrollEdgePx) {
          const strength =
            (verticalTopEdge + dragAutoScrollEdgePx - pointer.clientY) / dragAutoScrollEdgePx;
          scrollTopDelta = -Math.ceil(Math.min(1, Math.max(0, strength)) * dragAutoScrollMaxStepPx);
        }

        if (scrollLeftDelta !== 0 || scrollTopDelta !== 0) {
          scroller.scrollBy({ left: scrollLeftDelta, top: scrollTopDelta });
        }

        extendSelectionFromPointer(pointer);

        const atLeftEnd = scroller.scrollLeft <= dragAutoExtendScrollEpsilonPx;
        const atRightEnd =
          scroller.scrollLeft + scroller.clientWidth >=
          scroller.scrollWidth - dragAutoExtendScrollEpsilonPx;

        if (scrollLeftDelta > 0 && atRightEnd) {
          extendVisiblePeriod("right", now);
        } else if (scrollLeftDelta < 0 && atLeftEnd) {
          extendVisiblePeriod("left", now);
        }
      }

      animationFrameId = window.requestAnimationFrame(tick);
    }

    function handleMouseMove(event: MouseEvent) {
      dragAutoScrollPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
    }

    window.addEventListener("mousemove", handleMouseMove);
    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [hasDragSelection, isCoarsePointer]);

  const periodDaysCount = useMemo(() => {
    const daysCount = getInclusiveDateRangeDays(periodStartIso, periodEndIso);
    return Math.min(Math.max(1, daysCount || minVisibleDaysCount), maxBoardRangeDaysCount);
  }, [periodEndIso, periodStartIso]);
  const visibleDays = useMemo(
    () => buildVisibleDays(periodStartIso, periodDaysCount),
    [periodDaysCount, periodStartIso],
  );
  const periodHeaderLabel = useMemo(() => formatPeriodHeader(visibleDays), [visibleDays]);
  const visibleMonthSegments = useMemo(() => buildMonthSegments(visibleDays), [visibleDays]);
  const periodFromIso = visibleDays[0]?.iso ?? initialTodayIso;
  const periodToIso = visibleDays[visibleDays.length - 1]?.iso ?? initialTodayIso;
  const normalizedDragSelection = useMemo(() => {
    if (!dragSelection) {
      return null;
    }

    const normalized = normalizeIsoRange(dragSelection.startIso, dragSelection.endIso);
    return {
      roomId: dragSelection.roomId,
      dateFrom: normalized.dateFrom,
      dateTo: normalized.dateTo,
    };
  }, [dragSelection]);

  const groupedRooms = useMemo<GroupedRoomBucket[]>(() => {
    return [...rooms]
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return compareRoomsForChessboard(left, right);
      })
      .map((room) => ({
        key: `room:${room.id}`,
        groupLabel: `Категория: ${room.bathroomTypeLabel}`,
        items: [room],
      }));
  }, [rooms]);

  const roomPagerEntries = useMemo<RoomPagerEntry[]>(
    () =>
      groupedRooms.flatMap((group) =>
        group.items.map((room) => ({
          groupLabel: group.groupLabel,
          room,
        })),
      ),
    [groupedRooms],
  );
  const orderedRooms = useMemo(
    () => roomPagerEntries.map((entry) => entry.room),
    [roomPagerEntries],
  );

  const mobileRoomPageCount = useMemo(
    () => Math.max(1, Math.ceil(roomPagerEntries.length / mobileRoomsPerPage)),
    [roomPagerEntries],
  );

  const mobileBoardRoomPageCount = useMemo(
    () => Math.max(1, Math.ceil(roomPagerEntries.length / mobileBoardRoomsPerPage)),
    [roomPagerEntries],
  );
  const activeMobileBoardRoomPage = Math.min(
    mobileBoardRoomPage,
    Math.max(0, mobileBoardRoomPageCount - 1),
  );
  const visibleBoardRoomStartIndex = isMobilePortrait
    ? activeMobileBoardRoomPage * mobileBoardRoomsPerPage
    : 0;
  const visibleBoardRoomEndIndex = isMobilePortrait
    ? Math.min(roomPagerEntries.length, visibleBoardRoomStartIndex + mobileBoardRoomsPerPage)
    : roomPagerEntries.length;
  const visibleBoardRoomEntries = useMemo<RoomPagerEntry[]>(() => {
    if (!isMobilePortrait) {
      return roomPagerEntries;
    }

    return roomPagerEntries.slice(
      activeMobileBoardRoomPage * mobileBoardRoomsPerPage,
      activeMobileBoardRoomPage * mobileBoardRoomsPerPage + mobileBoardRoomsPerPage,
    );
  }, [activeMobileBoardRoomPage, isMobilePortrait, roomPagerEntries]);
  const showMobileBoardPager = isMobilePortrait && mobileBoardRoomPageCount > 1;

  const visibleRoomGroups = useMemo<GroupedRoomBucket[]>(() => {
    if (!isMobilePortrait) {
      return groupedRooms;
    }

    return visibleBoardRoomEntries.map((entry) => ({
      key: `room:${entry.room.id}`,
      groupLabel: entry.groupLabel,
      items: [entry.room],
    }));
  }, [groupedRooms, isMobilePortrait, visibleBoardRoomEntries]);

  const groupedRoomsWithOffset = useMemo<GroupedRoomBucketWithOffset[]>(
    () => addGroupOffsets(visibleRoomGroups, visibleBoardRoomStartIndex),
    [visibleRoomGroups, visibleBoardRoomStartIndex],
  );

  // Fast room/day occupancy lookup used by every rendered calendar cell.
  const occupancyLookup = useMemo(() => {
    const lookup = new Map<string, Map<string, SerializedRoomOccupancy>>();

    for (const [roomId, items] of Object.entries(occupanciesByRoom)) {
      const roomLookup = new Map<string, SerializedRoomOccupancy>();

      for (const item of items) {
        const from = parseIsoDate(item.dateFrom);
        const to = parseIsoDate(item.dateTo);

        if (!from || !to) {
          continue;
        }

        for (let day = from; day <= to; day = addDays(day, 1)) {
          roomLookup.set(toIsoDate(day), item);
        }
      }

      lookup.set(roomId, roomLookup);
    }

    return lookup;
  }, [occupanciesByRoom]);

  // Fast room/day price lookup for visible window only (28 days).
  const priceLookup = useMemo(() => {
    const lookup = new Map<string, Map<string, SerializedRoomPrice>>();

    for (const room of rooms) {
      const roomLookup = new Map<string, SerializedRoomPrice>();

      for (const day of visibleDays) {
        const matched = room.prices.find((item) =>
          periodContainsDate(item.dateFrom, item.dateTo, day.iso),
        );
        if (matched) {
          roomLookup.set(day.iso, matched);
        }
      }

      lookup.set(room.id, roomLookup);
    }

    return lookup;
  }, [rooms, visibleDays]);

  const selectedProperty = useMemo(
    () => properties.find((item) => item.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  );

  const roomLookupById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);

  const canManageCalendar = selectedPropertyId !== null && rooms.length > 0;

  useEffect(() => {
    setMobileBoardRoomPage((prev) => Math.min(prev, Math.max(0, mobileBoardRoomPageCount - 1)));
  }, [mobileBoardRoomPageCount]);

  useEffect(() => {
    setMobileBoardRoomPage(0);
  }, [selectedPropertyId]);

  useEffect(() => {
    setBookingRoomPage((prev) => Math.min(prev, Math.max(0, mobileRoomPageCount - 1)));
  }, [mobileRoomPageCount]);

  useEffect(() => {
    if (!isMobilePortrait) {
      setExpandedMobileRailKey(null);
    }
  }, [isMobilePortrait]);

  useEffect(() => {
    setExpandedMobileRailKey(null);
  }, [boardMode, isRoomOrderMode, periodEndIso, periodStartIso, selectedPropertyId]);

  useEffect(() => {
    setIsRoomOrderMode(false);
    setDraggingRoomId(null);
    setDragOverRoomId(null);
  }, [selectedPropertyId]);

  useEffect(() => {
    if (!isBookingModalOpen || !bookingForm?.roomId) {
      return;
    }

    const roomIndex = roomPagerEntries.findIndex((entry) => entry.room.id === bookingForm.roomId);
    if (roomIndex < 0) {
      return;
    }

    const nextPage = Math.floor(roomIndex / mobileRoomsPerPage);
    setBookingRoomPage((prev) => (prev === nextPage ? prev : nextPage));
  }, [bookingForm?.roomId, isBookingModalOpen, roomPagerEntries]);

  const refreshRooms = useCallback(async () => {
    if (!selectedPropertyId) {
      setRooms([]);
      setOccupanciesByRoom({});
      return;
    }

    setIsLoadingRooms(true);
    setMessageError("");

    try {
      const response = await fetch(`/api/properties/${selectedPropertyId}/rooms?view=chessboard`, {
        cache: "no-store",
      });
      const body = (await response.json()) as {
        items?: SerializedChessboardRoom[];
        error?: string;
      };

      if (!response.ok) {
        setMessageError(readResponseError(body, "Не удалось загрузить номера объекта"));
        setRooms([]);
        setOccupanciesByRoom({});
        return;
      }

      setRooms(body.items ?? []);
      setMessageSuccess("");
    } catch {
      setMessageError("Не удалось загрузить номера объекта");
      setRooms([]);
      setOccupanciesByRoom({});
    } finally {
      setIsLoadingRooms(false);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    void refreshRooms();
  }, [refreshRooms]);

  async function reorderRooms(nextRooms: SerializedChessboardRoom[]) {
    if (!selectedPropertyId || isReorderingRooms) {
      return;
    }

    const previousRooms = rooms;
    const normalizedRooms = nextRooms.map((room, index) => ({
      ...room,
      sortOrder: index + 1,
    }));

    setMessageError("");
    setMessageSuccess("");
    setDragSelection(null);
    setDraggingRoomId(null);
    setDragOverRoomId(null);
    setIsReorderingRooms(true);
    setRooms(normalizedRooms);

    try {
      const response = await fetch(
        `/api/properties/${selectedPropertyId}/rooms/reorder?view=chessboard`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderedIds: normalizedRooms.map((room) => room.id),
          }),
        },
      );

      const body = (await response.json()) as {
        items?: SerializedChessboardRoom[];
        error?: string;
      };

      if (!response.ok) {
        setRooms(previousRooms);
        setMessageError(readResponseError(body, "Не удалось изменить порядок номеров"));
        return;
      }

      setRooms(body.items ?? normalizedRooms);
      setMessageSuccess("Порядок номеров в шахматке сохранен");
    } catch {
      setRooms(previousRooms);
      setMessageError("Не удалось изменить порядок номеров");
    } finally {
      setIsReorderingRooms(false);
    }
  }

  function moveRoom(roomId: string, direction: -1 | 1) {
    const currentIndex = orderedRooms.findIndex((room) => room.id === roomId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= orderedRooms.length) {
      return;
    }

    const nextRooms = [...orderedRooms];
    const [movedRoom] = nextRooms.splice(currentIndex, 1);
    if (!movedRoom) {
      return;
    }
    nextRooms.splice(nextIndex, 0, movedRoom);
    void reorderRooms(nextRooms);
  }

  function moveRoomToPosition(roomId: string, position: number) {
    const currentIndex = orderedRooms.findIndex((room) => room.id === roomId);
    const nextIndex = Math.max(0, Math.min(orderedRooms.length - 1, position - 1));

    if (currentIndex < 0 || currentIndex === nextIndex) {
      return;
    }

    const nextRooms = [...orderedRooms];
    const [movedRoom] = nextRooms.splice(currentIndex, 1);
    if (!movedRoom) {
      return;
    }
    nextRooms.splice(nextIndex, 0, movedRoom);
    void reorderRooms(nextRooms);
  }

  function reorderRoomByDrop(roomId: string, targetRoomId: string) {
    if (roomId === targetRoomId || isReorderingRooms) {
      return;
    }

    const currentIndex = orderedRooms.findIndex((room) => room.id === roomId);
    const nextIndex = orderedRooms.findIndex((room) => room.id === targetRoomId);

    if (currentIndex < 0 || nextIndex < 0 || currentIndex === nextIndex) {
      return;
    }

    const nextRooms = [...orderedRooms];
    const [movedRoom] = nextRooms.splice(currentIndex, 1);
    if (!movedRoom) {
      return;
    }

    nextRooms.splice(nextIndex, 0, movedRoom);
    void reorderRooms(nextRooms);
  }

  // Occupancy API is property-scoped, so the visible window refreshes in a single request.
  const refreshOccupancies = useCallback(async () => {
    if (!selectedPropertyId) {
      setOccupanciesByRoom({});
      return;
    }

    setIsLoadingOccupancies(true);

    try {
      const url = `/api/properties/${selectedPropertyId}/occupancy?from=${encodeURIComponent(periodFromIso)}&to=${encodeURIComponent(periodToIso)}`;
      const response = await fetch(url);
      const body = (await response.json()) as {
        itemsByRoom?: Record<string, SerializedRoomOccupancy[]>;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(readResponseError(body, "Не удалось загрузить занятость"));
      }

      setOccupanciesByRoom(body.itemsByRoom ?? {});
      setMessageError("");
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Не удалось загрузить занятость");
    } finally {
      setIsLoadingOccupancies(false);
    }
  }, [periodFromIso, periodToIso, selectedPropertyId]);

  useEffect(() => {
    void refreshOccupancies();
  }, [refreshOccupancies, reloadKey]);

  function openOccupancyActions(occupancy: SerializedRoomOccupancy) {
    setExpandedMobileRailKey(null);
    setActiveOccupancy(occupancy);
    setOccupancyActionsError("");
    setIsOccupancyActionsOpen(true);
  }

  function closeOccupancyActions() {
    setIsOccupancyActionsOpen(false);
    setActiveOccupancy(null);
    setOccupancyActionsError("");
  }

  function openBookingModal(options?: {
    roomId?: string;
    dateFrom?: string;
    dateTo?: string;
    sourceOccupancy?: SerializedRoomOccupancy | null;
  }) {
    closeOccupancyActions();
    setExpandedMobileRailKey(null);
    const sourceOccupancy = options?.sourceOccupancy ?? null;
    const defaultRoomId =
      options?.roomId ?? sourceOccupancy?.roomId ?? visibleBoardRoomEntries[0]?.room.id ?? "";
    const dateFrom = sourceOccupancy?.dateFrom ?? options?.dateFrom ?? periodFromIso;
    const dateTo = sourceOccupancy?.dateTo ?? options?.dateTo ?? dateFrom;
    const parsedContacts = parseGuestContacts(sourceOccupancy?.guestContacts ?? null);

    if (sourceOccupancy) {
      setBookingForm({
        editingOccupancyId: sourceOccupancy.id,
        dateFrom,
        dateTo,
        timeFrom: sourceOccupancy.timeFrom ?? "",
        timeTo: sourceOccupancy.timeTo ?? "",
        status: sourceOccupancy.status,
        adults: sourceOccupancy.adultsCount,
        children: sourceOccupancy.childrenCount,
        tag: (sourceOccupancy.tag ?? "").slice(0, 20),
        color: normalizeBookingColor(sourceOccupancy.color),
        roomId: defaultRoomId,
        contactName: sourceOccupancy.guestName === "Гость" ? "" : (sourceOccupancy.guestName ?? ""),
        phone: sourceOccupancy.guestPhone ?? "",
        email: parsedContacts.email,
        website: parsedContacts.website,
        source: sourceOccupancy.source ?? "",
        description: sourceOccupancy.description ?? "",
        createdAt: sourceOccupancy.createdAt,
      });
    } else {
      setBookingForm(
        buildInitialBookingForm({
          defaultRoomId,
          dateFrom,
          dateTo,
        }),
      );
    }

    setBookingModalError("");
    setBookingRoomPage(0);
    setIsBookingModalOpen(true);
  }

  function closeBookingModal() {
    setIsBookingModalOpen(false);
    setBookingForm(null);
    setBookingModalError("");
  }

  function updateBookingForm(patch: Partial<BookingFormState>) {
    setBookingForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function openPriceModal(options?: {
    roomId?: string;
    dateFrom?: string;
    dateTo?: string;
    sourcePrice?: SerializedRoomPrice | null;
  }) {
    setExpandedMobileRailKey(null);
    const sourcePrice = options?.sourcePrice ?? null;
    const defaultRoomId =
      options?.roomId ?? sourcePrice?.roomId ?? visibleBoardRoomEntries[0]?.room.id ?? "";
    const dateFrom = sourcePrice?.dateFrom ?? options?.dateFrom ?? periodFromIso;
    const dateTo = sourcePrice?.dateTo ?? options?.dateTo ?? dateFrom;

    setPriceForm({
      roomId: defaultRoomId,
      dateFrom,
      dateTo,
      priceInput: sourcePrice ? String(sourcePrice.price) : "",
      priceType: sourcePrice ? normalizeRoomPriceType(sourcePrice.priceType) : defaultRoomPriceType,
      currency: sourcePrice?.currency ?? "RUB",
      minGuestsInput:
        sourcePrice?.minGuests === null || sourcePrice?.minGuests === undefined
          ? ""
          : String(sourcePrice.minGuests),
      minNightsInput:
        sourcePrice?.minNights === null || sourcePrice?.minNights === undefined
          ? ""
          : String(sourcePrice.minNights),
      extraBedPriceInput:
        sourcePrice?.extraBedPrice === null || sourcePrice?.extraBedPrice === undefined
          ? ""
          : String(sourcePrice.extraBedPrice),
      editingPriceId: sourcePrice?.id ?? null,
    });
    setIsPriceExtraSectionOpen(Boolean(sourcePrice?.extraBedPrice));
    setPriceModalError("");
    setIsPriceModalOpen(true);
  }

  function closePriceModal() {
    setIsPriceModalOpen(false);
    setPriceForm(null);
    setPriceModalError("");
    setIsPriceExtraSectionOpen(false);
  }

  function updatePriceForm(patch: Partial<PriceFormState>) {
    setPriceForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function openDuplicatePricesModal() {
    const sourceRoomId = rooms[0]?.id ?? "";
    setDuplicatePricesForm({
      sourceRoomId,
      targetRoomIds: rooms.filter((room) => room.id !== sourceRoomId).map((room) => room.id),
      dateFrom: periodFromIso,
      dateTo: periodToIso,
    });
    setDuplicatePricesError("");
    setIsDuplicatePricesModalOpen(true);
  }

  function closeDuplicatePricesModal() {
    setIsDuplicatePricesModalOpen(false);
    setDuplicatePricesForm(null);
    setDuplicatePricesError("");
  }

  function openCopyYearPricesModal() {
    const visibleYear = parseIsoDate(periodFromIso)?.getUTCFullYear() ?? new Date().getFullYear();
    setExpandedMobileRailKey(null);
    setCopyYearPricesForm({
      sourceYearInput: String(visibleYear),
      targetYearInput: String(visibleYear + 1),
      replaceExisting: false,
    });
    setCopyYearPricesError("");
    setIsCopyYearPricesModalOpen(true);
  }

  function closeCopyYearPricesModal() {
    setIsCopyYearPricesModalOpen(false);
    setCopyYearPricesForm(null);
    setCopyYearPricesError("");
  }

  function updateCopyYearPricesForm(patch: Partial<CopyYearPricesFormState>) {
    setCopyYearPricesForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateDuplicatePricesForm(patch: Partial<DuplicatePricesFormState>) {
    setDuplicatePricesForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateDuplicateSourceRoom(roomId: string) {
    setDuplicatePricesForm((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        sourceRoomId: roomId,
        targetRoomIds: prev.targetRoomIds.filter((targetRoomId) => targetRoomId !== roomId),
      };
    });
  }

  function toggleDuplicateTargetRoom(roomId: string) {
    setDuplicatePricesForm((prev) => {
      if (!prev || prev.sourceRoomId === roomId) {
        return prev;
      }

      return {
        ...prev,
        targetRoomIds: prev.targetRoomIds.includes(roomId)
          ? prev.targetRoomIds.filter((targetRoomId) => targetRoomId !== roomId)
          : [...prev.targetRoomIds, roomId],
      };
    });
  }

  function selectAllDuplicateTargetRooms() {
    setDuplicatePricesForm((prev) =>
      prev
        ? {
            ...prev,
            targetRoomIds: rooms
              .filter((room) => room.id !== prev.sourceRoomId)
              .map((room) => room.id),
          }
        : prev,
    );
  }

  function clearDuplicateTargetRooms() {
    updateDuplicatePricesForm({ targetRoomIds: [] });
  }

  function openCalendarSyncModal(roomId?: string) {
    const defaultRoomId = roomId ?? calendarSyncRoomId ?? rooms[0]?.id ?? "";
    setExpandedMobileRailKey(null);
    setCalendarSyncRoomId(defaultRoomId);
    setCalendarSyncConfig(null);
    setCalendarSyncSources([]);
    setNewCalendarSyncSourceName("");
    setNewCalendarSyncSourceUrl("");
    setCalendarSyncError("");
    setCalendarSyncSuccess("");
    setIsCalendarSyncModalOpen(true);
  }

  function closeCalendarSyncModal() {
    setIsCalendarSyncModalOpen(false);
    setCalendarSyncError("");
    setCalendarSyncSuccess("");
  }

  const loadCalendarSyncConfig = useCallback(async () => {
    if (!selectedPropertyId || !calendarSyncRoomId) {
      setCalendarSyncConfig(null);
      setCalendarSyncSources([]);
      return;
    }

    setIsLoadingCalendarSync(true);
    setCalendarSyncError("");

    try {
      const response = await fetch(
        `/api/properties/${selectedPropertyId}/rooms/${calendarSyncRoomId}/calendar-sync`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        item?: CalendarSyncConfig;
        error?: string;
      };

      if (!response.ok || !body.item) {
        setCalendarSyncError(readResponseError(body, "Не удалось загрузить календарь номера"));
        setCalendarSyncConfig(null);
        return;
      }

      setCalendarSyncConfig(body.item);
      setCalendarSyncSources(normalizeCalendarImportSources(body.item));
    } catch {
      setCalendarSyncError("Не удалось загрузить календарь номера");
      setCalendarSyncConfig(null);
      setCalendarSyncSources([]);
    } finally {
      setIsLoadingCalendarSync(false);
    }
  }, [calendarSyncRoomId, selectedPropertyId]);

  useEffect(() => {
    if (!isCalendarSyncModalOpen) {
      return;
    }

    void loadCalendarSyncConfig();
  }, [isCalendarSyncModalOpen, loadCalendarSyncConfig]);

  useEffect(() => {
    if (!isCalendarSyncModalOpen || rooms.length === 0) {
      return;
    }

    if (!calendarSyncRoomId || !rooms.some((room) => room.id === calendarSyncRoomId)) {
      setCalendarSyncRoomId(rooms[0].id);
    }
  }, [calendarSyncRoomId, isCalendarSyncModalOpen, rooms]);

  function addCalendarSyncSource() {
    const label = newCalendarSyncSourceName.trim();
    const importUrl = newCalendarSyncSourceUrl.trim();

    setCalendarSyncError("");
    setCalendarSyncSuccess("");

    if (!label) {
      setCalendarSyncError("Укажите название сайта");
      return;
    }
    if (!importUrl) {
      setCalendarSyncError("Укажите ссылку календаря");
      return;
    }
    if (calendarSyncSources.some((source) => source.importUrl.trim() === importUrl)) {
      setCalendarSyncError("Эта ссылка уже добавлена");
      return;
    }

    setCalendarSyncSources((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}`,
        label,
        importUrl,
        isEnabled: true,
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncMessage: null,
        updatedAt: new Date().toISOString(),
      },
    ]);
    setNewCalendarSyncSourceName("");
    setNewCalendarSyncSourceUrl("");
    setCalendarSyncSuccess("Источник добавлен. Сохраните настройки, чтобы включить синхронизацию.");
  }

  function updateCalendarSyncSource(
    sourceId: string,
    patch: Partial<Pick<CalendarImportSourceConfig, "label" | "importUrl" | "isEnabled">>,
  ) {
    setCalendarSyncSources((prev) =>
      prev.map((source) => (source.id === sourceId ? { ...source, ...patch } : source)),
    );
  }

  async function removeCalendarSyncSource(sourceId: string) {
    const previousSources = calendarSyncSources;
    const nextSources = calendarSyncSources.filter((source) => source.id !== sourceId);
    setCalendarSyncSources(nextSources);
    setCalendarSyncError("");
    setCalendarSyncSuccess("");

    if (sourceId.startsWith("draft-")) {
      setCalendarSyncSuccess("Источник удален");
      return;
    }

    const savedConfig = await saveCalendarSyncConfig(nextSources, "Синхронизация отключена");
    if (!savedConfig) {
      setCalendarSyncSources(previousSources);
    } else {
      setReloadKey((prev) => prev + 1);
    }
  }

  async function saveCalendarSyncConfig(
    sourcesOverride?: CalendarImportSourceConfig[],
    successMessage = "Настройки календаря сохранены",
  ): Promise<CalendarSyncConfig | null> {
    if (!selectedPropertyId || !calendarSyncRoomId) {
      return null;
    }

    const sourcesToSave = sourcesOverride ?? calendarSyncSources;

    setIsSavingCalendarSync(true);
    setCalendarSyncError("");
    setCalendarSyncSuccess("");

    try {
      const response = await fetch(
        `/api/properties/${selectedPropertyId}/rooms/${calendarSyncRoomId}/calendar-sync`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            importSources: sourcesToSave.map((source) => ({
              id: source.id.startsWith("draft-") ? undefined : source.id,
              label: source.label,
              importUrl: source.importUrl,
              isEnabled: source.isEnabled,
            })),
          }),
        },
      );
      const body = (await response.json()) as {
        item?: CalendarSyncConfig;
        error?: string;
      };

      if (!response.ok || !body.item) {
        setCalendarSyncError(readResponseError(body, "Не удалось сохранить настройки календаря"));
        return null;
      }

      setCalendarSyncConfig(body.item);
      setCalendarSyncSources(normalizeCalendarImportSources(body.item));
      setCalendarSyncSuccess(successMessage);
      return body.item;
    } catch {
      setCalendarSyncError("Не удалось сохранить настройки календаря");
      return null;
    } finally {
      setIsSavingCalendarSync(false);
    }
  }

  async function runCalendarSyncImport() {
    if (!selectedPropertyId || !calendarSyncRoomId) {
      return;
    }

    const savedConfig = await saveCalendarSyncConfig();
    if (!savedConfig) {
      return;
    }

    setIsRunningCalendarSync(true);
    setCalendarSyncError("");
    setCalendarSyncSuccess("");

    try {
      const response = await fetch(
        `/api/properties/${selectedPropertyId}/rooms/${calendarSyncRoomId}/calendar-sync/run`,
        { method: "POST" },
      );
      const body = (await response.json()) as {
        result?: { message?: string };
        error?: string;
      };

      if (!response.ok) {
        setCalendarSyncError(readResponseError(body, "Не удалось импортировать календарь"));
        void loadCalendarSyncConfig();
        return;
      }

      setCalendarSyncSuccess(body.result?.message ?? "Календарь импортирован");
      await loadCalendarSyncConfig();
      setReloadKey((prev) => prev + 1);
    } catch {
      setCalendarSyncError("Не удалось импортировать календарь");
    } finally {
      setIsRunningCalendarSync(false);
    }
  }

  async function copyCalendarExportUrl() {
    if (!calendarSyncConfig?.exportUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(calendarSyncConfig.exportUrl);
      setCalendarSyncSuccess("Ссылка экспорта скопирована");
      setCalendarSyncError("");
    } catch {
      setCalendarSyncError("Не удалось скопировать ссылку. Выделите ее вручную.");
    }
  }

  function beginDragSelection(roomId: string, dayIso: string, pointer?: DragPointer) {
    setExpandedMobileRailKey(null);
    dragAutoScrollPointerRef.current = pointer ?? null;
    dragAutoExtendAtRef.current = 0;
    setDragSelection({
      roomId,
      startIso: dayIso,
      endIso: dayIso,
    });
  }

  function extendDragSelection(roomId: string, dayIso: string) {
    setDragSelection((prev) => {
      if (!prev || prev.roomId !== roomId) {
        return prev;
      }
      if (prev.endIso === dayIso) {
        return prev;
      }
      return {
        ...prev,
        endIso: dayIso,
      };
    });
  }

  function scrollBoardToPeriodStart() {
    boardScrollRef.current?.scrollTo({
      left: 0,
      behavior: "smooth",
    });
  }

  function applyBoardPeriodRange(dateFromIso: string, dateToIso: string) {
    if (!parseIsoDate(dateFromIso) || !parseIsoDate(dateToIso)) {
      return;
    }

    const normalizedDateTo = compareIsoDates(dateToIso, dateFromIso) < 0 ? dateFromIso : dateToIso;
    const clamped = clampPeriodEndIso(dateFromIso, normalizedDateTo);

    if (clamped.wasClamped) {
      setMessageError(`Диапазон шахматки ограничен ${maxBoardRangeDaysCount} днями`);
    }

    setPeriodStartIso(dateFromIso);
    setPeriodEndIso(clamped.dateToIso);
    setDragSelection(null);
    scrollBoardToPeriodStart();
  }

  function updatePeriodStart(nextStartIso: string) {
    if (!parseIsoDate(nextStartIso)) {
      return;
    }

    const nextEndIso =
      compareIsoDates(nextStartIso, periodEndIso) > 0 ? nextStartIso : periodEndIso;
    applyBoardPeriodRange(nextStartIso, nextEndIso);
  }

  function updatePeriodEnd(nextEndIso: string) {
    if (!parseIsoDate(nextEndIso)) {
      return;
    }

    const nextStartIso =
      compareIsoDates(nextEndIso, periodStartIso) < 0 ? nextEndIso : periodStartIso;
    applyBoardPeriodRange(nextStartIso, nextEndIso);
  }

  function jumpToDate(dateIso: string) {
    const nextRangeLength = Math.max(1, periodDaysCount || visibleDaysCount);
    applyBoardPeriodRange(dateIso, addDaysToIsoDate(dateIso, nextRangeLength - 1));
  }

  function shiftVisiblePeriod(days: number) {
    const parsed = parseIsoDate(periodStartIso) ?? parseIsoDate(getLocalTodayIso());
    if (!parsed) {
      return;
    }
    const nextStartIso = toIsoDate(addDays(parsed, days));
    const nextEndIso = addDaysToIsoDate(periodEndIso, days);
    applyBoardPeriodRange(nextStartIso, nextEndIso);
  }

  function changeMobileBoardRoomPage(page: number) {
    const nextPage = Math.min(Math.max(0, page), Math.max(0, mobileBoardRoomPageCount - 1));
    setExpandedMobileRailKey(null);
    setMobileBoardRoomPage(nextPage);
    boardScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  const showFloatingQuickAdd = isCoarsePointer && rooms.length > 0;

  async function saveBooking(statusOverride?: BookingFormState["status"]) {
    if (!selectedPropertyId || !bookingForm) {
      return;
    }

    const dateFrom = parseIsoDate(bookingForm.dateFrom);
    const dateTo = parseIsoDate(bookingForm.dateTo);

    if (!dateFrom || !dateTo || dateTo < dateFrom) {
      setBookingModalError(
        "Проверьте период проживания: дата окончания не может быть раньше начала",
      );
      return;
    }

    if (!bookingForm.roomId) {
      setBookingModalError("Выберите номер");
      return;
    }

    const normalizedTimeFrom = normalizeOptionalText(bookingForm.timeFrom);
    const normalizedTimeTo = normalizeOptionalText(bookingForm.timeTo);
    if (
      bookingForm.dateFrom === bookingForm.dateTo &&
      normalizedTimeFrom &&
      normalizedTimeTo &&
      normalizedTimeTo.localeCompare(normalizedTimeFrom) <= 0
    ) {
      setBookingModalError("Для одного дня время выезда должно быть позже времени заезда");
      return;
    }

    const statusToSave = statusOverride ?? bookingForm.status;

    setIsSavingBooking(true);
    setBookingModalError("");

    try {
      // Same form supports create (POST) and update (PATCH) based on editingOccupancyId.
      const requestUrl = bookingForm.editingOccupancyId
        ? `/api/properties/${selectedPropertyId}/rooms/${bookingForm.roomId}/occupancy/${bookingForm.editingOccupancyId}`
        : `/api/properties/${selectedPropertyId}/rooms/${bookingForm.roomId}/occupancy`;

      const response = await fetch(requestUrl, {
        method: bookingForm.editingOccupancyId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: bookingForm.dateFrom,
          dateTo: bookingForm.dateTo,
          timeFrom: normalizedTimeFrom,
          timeTo: normalizedTimeTo,
          status: statusToSave,
          tag: normalizeOptionalText(bookingForm.tag),
          source: normalizeOptionalText(bookingForm.source),
          color: normalizeBookingColor(bookingForm.color),
          adultsCount: bookingForm.adults,
          childrenCount: bookingForm.children,
          guestName: normalizeOptionalText(bookingForm.contactName) ?? "Гость",
          guestPhone: normalizeOptionalText(bookingForm.phone),
          guestContacts: buildGuestContacts(bookingForm),
          description: buildBookingDescription(bookingForm),
        }),
      });

      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setBookingModalError(
          readResponseError(
            body,
            bookingForm.editingOccupancyId
              ? "Не удалось обновить бронирование"
              : "Не удалось создать бронирование",
          ),
        );
        return;
      }

      setMessageSuccess(
        bookingForm.editingOccupancyId
          ? "Бронирование обновлено в шахматке"
          : "Бронирование создано и отображено в шахматке",
      );
      setMessageError("");
      closeBookingModal();
      setReloadKey((prev) => prev + 1);
    } catch {
      setBookingModalError(
        bookingForm.editingOccupancyId
          ? "Не удалось обновить бронирование"
          : "Не удалось создать бронирование",
      );
    } finally {
      setIsSavingBooking(false);
    }
  }

  async function cancelBooking() {
    if (!selectedPropertyId || !bookingForm?.editingOccupancyId) {
      return;
    }

    setIsSavingBooking(true);
    setBookingModalError("");
    try {
      const response = await fetch(
        `/api/properties/${selectedPropertyId}/rooms/${bookingForm.roomId}/occupancy/${bookingForm.editingOccupancyId}`,
        { method: "DELETE" },
      );
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setBookingModalError(readResponseError(body, "Не удалось отменить бронирование"));
        return;
      }

      setMessageSuccess("Бронирование отменено");
      setMessageError("");
      closeBookingModal();
      setReloadKey((prev) => prev + 1);
    } catch {
      setBookingModalError("Не удалось отменить бронирование");
    } finally {
      setIsSavingBooking(false);
    }
  }

  async function checkInBooking() {
    if (!bookingForm?.editingOccupancyId) {
      return;
    }

    await saveBooking("CHECKED_IN");
  }

  function openBookingEditFromActions() {
    if (!activeOccupancy) {
      return;
    }

    openBookingModal({
      roomId: activeOccupancy.roomId,
      sourceOccupancy: activeOccupancy,
    });
  }

  async function checkInFromActions() {
    if (!selectedPropertyId || !activeOccupancy) {
      return;
    }

    if (activeOccupancy.status === "CHECKED_IN") {
      return;
    }

    setIsSavingOccupancyAction(true);
    setOccupancyActionsError("");
    try {
      const response = await fetch(
        `/api/properties/${selectedPropertyId}/rooms/${activeOccupancy.roomId}/occupancy/${activeOccupancy.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dateFrom: activeOccupancy.dateFrom,
            dateTo: activeOccupancy.dateTo,
            timeFrom: activeOccupancy.timeFrom,
            timeTo: activeOccupancy.timeTo,
            status: "CHECKED_IN",
            tag: activeOccupancy.tag ? activeOccupancy.tag.slice(0, 20) : null,
            source: activeOccupancy.source,
            color: activeOccupancy.color,
            adultsCount: activeOccupancy.adultsCount,
            childrenCount: activeOccupancy.childrenCount,
            guestName: activeOccupancy.guestName ?? "Гость",
            guestPhone: activeOccupancy.guestPhone,
            guestContacts: activeOccupancy.guestContacts,
            description: activeOccupancy.description,
          }),
        },
      );
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setOccupancyActionsError(readResponseError(body, "Не удалось заселить гостя"));
        return;
      }

      setMessageSuccess("Гость заселен");
      setMessageError("");
      closeOccupancyActions();
      setReloadKey((prev) => prev + 1);
    } catch {
      setOccupancyActionsError("Не удалось заселить гостя");
    } finally {
      setIsSavingOccupancyAction(false);
    }
  }

  async function cancelFromActions() {
    if (!selectedPropertyId || !activeOccupancy) {
      return;
    }

    setIsSavingOccupancyAction(true);
    setOccupancyActionsError("");
    try {
      const response = await fetch(
        `/api/properties/${selectedPropertyId}/rooms/${activeOccupancy.roomId}/occupancy/${activeOccupancy.id}`,
        { method: "DELETE" },
      );
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setOccupancyActionsError(readResponseError(body, "Не удалось отменить бронирование"));
        return;
      }

      setMessageSuccess("Бронирование отменено");
      setMessageError("");
      closeOccupancyActions();
      setReloadKey((prev) => prev + 1);
    } catch {
      setOccupancyActionsError("Не удалось отменить бронирование");
    } finally {
      setIsSavingOccupancyAction(false);
    }
  }

  async function savePricePeriod() {
    if (!selectedPropertyId || !priceForm) {
      return;
    }

    const room = roomLookupById.get(priceForm.roomId) ?? null;
    if (!room) {
      setPriceModalError("Выберите номер");
      return;
    }

    const dateFrom = parseIsoDate(priceForm.dateFrom);
    const dateTo = parseIsoDate(priceForm.dateTo);

    if (!dateFrom || !dateTo || dateTo < dateFrom) {
      setPriceModalError("Проверьте период цены: дата окончания не может быть раньше начала");
      return;
    }

    const normalizedPrice = Number(priceForm.priceInput.replace(",", ".").trim());
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      setPriceModalError("Укажите корректную цену за ночь");
      return;
    }

    const minGuestsValue = priceForm.minGuestsInput.trim();
    let minGuests: number | null = null;
    if (priceForm.priceType === "PER_PERSON" && minGuestsValue.length > 0) {
      const parsedMinGuests = Number.parseInt(minGuestsValue, 10);
      if (!Number.isFinite(parsedMinGuests) || parsedMinGuests < 1) {
        setPriceModalError("Минимум гостей должен быть целым числом от 1");
        return;
      }
      if (parsedMinGuests > 40) {
        setPriceModalError("Минимум гостей не может быть больше 40");
        return;
      }
      const capacity = room.beds + room.extraBeds;
      if (parsedMinGuests > capacity) {
        setPriceModalError(`Минимум гостей не может превышать вместимость номера (${capacity})`);
        return;
      }
      minGuests = parsedMinGuests;
    }

    const minNightsValue = priceForm.minNightsInput.trim();
    let minNights: number | null = null;
    if (minNightsValue.length > 0) {
      const parsedMinNights = Number.parseInt(minNightsValue, 10);
      if (!Number.isFinite(parsedMinNights) || parsedMinNights < 1) {
        setPriceModalError("Минимум ночей должен быть целым числом от 1");
        return;
      }
      if (parsedMinNights > 60) {
        setPriceModalError("Минимум ночей не может быть больше 60");
        return;
      }
      minNights = parsedMinNights;
    }

    const extraBedPriceValue = priceForm.extraBedPriceInput.trim().replace(",", ".");
    let extraBedPrice: number | null = null;
    if (priceForm.priceType === "PER_ROOM" && room.extraBeds > 0 && extraBedPriceValue.length > 0) {
      const parsedExtraBedPrice = Number(extraBedPriceValue);
      if (!Number.isFinite(parsedExtraBedPrice) || parsedExtraBedPrice <= 0) {
        setPriceModalError("Укажите корректную цену доп. места");
        return;
      }
      if (parsedExtraBedPrice > 1_000_000) {
        setPriceModalError("Цена доп. места слишком большая");
        return;
      }
      extraBedPrice = parsedExtraBedPrice;
    }

    setIsSavingPrice(true);
    setPriceModalError("");

    try {
      const requestUrl = priceForm.editingPriceId
        ? `/api/properties/${selectedPropertyId}/rooms/${priceForm.roomId}/prices/${priceForm.editingPriceId}`
        : `/api/properties/${selectedPropertyId}/rooms/${priceForm.roomId}/prices`;

      const response = await fetch(requestUrl, {
        method: priceForm.editingPriceId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: priceForm.dateFrom,
          dateTo: priceForm.dateTo,
          price: normalizedPrice,
          priceType: priceForm.priceType,
          minGuests,
          minNights,
          extraBedPrice,
          currency: priceForm.currency.trim().toUpperCase() || "RUB",
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setPriceModalError(
          readResponseError(
            body,
            priceForm.editingPriceId
              ? "Не удалось обновить период цены"
              : "Не удалось создать период цены",
          ),
        );
        return;
      }

      await refreshRooms();
      setMessageSuccess(
        priceForm.editingPriceId
          ? "Период цены обновлен и отображен в шахматке цен"
          : "Период цены создан и отображен в шахматке цен",
      );
      setMessageError("");
      closePriceModal();
    } catch {
      setPriceModalError(
        priceForm.editingPriceId
          ? "Не удалось обновить период цены"
          : "Не удалось создать период цены",
      );
    } finally {
      setIsSavingPrice(false);
    }
  }

  async function deletePricePeriod() {
    if (!selectedPropertyId || !priceForm?.editingPriceId) {
      return;
    }

    setIsSavingPrice(true);
    setPriceModalError("");

    try {
      const response = await fetch(
        `/api/properties/${selectedPropertyId}/rooms/${priceForm.roomId}/prices/${priceForm.editingPriceId}`,
        { method: "DELETE" },
      );

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setPriceModalError(readResponseError(body, "Не удалось удалить период цены"));
        return;
      }

      await refreshRooms();
      setMessageSuccess("Период цены удален");
      setMessageError("");
      closePriceModal();
    } catch {
      setPriceModalError("Не удалось удалить период цены");
    } finally {
      setIsSavingPrice(false);
    }
  }

  async function duplicatePricePeriods() {
    if (!selectedPropertyId || !duplicatePricesForm) {
      return;
    }

    const sourceRoom = roomLookupById.get(duplicatePricesForm.sourceRoomId) ?? null;
    if (!sourceRoom) {
      setDuplicatePricesError("Выберите номер, из которого нужно копировать цены");
      return;
    }

    const dateFrom = parseIsoDate(duplicatePricesForm.dateFrom);
    const dateTo = parseIsoDate(duplicatePricesForm.dateTo);

    if (!dateFrom || !dateTo || dateTo < dateFrom) {
      setDuplicatePricesError("Проверьте диапазон: дата окончания не может быть раньше начала");
      return;
    }

    const targetRoomIds = duplicatePricesForm.targetRoomIds.filter(
      (roomId) => roomId !== duplicatePricesForm.sourceRoomId && roomLookupById.has(roomId),
    );

    if (targetRoomIds.length === 0) {
      setDuplicatePricesError("Выберите хотя бы один номер, куда копировать цены");
      return;
    }

    const periodsToCopy = sourceRoom.prices
      .filter(
        (price) =>
          compareIsoDates(price.dateFrom, duplicatePricesForm.dateTo) <= 0 &&
          compareIsoDates(price.dateTo, duplicatePricesForm.dateFrom) >= 0,
      )
      .map((price) => ({
        dateFrom: maxIsoDate(price.dateFrom, duplicatePricesForm.dateFrom),
        dateTo: minIsoDate(price.dateTo, duplicatePricesForm.dateTo),
        price: price.price,
        priceType: price.priceType,
        minGuests: price.minGuests,
        minNights: price.minNights,
        extraBedPrice: price.extraBedPrice,
        currency: price.currency,
      }));

    if (periodsToCopy.length === 0) {
      setDuplicatePricesError("В выбранном диапазоне у исходного номера нет цен для копирования");
      return;
    }

    setIsDuplicatingPrices(true);
    setDuplicatePricesError("");

    try {
      const requests = targetRoomIds.flatMap((targetRoomId) =>
        periodsToCopy.map((period) => ({
          targetRoomId,
          targetRoom: roomLookupById.get(targetRoomId),
          period,
        })),
      );

      const results = await Promise.all(
        requests.map(async ({ targetRoomId, targetRoom, period }) => {
          const response = await fetch(
            `/api/properties/${selectedPropertyId}/rooms/${targetRoomId}/prices`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(period),
            },
          );

          let body: unknown = {};
          try {
            body = await response.json();
          } catch {
            body = {};
          }

          return {
            ok: response.ok,
            roomTitle: targetRoom?.title ?? "Номер",
            periodLabel: formatDateRangeLabel(period.dateFrom, period.dateTo),
            error: readResponseError(body, "Не удалось создать период цены"),
          };
        }),
      );

      const failures = results.filter((result) => !result.ok);
      const copiedCount = results.length - failures.length;

      await refreshRooms();

      if (failures.length > 0) {
        const failurePreview = failures
          .slice(0, 4)
          .map((failure) => `${failure.roomTitle}, ${failure.periodLabel}: ${failure.error}`)
          .join("; ");
        setDuplicatePricesError(
          copiedCount > 0
            ? `Часть цен скопирована (${copiedCount}), но есть конфликты: ${failurePreview}`
            : `Цены не скопированы: ${failurePreview}`,
        );
        return;
      }

      setMessageSuccess(
        `Цены скопированы: ${periodsToCopy.length} периодов в ${targetRoomIds.length} номеров`,
      );
      setMessageError("");
      closeDuplicatePricesModal();
    } catch {
      setDuplicatePricesError("Не удалось продублировать цены");
    } finally {
      setIsDuplicatingPrices(false);
    }
  }

  async function copyYearPricePeriods() {
    if (!selectedPropertyId || !copyYearPricesForm) {
      return;
    }

    const sourceYear = parseYearInput(copyYearPricesForm.sourceYearInput);
    const targetYear = parseYearInput(copyYearPricesForm.targetYearInput);

    if (!sourceYear || !targetYear) {
      setCopyYearPricesError("Укажите годы в формате 2026");
      return;
    }

    if (sourceYear === targetYear) {
      setCopyYearPricesError("Годы должны отличаться");
      return;
    }

    setIsCopyingYearPrices(true);
    setCopyYearPricesError("");

    try {
      const response = await fetch(`/api/properties/${selectedPropertyId}/prices/copy-year`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceYear,
          targetYear,
          replaceExisting: copyYearPricesForm.replaceExisting,
        }),
      });

      const body = (await response.json()) as {
        copiedCount?: number;
        roomsCount?: number;
        replacedCount?: number;
        error?: string;
      };

      if (!response.ok) {
        setCopyYearPricesError(readResponseError(body, "Не удалось перенести цены"));
        return;
      }

      await refreshRooms();
      applyBoardPeriodRange(getYearStartIso(targetYear), getYearEndIso(targetYear));
      setMessageSuccess(
        `Цены перенесены: ${body.copiedCount ?? 0} периодов из ${sourceYear} в ${targetYear}`,
      );
      setMessageError("");
      closeCopyYearPricesModal();
    } catch {
      setCopyYearPricesError("Не удалось перенести цены");
    } finally {
      setIsCopyingYearPrices(false);
    }
  }

  const selectedBookingRoom = bookingForm ? (roomLookupById.get(bookingForm.roomId) ?? null) : null;
  const visibleBookingRoomEntries = useMemo(
    () =>
      roomPagerEntries.slice(
        bookingRoomPage * mobileRoomsPerPage,
        bookingRoomPage * mobileRoomsPerPage + mobileRoomsPerPage,
      ),
    [bookingRoomPage, roomPagerEntries],
  );
  const selectedPriceRoom = priceForm ? (roomLookupById.get(priceForm.roomId) ?? null) : null;
  const canSetExtraBedPrice =
    priceForm?.priceType === "PER_ROOM" && (selectedPriceRoom?.extraBeds ?? 0) > 0;
  const duplicateSourceRoom = duplicatePricesForm
    ? (roomLookupById.get(duplicatePricesForm.sourceRoomId) ?? null)
    : null;
  const duplicateTargetRooms = duplicatePricesForm
    ? duplicatePricesForm.targetRoomIds
        .map((roomId) => roomLookupById.get(roomId) ?? null)
        .filter((room): room is SerializedChessboardRoom => room !== null)
    : [];
  const duplicatePricePeriodsPreview = useMemo(() => {
    if (!duplicatePricesForm) {
      return [];
    }

    const sourceRoom = roomLookupById.get(duplicatePricesForm.sourceRoomId);
    if (!sourceRoom) {
      return [];
    }

    return sourceRoom.prices
      .filter(
        (price) =>
          compareIsoDates(price.dateFrom, duplicatePricesForm.dateTo) <= 0 &&
          compareIsoDates(price.dateTo, duplicatePricesForm.dateFrom) >= 0,
      )
      .map((price) => ({
        ...price,
        dateFrom: maxIsoDate(price.dateFrom, duplicatePricesForm.dateFrom),
        dateTo: minIsoDate(price.dateTo, duplicatePricesForm.dateTo),
      }));
  }, [duplicatePricesForm, roomLookupById]);
  const copyYearSourceYear = copyYearPricesForm
    ? parseYearInput(copyYearPricesForm.sourceYearInput)
    : null;
  const copyYearPricePeriodsPreview = useMemo(() => {
    if (!copyYearSourceYear) {
      return [];
    }

    const yearStart = getYearStartIso(copyYearSourceYear);
    const yearEnd = getYearEndIso(copyYearSourceYear);

    return rooms.flatMap((room) =>
      room.prices
        .filter(
          (price) =>
            compareIsoDates(price.dateFrom, yearEnd) <= 0 &&
            compareIsoDates(price.dateTo, yearStart) >= 0,
        )
        .map((price) => ({
          ...price,
          roomTitle: room.title,
          dateFrom: maxIsoDate(price.dateFrom, yearStart),
          dateTo: minIsoDate(price.dateTo, yearEnd),
        })),
    );
  }, [copyYearSourceYear, rooms]);
  const copyYearRoomsCount = useMemo(
    () => new Set(copyYearPricePeriodsPreview.map((price) => price.roomId)).size,
    [copyYearPricePeriodsPreview],
  );
  const bookingStatusLabel = bookingForm?.status === "CHECKED_IN" ? "Заселен" : "Подтверждено";
  const bookingCreatedAtLabel = bookingForm?.createdAt
    ? new Date(bookingForm.createdAt).toLocaleString("ru-RU")
    : null;
  const bookingNights = bookingForm ? getStayNights(bookingForm.dateFrom, bookingForm.dateTo) : 0;
  const pricePeriodNights = priceForm ? getStayNights(priceForm.dateFrom, priceForm.dateTo) : 0;
  const activeOccupancyNights = activeOccupancy
    ? getStayNights(activeOccupancy.dateFrom, activeOccupancy.dateTo)
    : 0;
  const activeOccupancyStatusLabel =
    activeOccupancy?.status === "CHECKED_IN" ? "Заселен" : "Подтверждено";
  const activeOccupancyRoom = activeOccupancy
    ? (roomLookupById.get(activeOccupancy.roomId) ?? null)
    : null;
  const activeOccupancyCreatedAtLabel = activeOccupancy
    ? new Date(activeOccupancy.createdAt).toLocaleString("ru-RU")
    : null;
  const activeOccupancyPeriodLabel = activeOccupancy
    ? formatDateRangeLabel(activeOccupancy.dateFrom, activeOccupancy.dateTo)
    : "—";
  const activeOccupancyTimeLabel = activeOccupancy
    ? formatTimeRangeLabel(activeOccupancy.timeFrom ?? "", activeOccupancy.timeTo ?? "")
    : "—";
  const activeOccupancyPhoneLabel = activeOccupancy?.guestPhone?.trim() || "—";
  const activeOccupancyGuestsLabel = activeOccupancy
    ? formatGuestPartyLabel(activeOccupancy.adultsCount, activeOccupancy.childrenCount)
    : "—";
  const activeOccupancyColorLabel = activeOccupancy
    ? getBookingColorLabel(activeOccupancy.color)
    : "—";
  const calendarSyncRoom = calendarSyncRoomId
    ? (roomLookupById.get(calendarSyncRoomId) ?? null)
    : null;
  const calendarSyncLastSyncedLabel = calendarSyncConfig?.lastSyncedAt
    ? new Date(calendarSyncConfig.lastSyncedAt).toLocaleString("ru-RU")
    : "Еще не запускался";
  const calendarSyncStatusLabel = getCalendarSyncStatusLabel(
    calendarSyncConfig?.lastSyncStatus ?? null,
  );
  const enabledCalendarSyncSourcesCount = calendarSyncSources.filter(
    (source) => source.isEnabled && source.importUrl.trim(),
  ).length;

  return (
    <div className="chessboard-workspace space-y-2.5">
      <section className="space-y-2.5">
        <div className="rounded-xl border border-olive/10 bg-white/95 p-2.5 shadow-[0_10px_26px_-24px_rgba(58,43,35,0.4)] md:p-3 [@media(orientation:landscape)_and_(max-height:560px)]:rounded-lg [@media(orientation:landscape)_and_(max-height:560px)]:p-1.5">
          {/* Row 1: Object selector + mode toggle */}
          <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center [@media(orientation:landscape)_and_(max-height:560px)]:grid-cols-[minmax(0,1fr)_auto] [@media(orientation:landscape)_and_(max-height:560px)]:gap-1">
            <div className="relative min-w-0" ref={objectMenuRef}>
              <button
                type="button"
                className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-olive/14 bg-cream/55 px-3 text-left text-[13px] font-semibold text-olive transition hover:bg-cream sm:min-w-[220px] sm:text-sm [@media(orientation:landscape)_and_(max-height:560px)]:h-8 [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:text-[11px]"
                onClick={() => setIsObjectMenuOpen((prev) => !prev)}
              >
                <span className="truncate">{selectedProperty?.name ?? "Выберите объект"}</span>
                <AppIcon
                  icon={ChevronDown}
                  className="h-4 w-4 shrink-0 [@media(orientation:landscape)_and_(max-height:560px)]:h-3.5 [@media(orientation:landscape)_and_(max-height:560px)]:w-3.5"
                />
              </button>

              {isObjectMenuOpen ? (
                <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[220px] rounded-lg border border-olive/12 bg-white p-1 shadow-[0_16px_36px_-24px_rgba(58,43,35,0.28)]">
                  {properties.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-olive/70">Нет доступных объектов</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                      {properties.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={cn(
                            "block w-full rounded-lg px-3 py-2 text-left text-sm text-olive transition hover:bg-cream",
                            item.id === selectedPropertyId
                              ? "bg-primary/5 font-semibold text-primary"
                              : "",
                          )}
                          onClick={() => {
                            setSelectedPropertyId(item.id);
                            setIsObjectMenuOpen(false);
                            setMessageSuccess("");
                            setMessageError("");
                          }}
                        >
                          <span className="block truncate">
                            {item.name ?? "Объект без названия"}
                          </span>
                          <span className="text-[11px] text-olive/55">
                            {item.statusLabel} | {item.activeRoomsCount} ном.
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="inline-flex h-9 w-full rounded-lg border border-olive/15 bg-cream/45 p-0.5 sm:w-auto [@media(orientation:landscape)_and_(max-height:560px)]:h-8">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-3 text-[11px] font-semibold transition-all duration-200 sm:flex-none sm:text-xs [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:text-[11px]",
                  boardMode === "occupancy"
                    ? "bg-primary text-white shadow-[0_8px_18px_-14px_rgba(15,118,110,0.9)]"
                    : "text-olive/70 hover:text-olive",
                )}
                onClick={() => {
                  setBoardMode("occupancy");
                  setDragSelection(null);
                }}
              >
                Занятость
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-3 text-[11px] font-semibold transition-all duration-200 sm:flex-none sm:text-xs [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:text-[11px]",
                  boardMode === "prices"
                    ? "bg-primary text-white shadow-[0_8px_18px_-14px_rgba(15,118,110,0.9)]"
                    : "text-olive/70 hover:text-olive",
                )}
                onClick={() => {
                  setBoardMode("prices");
                  setDragSelection(null);
                }}
              >
                Цены
              </button>
            </div>
          </div>

          {/* Row 2: quick actions + period navigation */}
          <div className="mt-2 overflow-x-auto custom-scrollbar">
            <div className="flex min-w-max items-center gap-1.5 pb-0.5 sm:min-w-0 sm:flex-wrap">
              {returnHref ? (
                <Link
                  href={returnHref}
                  className={cn(
                    compactToolbarButtonClass,
                    "shrink-0 gap-1.5 border-primary/25 text-primary hover:border-primary/35 hover:bg-primary/6 hover:text-primary",
                  )}
                >
                  <AppIcon icon={ChevronLeft} className="h-3.5 w-3.5" />
                  {returnLabel}
                </Link>
              ) : null}
              {boardMode === "occupancy" ? (
                <>
                  <Button
                    className={cn(compactToolbarPrimaryButtonClass, "shrink-0")}
                    onClick={() => openBookingModal()}
                    disabled={!canManageCalendar}
                  >
                    + Бронь
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className={cn(compactToolbarPrimaryButtonClass, "shrink-0")}
                    onClick={() => openPriceModal()}
                    disabled={!canManageCalendar}
                  >
                    + Цена
                  </Button>
                </>
              )}
              <button
                type="button"
                className={cn(compactToolbarButtonClass, "shrink-0")}
                onClick={() => jumpToDate(getLocalTodayIso())}
              >
                Сегодня
              </button>
              <SingleDatePopoverField
                value={periodStartIso}
                onChange={(nextValue) => {
                  if (!parseIsoDate(nextValue)) {
                    return;
                  }
                  updatePeriodStart(nextValue);
                }}
                placeholder="Начало"
                helperText="Дата начала диапазона"
                showAdornment={false}
                allowClear={false}
                monthCount={24}
                desktopPanelStyle="dialog"
                desktopPopoverAlign="left"
                rootClassName="shrink-0"
                buttonClassName={cn(compactToolbarButtonClass, "w-auto min-w-[126px]")}
              />
              <SingleDatePopoverField
                value={periodEndIso}
                onChange={(nextValue) => {
                  if (!parseIsoDate(nextValue)) {
                    return;
                  }
                  updatePeriodEnd(nextValue);
                }}
                placeholder="Конец"
                helperText="Дата конца диапазона"
                showAdornment={false}
                allowClear={false}
                monthCount={24}
                desktopPanelStyle="dialog"
                desktopPopoverAlign="left"
                rootClassName="shrink-0"
                buttonClassName={cn(compactToolbarButtonClass, "w-auto min-w-[126px]")}
              />
              {selectedPropertyId && properties.length > 0 ? (
                <div className={cn(compactToolbarNavShellClass, "shrink-0 sm:ml-auto")}>
                  <button
                    type="button"
                    className="inline-flex h-full w-8 items-center justify-center rounded-md border border-olive/14 bg-white text-olive/60 transition hover:bg-cream hover:text-olive"
                    onClick={() => shiftVisiblePeriod(-periodDaysCount)}
                    aria-label="Назад"
                  >
                    <AppIcon
                      icon={ChevronLeft}
                      className="h-3.5 w-3.5 [@media(orientation:landscape)_and_(max-height:560px)]:h-3 [@media(orientation:landscape)_and_(max-height:560px)]:w-3"
                    />
                  </button>
                  <span className="truncate rounded-md bg-white px-2 py-1 text-center text-[11px] font-semibold text-olive/72 sm:text-xs">
                    {periodHeaderLabel}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-full w-8 items-center justify-center rounded-md border border-olive/14 bg-white text-olive/60 transition hover:bg-cream hover:text-olive"
                    onClick={() => shiftVisiblePeriod(periodDaysCount)}
                    aria-label="Вперед"
                  >
                    <AppIcon
                      icon={ChevronRight}
                      className="h-3.5 w-3.5 [@media(orientation:landscape)_and_(max-height:560px)]:h-3 [@media(orientation:landscape)_and_(max-height:560px)]:w-3"
                    />
                  </button>
                </div>
              ) : null}
              {boardMode === "occupancy" ? (
                <>
                  <button
                    type="button"
                    className={cn(
                      compactToolbarButtonClass,
                      "shrink-0",
                      isRoomOrderMode
                        ? "border-primary/30 bg-primary/8 text-primary"
                        : "text-olive/72",
                    )}
                    onClick={() => {
                      setIsRoomOrderMode((prev) => !prev);
                      setDragSelection(null);
                    }}
                    disabled={!canManageCalendar || rooms.length < 2}
                  >
                    {isRoomOrderMode ? "Готово" : "Порядок номеров"}
                  </button>
                  <button
                    type="button"
                    className={cn(compactToolbarButtonClass, "shrink-0 gap-1.5")}
                    onClick={() => openCalendarSyncModal()}
                    disabled={!canManageCalendar}
                  >
                    <AppIcon icon={CalendarDays} className="h-3.5 w-3.5" />
                    Синхронизация
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={cn(compactToolbarButtonClass, "shrink-0 gap-1.5")}
                    onClick={openCopyYearPricesModal}
                    disabled={!canManageCalendar}
                  >
                    <AppIcon icon={Copy} className="h-3.5 w-3.5" />
                    Перенести год
                  </button>
                  <button
                    type="button"
                    className={cn(
                      compactToolbarButtonClass,
                      "shrink-0",
                      isRoomOrderMode
                        ? "border-primary/30 bg-primary/8 text-primary"
                        : "text-olive/72",
                    )}
                    onClick={() => {
                      setIsRoomOrderMode((prev) => !prev);
                      setDragSelection(null);
                    }}
                    disabled={!canManageCalendar || rooms.length < 2}
                  >
                    {isRoomOrderMode ? "Готово" : "Порядок номеров"}
                  </button>
                  <button
                    type="button"
                    className={cn(compactToolbarButtonClass, "shrink-0")}
                    onClick={openDuplicatePricesModal}
                    disabled={!canManageCalendar || rooms.length < 2}
                  >
                    Дублировать цены
                  </button>
                </>
              )}
              <span
                className={cn(
                  "hidden shrink-0 items-center rounded-full px-2 py-1 text-[10px] font-semibold sm:inline-flex",
                  isLoadingRooms || isLoadingOccupancies
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700",
                )}
              >
                {isLoadingRooms || isLoadingOccupancies ? "Обновляем..." : "Актуально"}
              </span>
            </div>
          </div>
        </div>

        {messageError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {messageError}
          </p>
        ) : null}
        {messageSuccess ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {messageSuccess}
          </p>
        ) : null}

        {properties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-olive/25 bg-cream/70 p-4 text-sm text-olive/75">
            У вас пока нет объектов. Добавьте объект в разделе «Объекты», после этого шахматка
            станет доступна.
          </div>
        ) : null}

        {selectedPropertyId && properties.length > 0 ? (
          <div className="rounded-xl border border-olive/10 bg-white/96 p-1.5 md:p-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:rounded-lg [@media(orientation:landscape)_and_(max-height:560px)]:p-1.5">
            {rooms.length === 0 && !isLoadingRooms ? (
              <p className="rounded-lg border border-dashed border-olive/30 px-3 py-3 text-sm text-olive/65">
                В объекте пока нет активных номеров. Добавьте номер в разделе «Номерной фонд».
              </p>
            ) : null}

            {rooms.length > 0 && showMobileBoardPager ? (
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-olive/10 bg-cream/62 px-2 py-1.5">
                <span className="shrink-0 text-xs font-semibold text-olive/70">
                  Номера {visibleBoardRoomStartIndex + 1}-{visibleBoardRoomEndIndex} из{" "}
                  {roomPagerEntries.length}
                </span>
                <CompactPageDots
                  pageCount={mobileBoardRoomPageCount}
                  currentPage={activeMobileBoardRoomPage}
                  onChange={changeMobileBoardRoomPage}
                  className="ml-auto max-w-full"
                />
              </div>
            ) : null}

            {rooms.length > 0 && isRoomOrderMode ? (
              <div className="mb-2 overflow-hidden rounded-xl border border-primary/14 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(255,255,255,0.97))] shadow-[0_18px_34px_-30px_rgba(15,118,110,0.5)]">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-primary/10 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-olive">Порядок номеров в шахматке</p>
                    <p className="mt-0.5 text-xs text-olive/62">
                      Меняйте строки местами: цены и занятость останутся привязаны к своим номерам.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={cn(compactToolbarButtonClass, "shrink-0")}
                    onClick={() => {
                      setIsRoomOrderMode(false);
                      setDraggingRoomId(null);
                      setDragOverRoomId(null);
                    }}
                  >
                    Готово
                  </button>
                </div>

                <div className="grid gap-1.5 p-2 sm:p-3">
                  {orderedRooms.map((room, index) => {
                    const isFirstRoom = index === 0;
                    const isLastRoom = index === orderedRooms.length - 1;
                    const isDragging = draggingRoomId === room.id;
                    const isDragTarget = dragOverRoomId === room.id && draggingRoomId !== room.id;

                    return (
                      <article
                        key={room.id}
                        draggable={!isCoarsePointer && !isReorderingRooms}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", room.id);
                          setDraggingRoomId(room.id);
                          setDragOverRoomId(room.id);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          if (dragOverRoomId !== room.id) {
                            setDragOverRoomId(room.id);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const sourceRoomId =
                            event.dataTransfer.getData("text/plain") || draggingRoomId;
                          setDragOverRoomId(null);
                          setDraggingRoomId(null);
                          if (sourceRoomId) {
                            reorderRoomByDrop(sourceRoomId, room.id);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggingRoomId(null);
                          setDragOverRoomId(null);
                        }}
                        className={cn(
                          "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-white/94 p-2.5 shadow-[0_12px_24px_-24px_rgba(58,43,35,0.45)] transition sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]",
                          isReorderingRooms
                            ? "cursor-wait opacity-70"
                            : "cursor-grab active:cursor-grabbing",
                          isDragging
                            ? "scale-[0.99] border-primary/30 opacity-55"
                            : "border-olive/10",
                          isDragTarget
                            ? "border-primary/45 bg-primary/6 shadow-[0_18px_34px_-24px_rgba(15,118,110,0.45)]"
                            : "hover:border-primary/20 hover:bg-white",
                        )}
                      >
                        <span className="hidden h-10 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-olive/18 bg-cream/65 text-olive/46 transition group-hover:border-primary/25 group-hover:text-primary sm:inline-flex">
                          <AppIcon icon={MoreVertical} className="h-4 w-4" />
                        </span>
                        <span className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-primary/12 bg-primary/7 px-2 text-sm font-bold text-primary">
                          {index + 1}
                        </span>
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-olive">
                              {room.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-olive/55">
                              {formatRoomMeta(room)}
                            </p>
                          </div>
                          <select
                            value={index + 1}
                            onChange={(event) =>
                              moveRoomToPosition(room.id, Number.parseInt(event.target.value, 10))
                            }
                            disabled={isReorderingRooms}
                            aria-label="Позиция номера в шахматке"
                            className="hidden h-9 shrink-0 rounded-lg border border-olive/15 bg-white px-2 text-xs font-semibold text-olive outline-none transition hover:bg-cream focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-55 sm:block"
                          >
                            {orderedRooms.map((item, positionIndex) => (
                              <option key={item.id} value={positionIndex + 1}>
                                {positionIndex + 1}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            className="inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border border-olive/12 bg-cream/60 px-2 text-xs font-semibold text-olive transition hover:border-primary/20 hover:bg-primary/6 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => moveRoom(room.id, -1)}
                            disabled={isFirstRoom || isReorderingRooms}
                            aria-label="Поднять номер выше"
                          >
                            <AppIcon icon={ChevronUp} className="h-4 w-4" />
                            Выше
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border border-olive/12 bg-cream/60 px-2 text-xs font-semibold text-olive transition hover:border-primary/20 hover:bg-primary/6 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => moveRoom(room.id, 1)}
                            disabled={isLastRoom || isReorderingRooms}
                            aria-label="Опустить номер ниже"
                          >
                            <AppIcon icon={ChevronDown} className="h-4 w-4" />
                            Ниже
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {rooms.length > 0 ? (
              <div
                ref={boardScrollRef}
                className="chessboard-board-scroll custom-scrollbar relative isolate mt-1.5 max-h-[70dvh] overflow-auto overscroll-contain rounded-lg border border-olive/10 bg-[linear-gradient(180deg,rgba(247,243,235,0.78),rgba(255,255,255,0.98)_18%,rgba(255,255,255,0.98))] md:max-h-[78vh] [@media(orientation:landscape)_and_(max-height:560px)]:mt-1 [@media(orientation:landscape)_and_(max-height:560px)]:max-h-[72dvh]"
              >
                <table className="relative z-0 min-w-max border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th
                        className={cn(
                          `sticky left-0 top-0 z-[70] overflow-hidden border-b border-r border-olive/10 bg-[#f7f3eb] px-1.5 text-left text-[10px] font-semibold text-olive md:px-2.5 md:text-xs ${LS}:px-1.5 ${LS}:text-[10px]`,
                        )}
                        style={{
                          width: "var(--cb-sidebar-w)",
                          minWidth: "var(--cb-sidebar-w)",
                          height: "var(--cb-header-h1)",
                        }}
                      >
                        <span className="block truncate">
                          {isMobilePortrait
                            ? boardMode === "occupancy"
                              ? "Брони"
                              : "Цены"
                            : boardMode === "occupancy"
                              ? "Занятость"
                              : "Цены"}
                        </span>
                      </th>
                      {visibleMonthSegments.map((segment, segmentIndex) => (
                        <th
                          key={segment.key}
                          colSpan={segment.daysCount}
                          className={cn(
                            `sticky top-0 z-[60] border-b px-0 text-center text-[11px] font-semibold text-olive/82 md:text-xs ${LS}:text-[10px]`,
                            segmentIndex === 0
                              ? "border-l border-olive/10"
                              : "border-l-2 border-l-terra/32",
                            segmentIndex % 2 === 0 ? "bg-[#f7f3eb]" : "bg-[#f2ecdf]",
                          )}
                          style={{ height: "var(--cb-header-h1)" }}
                        >
                          <div className="flex h-full items-center justify-center px-2 md:px-3">
                            <span
                              className={cn(
                                "block truncate",
                                segment.daysCount <= 2 ? "text-[10px] lowercase" : "",
                              )}
                            >
                              {segment.daysCount <= 2 ? segment.compactLabel : segment.label}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th
                        className={cn(
                          `sticky left-0 z-[70] border-b border-r border-olive/10 bg-white px-2 text-left text-[9px] uppercase tracking-[0.12em] text-olive/48 md:px-2.5 md:text-[10px] ${LS}:px-1.5 ${LS}:text-[8px]`,
                        )}
                        style={{
                          top: "var(--cb-header-h1)",
                          width: "var(--cb-sidebar-w)",
                          minWidth: "var(--cb-sidebar-w)",
                          height: "var(--cb-header-h2)",
                        }}
                      >
                        Номер
                      </th>
                      {visibleDays.map((day) => {
                        const isDayToday = day.iso === initialTodayIso;
                        return (
                          <th
                            key={day.iso}
                            className={cn(
                              `sticky z-[60] border-b border-l border-olive/10 px-0 text-center ${LS}:px-0`,
                              isDayToday
                                ? "bg-[#f1f8f7]"
                                : day.isMonthStart
                                  ? "bg-[linear-gradient(180deg,#f4ebe1,#fffaf5)]"
                                  : day.isWeekend
                                    ? "bg-[#f7f3ed]"
                                    : "bg-white",
                              day.isMonthStart
                                ? "border-l-2 border-l-terra/40 shadow-[inset_1px_0_0_rgba(154,98,69,0.14)]"
                                : day.isWeekStart
                                  ? "border-l-terra/35"
                                  : "",
                              isDayToday ? "shadow-[inset_0_0_0_1px_rgba(15,118,110,0.1)]" : "",
                            )}
                            style={{
                              top: "var(--cb-header-h1)",
                              width: "var(--cb-cell-w)",
                              minWidth: "var(--cb-cell-w)",
                              height: "var(--cb-header-h2)",
                            }}
                          >
                            <span
                              className={cn(
                                `block font-semibold leading-none ${LS}:text-[9px]`,
                                isMobilePortrait ? "text-[11px]" : "text-[11px] md:text-xs",
                                isDayToday ? "text-primary" : "text-olive",
                              )}
                            >
                              {day.dayNumber}
                            </span>
                            <span
                              className={cn(
                                `mt-1 block uppercase leading-none ${LS}:text-[7px]`,
                                isMobilePortrait ? "text-[8px]" : "text-[8px] md:text-[10px]",
                                isDayToday
                                  ? "font-semibold text-primary/72"
                                  : day.isWeekend
                                    ? "font-medium text-terra/80"
                                    : "text-olive/55",
                              )}
                            >
                              {day.weekDayLabel}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {groupedRoomsWithOffset.map((group) => (
                      <FragmentByGroup
                        key={group.key}
                        groupLabel={group.groupLabel}
                        rooms={group.items}
                        visibleDays={visibleDays}
                        boardMode={boardMode}
                        dragSelection={normalizedDragSelection}
                        occupancyLookup={occupancyLookup}
                        priceLookup={priceLookup}
                        dayCellWidthPx={dayCellWidthPx}
                        isCoarsePointer={isCoarsePointer}
                        isMobilePortrait={isMobilePortrait}
                        todayIso={initialTodayIso}
                        rowOffset={group.rowOffset}
                        expandedMobileRailKey={expandedMobileRailKey}
                        onDismissMobileRail={() => setExpandedMobileRailKey(null)}
                        onToggleMobileRail={(key) =>
                          setExpandedMobileRailKey((prev) => (prev === key ? null : key))
                        }
                        onCellMouseDown={(roomId, dayIso, hasOccupancy, pointer) => {
                          if (isRoomOrderMode) {
                            return;
                          }
                          if (boardMode === "occupancy" && hasOccupancy) {
                            return;
                          }
                          beginDragSelection(roomId, dayIso, pointer);
                        }}
                        onCellMouseEnter={(roomId, dayIso, hasOccupancy) => {
                          if (!dragSelection || dragSelection.roomId !== roomId) {
                            return;
                          }
                          if (boardMode === "occupancy" && hasOccupancy) {
                            return;
                          }
                          extendDragSelection(roomId, dayIso);
                        }}
                        onCellTap={(roomId, dayIso, hasOccupancy, price) => {
                          if (isRoomOrderMode) {
                            return;
                          }
                          if (boardMode === "occupancy") {
                            if (hasOccupancy) {
                              return;
                            }
                            openBookingModal({
                              roomId,
                              dateFrom: dayIso,
                              dateTo: dayIso,
                            });
                            return;
                          }

                          openPriceModal({
                            roomId,
                            dateFrom: price?.dateFrom ?? dayIso,
                            dateTo: price?.dateTo ?? dayIso,
                            sourcePrice: price,
                          });
                        }}
                        onOccupancyClick={(occupancy) => {
                          if (isRoomOrderMode) {
                            return;
                          }
                          openOccupancyActions(occupancy);
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {isOccupancyActionsOpen && activeOccupancy ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight/45 sm:items-center sm:p-4">
          <div className="w-full rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-olive/10 px-4 py-3">
              <h2 className="text-lg font-semibold text-olive">Бронирование</h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-lg text-olive/75 hover:bg-cream"
                onClick={closeOccupancyActions}
                aria-label="Закрыть"
              >
                x
              </button>
            </div>

            <div className="space-y-3 px-4 py-3">
              <section className="rounded-xl border border-olive/12 bg-cream/45 p-3">
                <p className="text-xs uppercase tracking-wide text-olive/60">Период проживания</p>
                <p className="mt-1 text-sm font-semibold text-olive">
                  {activeOccupancyPeriodLabel}
                </p>
                <p className="mt-1 text-xs text-olive/70">
                  {formatNightsLabel(activeOccupancyNights)}
                </p>
              </section>

              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  variant="secondary"
                  onClick={openBookingEditFromActions}
                  disabled={isSavingOccupancyAction}
                >
                  ✎ Изменить
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void checkInFromActions()}
                  disabled={isSavingOccupancyAction || activeOccupancy.status === "CHECKED_IN"}
                >
                  {activeOccupancy.status === "CHECKED_IN" ? "✓ Заселен" : "⇥ Заселить"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void cancelFromActions()}
                  disabled={isSavingOccupancyAction}
                >
                  ✕ Отменить
                </Button>
              </div>

              <section className="rounded-xl border border-olive/12 bg-cream/45 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className={modalMetaLabelClass}>Статус</p>
                    <p className="mt-1 text-sm font-semibold text-olive">
                      {activeOccupancyStatusLabel}
                    </p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Создано</p>
                    <p className="mt-1 text-sm text-olive/80">
                      {activeOccupancyCreatedAtLabel ?? "Только что"}
                    </p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Номер</p>
                    <p className="mt-1 text-sm font-semibold text-olive">
                      {activeOccupancyRoom?.title ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Цвет брони</p>
                    <p className="mt-1 text-sm text-olive/80">{activeOccupancyColorLabel}</p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Гость</p>
                    <p className="mt-1 text-sm text-olive/80">{activeOccupancy.guestLabel}</p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Номер телефона</p>
                    <p className="mt-1 text-sm text-olive/80">{activeOccupancyPhoneLabel}</p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Время</p>
                    <p className="mt-1 text-sm text-olive/80">{activeOccupancyTimeLabel}</p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Гости</p>
                    <p className="mt-1 text-sm text-olive/80">{activeOccupancyGuestsLabel}</p>
                  </div>
                </div>
              </section>

              {occupancyActionsError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {occupancyActionsError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isCalendarSyncModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight/45 p-0 backdrop-blur-[6px] sm:items-center sm:p-4 [@media(orientation:landscape)_and_(max-height:560px)]:items-center [@media(orientation:landscape)_and_(max-height:560px)]:p-0.5">
          <div className="popover-enter glass-booking flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[26px] sm:max-h-[88vh] sm:max-w-2xl sm:rounded-[28px] [@media(orientation:landscape)_and_(max-height:560px)]:max-h-[92dvh] [@media(orientation:landscape)_and_(max-height:560px)]:max-w-[84vw] [@media(orientation:landscape)_and_(max-height:560px)]:rounded-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-olive/10 bg-white/80 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-olive sm:text-xl [@media(orientation:landscape)_and_(max-height:560px)]:text-base">
                  Синхронизация календарей
                </h2>
                {calendarSyncRoom ? (
                  <p className="mt-0.5 truncate text-xs text-olive/60">{calendarSyncRoom.title}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-olive/10 bg-white/85 text-olive/70 transition hover:scale-[1.03] hover:bg-cream hover:text-olive [@media(orientation:landscape)_and_(max-height:560px)]:h-8 [@media(orientation:landscape)_and_(max-height:560px)]:w-8"
                onClick={closeCalendarSyncModal}
                aria-label="Закрыть"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4 [@media(orientation:landscape)_and_(max-height:560px)]:space-y-2 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <section className={modalSectionClass}>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-olive">Номер</span>
                  <select
                    className={modalSelectClass}
                    value={calendarSyncRoomId}
                    onChange={(event) => {
                      setCalendarSyncRoomId(event.target.value);
                      setCalendarSyncConfig(null);
                      setCalendarSyncSources([]);
                      setNewCalendarSyncSourceName("");
                      setNewCalendarSyncSourceUrl("");
                      setCalendarSyncError("");
                      setCalendarSyncSuccess("");
                    }}
                    disabled={
                      isLoadingCalendarSync || isSavingCalendarSync || isRunningCalendarSync
                    }
                  >
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.title}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section className={modalSectionClass}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-olive">Экспорт занятых дат</p>
                  <AppIcon icon={ExternalLink} className="h-4 w-4 text-olive/45" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <Input
                    className={cn(modalTextInputClass, "font-mono text-xs")}
                    value={calendarSyncConfig?.exportUrl ?? ""}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                    placeholder={isLoadingCalendarSync ? "Загружаем..." : "Ссылка формируется"}
                  />
                  <Button
                    variant="secondary"
                    className="w-full gap-2 px-3 py-2 text-xs sm:w-auto sm:text-sm"
                    onClick={() => void copyCalendarExportUrl()}
                    disabled={!calendarSyncConfig?.exportUrl || isLoadingCalendarSync}
                  >
                    <AppIcon icon={Copy} className="h-4 w-4" />
                    Скопировать
                  </Button>
                  {calendarSyncConfig?.exportUrl ? (
                    <a
                      href={calendarSyncConfig.exportUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-white px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/6 sm:w-auto sm:text-sm"
                    >
                      <AppIcon icon={ExternalLink} className="h-4 w-4" />
                      Открыть
                    </a>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-olive/12 bg-white px-3 py-2 text-xs font-semibold text-olive/35 sm:w-auto sm:text-sm"
                    >
                      <AppIcon icon={ExternalLink} className="h-4 w-4" />
                      Открыть
                    </span>
                  )}
                </div>
              </section>

              <section className={modalSectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-olive">Импорт занятых дат</p>
                    <p className="mt-1 text-xs text-olive/62">
                      Синхронизация данных проводится автоматически примерно раз в час.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-olive/12 bg-white px-3 py-1.5 text-xs font-semibold text-olive/70">
                    {enabledCalendarSyncSourcesCount} из {calendarSyncSources.length} активны
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(120px,0.7fr)_minmax(0,1.3fr)_auto]">
                  <Input
                    className={modalTextInputClass}
                    value={newCalendarSyncSourceName}
                    onChange={(event) => setNewCalendarSyncSourceName(event.target.value)}
                    placeholder="Booking.com"
                    disabled={
                      isLoadingCalendarSync || isSavingCalendarSync || isRunningCalendarSync
                    }
                  />
                  <Input
                    className={cn(modalTextInputClass, "font-mono text-xs")}
                    value={newCalendarSyncSourceUrl}
                    onChange={(event) => setNewCalendarSyncSourceUrl(event.target.value)}
                    placeholder="https://example.ru/calendar/ical/room.ics"
                    disabled={
                      isLoadingCalendarSync || isSavingCalendarSync || isRunningCalendarSync
                    }
                  />
                  <Button
                    variant="secondary"
                    className="w-full gap-2 px-3 py-2 text-xs sm:w-auto sm:text-sm"
                    onClick={addCalendarSyncSource}
                    disabled={
                      isLoadingCalendarSync ||
                      isSavingCalendarSync ||
                      isRunningCalendarSync ||
                      !newCalendarSyncSourceName.trim() ||
                      !newCalendarSyncSourceUrl.trim()
                    }
                  >
                    <AppIcon icon={Plus} className="h-4 w-4" />
                    Добавить
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className={modalMetaLabelClass}>Текущие синхронизации</p>
                    {calendarSyncSources.length > 0 ? (
                      <p className="text-xs text-olive/50">
                        {calendarSyncSources.length} подключено
                      </p>
                    ) : null}
                  </div>

                  {calendarSyncSources.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-olive/16 bg-white/55 px-3 py-3 text-sm text-olive/62">
                      Подключенные календари появятся здесь после добавления.
                    </div>
                  ) : (
                    calendarSyncSources.map((source) => (
                      <div
                        key={source.id}
                        className="rounded-xl border border-olive/12 bg-white/82 p-3 shadow-[0_12px_22px_-24px_rgba(60,42,20,0.65)]"
                      >
                        <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
                          <label className="inline-flex items-center gap-2 rounded-full border border-olive/10 bg-cream/55 px-2.5 py-2 text-xs font-semibold text-olive/70 sm:mt-0.5">
                            <input
                              type="checkbox"
                              checked={source.isEnabled}
                              onChange={(event) =>
                                updateCalendarSyncSource(source.id, {
                                  isEnabled: event.target.checked,
                                })
                              }
                              className="h-4 w-4 accent-primary"
                              disabled={
                                isLoadingCalendarSync ||
                                isSavingCalendarSync ||
                                isRunningCalendarSync
                              }
                            />
                            Активна
                          </label>

                          <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(110px,0.7fr)_minmax(0,1.3fr)]">
                            <Input
                              className={cn(modalTextInputClass, "min-h-10")}
                              value={source.label}
                              onChange={(event) =>
                                updateCalendarSyncSource(source.id, {
                                  label: event.target.value,
                                })
                              }
                              placeholder="Название сайта"
                              disabled={
                                isLoadingCalendarSync ||
                                isSavingCalendarSync ||
                                isRunningCalendarSync
                              }
                            />
                            <Input
                              className={cn(modalTextInputClass, "min-h-10 font-mono text-xs")}
                              value={source.importUrl}
                              onChange={(event) =>
                                updateCalendarSyncSource(source.id, {
                                  importUrl: event.target.value,
                                })
                              }
                              placeholder="https://example.ru/calendar.ics"
                              disabled={
                                isLoadingCalendarSync ||
                                isSavingCalendarSync ||
                                isRunningCalendarSync
                              }
                            />
                          </div>

                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => void removeCalendarSyncSource(source.id)}
                            aria-label={`Отключить синхронизацию ${source.label}`}
                            disabled={
                              isLoadingCalendarSync || isSavingCalendarSync || isRunningCalendarSync
                            }
                          >
                            <AppIcon icon={X} className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                          <div>
                            <p className={modalMetaLabelClass}>Статус</p>
                            <span
                              className={cn(
                                "mt-1 inline-flex rounded-full border px-2.5 py-1 font-semibold",
                                getCalendarSyncStatusClass(source.lastSyncStatus),
                              )}
                            >
                              {getCalendarSyncStatusLabel(source.lastSyncStatus)}
                            </span>
                          </div>
                          <div>
                            <p className={modalMetaLabelClass}>Последний импорт</p>
                            <p className="mt-1 font-semibold text-olive">
                              {formatCalendarSyncDate(source.lastSyncedAt)}
                            </p>
                          </div>
                          <div>
                            <p className={modalMetaLabelClass}>Результат</p>
                            <p className="mt-1 line-clamp-2 text-olive/72">
                              {source.lastSyncMessage ?? "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className={modalSectionClass}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className={modalMetaLabelClass}>Последний импорт</p>
                    <p className="mt-1 text-sm font-semibold text-olive">
                      {calendarSyncLastSyncedLabel}
                    </p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Статус</p>
                    <p className="mt-1 text-sm font-semibold text-olive">
                      {calendarSyncStatusLabel}
                    </p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Результат</p>
                    <p className="mt-1 text-sm text-olive/80">
                      {calendarSyncConfig?.lastSyncMessage ?? "—"}
                    </p>
                  </div>
                </div>
              </section>

              {calendarSyncError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {calendarSyncError}
                </p>
              ) : null}
              {calendarSyncSuccess ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {calendarSyncSuccess}
                </p>
              ) : null}
            </div>

            <div className="glass-mobile-bar sticky bottom-0 z-10 grid shrink-0 gap-2 border-t border-olive/10 bg-white/84 px-3 py-3 sm:flex sm:items-center sm:justify-between sm:px-4 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <Button
                variant="ghost"
                className="w-full px-3 py-2 text-xs sm:w-auto sm:text-sm"
                onClick={closeCalendarSyncModal}
              >
                Закрыть
              </Button>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Button
                  variant="secondary"
                  className="w-full px-3 py-2 text-xs sm:w-auto sm:text-sm"
                  onClick={() => void saveCalendarSyncConfig()}
                  disabled={isLoadingCalendarSync || isSavingCalendarSync || isRunningCalendarSync}
                >
                  {isSavingCalendarSync ? "Сохранение..." : "Сохранить"}
                </Button>
                <Button
                  className="w-full gap-2 px-3 py-2 text-xs sm:w-auto sm:text-sm"
                  onClick={() => void runCalendarSyncImport()}
                  disabled={
                    isLoadingCalendarSync ||
                    isSavingCalendarSync ||
                    isRunningCalendarSync ||
                    enabledCalendarSyncSourcesCount === 0
                  }
                >
                  <AppIcon icon={RefreshCw} className="h-4 w-4" />
                  {isRunningCalendarSync ? "Импорт..." : "Импортировать сейчас"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isBookingModalOpen && bookingForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-midnight/45 backdrop-blur-[6px] p-1.5 pt-2 sm:items-center sm:p-3 [@media(orientation:landscape)_and_(max-height:560px)]:p-0.5">
          <div className="popover-enter glass-booking flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-[28px] sm:max-h-[88vh] sm:max-w-xl lg:max-w-3xl [@media(orientation:landscape)_and_(max-height:560px)]:max-h-[92dvh] [@media(orientation:landscape)_and_(max-height:560px)]:max-w-[84vw] [@media(orientation:landscape)_and_(max-height:560px)]:rounded-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-olive/10 bg-white/80 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3 [@media(orientation:landscape)_and_(max-height:560px)]:px-1.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-olive sm:text-lg [@media(orientation:landscape)_and_(max-height:560px)]:text-xs">
                  {bookingForm.editingOccupancyId ? "Карточка брони" : "Создать бронирование"}
                </h2>
                {isMobilePortrait && selectedBookingRoom ? (
                  <p className="mt-1 truncate text-xs text-olive/60">{selectedBookingRoom.title}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-olive/10 bg-white/85 text-olive/70 transition hover:scale-[1.03] hover:bg-cream hover:text-olive [@media(orientation:landscape)_and_(max-height:560px)]:h-7 [@media(orientation:landscape)_and_(max-height:560px)]:w-7"
                onClick={closeBookingModal}
                aria-label="Закрыть"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:space-y-3 sm:px-4 sm:py-4 [@media(orientation:landscape)_and_(max-height:560px)]:space-y-2 [@media(orientation:landscape)_and_(max-height:560px)]:px-1.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <section className={modalSectionClass}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className={modalMetaLabelClass}>Статус</p>
                    <p className="mt-1 text-sm font-semibold text-olive">{bookingStatusLabel}</p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Создано</p>
                    <p className="mt-1 text-sm text-olive/80">
                      {bookingCreatedAtLabel ?? "Только что"}
                    </p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Период</p>
                    <p className="mt-1 text-sm text-olive/80">
                      {formatDateRangeLabel(bookingForm.dateFrom, bookingForm.dateTo)}
                    </p>
                  </div>
                  <div>
                    <p className={modalMetaLabelClass}>Ночей</p>
                    <p className="mt-1 text-sm font-semibold text-olive">
                      {formatNightsLabel(bookingNights)}
                    </p>
                  </div>

                  {isMobilePortrait ? (
                    <div className="space-y-3 sm:col-span-2 xl:col-span-3">
                      <div className="rounded-[22px] border border-primary/10 bg-white/90 p-3 shadow-[0_16px_32px_-26px_rgba(15,118,110,0.55)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={modalMetaLabelClass}>Номер</p>
                            <p className="mt-1 truncate text-sm font-semibold text-olive">
                              {selectedBookingRoom?.title ?? "Выберите номер"}
                            </p>
                            {selectedBookingRoom ? (
                              <p className="mt-1 text-xs text-olive/60">
                                {getGroupShortLabel(
                                  roomPagerEntries.find(
                                    (entry) => entry.room.id === selectedBookingRoom.id,
                                  )?.groupLabel ?? "",
                                )}{" "}
                                • {formatRoomMeta(selectedBookingRoom)}
                              </p>
                            ) : null}
                          </div>
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                            {bookingRoomPage + 1}/{mobileRoomPageCount}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        {visibleBookingRoomEntries.map((entry) => {
                          const isActive = bookingForm.roomId === entry.room.id;
                          return (
                            <button
                              key={entry.room.id}
                              type="button"
                              className={cn(
                                "rounded-[20px] border p-3 text-left transition-all duration-200",
                                isActive
                                  ? "border-primary/25 bg-[linear-gradient(135deg,rgba(15,118,110,0.12),rgba(255,255,255,0.98))] shadow-[0_18px_34px_-26px_rgba(15,118,110,0.7)]"
                                  : "border-olive/10 bg-white/88 hover:border-primary/15 hover:bg-white",
                              )}
                              onClick={() => updateBookingForm({ roomId: entry.room.id })}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-olive">
                                    {entry.room.title}
                                  </p>
                                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-primary/70">
                                    {getGroupShortLabel(entry.groupLabel)}
                                  </p>
                                  <p className="mt-1 text-xs text-olive/60">
                                    {formatRoomMeta(entry.room)}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                    isActive ? "bg-primary text-white" : "bg-cream text-olive/55",
                                  )}
                                >
                                  {isActive ? "Выбран" : "Выбрать"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <CompactPageDots
                        pageCount={mobileRoomPageCount}
                        currentPage={bookingRoomPage}
                        onChange={setBookingRoomPage}
                      />
                    </div>
                  ) : (
                    <label className="space-y-1.5">
                      <span className={modalMetaLabelClass}>Номер</span>
                      <select
                        className={modalSelectClass}
                        value={bookingForm.roomId}
                        onChange={(event) => updateBookingForm({ roomId: event.target.value })}
                      >
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="space-y-1.5">
                    <span className={modalMetaLabelClass}>Цвет брони</span>
                    <select
                      className={modalSelectClass}
                      value={bookingForm.color}
                      onChange={(event) => updateBookingForm({ color: event.target.value })}
                    >
                      {bookingColorOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className={modalBookingPeriodSectionClass}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-primary sm:text-[15px]">
                    Период проживания
                  </p>
                  <span className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary shadow-sm">
                    {formatNightsLabel(bookingNights)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-olive/75">
                  {formatDateRangeLabel(bookingForm.dateFrom, bookingForm.dateTo)}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <SingleDatePopoverField
                    value={bookingForm.dateFrom}
                    onChange={(value) => updateBookingForm({ dateFrom: value })}
                    mobilePanelStyle="dialog"
                    placeholder="Дата начала"
                    helperText="Выберите дату начала"
                  />
                  <SingleDatePopoverField
                    value={bookingForm.dateTo}
                    onChange={(value) => updateBookingForm({ dateTo: value })}
                    mobilePanelStyle="dialog"
                    placeholder="Дата окончания"
                    helperText="Выберите дату окончания"
                  />
                </div>
              </section>

              <section className={modalBookingPhoneSectionClass}>
                <p className="text-sm font-semibold text-terra-ink sm:text-[15px]">
                  Номер телефона
                </p>
                <div className="mt-3">
                  <Input
                    className={modalTextInputClass}
                    value={bookingForm.phone}
                    onChange={(event) => updateBookingForm({ phone: event.target.value })}
                    placeholder="+7 (___) ___-__-__"
                  />
                </div>
              </section>

              <section className={modalBookingTimeSectionClass}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-accent sm:text-[15px]">
                    Время заезда и выезда
                  </p>
                  <span className="rounded-full bg-accent/8 px-2.5 py-1 text-xs font-semibold text-accent shadow-sm">
                    {formatTimeRangeLabel(bookingForm.timeFrom, bookingForm.timeTo)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-olive/75">
                  Если время не указано, запись будет восприниматься как на весь день.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <OverlayPickerField
                    label="Заезд"
                    valueLabel={formatTimeValueLabel(bookingForm.timeFrom)}
                    promptLabel="Выбрать время"
                    inputType="time"
                    inputValue={bookingForm.timeFrom}
                    onChange={(value) => updateBookingForm({ timeFrom: value })}
                    icon={Clock3}
                    labelClassName={modalMetaPrimaryLabelClass}
                    iconShellClassName="bg-accent/10 text-accent"
                    promptClassName="bg-accent/8 text-accent/85"
                  />
                  <OverlayPickerField
                    label="Выезд"
                    valueLabel={formatTimeValueLabel(bookingForm.timeTo)}
                    promptLabel="Выбрать время"
                    inputType="time"
                    inputValue={bookingForm.timeTo}
                    onChange={(value) => updateBookingForm({ timeTo: value })}
                    icon={Clock3}
                    labelClassName={modalMetaPrimaryLabelClass}
                    iconShellClassName="bg-accent/10 text-accent"
                    promptClassName="bg-accent/8 text-accent/85"
                  />
                </div>
              </section>

              <section className={modalBookingGuestsSectionClass}>
                <p className="text-sm font-semibold text-warning sm:text-[15px]">Гости</p>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-olive/14 bg-white p-3 shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)]">
                    <p className={modalMetaGoldLabelClass}>Взрослые</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        className="h-9 min-h-9 min-w-9 rounded-xl px-2 py-1 text-base"
                        onClick={() =>
                          updateBookingForm({
                            adults: Math.max(1, Math.min(20, bookingForm.adults - 1)),
                          })
                        }
                      >
                        -
                      </Button>
                      <span className="min-w-8 text-center text-lg font-semibold text-olive">
                        {bookingForm.adults}
                      </span>
                      <Button
                        variant="ghost"
                        className="h-9 min-h-9 min-w-9 rounded-xl px-2 py-1 text-base"
                        onClick={() =>
                          updateBookingForm({
                            adults: Math.max(1, Math.min(20, bookingForm.adults + 1)),
                          })
                        }
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-olive/14 bg-white p-3 shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)]">
                    <p className={modalMetaGoldLabelClass}>Детей</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        className="h-9 min-h-9 min-w-9 rounded-xl px-2 py-1 text-base"
                        onClick={() =>
                          updateBookingForm({
                            children: Math.max(0, Math.min(20, bookingForm.children - 1)),
                          })
                        }
                      >
                        -
                      </Button>
                      <span className="min-w-8 text-center text-lg font-semibold text-olive">
                        {bookingForm.children}
                      </span>
                      <Button
                        variant="ghost"
                        className="h-9 min-h-9 min-w-9 rounded-xl px-2 py-1 text-base"
                        onClick={() =>
                          updateBookingForm({
                            children: Math.max(0, Math.min(20, bookingForm.children + 1)),
                          })
                        }
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              {bookingModalError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {bookingModalError}
                </p>
              ) : null}
            </div>

            <div className="glass-mobile-bar sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-olive/10 bg-white/80 px-3 py-3 sm:px-4 [@media(orientation:landscape)_and_(max-height:560px)]:px-1.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1">
              <div>
                {bookingForm.editingOccupancyId ? (
                  <Button
                    variant="secondary"
                    className="px-3 py-2 text-xs sm:text-sm"
                    onClick={() => void cancelBooking()}
                    disabled={isSavingBooking}
                  >
                    Отменить бронь
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  className="px-3 py-2 text-xs sm:text-sm"
                  onClick={closeBookingModal}
                >
                  Закрыть
                </Button>
                {bookingForm.editingOccupancyId ? (
                  <Button
                    variant="secondary"
                    className="px-3 py-2 text-xs sm:text-sm"
                    onClick={() => void checkInBooking()}
                    disabled={isSavingBooking || bookingForm.status === "CHECKED_IN"}
                  >
                    {bookingForm.status === "CHECKED_IN" ? "Гость заселен" : "Заселить"}
                  </Button>
                ) : null}
                <Button
                  className="px-3 py-2 text-xs sm:text-sm"
                  onClick={() => void saveBooking()}
                  disabled={isSavingBooking}
                >
                  {isSavingBooking
                    ? "Сохранение..."
                    : bookingForm.editingOccupancyId
                      ? "Сохранить изменения"
                      : "Создать бронь"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isPriceModalOpen && priceForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-midnight/45 backdrop-blur-[6px] p-1.5 pt-2 sm:items-center sm:p-4 [@media(orientation:landscape)_and_(max-height:560px)]:p-0.5">
          <div className="popover-enter glass-booking flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-[28px] sm:max-h-[88vh] sm:max-w-xl lg:max-w-2xl [@media(orientation:landscape)_and_(max-height:560px)]:max-h-[92dvh] [@media(orientation:landscape)_and_(max-height:560px)]:max-w-[84vw] [@media(orientation:landscape)_and_(max-height:560px)]:rounded-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-olive/10 bg-white/80 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <h2 className="text-base font-semibold text-olive sm:text-xl [@media(orientation:landscape)_and_(max-height:560px)]:text-base">
                {priceForm.editingPriceId ? "Редактирование периода цены" : "Создание периода цены"}
              </h2>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-olive/10 bg-white/85 text-olive/70 transition hover:scale-[1.03] hover:bg-cream hover:text-olive [@media(orientation:landscape)_and_(max-height:560px)]:h-8 [@media(orientation:landscape)_and_(max-height:560px)]:w-8"
                onClick={closePriceModal}
                aria-label="Закрыть"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4 [@media(orientation:landscape)_and_(max-height:560px)]:space-y-2 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <section className={modalPriceRoomSectionClass}>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-primary">Номер</span>
                  <select
                    className={modalSelectClass}
                    value={priceForm.roomId}
                    onChange={(event) =>
                      updatePriceForm({
                        roomId: event.target.value,
                        editingPriceId: null,
                        extraBedPriceInput: "",
                      })
                    }
                  >
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.title}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedPriceRoom ? (
                  <p className="mt-1.5 text-xs text-olive/70">
                    Вместимость номера: {selectedPriceRoom.beds + selectedPriceRoom.extraBeds}{" "}
                    гостей
                  </p>
                ) : null}
              </section>

              <section className={modalPricePeriodSectionClass}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-warning sm:text-[15px]">Период</p>
                  <span className="rounded-full bg-sage/18 px-2.5 py-1 text-xs font-semibold text-warning shadow-sm">
                    {formatNightsLabel(pricePeriodNights)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-olive/75">
                  {formatDateRangeLabel(priceForm.dateFrom, priceForm.dateTo)}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <SingleDatePopoverField
                    value={priceForm.dateFrom}
                    onChange={(value) => updatePriceForm({ dateFrom: value })}
                    mobilePanelStyle="dialog"
                    placeholder="Дата начала"
                    helperText="Выберите дату начала"
                  />
                  <SingleDatePopoverField
                    value={priceForm.dateTo}
                    onChange={(value) => updatePriceForm({ dateTo: value })}
                    mobilePanelStyle="dialog"
                    placeholder="Дата окончания"
                    helperText="Выберите дату окончания"
                  />
                </div>
              </section>

              <section className={modalPriceValueSectionClass}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className={modalMetaWarmLabelClass}>
                      {priceForm.priceType === "PER_PERSON"
                        ? "Цена за человека"
                        : "Цена за комнату/ночь"}
                    </span>
                    <Input
                      className={modalTextInputClass}
                      type="number"
                      min={1}
                      step="0.01"
                      value={priceForm.priceInput}
                      onChange={(event) => updatePriceForm({ priceInput: event.target.value })}
                      placeholder="Например, 2500"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className={modalMetaWarmLabelClass}>Валюта</span>
                    <Input
                      className={modalTextInputClass}
                      value={priceForm.currency}
                      onChange={(event) =>
                        updatePriceForm({ currency: event.target.value.toUpperCase() })
                      }
                      placeholder="RUB"
                      maxLength={3}
                    />
                  </label>
                </div>
                <div className="mt-3 space-y-1.5">
                  <span className={modalMetaWarmLabelClass}>Как считать цену</span>
                  <div className="grid grid-cols-2 gap-1 rounded-2xl border border-olive/12 bg-white p-1 shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)]">
                    {(["PER_ROOM", "PER_PERSON"] as const).map((type) => {
                      const isSelected = priceForm.priceType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            updatePriceForm(
                              type === "PER_ROOM"
                                ? { priceType: type, minGuestsInput: "" }
                                : { priceType: type, extraBedPriceInput: "" },
                            );
                            if (type === "PER_PERSON") {
                              setIsPriceExtraSectionOpen(false);
                            }
                          }}
                          className={cn(
                            "h-10 rounded-xl px-3 text-xs font-semibold transition sm:text-sm",
                            isSelected
                              ? "bg-primary text-white shadow-sm"
                              : "text-olive/70 hover:bg-cream hover:text-olive",
                          )}
                          aria-pressed={isSelected}
                        >
                          <span className="hidden sm:inline">{getRoomPriceUnitText(type)}</span>
                          <span className="sm:hidden">/{getRoomPriceShortUnit(type)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-3 grid gap-3",
                    priceForm.priceType === "PER_PERSON" ? "sm:grid-cols-2" : "",
                  )}
                >
                  {priceForm.priceType === "PER_PERSON" ? (
                    <label className="block space-y-1.5">
                      <span className={modalMetaWarmLabelClass}>Минимум гостей</span>
                      <Input
                        className={modalTextInputClass}
                        type="number"
                        min={1}
                        max={40}
                        value={priceForm.minGuestsInput}
                        onChange={(event) =>
                          updatePriceForm({ minGuestsInput: event.target.value })
                        }
                        placeholder="Без ограничения"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {["", "1", "2", "3", "4", "5"].map((value) => (
                          <button
                            key={`min-guests-${value || "any"}`}
                            type="button"
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                              priceForm.minGuestsInput === value
                                ? "border-primary/25 bg-primary/10 text-primary"
                                : "border-olive/12 bg-white text-olive/65 hover:border-primary/20 hover:text-primary",
                            )}
                            onClick={() => updatePriceForm({ minGuestsInput: value })}
                          >
                            {value ? `от ${value}` : "любой"}
                          </button>
                        ))}
                      </div>
                    </label>
                  ) : null}

                  <label className="block space-y-1.5">
                    <span className={modalMetaWarmLabelClass}>Минимум ночей</span>
                    <Input
                      className={modalTextInputClass}
                      type="number"
                      min={1}
                      max={60}
                      value={priceForm.minNightsInput}
                      onChange={(event) => updatePriceForm({ minNightsInput: event.target.value })}
                      placeholder="Без ограничения"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {["", "1", "2", "3", "5", "7"].map((value) => (
                        <button
                          key={`min-nights-${value || "any"}`}
                          type="button"
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                            priceForm.minNightsInput === value
                              ? "border-primary/25 bg-primary/10 text-primary"
                              : "border-olive/12 bg-white text-olive/65 hover:border-primary/20 hover:text-primary",
                          )}
                          onClick={() => updatePriceForm({ minNightsInput: value })}
                        >
                          {value ? `от ${value}` : "любой"}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
                {canSetExtraBedPrice ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-olive/12 bg-white shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)]">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm font-semibold text-olive transition hover:bg-cream/55"
                      onClick={() => setIsPriceExtraSectionOpen((prev) => !prev)}
                      aria-expanded={isPriceExtraSectionOpen}
                    >
                      <span>Дополнительно</span>
                      <span className="inline-flex items-center gap-2 text-xs text-olive/55">
                        {selectedPriceRoom?.extraBeds ?? 0} доп.
                        <AppIcon
                          icon={isPriceExtraSectionOpen ? ChevronUp : ChevronDown}
                          className="h-4 w-4"
                        />
                      </span>
                    </button>
                    {isPriceExtraSectionOpen ? (
                      <div className="border-t border-olive/10 px-3.5 py-3">
                        <label className="block space-y-1.5">
                          <span className={modalMetaWarmLabelClass}>
                            Цена доп. места за ночь
                          </span>
                          <Input
                            className={modalTextInputClass}
                            type="number"
                            min={1}
                            step="0.01"
                            value={priceForm.extraBedPriceInput}
                            onChange={(event) =>
                              updatePriceForm({ extraBedPriceInput: event.target.value })
                            }
                            placeholder="Например, 800"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {priceModalError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {priceModalError}
                </p>
              ) : null}
            </div>

            <div className="glass-mobile-bar sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-olive/10 bg-white/80 px-3 py-3 sm:px-4 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <div>
                {priceForm.editingPriceId ? (
                  <Button
                    variant="secondary"
                    className="px-3 py-2 text-xs sm:text-sm"
                    onClick={() => void deletePricePeriod()}
                    disabled={isSavingPrice}
                  >
                    Удалить период
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="px-3 py-2 text-xs sm:text-sm"
                  onClick={closePriceModal}
                >
                  Закрыть
                </Button>
                <Button
                  className="px-3 py-2 text-xs sm:text-sm"
                  onClick={() => void savePricePeriod()}
                  disabled={isSavingPrice}
                >
                  {isSavingPrice
                    ? "Сохранение..."
                    : priceForm.editingPriceId
                      ? "Сохранить изменения"
                      : "Сохранить"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isDuplicatePricesModalOpen && duplicatePricesForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-midnight/45 backdrop-blur-[6px] p-1.5 pt-2 sm:items-center sm:p-4 [@media(orientation:landscape)_and_(max-height:560px)]:p-0.5">
          <div className="popover-enter glass-booking flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-[28px] sm:max-h-[88vh] sm:max-w-xl lg:max-w-3xl [@media(orientation:landscape)_and_(max-height:560px)]:max-h-[92dvh] [@media(orientation:landscape)_and_(max-height:560px)]:max-w-[84vw] [@media(orientation:landscape)_and_(max-height:560px)]:rounded-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-olive/10 bg-white/80 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <div>
                <h2 className="text-base font-semibold text-olive sm:text-xl [@media(orientation:landscape)_and_(max-height:560px)]:text-base">
                  Дублировать цены
                </h2>
                <p className="mt-0.5 text-xs text-olive/60">
                  Скопируйте периоды из одного номера в выбранные номера.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-olive/10 bg-white/85 text-olive/70 transition hover:scale-[1.03] hover:bg-cream hover:text-olive [@media(orientation:landscape)_and_(max-height:560px)]:h-8 [@media(orientation:landscape)_and_(max-height:560px)]:w-8"
                onClick={closeDuplicatePricesModal}
                aria-label="Закрыть"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4 [@media(orientation:landscape)_and_(max-height:560px)]:space-y-2 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <section className={modalSectionClass}>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-olive">Копировать из номера</span>
                    <select
                      className={modalSelectClass}
                      value={duplicatePricesForm.sourceRoomId}
                      onChange={(event) => updateDuplicateSourceRoom(event.target.value)}
                    >
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-2xl border border-olive/12 bg-white/86 p-3">
                    <p className={modalMetaLabelClass}>Найдено периодов</p>
                    <p className="mt-1 text-sm font-semibold text-olive">
                      {duplicatePricePeriodsPreview.length}
                    </p>
                    <p className="mt-1 text-xs text-olive/60">
                      {duplicateSourceRoom?.title ?? "Выберите исходный номер"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <SingleDatePopoverField
                    value={duplicatePricesForm.dateFrom}
                    onChange={(value) => updateDuplicatePricesForm({ dateFrom: value })}
                    mobilePanelStyle="dialog"
                    monthCount={24}
                    placeholder="Дата начала"
                    helperText="Копировать цены с даты"
                  />
                  <SingleDatePopoverField
                    value={duplicatePricesForm.dateTo}
                    onChange={(value) => updateDuplicatePricesForm({ dateTo: value })}
                    mobilePanelStyle="dialog"
                    monthCount={24}
                    placeholder="Дата окончания"
                    helperText="Копировать цены до даты"
                  />
                </div>
              </section>

              <section className={modalSectionClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-olive">Куда копировать</p>
                    <p className="mt-0.5 text-xs text-olive/60">
                      Выбрано номеров: {duplicateTargetRooms.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      className="px-3 py-2 text-xs"
                      onClick={selectAllDuplicateTargetRooms}
                      disabled={rooms.length < 2}
                    >
                      Все
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-3 py-2 text-xs"
                      onClick={clearDuplicateTargetRooms}
                    >
                      Снять
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {rooms
                    .filter((room) => room.id !== duplicatePricesForm.sourceRoomId)
                    .map((room) => {
                      const isSelected = duplicatePricesForm.targetRoomIds.includes(room.id);
                      return (
                        <button
                          key={room.id}
                          type="button"
                          className={cn(
                            "rounded-[18px] border p-3 text-left transition-all duration-200",
                            isSelected
                              ? "border-primary/28 bg-[linear-gradient(135deg,rgba(15,118,110,0.13),rgba(255,255,255,0.98))] shadow-[0_18px_34px_-28px_rgba(15,118,110,0.65)]"
                              : "border-olive/10 bg-white/88 hover:border-primary/15 hover:bg-white",
                          )}
                          onClick={() => toggleDuplicateTargetRoom(room.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-olive">
                                {room.title}
                              </p>
                              <p className="mt-1 text-xs text-olive/60">{formatRoomMeta(room)}</p>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                isSelected ? "bg-primary text-white" : "bg-cream text-olive/55",
                              )}
                            >
                              {isSelected ? "Выбран" : "Выбрать"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </section>

              {duplicatePricePeriodsPreview.length > 0 ? (
                <section className={modalSectionClass}>
                  <p className="text-sm font-semibold text-olive">Периоды для копирования</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {duplicatePricePeriodsPreview.slice(0, 6).map((price) => (
                      <div
                        key={`${price.id}-${price.dateFrom}-${price.dateTo}`}
                        className="rounded-2xl border border-olive/10 bg-white/86 p-3"
                      >
                        <p className="text-sm font-semibold text-olive">
                          {formatPriceLabel(price)}
                        </p>
                        <p className="mt-1 text-xs text-olive/62">
                          {formatDateRangeLabel(price.dateFrom, price.dateTo)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {duplicatePricePeriodsPreview.length > 6 ? (
                    <p className="mt-2 text-xs text-olive/60">
                      И еще {duplicatePricePeriodsPreview.length - 6} периодов.
                    </p>
                  ) : null}
                </section>
              ) : null}

              {duplicatePricesError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {duplicatePricesError}
                </p>
              ) : null}
            </div>

            <div className="glass-mobile-bar sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-olive/10 bg-white/80 px-3 py-3 sm:px-4 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <Button
                variant="ghost"
                className="px-3 py-2 text-xs sm:text-sm"
                onClick={closeDuplicatePricesModal}
              >
                Закрыть
              </Button>
              <Button
                className="px-3 py-2 text-xs sm:text-sm"
                onClick={() => void duplicatePricePeriods()}
                disabled={isDuplicatingPrices}
              >
                {isDuplicatingPrices ? "Копирование..." : "Продублировать цены"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isCopyYearPricesModalOpen && copyYearPricesForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-midnight/45 backdrop-blur-[6px] p-1.5 pt-2 sm:items-center sm:p-4 [@media(orientation:landscape)_and_(max-height:560px)]:p-0.5">
          <div className="popover-enter glass-booking flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-[28px] sm:max-h-[88vh] sm:max-w-xl [@media(orientation:landscape)_and_(max-height:560px)]:max-h-[92dvh] [@media(orientation:landscape)_and_(max-height:560px)]:max-w-[84vw] [@media(orientation:landscape)_and_(max-height:560px)]:rounded-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-olive/10 bg-white/80 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <div>
                <h2 className="text-base font-semibold text-olive sm:text-xl [@media(orientation:landscape)_and_(max-height:560px)]:text-base">
                  Перенести цены на другой год
                </h2>
                <p className="mt-0.5 text-xs text-olive/60">
                  Скопируйте все периоды цен по активным номерам с января по декабрь.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-olive/10 bg-white/85 text-olive/70 transition hover:scale-[1.03] hover:bg-cream hover:text-olive [@media(orientation:landscape)_and_(max-height:560px)]:h-8 [@media(orientation:landscape)_and_(max-height:560px)]:w-8"
                onClick={closeCopyYearPricesModal}
                aria-label="Закрыть"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4 [@media(orientation:landscape)_and_(max-height:560px)]:space-y-2 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <section className={modalSectionClass}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-olive">Из какого года</span>
                    <Input
                      type="number"
                      min={2000}
                      max={2100}
                      value={copyYearPricesForm.sourceYearInput}
                      onChange={(event) =>
                        updateCopyYearPricesForm({ sourceYearInput: event.target.value })
                      }
                      className={modalTextInputClass}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-olive">На какой год</span>
                    <Input
                      type="number"
                      min={2000}
                      max={2100}
                      value={copyYearPricesForm.targetYearInput}
                      onChange={(event) =>
                        updateCopyYearPricesForm({ targetYearInput: event.target.value })
                      }
                      className={modalTextInputClass}
                    />
                  </label>
                </div>

                <label className="mt-3 flex items-start gap-3 rounded-2xl border border-olive/12 bg-white/86 p-3">
                  <input
                    type="checkbox"
                    checked={copyYearPricesForm.replaceExisting}
                    onChange={(event) =>
                      updateCopyYearPricesForm({ replaceExisting: event.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-olive/25 text-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-olive">
                      Заменить цены в целевом году
                    </span>
                    <span className="mt-0.5 block text-xs text-olive/60">
                      Если в выбранном году уже есть цены, они будут удалены и записаны заново.
                    </span>
                  </span>
                </label>
              </section>

              <section className={modalSectionClass}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-olive/12 bg-white/86 p-3">
                    <p className={modalMetaLabelClass}>Периодов к переносу</p>
                    <p className="mt-1 text-sm font-semibold text-olive">
                      {copyYearPricePeriodsPreview.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-olive/12 bg-white/86 p-3">
                    <p className={modalMetaLabelClass}>Номеров с ценами</p>
                    <p className="mt-1 text-sm font-semibold text-olive">{copyYearRoomsCount}</p>
                  </div>
                </div>

                {copyYearPricePeriodsPreview.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {copyYearPricePeriodsPreview.slice(0, 6).map((price) => (
                      <div
                        key={`${price.id}-${price.roomId}-${price.dateFrom}-${price.dateTo}`}
                        className="rounded-2xl border border-olive/10 bg-white/86 p-3"
                      >
                        <p className="truncate text-sm font-semibold text-olive">
                          {price.roomTitle}
                        </p>
                        <p className="mt-1 text-xs text-olive/62">
                          {formatPriceLabel(price)} ·{" "}
                          {formatDateRangeLabel(price.dateFrom, price.dateTo)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-2xl border border-olive/10 bg-white/72 px-3 py-2 text-sm text-olive/65">
                    В выбранном исходном году цены пока не найдены.
                  </p>
                )}
                {copyYearPricePeriodsPreview.length > 6 ? (
                  <p className="mt-2 text-xs text-olive/60">
                    И еще {copyYearPricePeriodsPreview.length - 6} периодов.
                  </p>
                ) : null}
              </section>

              {copyYearPricesError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {copyYearPricesError}
                </p>
              ) : null}
            </div>

            <div className="glass-mobile-bar sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-olive/10 bg-white/80 px-3 py-3 sm:px-4 [@media(orientation:landscape)_and_(max-height:560px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5">
              <Button
                variant="ghost"
                className="px-3 py-2 text-xs sm:text-sm"
                onClick={closeCopyYearPricesModal}
              >
                Закрыть
              </Button>
              <Button
                className="px-3 py-2 text-xs sm:text-sm"
                onClick={() => void copyYearPricePeriods()}
                disabled={isCopyingYearPrices || copyYearPricePeriodsPreview.length === 0}
              >
                {isCopyingYearPrices ? "Перенос..." : "Перенести цены"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Floating action button for mobile quick add */}
      {showFloatingQuickAdd &&
      canManageCalendar &&
      !isRoomOrderMode &&
      !isBookingModalOpen &&
      !isCalendarSyncModalOpen &&
      !isPriceModalOpen &&
      !isDuplicatePricesModalOpen &&
      !isCopyYearPricesModalOpen &&
      !isOccupancyActionsOpen ? (
        <button
          type="button"
          className={cn(
            "fixed right-3 z-40 inline-flex items-center justify-center gap-2 transition active:scale-[0.97]",
            avoidDashboardBottomNav
              ? "bottom-[calc(env(safe-area-inset-bottom,0px)+6.25rem)] lg:bottom-3"
              : "bottom-3",
            isMobilePortrait
              ? "sticky-bottom-enter h-14 rounded-[24px] bg-[linear-gradient(135deg,#0f766e_0%,#0e7490_100%)] px-4 text-sm font-semibold text-white shadow-[0_20px_40px_-18px_rgba(15,118,110,0.75)]"
              : "h-12 w-12 rounded-full bg-primary text-white shadow-lg shadow-primary/30",
          )}
          onClick={() => {
            if (boardMode === "occupancy") {
              openBookingModal();
            } else {
              openPriceModal();
            }
          }}
          aria-label={boardMode === "occupancy" ? "Добавить бронь" : "Добавить цену"}
        >
          <AppIcon icon={Plus} className="h-6 w-6" />
          {isMobilePortrait ? (
            <span>{boardMode === "occupancy" ? "Новая бронь" : "Новая цена"}</span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

type FragmentByGroupProps = {
  groupLabel: string;
  rooms: SerializedChessboardRoom[];
  visibleDays: ChessboardDay[];
  boardMode: BoardMode;
  dayCellWidthPx: number;
  isCoarsePointer: boolean;
  isMobilePortrait: boolean;
  todayIso: string;
  rowOffset: number;
  dragSelection: {
    roomId: string;
    dateFrom: string;
    dateTo: string;
  } | null;
  expandedMobileRailKey: string | null;
  occupancyLookup: Map<string, Map<string, SerializedRoomOccupancy>>;
  priceLookup: Map<string, Map<string, SerializedRoomPrice>>;
  onDismissMobileRail: () => void;
  onToggleMobileRail: (key: string) => void;
  onCellMouseDown: (
    roomId: string,
    dayIso: string,
    hasOccupancy: boolean,
    pointer: DragPointer,
  ) => void;
  onCellMouseEnter: (roomId: string, dayIso: string, hasOccupancy: boolean) => void;
  onCellTap: (
    roomId: string,
    dayIso: string,
    hasOccupancy: boolean,
    price: SerializedRoomPrice | null,
  ) => void;
  onOccupancyClick: (occupancy: SerializedRoomOccupancy) => void;
};

type CompactPageDotsProps = {
  pageCount: number;
  currentPage: number;
  onChange: (page: number) => void;
  className?: string;
};

function CompactPageDots({ pageCount, currentPage, onChange, className }: CompactPageDotsProps) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/12 bg-white text-olive/65 transition hover:border-primary/20 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
        onClick={() => onChange(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        aria-label="Предыдущая страница номеров"
      >
        <AppIcon icon={ChevronLeft} className="h-3.5 w-3.5" />
      </button>
      <div className="custom-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto py-1">
        {Array.from({ length: pageCount }, (_, pageIndex) => (
          <button
            key={pageIndex}
            type="button"
            className={cn(
              "h-8 min-w-8 rounded-full px-2.5 text-xs font-semibold transition",
              currentPage === pageIndex
                ? "bg-primary text-white shadow-[0_12px_22px_-18px_rgba(15,118,110,0.85)]"
                : "bg-white text-olive/70 hover:bg-cream hover:text-olive",
            )}
            onClick={() => onChange(pageIndex)}
            aria-label={`Страница ${pageIndex + 1}`}
            aria-current={currentPage === pageIndex ? "page" : undefined}
          >
            {pageIndex + 1}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/12 bg-white text-olive/65 transition hover:border-primary/20 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
        onClick={() => onChange(Math.min(pageCount - 1, currentPage + 1))}
        disabled={currentPage >= pageCount - 1}
        aria-label="Следующая страница номеров"
      >
        <AppIcon icon={ChevronRight} className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

type MobileRailPreviewProps = {
  preview: string;
  ordinal: number;
  title: string;
  subtitle?: string;
  expanded: boolean;
  variant: "group" | "room";
  onToggle: () => void;
};

function MobileRailPreview({
  preview,
  ordinal,
  title,
  subtitle,
  expanded,
  variant,
  onToggle,
}: MobileRailPreviewProps) {
  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "group relative inline-flex min-h-[calc(var(--cb-cell-h)-4px)] w-full items-center justify-center rounded-md border border-olive/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,248,245,0.96))] px-1 py-1 text-center transition-all duration-200 active:scale-[0.98]",
          expanded
            ? "border-primary/20 shadow-[0_16px_30px_-26px_rgba(15,118,110,0.55)] ring-2 ring-primary/10"
            : "shadow-[0_12px_24px_-28px_rgba(58,43,35,0.35)]",
        )}
        onClick={onToggle}
        aria-expanded={expanded}
        title={title}
        aria-label={`${expanded ? "Свернуть" : "Показать"} ${
          variant === "group" ? "категорию" : "номер"
        } ${title}`}
      >
        <span className="sr-only">{title}</span>
        <span className="flex min-w-0 items-center justify-center gap-1.5">
          <span className="shrink-0 text-[9px] font-semibold leading-none text-olive/45">
            {ordinal}
          </span>
          <span className="truncate text-[11px] font-bold leading-4 text-olive">{preview}</span>
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
              expanded ? "bg-primary" : "bg-olive/28",
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      <div
        className={cn(
          "pointer-events-none absolute left-full top-1/2 z-30 w-[min(68vw,260px)] -translate-y-1/2 pl-1.5 transition-all duration-200",
          expanded ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
        )}
      >
        <div className="rounded-lg border border-olive/10 bg-white/96 p-2.5 shadow-[0_18px_36px_-28px_rgba(58,43,35,0.38)] backdrop-blur-sm">
          <p className="break-words text-xs font-semibold leading-4 text-olive">{title}</p>
          {subtitle ? <p className="mt-1 text-[10px] leading-4 text-olive/62">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

function FragmentByGroup({
  groupLabel,
  rooms,
  visibleDays,
  boardMode,
  dayCellWidthPx,
  isCoarsePointer,
  isMobilePortrait,
  todayIso,
  rowOffset,
  dragSelection,
  expandedMobileRailKey,
  occupancyLookup,
  priceLookup,
  onDismissMobileRail,
  onToggleMobileRail,
  onCellMouseDown,
  onCellMouseEnter,
  onCellTap,
  onOccupancyClick,
}: FragmentByGroupProps) {
  const firstVisibleIso = visibleDays[0]?.iso ?? null;
  const lastVisibleIso = visibleDays[visibleDays.length - 1]?.iso ?? null;
  const dayIndexByIso = new Map(visibleDays.map((day, index) => [day.iso, index]));

  return (
    <>
      {rooms.map((room, localRoomIndex) => {
        const isEvenRow = (rowOffset + localRoomIndex) % 2 === 0;
        return (
          <tr key={room.id} className="align-top">
            <th
              className={cn(
                `sticky left-0 z-50 border-b border-r border-olive/10 px-2 py-1.5 text-left align-middle shadow-[8px_0_18px_-20px_rgba(58,43,35,0.55)] ${LS}:px-1.5 ${LS}:py-0.5`,
                isEvenRow ? "bg-white" : "bg-[#faf7ef]",
              )}
              style={{
                width: "var(--cb-sidebar-w)",
                minWidth: "var(--cb-sidebar-w)",
              }}
            >
              {isMobilePortrait ? (
                <MobileRailPreview
                  preview={buildCompactPreviewLabel(room.title)}
                  ordinal={rowOffset + localRoomIndex + 1}
                  title={room.title}
                  subtitle={`${getGroupShortLabel(groupLabel)} • ${formatRoomMeta(room)}`}
                  expanded={expandedMobileRailKey === `room:${room.id}`}
                  variant="room"
                  onToggle={() => onToggleMobileRail(`room:${room.id}`)}
                />
              ) : (
                <>
                  <p
                    className={`truncate text-[11px] font-semibold leading-4 text-olive md:text-xs ${LS}:text-[9px]`}
                  >
                    {room.title}
                  </p>
                  <p className={`hidden text-[10px] text-olive/52 sm:block ${LS}:!hidden`}>
                    {formatRoomMeta(room)}
                  </p>
                </>
              )}
            </th>

            {visibleDays.map((day) => {
              const occupancy = occupancyLookup.get(room.id)?.get(day.iso) ?? null;
              const price = priceLookup.get(room.id)?.get(day.iso) ?? null;
              const isSelected =
                dragSelection !== null &&
                dragSelection.roomId === room.id &&
                isoDateInRange(day.iso, dragSelection.dateFrom, dragSelection.dateTo);
              const isInteractive = boardMode === "prices" || !occupancy;

              const occupancyBar =
                boardMode === "occupancy" && occupancy && firstVisibleIso && lastVisibleIso
                  ? (() => {
                      const startsWithinVisible =
                        compareIsoDates(occupancy.dateFrom, firstVisibleIso) >= 0;
                      const endsWithinVisible =
                        compareIsoDates(occupancy.dateTo, lastVisibleIso) <= 0;
                      const rangeStartIso = startsWithinVisible
                        ? occupancy.dateFrom
                        : firstVisibleIso;
                      const rangeEndIso = endsWithinVisible ? occupancy.dateTo : lastVisibleIso;

                      const rangeStartIndex = dayIndexByIso.get(rangeStartIso);
                      const rangeEndIndex = dayIndexByIso.get(rangeEndIso);
                      if (
                        rangeStartIndex === undefined ||
                        rangeEndIndex === undefined ||
                        rangeEndIndex < rangeStartIndex
                      ) {
                        return null;
                      }

                      const startOffsetPx = 0;
                      const endOffsetPx = dayCellWidthPx;
                      const widthPx = Math.max(
                        12,
                        (rangeEndIndex - rangeStartIndex) * dayCellWidthPx +
                          (endOffsetPx - startOffsetPx),
                      );
                      const createdAtLabel = new Date(occupancy.createdAt).toLocaleDateString(
                        "ru-RU",
                      );
                      const nightsLabel = formatNightsLabel(
                        getStayNights(occupancy.dateFrom, occupancy.dateTo),
                      );
                      const tagLabel = occupancy.tag ? truncateToLength(occupancy.tag, 20) : null;

                      return {
                        rangeStartIso,
                        startOffsetPx,
                        widthPx,
                        classes: getOccupancyBarClasses(occupancy.status, occupancy.color),
                        guestLabel: occupancy.guestLabel,
                        metaLabel: tagLabel
                          ? `${nightsLabel} • ${tagLabel}`
                          : `${nightsLabel} • создано ${createdAtLabel}`,
                        occupancy,
                      };
                    })()
                  : null;

              const priceBar =
                boardMode === "prices" && price && firstVisibleIso && lastVisibleIso
                  ? (() => {
                      const startsWithinVisible =
                        compareIsoDates(price.dateFrom, firstVisibleIso) >= 0;
                      const endsWithinVisible = compareIsoDates(price.dateTo, lastVisibleIso) <= 0;
                      const rangeStartIso = startsWithinVisible ? price.dateFrom : firstVisibleIso;
                      const rangeEndIso = endsWithinVisible ? price.dateTo : lastVisibleIso;

                      const rangeStartIndex = dayIndexByIso.get(rangeStartIso);
                      const rangeEndIndex = dayIndexByIso.get(rangeEndIso);
                      if (
                        rangeStartIndex === undefined ||
                        rangeEndIndex === undefined ||
                        rangeEndIndex < rangeStartIndex
                      ) {
                        return null;
                      }

                      const startOffsetPx = 0;
                      const endOffsetPx = dayCellWidthPx;
                      const widthPx = Math.max(
                        12,
                        (rangeEndIndex - rangeStartIndex) * dayCellWidthPx +
                          (endOffsetPx - startOffsetPx),
                      );

                      return {
                        rangeStartIso,
                        startOffsetPx,
                        widthPx,
                        priceLabel: formatPriceLabel(price),
                        guestsLabel: formatPriceRestrictionLabel(price),
                      };
                    })()
                  : null;

              const selectionBar =
                dragSelection !== null &&
                dragSelection.roomId === room.id &&
                firstVisibleIso &&
                lastVisibleIso
                  ? (() => {
                      const startsWithinVisible =
                        compareIsoDates(dragSelection.dateFrom, firstVisibleIso) >= 0;
                      const endsWithinVisible =
                        compareIsoDates(dragSelection.dateTo, lastVisibleIso) <= 0;
                      const rangeStartIso = startsWithinVisible
                        ? dragSelection.dateFrom
                        : firstVisibleIso;
                      const rangeEndIso = endsWithinVisible ? dragSelection.dateTo : lastVisibleIso;
                      const rangeStartIndex = dayIndexByIso.get(rangeStartIso);
                      const rangeEndIndex = dayIndexByIso.get(rangeEndIso);

                      if (
                        rangeStartIndex === undefined ||
                        rangeEndIndex === undefined ||
                        rangeEndIndex < rangeStartIndex
                      ) {
                        return null;
                      }

                      return {
                        rangeStartIso,
                        widthPx: Math.max(
                          12,
                          (rangeEndIndex - rangeStartIndex + 1) * dayCellWidthPx,
                        ),
                      };
                    })()
                  : null;

              const isToday = day.iso === todayIso;
              return (
                <td
                  key={`${room.id}-${day.iso}`}
                  className={cn(
                    `relative overflow-visible border-b border-l border-olive/10 align-top`,
                    isSelected
                      ? chessboardToneClasses.selectedCell
                      : isToday
                        ? "bg-primary/6"
                        : day.isMonthStart
                          ? isEvenRow
                            ? "bg-[linear-gradient(180deg,rgba(249,244,236,0.95),rgba(255,255,255,0.96))]"
                            : "bg-[linear-gradient(180deg,rgba(245,239,230,0.92),rgba(255,255,255,0.94))]"
                          : day.isWeekend
                            ? isEvenRow
                              ? "bg-sand/32"
                              : "bg-sand/18"
                            : isEvenRow
                              ? "bg-cream/28"
                              : "bg-white/96",
                    day.isMonthStart
                      ? "border-l-2 border-l-terra/40 shadow-[inset_1px_0_0_rgba(154,98,69,0.12)]"
                      : day.isWeekStart
                        ? "border-l-terra/35"
                        : "",
                    isToday ? "shadow-[inset_0_0_0_1px_rgba(15,118,110,0.08)]" : "",
                  )}
                  style={{
                    width: "var(--cb-cell-w)",
                    minWidth: "var(--cb-cell-w)",
                    height: "var(--cb-cell-h)",
                  }}
                >
                  {occupancyBar && occupancyBar.rangeStartIso === day.iso ? (
                    <button
                      type="button"
                      className={cn(
                        "absolute left-0 z-10 border shadow-[0_10px_18px_-16px_rgba(58,43,35,0.45)] transition hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                        occupancyBar.classes,
                      )}
                      style={{
                        left: `${occupancyBar.startOffsetPx}px`,
                        width: `${occupancyBar.widthPx}px`,
                        top: "var(--cb-booking-top)",
                        height: "var(--cb-booking-h)",
                        borderRadius: isMobilePortrait ? "10px" : "12px",
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onDismissMobileRail();
                        onOccupancyClick(occupancyBar.occupancy);
                      }}
                      aria-label={`Открыть бронь: ${occupancyBar.guestLabel}`}
                    >
                      <div
                        className={cn(
                          `leading-tight text-white ${LS}:px-1 ${LS}:py-0.5`,
                          isMobilePortrait ? "px-1.5 py-1" : "px-2 py-1",
                        )}
                      >
                        <p
                          className={cn(
                            `truncate font-semibold leading-none ${LS}:text-[8px]`,
                            isMobilePortrait ? "text-[9px]" : "text-[10px]",
                          )}
                        >
                          {occupancyBar.guestLabel}
                        </p>
                        <p
                          className={cn(
                            `mt-1 truncate text-white/88 leading-none ${LS}:text-[7px]`,
                            isMobilePortrait ? "text-[8px]" : "text-[9px]",
                          )}
                        >
                          {occupancyBar.metaLabel}
                        </p>
                      </div>
                    </button>
                  ) : null}
                  {priceBar && priceBar.rangeStartIso === day.iso ? (
                    <div
                      className={cn(
                        "pointer-events-none absolute left-0 z-10 border shadow-[0_10px_18px_-16px_rgba(58,43,35,0.42)]",
                        chessboardToneClasses.priceBar,
                      )}
                      style={{
                        left: `${priceBar.startOffsetPx}px`,
                        width: `${priceBar.widthPx}px`,
                        top: "var(--cb-booking-top)",
                        height: "var(--cb-booking-h)",
                        borderRadius: isMobilePortrait ? "10px" : "12px",
                      }}
                    >
                      <div
                        className={cn(
                          `leading-tight text-white ${LS}:px-1 ${LS}:py-0.5`,
                          isMobilePortrait ? "px-1.5 py-1" : "px-2 py-1",
                        )}
                      >
                        <p
                          className={cn(
                            `truncate font-semibold leading-none ${LS}:text-[8px]`,
                            isMobilePortrait ? "text-[9px]" : "text-[10px]",
                          )}
                        >
                          {priceBar.priceLabel}
                        </p>
                        <p
                          className={cn(
                            `mt-1 truncate text-white/88 leading-none ${LS}:text-[7px]`,
                            isMobilePortrait ? "text-[8px]" : "text-[9px]",
                          )}
                        >
                          {priceBar.guestsLabel}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {selectionBar && selectionBar.rangeStartIso === day.iso ? (
                    <div
                      className={cn(
                        "pointer-events-none absolute left-0 z-20 border",
                        chessboardToneClasses.selectionRange,
                      )}
                      style={{
                        width: `${selectionBar.widthPx}px`,
                        top: "calc(var(--cb-booking-top) - 2px)",
                        height: "calc(var(--cb-booking-h) + 4px)",
                        borderRadius: isMobilePortrait ? "12px" : "14px",
                      }}
                    />
                  ) : null}
                  <button
                    type="button"
                    className={cn(
                      "h-full w-full rounded-[10px] px-1 py-0.5 text-left transition-colors",
                      isInteractive
                        ? isCoarsePointer
                          ? "cursor-pointer active:bg-primary/10"
                          : "cursor-crosshair"
                        : "cursor-default",
                      boardMode === "prices"
                        ? price
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "bg-terra/5 hover:bg-terra/10"
                        : "",
                    )}
                    data-chess-cell="1"
                    data-room-id={room.id}
                    data-day-iso={day.iso}
                    data-has-occupancy={occupancy ? "1" : "0"}
                    data-interactive={isInteractive ? "1" : "0"}
                    onMouseDown={(event) => {
                      if (!isInteractive || isCoarsePointer) {
                        return;
                      }
                      event.preventDefault();
                      onDismissMobileRail();
                      onCellMouseDown(room.id, day.iso, Boolean(occupancy), {
                        clientX: event.clientX,
                        clientY: event.clientY,
                      });
                    }}
                    onMouseEnter={() => {
                      if (!isInteractive || isCoarsePointer) {
                        return;
                      }
                      onCellMouseEnter(room.id, day.iso, Boolean(occupancy));
                    }}
                    onClick={() => {
                      if (!isCoarsePointer || !isInteractive) {
                        return;
                      }
                      onDismissMobileRail();
                      onCellTap(room.id, day.iso, Boolean(occupancy), price);
                    }}
                    style={{ touchAction: isCoarsePointer ? "manipulation" : "pan-y" }}
                  >
                    {boardMode === "occupancy" ? null : price ? null : (
                      <span
                        className={cn(
                          `inline-flex rounded-md bg-terra/8 font-medium text-terra ${LS}:px-0.5 ${LS}:py-0 ${LS}:text-[7px]`,
                          isMobilePortrait ? "px-1 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[9px]",
                        )}
                      >
                        Без цены
                      </span>
                    )}
                  </button>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

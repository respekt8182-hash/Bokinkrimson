// Owner chessboard workspace:
// - occupancy board (bookings/check-in/cancel)
// - prices board (period pricing CRUD)
// - shared calendar navigation and drag-to-select interactions
"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  type LucideIcon,
  Plus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SingleDatePopoverField } from "@/components/ui/single-date-popover-field";
import { cn } from "@/lib/cn";
import type { SerializedRoomOccupancy } from "@/lib/occupancy";
import { addDays, parseIsoDate, toIsoDate, type SerializedRoomPrice } from "@/lib/pricing";
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

type PriceFormState = {
  roomId: string;
  dateFrom: string;
  dateTo: string;
  priceInput: string;
  currency: string;
  minGuestsInput: string;
  editingPriceId: string | null;
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
const mobileRoomsPerPage = 3;
const dayCellWidthDesktopPx = 44;
const dayCellWidthTabletPx = 42;
const dayCellWidthPortraitPx = 40;
const dayCellWidthMobilePx = 40;
const dayCellWidthLandscapePx = 36;
const LS = "[@media(orientation:landscape)_and_(max-height:560px)]";
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
const modalSectionClass =
  "wizard-section-enter rounded-[24px] border border-olive/12 bg-[linear-gradient(180deg,rgba(248,242,232,0.86),rgba(255,255,255,0.98))] p-3 shadow-sm sm:p-4";
const modalTextInputClass =
  "min-h-11 rounded-2xl border-olive/15 bg-white shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)]";
const modalSelectClass =
  "w-full rounded-2xl border border-olive/15 bg-white px-3.5 py-3 text-sm text-olive shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/22";
const modalMetaLabelClass = "text-[11px] uppercase tracking-[0.14em] text-olive/50";
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
    bookingColorOptions.find((option) => option.id === normalized)?.label ?? bookingColorOptions[0].label
  );
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
      return value;
    }
  }
  return fallback;
}

const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatPriceLabel(price: SerializedRoomPrice): string {
  const amount = ruNumberFormat.format(price.price);
  return `${amount} ${price.currency}`;
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

  return Array.from(normalized[0] ?? value.trim())
    .slice(0, maxLetters)
    .join("")
    .toUpperCase();
}

function addGroupOffsets(groups: GroupedRoomBucket[]): GroupedRoomBucketWithOffset[] {
  let offset = 0;

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
};

function OverlayPickerField({
  label,
  valueLabel,
  promptLabel,
  inputType,
  inputValue,
  onChange,
  icon,
}: OverlayPickerFieldProps) {
  return (
    <label className="group relative block">
      <div className={modalPickerCardClass}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={modalMetaLabelClass}>{label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-olive sm:text-[15px]">
              {valueLabel}
            </p>
          </div>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <AppIcon icon={icon} className="h-4 w-4" />
          </span>
        </div>
        <span className="mt-3 inline-flex items-center rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-semibold text-primary/85">
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
}: PropertyChessboardWorkspaceProps) {
  const initialTodayIso = useMemo(() => getLocalTodayIso(), []);
  // UI state (menus/modals), dataset state (rooms/occupancies), and edit forms live together
  // because all calendar interactions need synchronized updates.
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    initialPropertyId ?? properties[0]?.id ?? null,
  );
  const [periodStartIso, setPeriodStartIso] = useState(initialTodayIso);
  const [boardMode, setBoardMode] = useState<BoardMode>("occupancy");
  const [isObjectMenuOpen, setIsObjectMenuOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isOccupancyActionsOpen, setIsOccupancyActionsOpen] = useState(false);
  const [rooms, setRooms] = useState<SerializedChessboardRoom[]>([]);
  const [occupanciesByRoom, setOccupanciesByRoom] = useState<
    Record<string, SerializedRoomOccupancy[]>
  >({});
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingOccupancies, setIsLoadingOccupancies] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [messageSuccess, setMessageSuccess] = useState("");
  const [bookingModalError, setBookingModalError] = useState("");
  const [occupancyActionsError, setOccupancyActionsError] = useState("");
  const [priceModalError, setPriceModalError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [bookingForm, setBookingForm] = useState<BookingFormState | null>(null);
  const [activeOccupancy, setActiveOccupancy] = useState<SerializedRoomOccupancy | null>(null);
  const [priceForm, setPriceForm] = useState<PriceFormState | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelectionState | null>(null);
  const [isSavingOccupancyAction, setIsSavingOccupancyAction] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [mobileRoomPage, setMobileRoomPage] = useState(0);
  const [bookingRoomPage, setBookingRoomPage] = useState(0);
  const [expandedMobileRailKey, setExpandedMobileRailKey] = useState<string | null>(null);
  const [dayCellWidthPx, setDayCellWidthPx] = useState(dayCellWidthDesktopPx);
  const [visibleDaysCount, setVisibleDaysCount] = useState(minVisibleDaysCount);
  const objectMenuRef = useRef<HTMLDivElement | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);

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
      const sidebarWidthPx =
        Number.parseFloat(styles.getPropertyValue("--cb-sidebar-w")) || 0;
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
    setDragSelection(null);
  }, [boardMode, selectedPropertyId, periodStartIso]);

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
        currency: sourcePrice?.currency ?? "RUB",
        minGuestsInput:
          sourcePrice?.minGuests === null || sourcePrice?.minGuests === undefined
            ? ""
            : String(sourcePrice.minGuests),
        editingPriceId: sourcePrice?.id ?? null,
      });
      setPriceModalError("");
      setIsPriceModalOpen(true);
      setDragSelection(null);
    },
    [boardMode, rooms],
  );

  // Desktop flow: drag with mouse and release to open modal.
  useEffect(() => {
    const selection = dragSelection;
    if (!selection || isCoarsePointer) {
      return;
    }
    const activeSelection: DragSelectionState = selection;

    function handleMouseUp() {
      openModalFromSelection(activeSelection);
    }

    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragSelection, isCoarsePointer, openModalFromSelection]);

  const visibleDays = useMemo(
    () => buildVisibleDays(periodStartIso, visibleDaysCount),
    [periodStartIso, visibleDaysCount],
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
    const normalizedRooms = [...rooms].sort((left, right) =>
      left.title.localeCompare(right.title, "ru"),
    );
    const grouped = new Map<string, SerializedChessboardRoom[]>();

    for (const room of normalizedRooms) {
      const key = `Категория: ${room.bathroomTypeLabel}`;
      const list = grouped.get(key) ?? [];
      list.push(room);
      grouped.set(key, list);
    }

    return Array.from(grouped.entries()).map(([groupLabel, items]) => ({
      groupLabel,
      items,
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

  const mobileRoomPageCount = useMemo(
    () => Math.max(1, Math.ceil(roomPagerEntries.length / mobileRoomsPerPage)),
    [roomPagerEntries],
  );

  const visibleRoomGroups = useMemo<GroupedRoomBucket[]>(() => {
    if (!isMobilePortrait) {
      return groupedRooms;
    }

    const start = mobileRoomPage * mobileRoomsPerPage;
    const slice = roomPagerEntries.slice(start, start + mobileRoomsPerPage);
    const regrouped = new Map<string, SerializedChessboardRoom[]>();

    for (const entry of slice) {
      const list = regrouped.get(entry.groupLabel) ?? [];
      list.push(entry.room);
      regrouped.set(entry.groupLabel, list);
    }

    return Array.from(regrouped.entries()).map(([groupLabel, items]) => ({
      groupLabel,
      items,
    }));
  }, [groupedRooms, isMobilePortrait, mobileRoomPage, roomPagerEntries]);

  const groupedRoomsWithOffset = useMemo<GroupedRoomBucketWithOffset[]>(
    () => addGroupOffsets(visibleRoomGroups),
    [visibleRoomGroups],
  );

  const visibleRoomRange = useMemo(() => {
    if (roomPagerEntries.length === 0) {
      return { from: 0, to: 0 };
    }

    if (!isMobilePortrait) {
      return { from: 1, to: roomPagerEntries.length };
    }

    const from = mobileRoomPage * mobileRoomsPerPage + 1;
    const to = Math.min((mobileRoomPage + 1) * mobileRoomsPerPage, roomPagerEntries.length);
    return { from, to };
  }, [isMobilePortrait, mobileRoomPage, roomPagerEntries]);

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
    setMobileRoomPage((prev) => Math.min(prev, Math.max(0, mobileRoomPageCount - 1)));
    setBookingRoomPage((prev) => Math.min(prev, Math.max(0, mobileRoomPageCount - 1)));
  }, [mobileRoomPageCount]);

  useEffect(() => {
    if (!isMobilePortrait) {
      setExpandedMobileRailKey(null);
    }
  }, [isMobilePortrait]);

  useEffect(() => {
    setExpandedMobileRailKey(null);
  }, [boardMode, mobileRoomPage, periodStartIso, selectedPropertyId]);

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
      const response = await fetch(`/api/properties/${selectedPropertyId}/rooms?view=chessboard`);
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
    const defaultRoomId = options?.roomId ?? sourceOccupancy?.roomId ?? rooms[0]?.id ?? "";
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
    const defaultRoomId = options?.roomId ?? sourcePrice?.roomId ?? rooms[0]?.id ?? "";
    const dateFrom = sourcePrice?.dateFrom ?? options?.dateFrom ?? periodFromIso;
    const dateTo = sourcePrice?.dateTo ?? options?.dateTo ?? dateFrom;

    setPriceForm({
      roomId: defaultRoomId,
      dateFrom,
      dateTo,
      priceInput: sourcePrice ? String(sourcePrice.price) : "",
      currency: sourcePrice?.currency ?? "RUB",
      minGuestsInput:
        sourcePrice?.minGuests === null || sourcePrice?.minGuests === undefined
          ? ""
          : String(sourcePrice.minGuests),
      editingPriceId: sourcePrice?.id ?? null,
    });
    setPriceModalError("");
    setIsPriceModalOpen(true);
  }

  function closePriceModal() {
    setIsPriceModalOpen(false);
    setPriceForm(null);
    setPriceModalError("");
  }

  function updatePriceForm(patch: Partial<PriceFormState>) {
    setPriceForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function beginDragSelection(roomId: string, dayIso: string) {
    setExpandedMobileRailKey(null);
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

  function jumpToDate(dateIso: string) {
    setPeriodStartIso(dateIso);
    setDragSelection(null);
    scrollBoardToPeriodStart();
  }

  function shiftVisiblePeriod(days: number) {
    const parsed = parseIsoDate(periodStartIso) ?? parseIsoDate(getLocalTodayIso());
    if (!parsed) {
      return;
    }
    const next = toIsoDate(addDays(parsed, days));
    jumpToDate(next);
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
    if (minGuestsValue.length > 0) {
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
          minGuests,
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
  const activeOccupancyColorLabel = activeOccupancy ? getBookingColorLabel(activeOccupancy.color) : "—";

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
              {boardMode === "occupancy" ? (
                <Button
                  className={cn(compactToolbarPrimaryButtonClass, "shrink-0")}
                  onClick={() => openBookingModal()}
                  disabled={!canManageCalendar}
                >
                  + Бронь
                </Button>
              ) : (
                <Button
                  className={cn(compactToolbarPrimaryButtonClass, "shrink-0")}
                  onClick={() => openPriceModal()}
                  disabled={!canManageCalendar}
                >
                  + Цена
                </Button>
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
                  jumpToDate(nextValue);
                }}
                placeholder="К дате"
                helperText="Выберите дату перехода"
                buttonLabel="К дате"
                showAdornment={false}
                allowClear={false}
                desktopPanelStyle="dialog"
                desktopPopoverAlign="left"
                rootClassName="shrink-0"
                buttonClassName={cn(compactToolbarButtonClass, "w-auto min-w-[92px]")}
              />
              {selectedPropertyId && properties.length > 0 ? (
                <div className={cn(compactToolbarNavShellClass, "shrink-0 sm:ml-auto")}>
                  <button
                    type="button"
                    className="inline-flex h-full w-8 items-center justify-center rounded-md border border-olive/14 bg-white text-olive/60 transition hover:bg-cream hover:text-olive"
                    onClick={() => shiftVisiblePeriod(-visibleDaysCount)}
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
                    onClick={() => shiftVisiblePeriod(visibleDaysCount)}
                    aria-label="Вперед"
                  >
                    <AppIcon
                      icon={ChevronRight}
                      className="h-3.5 w-3.5 [@media(orientation:landscape)_and_(max-height:560px)]:h-3 [@media(orientation:landscape)_and_(max-height:560px)]:w-3"
                    />
                  </button>
                </div>
              ) : null}
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
          <div className="rounded-xl border border-olive/10 bg-white/96 p-2 md:p-2.5 [@media(orientation:landscape)_and_(max-height:560px)]:rounded-lg [@media(orientation:landscape)_and_(max-height:560px)]:p-1.5">
            {rooms.length === 0 && !isLoadingRooms ? (
              <p className="rounded-lg border border-dashed border-olive/30 px-3 py-3 text-sm text-olive/65">
                В объекте пока нет активных номеров. Добавьте номер в разделе «Номерной фонд».
              </p>
            ) : null}

            {isMobilePortrait && roomPagerEntries.length > 0 ? (
              <div className="mt-2 rounded-lg border border-primary/10 bg-[linear-gradient(135deg,rgba(15,118,110,0.05),rgba(250,248,245,0.94)_60%,rgba(255,255,255,0.98))] px-3 py-2 shadow-[0_16px_32px_-30px_rgba(15,118,110,0.4)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-olive/55">
                      Номера
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-olive">
                      {visibleRoomRange.from}-{visibleRoomRange.to} из {roomPagerEntries.length}
                    </p>
                  </div>
                  <span className="glass-badge inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                    {mobileRoomPage + 1}/{mobileRoomPageCount}
                  </span>
                </div>
              </div>
            ) : null}

            {rooms.length > 0 ? (
              <div
                ref={boardScrollRef}
                className="chessboard-board-scroll custom-scrollbar mt-1.5 max-h-[70dvh] overflow-auto overscroll-contain rounded-lg border border-olive/10 bg-[linear-gradient(180deg,rgba(247,243,235,0.78),rgba(255,255,255,0.98)_18%,rgba(255,255,255,0.98))] md:max-h-[78vh] [@media(orientation:landscape)_and_(max-height:560px)]:mt-1 [@media(orientation:landscape)_and_(max-height:560px)]:max-h-[72dvh]"
              >
                <table className="min-w-max border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th
                        className={cn(
                          `sticky left-0 top-0 z-50 border-b border-r border-olive/10 bg-[#f7f3eb] px-2 text-left text-[11px] font-semibold text-olive md:px-2.5 md:text-xs ${LS}:px-1.5 ${LS}:text-[10px]`,
                        )}
                        style={{
                          width: "var(--cb-sidebar-w)",
                          minWidth: "var(--cb-sidebar-w)",
                          height: "var(--cb-header-h1)",
                        }}
                      >
                        {boardMode === "occupancy" ? "Занятость" : "Цены"}
                      </th>
                      {visibleMonthSegments.map((segment, segmentIndex) => (
                        <th
                          key={segment.key}
                          colSpan={segment.daysCount}
                          className={cn(
                            `sticky top-0 z-30 border-b px-0 text-center text-[11px] font-semibold text-olive/82 md:text-xs ${LS}:text-[10px]`,
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
                          `sticky left-0 z-50 border-b border-r border-olive/10 bg-white px-2 text-left text-[9px] uppercase tracking-[0.12em] text-olive/48 md:px-2.5 md:text-[10px] ${LS}:px-1.5 ${LS}:text-[8px]`,
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
                              `sticky z-20 border-b border-l border-olive/10 px-0 text-center ${LS}:px-0`,
                              isDayToday
                                ? "bg-primary/7"
                                : day.isMonthStart
                                  ? "bg-[linear-gradient(180deg,rgba(244,235,225,0.96),rgba(255,255,255,0.98))]"
                                : day.isWeekend
                                  ? "bg-sand/55"
                                  : "bg-white/96",
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
                        key={group.groupLabel}
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
                        onCellMouseDown={(roomId, dayIso, hasOccupancy) => {
                          if (boardMode === "occupancy" && hasOccupancy) {
                            return;
                          }
                          beginDragSelection(roomId, dayIso);
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
                        onPriceClick={(price) =>
                          openPriceModal({
                            roomId: price.roomId,
                            sourcePrice: price,
                          })
                        }
                        onOccupancyClick={(occupancy) => openOccupancyActions(occupancy)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {isMobilePortrait && mobileRoomPageCount > 1 ? (
              <div className="sticky-bottom-enter mt-2 rounded-lg border border-olive/10 bg-white/94 p-2.5 shadow-[0_18px_36px_-30px_rgba(58,43,35,0.32)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-olive">
                      Номера {visibleRoomRange.from}-{visibleRoomRange.to} из{" "}
                      {roomPagerEntries.length}
                    </p>
                    <p className="mt-0.5 text-xs text-olive/60">
                      Переключайте блоки по 3 номера, чтобы оставить больше места самой шахматке.
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                    {mobileRoomPage + 1}/{mobileRoomPageCount}
                  </span>
                </div>
                <CompactPageDots
                  pageCount={mobileRoomPageCount}
                  currentPage={mobileRoomPage}
                  onChange={setMobileRoomPage}
                  className="mt-2.5"
                />
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

              <section className={modalSectionClass}>
                <p className="text-sm font-semibold text-olive sm:text-[15px]">
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
              <section className={modalSectionClass}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-olive sm:text-[15px]">
                    Период проживания
                  </p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-olive/70 shadow-sm">
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

              <section className={modalSectionClass}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-olive sm:text-[15px]">
                    Время заезда и выезда
                  </p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-olive/70 shadow-sm">
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
                  />
                  <OverlayPickerField
                    label="Выезд"
                    valueLabel={formatTimeValueLabel(bookingForm.timeTo)}
                    promptLabel="Выбрать время"
                    inputType="time"
                    inputValue={bookingForm.timeTo}
                    onChange={(value) => updateBookingForm({ timeTo: value })}
                    icon={Clock3}
                  />
                </div>
              </section>

              <section className={modalSectionClass}>
                <p className="text-sm font-semibold text-olive sm:text-[15px]">Гости</p>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-olive/14 bg-white p-3 shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)]">
                    <p className={modalMetaLabelClass}>Взрослые</p>
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
                    <p className={modalMetaLabelClass}>Детей</p>
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
              <section className={modalSectionClass}>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-olive">Номер</span>
                  <select
                    className={modalSelectClass}
                    value={priceForm.roomId}
                    onChange={(event) =>
                      updatePriceForm({
                        roomId: event.target.value,
                        editingPriceId: null,
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

              <section className={modalSectionClass}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-olive sm:text-[15px]">Период</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-olive/70 shadow-sm">
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

              <section className={modalSectionClass}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className={modalMetaLabelClass}>Цена за ночь</span>
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
                    <span className={modalMetaLabelClass}>Валюта</span>
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
                <label className="mt-3 block space-y-1.5">
                  <span className={modalMetaLabelClass}>Минимум гостей (необязательно)</span>
                  <Input
                    className={modalTextInputClass}
                    type="number"
                    min={1}
                    max={40}
                    value={priceForm.minGuestsInput}
                    onChange={(event) => updatePriceForm({ minGuestsInput: event.target.value })}
                    placeholder="Если пусто — без ограничений"
                  />
                </label>
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

      {/* Floating action button for mobile quick add */}
      {showFloatingQuickAdd &&
      canManageCalendar &&
      !isBookingModalOpen &&
      !isPriceModalOpen &&
      !isOccupancyActionsOpen ? (
        <button
          type="button"
          className={cn(
            "fixed bottom-3 right-3 z-40 inline-flex items-center justify-center gap-2 transition active:scale-[0.97]",
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
  onCellMouseDown: (roomId: string, dayIso: string, hasOccupancy: boolean) => void;
  onCellMouseEnter: (roomId: string, dayIso: string, hasOccupancy: boolean) => void;
  onPriceClick: (price: SerializedRoomPrice) => void;
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
  title: string;
  subtitle?: string;
  expanded: boolean;
  variant: "group" | "room";
  onToggle: () => void;
};

function MobileRailPreview({
  preview,
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
          "group relative inline-flex min-h-[calc(var(--cb-cell-h)-4px)] w-full items-center rounded-md border border-olive/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,248,245,0.96))] px-2 py-1 text-left transition-all duration-200 active:scale-[0.98]",
          expanded
            ? "border-primary/20 shadow-[0_16px_30px_-26px_rgba(15,118,110,0.55)] ring-2 ring-primary/10"
            : "shadow-[0_12px_24px_-28px_rgba(58,43,35,0.35)]",
        )}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Свернуть" : "Показать"} ${
          variant === "group" ? "категорию" : "номер"
        } ${title}`}
      >
        <span className="sr-only">{preview}</span>
        <span className="truncate text-[11px] font-semibold leading-4 text-olive">{title}</span>
      </button>

      <div
        className={cn(
          "pointer-events-none absolute left-full top-1/2 z-30 w-[min(62vw,220px)] -translate-y-1/2 pl-2 transition-all duration-200",
          expanded ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
        )}
      >
        <div className="rounded-lg border border-olive/10 bg-white/96 p-2.5 shadow-[0_18px_36px_-28px_rgba(58,43,35,0.38)] backdrop-blur-sm">
          <p className="text-xs font-semibold text-olive">{title}</p>
          {subtitle ? <p className="mt-1 text-[10px] leading-4 text-olive/62">{subtitle}</p> : null}
          <p className="mt-2 text-[9px] uppercase tracking-[0.14em] text-primary/72">
            Нажмите по ярлыку еще раз, чтобы свернуть
          </p>
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
  onPriceClick,
  onOccupancyClick,
}: FragmentByGroupProps) {
  const firstVisibleIso = visibleDays[0]?.iso ?? null;
  const lastVisibleIso = visibleDays[visibleDays.length - 1]?.iso ?? null;
  const dayIndexByIso = new Map(visibleDays.map((day, index) => [day.iso, index]));
  const halfDayCellWidthPx = dayCellWidthPx / 2;

  return (
    <>
      {rooms.map((room, localRoomIndex) => {
        const isEvenRow = (rowOffset + localRoomIndex) % 2 === 0;
        return (
          <tr key={room.id} className="align-top">
            <th
              className={cn(
                `sticky left-0 z-30 border-b border-r border-olive/10 px-2 py-1.5 text-left align-middle ${LS}:px-1.5 ${LS}:py-0.5`,
                isEvenRow ? "bg-white/96" : "bg-cream/62",
              )}
              style={{
                width: "var(--cb-sidebar-w)",
                minWidth: "var(--cb-sidebar-w)",
              }}
            >
              {isMobilePortrait ? (
                <MobileRailPreview
                  preview={buildCompactPreviewLabel(room.title)}
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

                      const startOffsetPx = startsWithinVisible ? halfDayCellWidthPx : 0;
                      const endOffsetPx = endsWithinVisible ? halfDayCellWidthPx : dayCellWidthPx;
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
                        guestsLabel:
                          price.minGuests === null
                            ? "Любой состав гостей"
                            : `От ${price.minGuests} гостей`,
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
                          ? boardMode === "prices" && price
                            ? "cursor-pointer"
                            : "cursor-default"
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
                      onCellMouseDown(room.id, day.iso, Boolean(occupancy));
                    }}
                    onMouseEnter={() => {
                      if (!isInteractive || isCoarsePointer) {
                        return;
                      }
                      onCellMouseEnter(room.id, day.iso, Boolean(occupancy));
                    }}
                    onClick={() => {
                      if (!isCoarsePointer || boardMode !== "prices" || !price) {
                        return;
                      }
                      onDismissMobileRail();
                      onPriceClick(price);
                    }}
                    style={{ touchAction: "pan-y" }}
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

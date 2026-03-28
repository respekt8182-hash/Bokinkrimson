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
import type { SerializedRoom } from "@/lib/rooms";

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
};

type GroupedRoomBucket = {
  groupLabel: string;
  items: SerializedRoom[];
};

type GroupedRoomBucketWithOffset = GroupedRoomBucket & {
  rowOffset: number;
};

type RoomPagerEntry = {
  groupLabel: string;
  room: SerializedRoom;
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
const visibleDaysCount = 28;
const mobileRoomsPerPage = 3;
const dayCellWidthDesktopPx = 64;
const dayCellWidthTabletPx = 56;
const dayCellWidthPortraitPx = 44;
const dayCellWidthMobilePx = 48;
const dayCellWidthLandscapePx = 36;
const LS = "[@media(orientation:landscape)_and_(max-height:560px)]";
const bookingSources = [
  "Сайт",
  "Телефон",
  "WhatsApp",
  "Telegram",
  "Booking.com",
  "Ostrovok",
  "Другое",
] as const;

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
  { id: "GREEN", label: "Зеленый" },
  { id: "VIOLET", label: "Фиолетовый" },
] as const;

// Chessboard-specific palette aligned with site olive/terra/sage tones.
const chessboardToneClasses = {
  checkedInBar: "border-[#0e7490] bg-[#22b6c8]/85",
  confirmedGreenBar: "border-[#047857] bg-[#10b981]/85",
  priceBar: "border-[#8f543b] bg-[#d08b63]/85",
  selectedCell: "bg-sage/35",
  selectionRange: "border-terra/55 bg-sage/35 shadow-[0_0_0_1px_rgba(15,118,110,0.3)]",
} as const;
const modalSectionClass =
  "wizard-section-enter rounded-[24px] border border-olive/12 bg-[linear-gradient(180deg,rgba(248,242,232,0.86),rgba(255,255,255,0.98))] p-3 shadow-sm sm:p-4";
const modalTextInputClass =
  "min-h-11 rounded-2xl border-olive/15 bg-white shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)]";
const modalSelectClass =
  "w-full rounded-2xl border border-olive/15 bg-white px-3.5 py-3 text-sm text-olive shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/22";
const modalTextareaClass =
  "min-h-[108px] w-full rounded-2xl border border-olive/15 bg-white px-3.5 py-3 text-sm text-olive shadow-[0_10px_24px_-20px_rgba(60,42,20,0.55)] outline-none transition focus:border-terra focus:ring-2 focus:ring-terra/20";
const modalMetaLabelClass = "text-[11px] uppercase tracking-[0.14em] text-olive/50";
const modalPickerCardClass =
  "h-full rounded-2xl border border-olive/14 bg-white px-3.5 py-3 shadow-[0_14px_28px_-24px_rgba(60,42,20,0.7)] transition group-hover:border-primary/30 group-focus-within:border-primary/40 group-focus-within:ring-2 group-focus-within:ring-primary/12";

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
      return "border-amber-500 bg-amber-600";
    case "GREEN":
      return chessboardToneClasses.confirmedGreenBar;
    case "VIOLET":
      return "border-violet-500 bg-violet-600";
    case "RED":
    default:
      return "border-terra/70 bg-terra/85";
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

function buildVisibleDays(startIso: string): ChessboardDay[] {
  const parsed = parseIsoDate(startIso);
  if (!parsed) {
    return [];
  }

  return Array.from({ length: visibleDaysCount }).map((_, index) => {
    const date = addDays(parsed, index);
    const weekDayIndex = (date.getUTCDay() + 6) % 7;
    return {
      iso: toIsoDate(date),
      dayNumber: date.getUTCDate(),
      weekDayLabel: dayLabels[weekDayIndex],
      isWeekend: weekDayIndex >= 5,
      isWeekStart: weekDayIndex === 0 && index !== 0,
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
  return normalized.length > 0 ? normalized : "РќРµ СѓРєР°Р·Р°РЅРѕ";
}

function formatTimeRangeLabel(timeFrom: string, timeTo: string): string {
  const normalizedFrom = timeFrom.trim();
  const normalizedTo = timeTo.trim();

  if (normalizedFrom && normalizedTo) {
    return `${normalizedFrom} - ${normalizedTo}`;
  }
  if (normalizedFrom) {
    return `Р—Р°РµР·Рґ СЃ ${normalizedFrom}`;
  }
  if (normalizedTo) {
    return `Р’С‹РµР·Рґ РґРѕ ${normalizedTo}`;
  }
  return "Р’РµСЃСЊ РґРµРЅСЊ";
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
    source: bookingSources[0],
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

function formatPriceLabel(price: SerializedRoomPrice): string {
  const amount = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(price.price);
  return `${amount} ${price.currency}`;
}

function truncateToLength(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function formatRoomMeta(room: SerializedRoom): string {
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
  const [jumpDateValue, setJumpDateValue] = useState(initialTodayIso);
  const [boardMode, setBoardMode] = useState<BoardMode>("occupancy");
  const [isJumpDateOpen, setIsJumpDateOpen] = useState(false);
  const [isObjectMenuOpen, setIsObjectMenuOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isOccupancyActionsOpen, setIsOccupancyActionsOpen] = useState(false);
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [rooms, setRooms] = useState<SerializedRoom[]>([]);
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
        setIsBookingDetailsOpen(false);
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

  const visibleDays = useMemo(() => buildVisibleDays(periodStartIso), [periodStartIso]);
  const periodHeaderLabel = useMemo(() => formatPeriodHeader(visibleDays), [visibleDays]);
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
    const grouped = new Map<string, SerializedRoom[]>();

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
    const regrouped = new Map<string, SerializedRoom[]>();

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
      const response = await fetch(`/api/properties/${selectedPropertyId}/rooms`);
      const body = (await response.json()) as { items?: SerializedRoom[]; error?: string };

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

  // Occupancy API is room-scoped, so load all rooms in parallel for the current visible range.
  const refreshOccupancies = useCallback(async () => {
    if (!selectedPropertyId || rooms.length === 0) {
      setOccupanciesByRoom({});
      return;
    }

    setIsLoadingOccupancies(true);

    try {
      const items = await Promise.all(
        rooms.map(async (room) => {
          const url = `/api/properties/${selectedPropertyId}/rooms/${room.id}/occupancy?from=${encodeURIComponent(periodFromIso)}&to=${encodeURIComponent(periodToIso)}`;
          const response = await fetch(url);
          const body = (await response.json()) as {
            items?: SerializedRoomOccupancy[];
            error?: string;
          };

          if (!response.ok) {
            throw new Error(
              readResponseError(body, `Не удалось загрузить занятость номера ${room.title}`),
            );
          }

          return {
            roomId: room.id,
            items: body.items ?? [],
          };
        }),
      );

      const next: Record<string, SerializedRoomOccupancy[]> = {};
      for (const item of items) {
        next[item.roomId] = item.items;
      }

      setOccupanciesByRoom(next);
      setMessageError("");
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Не удалось загрузить занятость");
    } finally {
      setIsLoadingOccupancies(false);
    }
  }, [periodFromIso, periodToIso, rooms, selectedPropertyId]);

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
        source: sourceOccupancy.source ?? bookingSources[0],
        description: sourceOccupancy.description ?? "",
        createdAt: sourceOccupancy.createdAt,
      });
      setIsBookingDetailsOpen(
        Boolean(
          parsedContacts.email ||
          parsedContacts.website ||
          sourceOccupancy.guestPhone ||
          sourceOccupancy.source,
        ),
      );
    } else {
      setBookingForm(
        buildInitialBookingForm({
          defaultRoomId,
          dateFrom,
          dateTo,
        }),
      );
      setIsBookingDetailsOpen(false);
    }

    setBookingModalError("");
    setBookingRoomPage(0);
    setIsBookingModalOpen(true);
  }

  function closeBookingModal() {
    setIsBookingModalOpen(false);
    setBookingForm(null);
    setBookingModalError("");
    setIsBookingDetailsOpen(false);
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
    setJumpDateValue(dateIso);
    setDragSelection(null);
    setIsJumpDateOpen(false);
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

  return (
    <div className="space-y-3">
      <section className="space-y-3">
        <div className="rounded-2xl border border-olive/8 bg-white p-3 shadow-sm md:p-4 [@media(orientation:landscape)_and_(max-height:560px)]:rounded-xl [@media(orientation:landscape)_and_(max-height:560px)]:p-1.5">
          {/* Row 1: Object selector + mode toggle */}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center [@media(orientation:landscape)_and_(max-height:560px)]:grid-cols-[minmax(0,1fr)_auto] [@media(orientation:landscape)_and_(max-height:560px)]:gap-1.5">
            <div className="relative min-w-0" ref={objectMenuRef}>
              <button
                type="button"
                className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-olive/15 bg-cream/60 px-3 py-2.5 text-left text-sm font-semibold text-olive transition hover:bg-cream sm:min-w-[260px] [@media(orientation:landscape)_and_(max-height:560px)]:rounded-lg [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:py-1.5 [@media(orientation:landscape)_and_(max-height:560px)]:text-xs"
                onClick={() => setIsObjectMenuOpen((prev) => !prev)}
              >
                <span className="truncate">{selectedProperty?.name ?? "Выберите объект"}</span>
                <AppIcon
                  icon={ChevronDown}
                  className="h-4 w-4 shrink-0 [@media(orientation:landscape)_and_(max-height:560px)]:h-3.5 [@media(orientation:landscape)_and_(max-height:560px)]:w-3.5"
                />
              </button>

              {isObjectMenuOpen ? (
                <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[280px] rounded-xl border border-olive/12 bg-white p-1 shadow-xl">
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

            <div className="inline-flex w-full rounded-xl border border-olive/15 bg-cream/40 p-0.5 sm:w-auto [@media(orientation:landscape)_and_(max-height:560px)]:rounded-lg">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all duration-200 sm:flex-none [@media(orientation:landscape)_and_(max-height:560px)]:rounded-md [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:py-1 [@media(orientation:landscape)_and_(max-height:560px)]:text-[11px]",
                  boardMode === "occupancy"
                    ? "bg-primary text-white shadow-sm"
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
                  "flex-1 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all duration-200 sm:flex-none [@media(orientation:landscape)_and_(max-height:560px)]:rounded-md [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:py-1 [@media(orientation:landscape)_and_(max-height:560px)]:text-[11px]",
                  boardMode === "prices"
                    ? "bg-primary text-white shadow-sm"
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

          {/* Row 2: quick actions */}
          <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5 [@media(orientation:landscape)_and_(max-height:560px)]:mt-1 [@media(orientation:landscape)_and_(max-height:560px)]:flex [@media(orientation:landscape)_and_(max-height:560px)]:flex-wrap [@media(orientation:landscape)_and_(max-height:560px)]:gap-1">
            {boardMode === "occupancy" ? (
              <Button
                className="w-full sm:w-auto [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:py-1 [@media(orientation:landscape)_and_(max-height:560px)]:text-[11px]"
                onClick={() => openBookingModal()}
                disabled={!canManageCalendar}
              >
                + Бронь
              </Button>
            ) : (
              <Button
                className="w-full sm:w-auto [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:py-1 [@media(orientation:landscape)_and_(max-height:560px)]:text-[11px]"
                onClick={() => openPriceModal()}
                disabled={!canManageCalendar}
              >
                + Цена
              </Button>
            )}
            <button
              type="button"
              className="w-full shrink-0 rounded-xl border border-olive/15 px-3 py-2 text-xs font-medium text-olive/70 transition hover:bg-cream hover:text-olive sm:w-auto [@media(orientation:landscape)_and_(max-height:560px)]:rounded-lg [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:py-1 [@media(orientation:landscape)_and_(max-height:560px)]:text-[11px]"
              onClick={() => jumpToDate(getLocalTodayIso())}
            >
              Сегодня
            </button>
            <div className="relative w-full shrink-0 sm:w-auto">
              <button
                type="button"
                className="w-full rounded-xl border border-olive/15 px-3 py-2 text-xs font-medium text-olive/70 transition hover:bg-cream hover:text-olive sm:w-auto [@media(orientation:landscape)_and_(max-height:560px)]:rounded-lg [@media(orientation:landscape)_and_(max-height:560px)]:px-2 [@media(orientation:landscape)_and_(max-height:560px)]:py-1 [@media(orientation:landscape)_and_(max-height:560px)]:text-[11px]"
                onClick={() => {
                  setJumpDateValue(periodStartIso);
                  setIsJumpDateOpen((prev) => !prev);
                }}
              >
                К дате
              </button>
              {isJumpDateOpen ? (
                <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-xl border border-olive/12 bg-white p-3 shadow-xl sm:left-auto sm:right-0 sm:w-[220px]">
                  <Input
                    type="date"
                    value={jumpDateValue}
                    onChange={(event) => setJumpDateValue(event.target.value)}
                  />
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        if (parseIsoDate(jumpDateValue)) {
                          jumpToDate(jumpDateValue);
                        }
                      }}
                    >
                      Перейти
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setIsJumpDateOpen(false)}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="hidden">
            {selectedProperty ? (
              <div className="flex flex-wrap items-center gap-2 sm:justify-between">
                <p className="text-sm text-olive/75">
                  Объект:{" "}
                  <span className="font-semibold text-olive">
                    {selectedProperty.name ?? "Без названия"}
                  </span>
                </p>
                <span className="inline-flex items-center rounded-full border border-olive/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-olive/70">
                  {selectedProperty.statusLabel}
                </span>
              </div>
            ) : null}
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 sm:justify-between",
                selectedProperty ? "mt-2" : "",
              )}
            >
              <p className="text-sm text-olive/75">
                Период:{" "}
                <span className="font-semibold text-olive">
                  {formatDateLabel(periodFromIso)} - {formatDateLabel(periodToIso)}
                </span>
              </p>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  isLoadingRooms || isLoadingOccupancies
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700",
                )}
              >
                {isLoadingRooms || isLoadingOccupancies
                  ? "Обновляем данные..."
                  : "Данные актуальны"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-olive/60 sm:text-xs">
              Красные вертикальные линии показывают границы недель.
            </p>
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
          <div className="rounded-2xl border border-dashed border-olive/25 bg-cream p-4 text-sm text-olive/75">
            У вас пока нет объектов. Добавьте объект в разделе «Объекты», после этого шахматка
            станет доступна.
          </div>
        ) : null}

        {selectedPropertyId && properties.length > 0 ? (
          <div className="rounded-2xl border border-olive/10 bg-white p-3 [@media(orientation:landscape)_and_(max-height:560px)]:rounded-xl [@media(orientation:landscape)_and_(max-height:560px)]:p-1.5">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-olive/15 bg-cream/30 p-1 [@media(orientation:landscape)_and_(max-height:560px)]:gap-1 [@media(orientation:landscape)_and_(max-height:560px)]:rounded-lg [@media(orientation:landscape)_and_(max-height:560px)]:p-0.5">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-olive/15 bg-white text-olive/60 transition hover:bg-cream hover:text-olive [@media(orientation:landscape)_and_(max-height:560px)]:h-7 [@media(orientation:landscape)_and_(max-height:560px)]:w-7 [@media(orientation:landscape)_and_(max-height:560px)]:rounded-md"
                onClick={() => shiftVisiblePeriod(-visibleDaysCount)}
                aria-label="Назад"
              >
                <AppIcon
                  icon={ChevronLeft}
                  className="h-4 w-4 [@media(orientation:landscape)_and_(max-height:560px)]:h-3.5 [@media(orientation:landscape)_and_(max-height:560px)]:w-3.5"
                />
              </button>
              <span className="truncate rounded-lg bg-white px-2 py-1 text-center text-xs font-semibold text-olive/70 sm:text-sm [@media(orientation:landscape)_and_(max-height:560px)]:rounded-md [@media(orientation:landscape)_and_(max-height:560px)]:px-1.5 [@media(orientation:landscape)_and_(max-height:560px)]:py-0.5 [@media(orientation:landscape)_and_(max-height:560px)]:text-[11px]">
                {periodHeaderLabel}
              </span>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-olive/15 bg-white text-olive/60 transition hover:bg-cream hover:text-olive [@media(orientation:landscape)_and_(max-height:560px)]:h-7 [@media(orientation:landscape)_and_(max-height:560px)]:w-7 [@media(orientation:landscape)_and_(max-height:560px)]:rounded-md"
                onClick={() => shiftVisiblePeriod(visibleDaysCount)}
                aria-label="Вперед"
              >
                <AppIcon
                  icon={ChevronRight}
                  className="h-4 w-4 [@media(orientation:landscape)_and_(max-height:560px)]:h-3.5 [@media(orientation:landscape)_and_(max-height:560px)]:w-3.5"
                />
              </button>
            </div>

            {rooms.length === 0 && !isLoadingRooms ? (
              <p className="mt-3 rounded-xl border border-dashed border-olive/30 p-4 text-sm text-olive/65">
                В объекте пока нет активных номеров. Добавьте номер в разделе «Номерной фонд».
              </p>
            ) : null}

            {isMobilePortrait && roomPagerEntries.length > 0 ? (
              <div className="mt-3 rounded-[22px] border border-primary/10 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(240,253,250,0.95)_55%,rgba(255,255,255,0.98))] px-3 py-2.5 shadow-[0_18px_35px_-28px_rgba(15,118,110,0.5)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-olive">Вертикальный режим шахматки</p>
                    <p className="mt-1 text-xs text-olive/65">
                      Подписи слева свернуты. Тапните по ярлыку, чтобы раскрыть название номера.
                    </p>
                  </div>
                  <span className="glass-badge inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                    {visibleRoomRange.from}-{visibleRoomRange.to}
                  </span>
                </div>
              </div>
            ) : null}

            {rooms.length > 0 ? (
              <div
                ref={boardScrollRef}
                className="chessboard-board-scroll custom-scrollbar mt-2 max-h-[68dvh] overflow-auto overscroll-contain rounded-xl border border-olive/8 md:max-h-[76vh] [@media(orientation:landscape)_and_(max-height:560px)]:mt-1 [@media(orientation:landscape)_and_(max-height:560px)]:max-h-[72dvh] [@media(orientation:landscape)_and_(max-height:560px)]:rounded-lg"
              >
                <table className="min-w-max border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th
                        className={cn(
                          `sticky left-0 top-0 z-40 h-10 border-b border-r border-olive/10 bg-cream text-left text-xs font-semibold text-olive md:text-sm ${LS}:h-7 ${LS}:text-[10px]`,
                          isMobilePortrait
                            ? "min-w-[56px] px-1.5"
                            : `min-w-[120px] px-2 sm:min-w-[180px] md:min-w-[280px] md:px-3 ${LS}:min-w-[90px] ${LS}:px-1.5`,
                        )}
                      >
                        {isMobilePortrait ? (
                          <div className="flex justify-center">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-white/90 text-[10px] font-black tracking-[0.18em] text-primary shadow-sm">
                              {boardMode === "occupancy" ? "ЗН" : "ЦН"}
                            </span>
                          </div>
                        ) : boardMode === "occupancy" ? (
                          "Занятость"
                        ) : (
                          "Цены"
                        )}
                      </th>
                      <th
                        colSpan={visibleDays.length}
                        className={`sticky top-0 z-30 h-10 border-b border-olive/10 bg-cream px-2 text-left text-xs font-semibold text-olive md:px-3 md:text-sm ${LS}:h-7 ${LS}:px-1.5 ${LS}:text-[10px]`}
                      >
                        {periodHeaderLabel}
                      </th>
                    </tr>
                    <tr>
                      <th
                        className={cn(
                          `sticky left-0 top-10 z-40 border-b border-r border-olive/10 bg-white text-left text-[10px] uppercase tracking-wide text-olive/55 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-[2px] after:h-[2px] after:bg-inherit md:text-xs ${LS}:top-7 ${LS}:text-[8px]`,
                          isMobilePortrait
                            ? "min-w-[56px] px-1.5 py-1"
                            : `min-w-[120px] px-2 py-1.5 sm:min-w-[180px] md:min-w-[280px] md:px-3 md:py-2 ${LS}:min-w-[90px] ${LS}:px-1.5 ${LS}:py-0.5`,
                        )}
                      >
                        {isMobilePortrait ? "№" : "Номер"}
                      </th>
                      {visibleDays.map((day) => {
                        const isDayToday = day.iso === initialTodayIso;
                        return (
                          <th
                            key={day.iso}
                            className={cn(
                              `sticky top-10 z-20 border-b border-l border-olive/10 text-center after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-[2px] after:h-[2px] after:bg-inherit ${LS}:top-7 ${LS}:w-9 ${LS}:min-w-9 ${LS}:px-0 ${LS}:py-0.5`,
                              isMobilePortrait
                                ? "w-11 min-w-11 px-0 py-1"
                                : "w-12 min-w-12 px-0.5 py-1 sm:w-14 sm:min-w-14 md:w-16 md:min-w-16 md:px-1",
                              isDayToday ? "bg-primary/10" : day.isWeekend ? "bg-sand" : "bg-white",
                              day.isWeekStart ? "border-l-2 border-l-red-300/70" : "",
                              isDayToday ? "border-l border-l-primary/40" : "",
                            )}
                          >
                            <span
                              className={cn(
                                `block font-semibold ${LS}:text-[9px]`,
                                isMobilePortrait ? "text-[11px]" : "text-xs md:text-sm",
                                isDayToday ? "text-primary" : "text-olive",
                              )}
                            >
                              {day.dayNumber}
                            </span>
                            <span
                              className={cn(
                                `block uppercase ${LS}:text-[7px]`,
                                isMobilePortrait ? "text-[8px]" : "text-[9px] md:text-[11px]",
                                isDayToday
                                  ? "font-bold text-primary/70"
                                  : day.isWeekend
                                    ? "font-semibold text-terra"
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
              <div className="glass-booking sticky-bottom-enter mt-3 rounded-[24px] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-olive">
                      Номера {visibleRoomRange.from}-{visibleRoomRange.to} из{" "}
                      {roomPagerEntries.length}
                    </p>
                    <p className="mt-1 text-xs text-olive/60">
                      Переключайте блоки по 3 номера, чтобы оставить больше места самой шахматке.
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    {mobileRoomPage + 1}/{mobileRoomPageCount}
                  </span>
                </div>
                <CompactPageDots
                  pageCount={mobileRoomPageCount}
                  currentPage={mobileRoomPage}
                  onChange={setMobileRoomPage}
                  className="mt-3"
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
                  {formatDateLabel(activeOccupancy.dateFrom)} -{" "}
                  {formatDateLabel(activeOccupancy.dateTo)}
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
                <div className="grid gap-2 text-sm text-olive/85">
                  <p>
                    <span className="text-olive/60">Статус:</span> {activeOccupancyStatusLabel}
                  </p>
                  <p>
                    <span className="text-olive/60">Метка:</span>{" "}
                    {activeOccupancy.tag ? truncateToLength(activeOccupancy.tag, 20) : "—"}
                  </p>
                  <p>
                    <span className="text-olive/60">Номер:</span>{" "}
                    {activeOccupancyRoom?.title ?? "—"}
                  </p>
                  <p>
                    <span className="text-olive/60">Гость:</span> {activeOccupancy.guestLabel}
                  </p>
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
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-olive sm:text-[15px]">
                    Контактные данные
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-olive/80 hover:text-olive"
                    onClick={() => setIsBookingDetailsOpen((prev) => !prev)}
                  >
                    {isBookingDetailsOpen
                      ? "Скрыть дополнительные поля"
                      : "Показать дополнительные поля"}
                    <span
                      className={cn(
                        "transition-transform",
                        isBookingDetailsOpen ? "rotate-180" : "",
                      )}
                    >
                      ▼
                    </span>
                  </button>
                </div>
                <div className="mt-3">
                  <Input
                    className={modalTextInputClass}
                    value={bookingForm.contactName}
                    onChange={(event) => updateBookingForm({ contactName: event.target.value })}
                    placeholder="Контактное лицо"
                  />
                </div>
                <div
                  className={cn(
                    "grid overflow-hidden transition-all duration-300",
                    isBookingDetailsOpen
                      ? "mt-3 max-h-[420px] gap-2 opacity-100 sm:grid-cols-2"
                      : "pointer-events-none mt-0 max-h-0 opacity-0",
                  )}
                >
                  <Input
                    className={modalTextInputClass}
                    value={bookingForm.phone}
                    onChange={(event) => updateBookingForm({ phone: event.target.value })}
                    placeholder="+7 (___) ___-__-__"
                  />
                  <Input
                    className={modalTextInputClass}
                    type="email"
                    value={bookingForm.email}
                    onChange={(event) => updateBookingForm({ email: event.target.value })}
                    placeholder="Email"
                  />
                  <Input
                    className={modalTextInputClass}
                    value={bookingForm.website}
                    onChange={(event) => updateBookingForm({ website: event.target.value })}
                    placeholder="Сайт"
                  />
                  <select
                    className={modalSelectClass}
                    value={bookingForm.source}
                    onChange={(event) => updateBookingForm({ source: event.target.value })}
                  >
                    {bookingSources.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
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

              <section className={modalSectionClass}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-olive sm:text-[15px]">Метка брони</p>
                </div>
                <div className="mt-3">
                  <Input
                    className={modalTextInputClass}
                    value={bookingForm.tag}
                    onChange={(event) =>
                      updateBookingForm({ tag: event.target.value.slice(0, 20) })
                    }
                    maxLength={20}
                    placeholder="Например: Раннее бронирование"
                  />
                  <p className="mt-1 text-xs text-olive/60">{bookingForm.tag.length}/20</p>
                </div>
              </section>

              <section className={modalSectionClass}>
                <label className="space-y-1">
                  <span className="text-sm font-semibold text-olive sm:text-[15px]">
                    Описание (до 250 символов)
                  </span>
                  <textarea
                    value={bookingForm.description}
                    onChange={(event) => updateBookingForm({ description: event.target.value })}
                    maxLength={250}
                    rows={4}
                    className={modalTextareaClass}
                    placeholder="Описание брони (необязательно)"
                  />
                  <p className="text-xs text-olive/60">{bookingForm.description.length}/250</p>
                </label>
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
  rooms: SerializedRoom[];
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
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-olive/12 bg-white text-olive/65 transition hover:border-primary/20 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
        onClick={() => onChange(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        aria-label="Предыдущая страница номеров"
      >
        <AppIcon icon={ChevronLeft} className="h-4 w-4" />
      </button>
      <div className="custom-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto py-1">
        {Array.from({ length: pageCount }, (_, pageIndex) => (
          <button
            key={pageIndex}
            type="button"
            className={cn(
              "h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition",
              currentPage === pageIndex
                ? "bg-primary text-white shadow-[0_16px_28px_-18px_rgba(15,118,110,0.9)]"
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
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-olive/12 bg-white text-olive/65 transition hover:border-primary/20 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
        onClick={() => onChange(Math.min(pageCount - 1, currentPage + 1))}
        disabled={currentPage >= pageCount - 1}
        aria-label="Следующая страница номеров"
      >
        <AppIcon icon={ChevronRight} className="h-4 w-4" />
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
    <div className="relative flex justify-center">
      <button
        type="button"
        className={cn(
          "group relative inline-flex w-full flex-col items-center justify-center border text-center transition-all duration-300 active:scale-[0.98]",
          variant === "group" ? "min-h-8 rounded-[14px]" : "min-h-10 rounded-[16px]",
          variant === "group"
            ? "border-primary/10 bg-[linear-gradient(180deg,rgba(240,253,250,0.96),rgba(255,255,255,0.96))]"
            : "border-olive/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,248,245,0.96))]",
          expanded
            ? "shadow-[0_18px_34px_-24px_rgba(15,118,110,0.7)] ring-2 ring-primary/10"
            : "shadow-[0_12px_24px_-26px_rgba(58,43,35,0.45)]",
        )}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Свернуть" : "Показать"} ${title}`}
      >
        <span
          className={cn(
            "text-[11px] font-black tracking-[0.2em]",
            variant === "group" ? "text-primary/85" : "text-olive",
          )}
        >
          {preview}
        </span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.16em] text-olive/40">
          {variant === "group" ? "кат." : "номер"}
        </span>
      </button>

      <div
        className={cn(
          "pointer-events-none absolute left-full top-1/2 z-30 w-[min(68vw,240px)] -translate-y-1/2 pl-2 transition-all duration-300",
          expanded ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0",
        )}
      >
        <div className="glass-booking rounded-[22px] p-3">
          <p className="text-sm font-semibold text-olive">{title}</p>
          {subtitle ? <p className="mt-1 text-[11px] leading-4 text-olive/65">{subtitle}</p> : null}
          <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-primary/75">
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
                `sticky left-0 z-30 border-b border-r border-olive/10 text-left ${LS}:min-w-[90px] ${LS}:px-1 ${LS}:py-0.5`,
                isMobilePortrait
                  ? "min-w-[56px] px-1 py-0"
                  : "min-w-[120px] px-2 py-1.5 sm:min-w-[180px] md:min-w-[280px] md:px-3 md:py-2",
                isEvenRow ? "bg-white" : "bg-cream",
              )}
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
                    className={`truncate text-xs font-semibold text-olive md:text-sm ${LS}:text-[9px]`}
                  >
                    {room.title}
                  </p>
                  <p
                    className={`hidden text-[10px] text-olive/55 sm:block md:text-xs ${LS}:!hidden`}
                  >
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
                    `relative border-b border-l border-olive/10 align-top overflow-visible ${LS}:h-8 ${LS}:w-9 ${LS}:min-w-9`,
                    isMobilePortrait
                      ? "h-10 w-11 min-w-11"
                      : "h-12 w-12 min-w-12 sm:h-14 sm:w-14 sm:min-w-14 md:h-16 md:w-16 md:min-w-16",
                    isSelected
                      ? chessboardToneClasses.selectedCell
                      : isToday
                        ? "bg-primary/8"
                        : day.isWeekend
                          ? isEvenRow
                            ? "bg-sand/50"
                            : "bg-sand/25"
                          : isEvenRow
                            ? "bg-cream/30"
                            : "bg-white",
                    day.isWeekStart ? "border-l-2 border-l-red-300/70" : "",
                    isToday ? "border-l border-l-primary/30" : "",
                  )}
                >
                  {occupancyBar && occupancyBar.rangeStartIso === day.iso ? (
                    <button
                      type="button"
                      className={cn(
                        `absolute left-0 z-10 border shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${LS}:top-0.5 ${LS}:h-7 ${LS}:rounded-md`,
                        isMobilePortrait ? "top-0.5 h-9 rounded-[14px]" : "top-2 h-12 rounded-lg",
                        occupancyBar.classes,
                      )}
                      style={{
                        left: `${occupancyBar.startOffsetPx}px`,
                        width: `${occupancyBar.widthPx}px`,
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
                            `truncate font-semibold ${LS}:text-[8px]`,
                            isMobilePortrait ? "text-[9px]" : "text-[10px]",
                          )}
                        >
                          {occupancyBar.guestLabel}
                        </p>
                        <p
                          className={cn(
                            `truncate text-white/90 ${LS}:text-[7px]`,
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
                        `pointer-events-none absolute left-0 z-10 border shadow-sm ${LS}:top-0.5 ${LS}:h-7 ${LS}:rounded-md`,
                        isMobilePortrait ? "top-0.5 h-9 rounded-[14px]" : "top-2 h-12 rounded-lg",
                        chessboardToneClasses.priceBar,
                      )}
                      style={{
                        left: `${priceBar.startOffsetPx}px`,
                        width: `${priceBar.widthPx}px`,
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
                            `truncate font-semibold ${LS}:text-[8px]`,
                            isMobilePortrait ? "text-[9px]" : "text-[10px]",
                          )}
                        >
                          {priceBar.priceLabel}
                        </p>
                        <p
                          className={cn(
                            `truncate text-white/90 ${LS}:text-[7px]`,
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
                        `pointer-events-none absolute left-0 z-20 border ${LS}:top-0 ${LS}:h-8 ${LS}:rounded-lg`,
                        isMobilePortrait ? "top-0.5 h-10 rounded-[16px]" : "top-1 h-14 rounded-xl",
                        chessboardToneClasses.selectionRange,
                      )}
                      style={{
                        width: `${selectionBar.widthPx}px`,
                      }}
                    />
                  ) : null}
                  <button
                    type="button"
                    className={cn(
                      "h-full w-full rounded-md px-1 py-1 text-left transition-colors",
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
                          `inline-flex rounded-md bg-terra/10 font-medium text-terra ${LS}:px-0.5 ${LS}:py-0 ${LS}:text-[7px]`,
                          isMobilePortrait ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]",
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

"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Compass,
  Globe2,
  House,
  Landmark,
  LocateFixed,
  MapPin,
  PawPrint,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { FieldAdornmentIcon } from "@/components/ui/field-adornment-icon";
import { cn } from "@/lib/cn";
import type { HomeCityShowcaseItem } from "@/lib/home-cities";
import {
  attractionsHubPath,
  buildExcursionsLocationPath,
  buildHousingCatalogPath,
  buildHousingLocationPath,
  excursionsHubPath,
  housingHubPath,
  resolveKnownCrimeaLocationSlug,
  transfersHubPath,
} from "@/lib/seo/routes";
import { buildDateRangeParam } from "@/lib/seo/url-normalize";

const directionLabels = {
  housing: "Жильё",
  excursions: "Экскурсии",
  attractions: "Досуг",
  transfers: "Трансферы",
} as const;

type Direction = keyof typeof directionLabels;

type MobileSearchStep = "location" | "date" | "guests" | "review";

type DateRangeState = {
  checkIn: string;
  checkOut: string;
};

type GuestsState = {
  adults: number;
  childrenAges: number[];
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

type HomeSearchShowcaseProps = {
  cities: HomeCityShowcaseItem[];
  locationSuggestions: string[];
  publishedPropertiesCount: number | null;
  publishedExcursionsCount: number | null;
  initialPopularSuggestionsByDirection?: Partial<Record<Direction, HomeSearchSuggestionItem[]>>;
};

type SearchSuggestionType = "location" | "hotel" | "listing";
type SearchSuggestionSection = "recent" | "popular" | "matches";

type HomeSearchSuggestionItem = {
  type: SearchSuggestionType;
  id: string;
  name: string;
  subtitle: string;
  locationId: string | null;
  activeListingsCount: number;
};

type HomeSearchSuggestionsResponse = {
  recent: HomeSearchSuggestionItem[];
  popular: HomeSearchSuggestionItem[];
  matches: HomeSearchSuggestionItem[];
};

type SearchDropdownOption = {
  key: string;
  section: SearchSuggestionSection;
  item: HomeSearchSuggestionItem;
  position: number;
};

type RecentSearchEntry = {
  type: SearchSuggestionType;
  id: string;
  name: string;
  locationId: string | null;
  direction: Direction;
  checkIn: string;
  checkOut: string;
  isAnyDate: boolean;
  guests: number;
  timestamp: number;
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

const monthNamesShort = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
] as const;

const weekdayShortLower = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;

const weekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
const calendarMonthCount = 14;
const popoverExitDurationMs = 250;
const guestsPopoverTransitionMs = 200;
const maxGuestsCount = 20;
const radiusOptions = [5, 10, 15, 25, 30, 50, 100] as const;
const contestPagePath = "/rozigrash";

const rubFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const yearFormatter = new Intl.NumberFormat("ru-RU", {
  useGrouping: false,
});

const countFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

function normalizeLocation(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase().replace(/ё/g, "е");
}

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

  return { year, month, day };
}

function toUtcTimestamp(iso: string): number | null {
  const parsed = parseIsoParts(iso);
  if (!parsed) {
    return null;
  }

  return Date.UTC(parsed.year, parsed.month - 1, parsed.day);
}

function getNightsCount(checkIn: string, checkOut: string): number {
  const checkInUtc = toUtcTimestamp(checkIn);
  const checkOutUtc = toUtcTimestamp(checkOut);

  if (checkInUtc === null || checkOutUtc === null || checkOutUtc <= checkInUtc) {
    return 0;
  }

  return Math.round((checkOutUtc - checkInUtc) / 86_400_000);
}

function pluralize(value: number, variants: [string, string, string]): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;

  if (abs > 10 && abs < 20) {
    return variants[2];
  }
  if (mod > 1 && mod < 5) {
    return variants[1];
  }
  if (mod === 1) {
    return variants[0];
  }

  return variants[2];
}

function useTypewriterText(words: string[]): string {
  const [wordIndex, setWordIndex] = useState(0);
  const [letterCount, setLetterCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (words.length === 0) {
      return;
    }

    const currentWord = words[wordIndex % words.length] ?? "";
    const delay =
      !isDeleting && letterCount === currentWord.length
        ? typewriterHoldDelayMs
        : isDeleting
          ? typewriterDeleteDelayMs
          : typewriterTypeDelayMs;

    const timer = window.setTimeout(() => {
      if (!isDeleting && letterCount < currentWord.length) {
        setLetterCount((current) => current + 1);
        return;
      }

      if (!isDeleting) {
        setIsDeleting(true);
        return;
      }

      if (letterCount > 0) {
        setLetterCount((current) => Math.max(0, current - 1));
        return;
      }

      setIsDeleting(false);
      setWordIndex((current) => (current + 1) % words.length);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isDeleting, letterCount, wordIndex, words]);

  return (words[wordIndex % Math.max(words.length, 1)] ?? "").slice(0, letterCount);
}

function formatChildAgeOption(age: number): string {
  if (age === 0) {
    return "до 1 года";
  }

  return `${age} ${pluralize(age, ["год", "года", "лет"])}`;
}

function formatDayMonth(iso: string, includeYear: boolean): string {
  const parsed = parseIsoParts(iso);
  if (!parsed) {
    return "";
  }

  const base = `${parsed.day} ${monthNamesGenitive[parsed.month - 1]}`;
  return includeYear ? `${base} ${yearFormatter.format(parsed.year)}` : base;
}

function formatDayMonthWeekday(iso: string): string {
  const parsed = parseIsoParts(iso);
  if (!parsed) {
    return "";
  }

  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  const weekdayIndex = (date.getDay() + 6) % 7;
  return `${parsed.day} ${monthNamesShort[parsed.month - 1]}, ${weekdayShortLower[weekdayIndex]}`;
}

function formatHousingDatesField(range: DateRangeState): string {
  if (!range.checkIn) {
    return "Даты";
  }

  if (!range.checkOut) {
    return formatDayMonth(range.checkIn, false);
  }

  const from = parseIsoParts(range.checkIn);
  const to = parseIsoParts(range.checkOut);

  if (!from || !to) {
    return "Даты";
  }

  const nights = getNightsCount(range.checkIn, range.checkOut);
  const nightsPart = `${nights} ${pluralize(nights, ["ночь", "ночи", "ночей"])}`;

  if (from.year === to.year && from.month === to.month) {
    return `${from.day} - ${to.day} ${monthNamesGenitive[to.month - 1]}, ${nightsPart}`;
  }

  const includeYear = from.year !== to.year;
  const fromPart = formatDayMonth(range.checkIn, includeYear);
  const toPart = formatDayMonth(range.checkOut, true);
  return `${fromPart} - ${toPart}, ${nightsPart}`;
}

function formatMobileHousingDatesSummary(range: DateRangeState): string {
  if (!range.checkIn && !range.checkOut) {
    return "Выберите даты";
  }

  if (range.checkIn && !range.checkOut) {
    return `${formatDayMonthWeekday(range.checkIn)} — выберите выезд`;
  }

  if (!range.checkIn || !range.checkOut) {
    return "Выберите даты";
  }

  const nights = getNightsCount(range.checkIn, range.checkOut);
  const nightsPart = `${nights} ${pluralize(nights, ["сутки", "суток", "суток"])}`;
  return `${formatDayMonth(range.checkIn, false)} — ${formatDayMonth(range.checkOut, false)}, ${nightsPart}`;
}

function formatExcursionDateField(dateIso: string, anyDate: boolean): string {
  if (anyDate) {
    return "Любая дата";
  }

  if (!dateIso) {
    return "Дата";
  }

  return formatDayMonth(dateIso, false);
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

function clampGuests(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(maxGuestsCount, Math.round(value)));
}

const homeSearchStorageKey = "boking.home_search_state_v1";
const homeSearchQueryStorageKey = "boking.home_search_query_v1";
const homeSearchRecentStorageKey = "boking.home_search_recent_v1";
const homeSearchSuggestionsListboxId = "home-search-suggestions-listbox";
const homeSearchRecentLimit = 10;
const homeSearchSuggestionsDebounceMs = 240;
const homeSearchSuggestionsCacheTtlMs = 10 * 60_000;
const typewriterDeleteDelayMs = 72;
const typewriterTypeDelayMs = 118;
const typewriterHoldDelayMs = 1800;
const defaultTypewriterDestinations = [
  "Ялта",
  "Алушта",
  "Алупка",
  "Гурзуф",
  "Форос",
  "Симеиз",
  "Евпатория",
  "Судак",
  "Новый Свет",
  "Коктебель",
  "Феодосия",
  "Балаклава",
  "Севастополь",
  "Керчь",
] as const;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

type PersistedHomeSearchState = {
  direction?: Direction;
  searchValue?: string;
  housingDates?: DateRangeState;
  excursionDate?: string;
  isExcursionAnyDate?: boolean;
  housingGuests?: GuestsState;
  excursionGuests?: GuestsState;
};

function isSuggestionType(value: unknown): value is SearchSuggestionType {
  return value === "location" || value === "hotel" || value === "listing";
}

function isDirection(value: unknown): value is Direction {
  return (
    value === "housing" ||
    value === "attractions" ||
    value === "excursions" ||
    value === "transfers"
  );
}

function parseSuggestionItem(value: unknown): HomeSearchSuggestionItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<HomeSearchSuggestionItem>;
  if (!isSuggestionType(candidate.type)) {
    return null;
  }

  if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
    return null;
  }

  if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
    return null;
  }

  return {
    type: candidate.type,
    id: candidate.id.trim().slice(0, 120),
    name: candidate.name.trim().slice(0, 120),
    subtitle: typeof candidate.subtitle === "string" ? candidate.subtitle.trim().slice(0, 180) : "",
    locationId:
      typeof candidate.locationId === "string" && candidate.locationId.trim().length > 0
        ? candidate.locationId.trim().slice(0, 120)
        : null,
    activeListingsCount:
      typeof candidate.activeListingsCount === "number" &&
      Number.isFinite(candidate.activeListingsCount) &&
      candidate.activeListingsCount > 0
        ? Math.round(candidate.activeListingsCount)
        : 0,
  };
}

function parseSuggestionsResponse(value: unknown): HomeSearchSuggestionsResponse {
  if (!value || typeof value !== "object") {
    return {
      recent: [],
      popular: [],
      matches: [],
    };
  }

  const candidate = value as Partial<HomeSearchSuggestionsResponse>;
  const parseList = (list: unknown): HomeSearchSuggestionItem[] =>
    Array.isArray(list)
      ? list
          .map((entry) => parseSuggestionItem(entry))
          .filter((entry): entry is HomeSearchSuggestionItem => Boolean(entry))
      : [];

  return {
    recent: parseList(candidate.recent),
    popular: parseList(candidate.popular),
    matches: parseList(candidate.matches),
  };
}

function formatRecentSearchSubtitle(entry: RecentSearchEntry): string {
  if (entry.type === "listing") {
    if (entry.direction === "attractions") {
      return "Место досуга";
    }

    if (entry.direction === "transfers") {
      return "Трансфер или маршрут";
    }

    if (entry.direction === "excursions") {
      return "Экскурсия или тур";
    }
  }

  const guestsLabel =
    entry.direction === "excursions"
      ? `${entry.guests} ${pluralize(entry.guests, ["участник", "участника", "участников"])}`
      : `${entry.guests} ${pluralize(entry.guests, ["гость", "гостя", "гостей"])}`;

  if (entry.direction === "excursions") {
    if (entry.isAnyDate) {
      return `Любая дата, ${guestsLabel}`;
    }

    if (entry.checkIn) {
      return `${formatDayMonth(entry.checkIn, false)}, ${guestsLabel}`;
    }

    return `Без даты, ${guestsLabel}`;
  }

  if (entry.direction === "attractions") {
    return "Досуг рядом с локацией";
  }

  if (entry.direction === "transfers") {
    return "Трансферы и маршруты рядом с локацией";
  }

  if (entry.checkIn && entry.checkOut) {
    return `${formatDayMonth(entry.checkIn, false)} - ${formatDayMonth(entry.checkOut, false)}, ${guestsLabel}`;
  }

  if (entry.checkIn) {
    return `${formatDayMonth(entry.checkIn, false)}, ${guestsLabel}`;
  }

  return `Без дат, ${guestsLabel}`;
}

function parseRecentSearches(raw: string): RecentSearchEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((entryRaw) => {
      if (!entryRaw || typeof entryRaw !== "object") {
        return null;
      }

      const candidate = entryRaw as Partial<RecentSearchEntry>;
      if (!isSuggestionType(candidate.type)) {
        return null;
      }

      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
        return null;
      }

      if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
        return null;
      }

      return {
        type: candidate.type,
        id: candidate.id.trim().slice(0, 120),
        name: candidate.name.trim().slice(0, 120),
        locationId:
          typeof candidate.locationId === "string" && candidate.locationId.trim().length > 0
            ? candidate.locationId.trim().slice(0, 120)
            : null,
        direction: isDirection(candidate.direction) ? candidate.direction : "housing",
        checkIn: normalizeStoredIsoDate(candidate.checkIn),
        checkOut: normalizeStoredIsoDate(candidate.checkOut),
        isAnyDate: Boolean(candidate.isAnyDate),
        guests: clampGuests(typeof candidate.guests === "number" ? candidate.guests : 2),
        timestamp:
          typeof candidate.timestamp === "number" && Number.isFinite(candidate.timestamp)
            ? candidate.timestamp
            : Date.now(),
      } satisfies RecentSearchEntry;
    })
    .filter((entry): entry is RecentSearchEntry => Boolean(entry))
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, homeSearchRecentLimit);
}

function toRecentSuggestionItems(entries: RecentSearchEntry[]): HomeSearchSuggestionItem[] {
  return entries.map((entry) => ({
    type: entry.type,
    id: entry.id,
    name: entry.name,
    subtitle: formatRecentSearchSubtitle(entry),
    locationId: entry.locationId,
    activeListingsCount: 0,
  }));
}

function upsertRecentSearchEntry(
  entries: RecentSearchEntry[],
  next: RecentSearchEntry,
): RecentSearchEntry[] {
  const deduped = entries.filter(
    (item) =>
      !(item.type === next.type && item.direction === next.direction && item.id === next.id),
  );

  return [next, ...deduped]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, homeSearchRecentLimit);
}

function trackSearchAnalytics(event: string, payload: Record<string, unknown>): void {
  if (typeof window === "undefined") {
    return;
  }

  const detail = { event, ...payload };
  window.dispatchEvent(new CustomEvent("boking:search-analytics", { detail }));

  const analyticsWindow = window as typeof window & {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (command: "event", eventName: string, params: Record<string, unknown>) => void;
  };

  if (Array.isArray(analyticsWindow.dataLayer)) {
    analyticsWindow.dataLayer.push(detail);
  }

  if (typeof analyticsWindow.gtag === "function") {
    analyticsWindow.gtag("event", event, payload);
  }
}

function getSearchOptionDomId(key: string): string {
  return `home-search-option-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function normalizeStoredIsoDate(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  return isoDatePattern.test(normalized) ? normalized : "";
}

function normalizeStoredGuestsState(value: unknown): GuestsState {
  if (!value || typeof value !== "object") {
    return {
      adults: 2,
      childrenAges: [],
    };
  }

  const candidate = value as Partial<GuestsState>;
  const adults = clampGuests(typeof candidate.adults === "number" ? candidate.adults : 2);
  const childrenAges = Array.isArray(candidate.childrenAges)
    ? candidate.childrenAges
        .map((item) => (typeof item === "number" ? Math.round(item) : Number.NaN))
        .filter((item) => Number.isFinite(item) && item >= 0 && item <= 17)
        .slice(0, Math.max(0, maxGuestsCount - adults))
    : [];

  return {
    adults,
    childrenAges,
  };
}

function parsePersistedSearchState(raw: string): PersistedHomeSearchState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const candidate = parsed as PersistedHomeSearchState;
  return {
    direction: isDirection(candidate.direction) ? candidate.direction : "housing",
    searchValue:
      typeof candidate.searchValue === "string" ? candidate.searchValue.slice(0, 120) : "",
    housingDates: {
      checkIn: normalizeStoredIsoDate(candidate.housingDates?.checkIn),
      checkOut: normalizeStoredIsoDate(candidate.housingDates?.checkOut),
    },
    excursionDate: normalizeStoredIsoDate(candidate.excursionDate),
    isExcursionAnyDate: Boolean(candidate.isExcursionAnyDate),
    housingGuests: normalizeStoredGuestsState(candidate.housingGuests),
    excursionGuests: normalizeStoredGuestsState(candidate.excursionGuests),
  };
}

function getGuestsFieldValue(guests: GuestsState): string {
  const total = guests.adults + guests.childrenAges.length;
  return `${total} ${pluralize(total, ["гость", "гостя", "гостей"])}`;
}

function getDetailedGuestsFieldValue(guests: GuestsState, withPet: boolean): string {
  const adultsLabel = `${guests.adults} ${pluralize(guests.adults, [
    "взрослый",
    "взрослых",
    "взрослых",
  ])}`;
  const childrenCount = guests.childrenAges.length;
  const childrenLabel =
    childrenCount > 0
      ? `${childrenCount} ${pluralize(childrenCount, ["ребенок", "ребенка", "детей"])}`
      : "без детей";
  const petLabel = withPet ? "с питомцем" : "без питомцев";

  return `${adultsLabel}, ${childrenLabel} и ${petLabel}`;
}

function getMobileDirectionTitle(direction: Direction): string {
  if (direction === "housing") {
    return "Поиск жилья";
  }

  if (direction === "excursions") {
    return "Поиск экскурсий";
  }

  if (direction === "attractions") {
    return "Поиск досуга";
  }

  return "Поиск трансфера";
}

function getMobileLocationPlaceholder(direction: Direction): string {
  if (direction === "housing") {
    return "Курорт, город или адрес";
  }

  if (direction === "transfers") {
    return "Город, маршрут или авто";
  }

  return "Курорт, город или место";
}

function getNextMobileStepAfterLocation(direction: Direction): MobileSearchStep {
  return direction === "housing" || direction === "excursions" ? "date" : "review";
}

function DirectionIcon(props: { direction: Direction; className?: string }) {
  const Icon =
    props.direction === "housing"
      ? House
      : props.direction === "excursions"
        ? Compass
        : props.direction === "attractions"
          ? Landmark
          : Car;

  return <AppIcon icon={Icon} className={props.className} />;
}

function formatCardPrice(value: number, direction: Direction): string {
  const rounded = Math.max(0, Math.round(value));
  const money = `${rubFormatter.format(rounded)} ₽`;

  if (direction === "attractions") {
    return "досуг рядом с городом";
  }

  if (direction === "transfers") {
    return "водители и маршруты";
  }

  if (direction === "excursions") {
    return `от ${money}`;
  }

  return `от ${money} / сутки`;
}

function buildCityHref(input: {
  direction: Direction;
  locationId: string;
  locationName: string;
}): string {
  if (input.direction === "housing") {
    return buildHousingLocationPath(input.locationId);
  }

  if (input.direction === "attractions") {
    return `${attractionsHubPath}?${new URLSearchParams({ location: input.locationName }).toString()}`;
  }

  if (input.direction === "transfers") {
    return `${transfersHubPath}?${new URLSearchParams({ location: input.locationName }).toString()}`;
  }

  return buildExcursionsLocationPath(input.locationId);
}

function CalendarIcon(props: { className?: string }) {
  return <FieldAdornmentIcon icon={CalendarDays} shellClassName={props.className} />;
}

function UserIcon(props: { className?: string }) {
  return <FieldAdornmentIcon icon={Users} shellClassName={props.className} />;
}

function ClockIcon(props: { className?: string }) {
  return <AppIcon icon={Clock3} className={props.className} />;
}

function LocationIcon(props: { className?: string }) {
  return <AppIcon icon={MapPin} className={props.className} />;
}

function HotelIcon(props: { className?: string }) {
  return <AppIcon icon={Building2} className={props.className} />;
}

function ListingIcon(props: { className?: string }) {
  return <AppIcon icon={ArrowUpRight} className={props.className} />;
}

function renderSuggestionName(name: string, query: string): ReactNode {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return name;
  }

  const lowerName = name.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();
  const matchIndex = lowerName.indexOf(lowerQuery);
  if (matchIndex < 0) {
    return name;
  }

  const endIndex = matchIndex + trimmedQuery.length;
  return [
    name.slice(0, matchIndex),
    <mark key={`${name}-${matchIndex}`} className="bg-transparent font-semibold text-olive">
      {name.slice(matchIndex, endIndex)}
    </mark>,
    name.slice(endIndex),
  ];
}

function SuggestionLeadingIcon(props: {
  section: SearchSuggestionSection;
  type: SearchSuggestionType;
}) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-olive/70">
      {props.section === "recent" ? (
        <ClockIcon className="h-4 w-4" />
      ) : props.type === "hotel" ? (
        <HotelIcon className="h-4 w-4" />
      ) : props.type === "listing" ? (
        <ListingIcon className="h-4 w-4" />
      ) : (
        <LocationIcon className="h-4 w-4" />
      )}
    </span>
  );
}

export function HomeSearchShowcase({
  cities,
  locationSuggestions,
  publishedPropertiesCount,
  publishedExcursionsCount,
  initialPopularSuggestionsByDirection,
}: HomeSearchShowcaseProps) {
  const router = useRouter();
  const pathname = usePathname();
  const seededPopularSuggestions = useMemo(
    () => ({
      housing: initialPopularSuggestionsByDirection?.housing ?? [],
      attractions: initialPopularSuggestionsByDirection?.attractions ?? [],
      excursions: initialPopularSuggestionsByDirection?.excursions ?? [],
      transfers: initialPopularSuggestionsByDirection?.transfers ?? [],
    }),
    [initialPopularSuggestionsByDirection],
  );

  const [direction, setDirection] = useState<Direction>("housing");
  const [searchValue, setSearchValue] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<HomeSearchSuggestionItem | null>(
    null,
  );
  const [housingDates, setHousingDates] = useState<DateRangeState>({
    checkIn: "",
    checkOut: "",
  });
  const [excursionDate, setExcursionDate] = useState("");
  const [isExcursionAnyDate, setIsExcursionAnyDate] = useState(false);

  const [housingGuests, setHousingGuests] = useState<GuestsState>({
    adults: 2,
    childrenAges: [],
  });
  const [excursionGuests, setExcursionGuests] = useState<GuestsState>({
    adults: 2,
    childrenAges: [],
  });

  const [housingNewChildAge, setHousingNewChildAge] = useState("");
  const [excursionNewChildAge, setExcursionNewChildAge] = useState("");
  const [excursionRadius, setExcursionRadius] = useState(10);
  const [isChildAgeSelectExpanded, setIsChildAgeSelectExpanded] = useState(false);
  const [openedChildAgeDropdownKey, setOpenedChildAgeDropdownKey] = useState<string | null>(null);
  const [openedPanel, setOpenedPanel] = useState<null | "date" | "guests">(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [mobileStep, setMobileStep] = useState<MobileSearchStep>("location");
  const [travelsWithPet, setTravelsWithPet] = useState(false);
  const [isDatePanelMounted, setIsDatePanelMounted] = useState(false);
  const [isGuestsPanelMounted, setIsGuestsPanelMounted] = useState(false);
  const [hoverHousingDate, setHoverHousingDate] = useState("");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isSearchDropdownMounted, setIsSearchDropdownMounted] = useState(false);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [popularSuggestions, setPopularSuggestions] = useState<HomeSearchSuggestionItem[]>(
    seededPopularSuggestions.housing,
  );
  const [matchSuggestions, setMatchSuggestions] = useState<HomeSearchSuggestionItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<RecentSearchEntry[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const searchFieldRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const dateFieldRef = useRef<HTMLDivElement | null>(null);
  const guestsFieldRef = useRef<HTMLDivElement | null>(null);
  const childAgeSelectRef = useRef<HTMLDivElement | null>(null);
  const childAgeRowsRef = useRef<HTMLDivElement | null>(null);
  const monthSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const monthListRef = useRef<HTMLDivElement | null>(null);
  const datePanelCloseTimerRef = useRef<number | null>(null);
  const guestsPanelCloseTimerRef = useRef<number | null>(null);
  const searchDropdownCloseTimerRef = useRef<number | null>(null);
  const hasRestoredSearchStateRef = useRef(false);
  const suggestionsCacheRef = useRef<
    Map<string, { expiresAt: number; payload: HomeSearchSuggestionsResponse }>
  >(new Map());
  const hasRestoredRecentSearchRef = useRef(false);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const calendarMonths = useMemo(() => buildCalendarMonths(new Date(), calendarMonthCount), []);
  const firstMonthKey = calendarMonths[0]?.key ?? "";
  const isLocationEmpty = searchValue.trim().length === 0;
  const usesDateGuests = direction === "housing" || direction === "excursions";
  const usesRadius = direction !== "housing";
  const suggestionDirection = direction;
  const typewriterDestinations = useMemo(() => {
    const source = [
      ...defaultTypewriterDestinations,
      ...cities.map((city) => city.locationName),
      ...locationSuggestions,
    ];
    const result: string[] = [];
    const seen = new Set<string>();

    for (const item of source) {
      const name = item.trim();
      const key = normalizeLocation(name);
      if (!name || seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(name);
      if (result.length >= 14) {
        break;
      }
    }

    return result;
  }, [cities, locationSuggestions]);
  const typedDestination = useTypewriterText(typewriterDestinations);
  const searchDemoDestination =
    typedDestination || (typewriterDestinations.length === 0 ? "Ялта" : "");
  const searchDemoLabel = `Куда едем - ${searchDemoDestination}`;
  const renderSearchDemoLabel = () => (
    <span className="inline-flex min-w-0 items-center">
      <span className="truncate">{searchDemoLabel}</span>
      <span className="ml-0.5 inline-block h-4 w-px shrink-0 animate-pulse bg-primary/70" />
    </span>
  );
  const housingStat = useMemo(() => {
    if (publishedPropertiesCount !== null) {
      return {
        value: countFormatter.format(publishedPropertiesCount),
        label: pluralize(publishedPropertiesCount, [
          "объект жилья",
          "объекта жилья",
          "объектов жилья",
        ]),
      };
    }

    return {
      value: String(cities.length),
      label: `${pluralize(cities.length, ["курорт", "курорта", "курортов"])} на витрине`,
    };
  }, [cities.length, publishedPropertiesCount]);
  const excursionStat = useMemo(() => {
    if (publishedExcursionsCount !== null) {
      return {
        value: countFormatter.format(publishedExcursionsCount),
        label: pluralize(publishedExcursionsCount, ["экскурсия", "экскурсии", "экскурсий"]),
      };
    }

    return {
      value: "2",
      label: "направления отдыха",
    };
  }, [publishedExcursionsCount]);
  const locationCountLabel = `${pluralize(locationSuggestions.length, [
    "населенный пункт",
    "населенных пункта",
    "населенных пунктов",
  ])} Крыма`;

  const locationByNormalizedName = useMemo(() => {
    const map = new Map<string, string>();

    for (const city of cities) {
      map.set(normalizeLocation(city.locationName), city.locationName);
    }

    for (const suggestion of locationSuggestions) {
      const key = normalizeLocation(suggestion);
      if (!map.has(key)) {
        map.set(key, suggestion);
      }
    }

    return map;
  }, [cities, locationSuggestions]);

  const recentSuggestions = useMemo(
    () => toRecentSuggestionItems(recentEntries.filter((entry) => entry.direction === direction)),
    [recentEntries, direction],
  );
  const normalizedSearchQuery = searchValue.trim();
  useEffect(() => {
    const expiresAt = Date.now() + homeSearchSuggestionsCacheTtlMs;
    for (const directionKey of Object.keys(directionLabels) as Direction[]) {
      const popular = seededPopularSuggestions[directionKey];
      if (popular.length === 0) {
        continue;
      }

      suggestionsCacheRef.current.set(`${directionKey}|`, {
        payload: {
          recent: [],
          popular,
          matches: [],
        },
        expiresAt,
      });
    }
  }, [seededPopularSuggestions]);

  useEffect(() => {
    if (normalizedSearchQuery.length > 0) {
      return;
    }

    const popular = seededPopularSuggestions[direction];
    if (popular.length === 0) {
      return;
    }

    setPopularSuggestions(popular);
    setMatchSuggestions([]);
  }, [direction, normalizedSearchQuery, seededPopularSuggestions]);

  const isSuggestionQueryMode = normalizedSearchQuery.length > 0;
  const shownPopularSuggestions = useMemo(
    () => (isSuggestionQueryMode ? [] : popularSuggestions),
    [isSuggestionQueryMode, popularSuggestions],
  );
  const shownMatchSuggestions = useMemo(
    () => (isSuggestionQueryMode ? matchSuggestions : []),
    [isSuggestionQueryMode, matchSuggestions],
  );
  const searchDropdownOptions = useMemo<SearchDropdownOption[]>(() => {
    const options: SearchDropdownOption[] = [];

    if (!isSuggestionQueryMode) {
      for (const [index, item] of recentSuggestions.entries()) {
        options.push({
          key: `recent:${item.type}:${item.id}:${index}`,
          section: "recent",
          item,
          position: index + 1,
        });
      }

      for (const [index, item] of shownPopularSuggestions.entries()) {
        options.push({
          key: `popular:${item.type}:${item.id}:${index}`,
          section: "popular",
          item,
          position: index + 1,
        });
      }

      return options;
    }

    for (const [index, item] of shownMatchSuggestions.entries()) {
      options.push({
        key: `matches:${item.type}:${item.id}:${index}`,
        section: "matches",
        item,
        position: index + 1,
      });
    }

    return options;
  }, [isSuggestionQueryMode, recentSuggestions, shownPopularSuggestions, shownMatchSuggestions]);
  const matchLocationSuggestionEntries = useMemo(
    () =>
      shownMatchSuggestions
        .map((item, index) => ({ item, index }))
        .filter((entry) => entry.item.type === "location"),
    [shownMatchSuggestions],
  );
  const matchHotelSuggestionEntries = useMemo(
    () =>
      shownMatchSuggestions
        .map((item, index) => ({ item, index }))
        .filter((entry) => entry.item.type === "hotel"),
    [shownMatchSuggestions],
  );
  const matchListingSuggestionEntries = useMemo(
    () =>
      shownMatchSuggestions
        .map((item, index) => ({ item, index }))
        .filter((entry) => entry.item.type === "listing"),
    [shownMatchSuggestions],
  );
  const listingSuggestionGroupLabel =
    direction === "transfers"
      ? "Трансферы и маршруты"
      : direction === "attractions"
        ? "Места"
        : "Экскурсии и туры";
  const searchDropdownOptionByKey = useMemo(
    () => new Map(searchDropdownOptions.map((option) => [option.key, option])),
    [searchDropdownOptions],
  );
  const getSearchDropdownOption = useCallback(
    (
      section: SearchSuggestionSection,
      item: HomeSearchSuggestionItem,
      index: number,
    ): SearchDropdownOption | null => {
      const key = `${section}:${item.type}:${item.id}:${index}`;
      return searchDropdownOptionByKey.get(key) ?? null;
    },
    [searchDropdownOptionByKey],
  );

  const activeGuests = direction === "housing" ? housingGuests : excursionGuests;
  const activeGuestsTotal = activeGuests.adults + activeGuests.childrenAges.length;
  const activeMobileGuestsValue =
    direction === "housing"
      ? getDetailedGuestsFieldValue(activeGuests, travelsWithPet)
      : getGuestsFieldValue(activeGuests);
  const dateFieldValue =
    direction === "housing"
      ? formatHousingDatesField(housingDates)
      : formatExcursionDateField(excursionDate, isExcursionAnyDate);
  const mobileDateSummary =
    direction === "housing"
      ? formatMobileHousingDatesSummary(housingDates)
      : formatExcursionDateField(excursionDate, isExcursionAnyDate);
  const mobileCompactSubtitle =
    direction === "housing"
      ? `${mobileDateSummary}, ${getGuestsFieldValue(housingGuests)}`
      : direction === "excursions"
        ? `${mobileDateSummary}, ${getGuestsFieldValue(excursionGuests)}`
        : "Куда едем";
  const isMobileLocationStep = isMobileSearchOpen && mobileStep === "location";
  const housingPreviewCheckOut = useMemo(() => {
    if (housingDates.checkOut) {
      return housingDates.checkOut;
    }

    if (!housingDates.checkIn || !hoverHousingDate || hoverHousingDate <= housingDates.checkIn) {
      return "";
    }

    return hoverHousingDate;
  }, [housingDates.checkIn, housingDates.checkOut, hoverHousingDate]);
  const guestsFieldLabel = direction === "housing" ? "Размещение" : "Участники";
  const guestsFieldValue = getGuestsFieldValue(activeGuests);
  const pendingChildAgeValue = direction === "housing" ? housingNewChildAge : excursionNewChildAge;
  const pendingChildAgeLabel =
    pendingChildAgeValue === ""
      ? "Выберите возраст"
      : formatChildAgeOption(Number.parseInt(pendingChildAgeValue, 10));
  const activeMonthKey =
    getMonthKeyFromIso(
      direction === "housing" ? housingDates.checkIn || todayIso : excursionDate || todayIso,
    ) ?? firstMonthKey;

  const closeDatePanelByOutside = useCallback(() => {
    if (direction === "housing" && housingDates.checkIn && !housingDates.checkOut) {
      return;
    }

    setHoverHousingDate("");
    setOpenedPanel(null);
    setIsChildAgeSelectExpanded(false);
  }, [direction, housingDates.checkIn, housingDates.checkOut]);

  const clearDatePanelCloseTimer = useCallback(() => {
    if (datePanelCloseTimerRef.current === null) {
      return;
    }

    window.clearTimeout(datePanelCloseTimerRef.current);
    datePanelCloseTimerRef.current = null;
  }, []);

  const clearGuestsPanelCloseTimer = useCallback(() => {
    if (guestsPanelCloseTimerRef.current === null) {
      return;
    }

    window.clearTimeout(guestsPanelCloseTimerRef.current);
    guestsPanelCloseTimerRef.current = null;
  }, []);

  const clearSearchDropdownCloseTimer = useCallback(() => {
    if (searchDropdownCloseTimerRef.current === null) {
      return;
    }

    window.clearTimeout(searchDropdownCloseTimerRef.current);
    searchDropdownCloseTimerRef.current = null;
  }, []);

  const closeSearchDropdown = useCallback(() => {
    setIsSearchDropdownOpen(false);
    setActiveSuggestionIndex(-1);
  }, []);

  const closeAllPopovers = useCallback(
    (except: "search" | "date" | "guests" | null = null) => {
      if (except !== "search") {
        closeSearchDropdown();
      }

      if (except !== "date" && openedPanel === "date") {
        setHoverHousingDate("");
        setOpenedPanel(null);
        setIsChildAgeSelectExpanded(false);
      }

      if (except !== "guests" && openedPanel === "guests") {
        setOpenedPanel(null);
        setIsChildAgeSelectExpanded(false);
      }
    },
    [closeSearchDropdown, openedPanel],
  );

  const openSearchDropdown = useCallback(() => {
    closeAllPopovers("search");
    clearSearchDropdownCloseTimer();
    setIsSearchDropdownMounted(true);
    setIsSearchDropdownOpen((prev) => {
      if (!prev) {
        trackSearchAnalytics("search_dropdown_open", {
          direction,
        });
      }

      return true;
    });
  }, [clearSearchDropdownCloseTimer, closeAllPopovers, direction]);

  const commitRecentSuggestion = useCallback(
    (item: HomeSearchSuggestionItem) => {
      const safeGuests = clampGuests(activeGuestsTotal);
      const nextEntry: RecentSearchEntry = {
        type: item.type,
        id: item.id,
        name: item.name,
        locationId: item.locationId,
        direction,
        checkIn:
          direction === "housing"
            ? housingDates.checkIn
            : direction === "excursions" && !isExcursionAnyDate
              ? excursionDate
              : "",
        checkOut: direction === "housing" ? housingDates.checkOut : "",
        isAnyDate: direction === "excursions" ? isExcursionAnyDate : false,
        guests: safeGuests,
        timestamp: Date.now(),
      };

      setRecentEntries((prev) => {
        const updated = upsertRecentSearchEntry(prev, nextEntry);
        try {
          window.sessionStorage.setItem(homeSearchRecentStorageKey, JSON.stringify(updated));
        } catch {
          // Ignore storage write errors and keep UX responsive.
        }
        return updated;
      });
    },
    [
      activeGuestsTotal,
      direction,
      housingDates.checkIn,
      housingDates.checkOut,
      isExcursionAnyDate,
      excursionDate,
    ],
  );

  const applySuggestionSelection = useCallback(
    (option: SearchDropdownOption) => {
      setSearchValue(option.item.name);
      setSelectedSuggestion(option.item);
      commitRecentSuggestion(option.item);
      closeSearchDropdown();
      searchInputRef.current?.focus();

      trackSearchAnalytics("search_suggestion_click", {
        direction,
        type: option.item.type,
        id: option.item.id,
        section: option.section,
        position: option.position,
      });
    },
    [commitRecentSuggestion, closeSearchDropdown, direction],
  );

  const openMobileSearch = useCallback(
    (step: MobileSearchStep = "location") => {
      closeAllPopovers(null);
      clearDatePanelCloseTimer();
      clearGuestsPanelCloseTimer();
      setIsChildAgeSelectExpanded(false);
      setOpenedChildAgeDropdownKey(null);
      setMobileStep(step);
      setIsMobileSearchOpen(true);
    },
    [clearDatePanelCloseTimer, clearGuestsPanelCloseTimer, closeAllPopovers],
  );

  const closeMobileSearch = useCallback(() => {
    setIsMobileSearchOpen(false);
    setMobileStep("location");
    setIsChildAgeSelectExpanded(false);
    setOpenedChildAgeDropdownKey(null);
  }, []);

  const applyMobileSuggestionSelection = useCallback(
    (option: SearchDropdownOption) => {
      setSearchValue(option.item.name);
      setSelectedSuggestion(option.item);
      commitRecentSuggestion(option.item);
      closeSearchDropdown();
      setMobileStep(getNextMobileStepAfterLocation(direction));

      trackSearchAnalytics("search_suggestion_click", {
        direction,
        type: option.item.type,
        id: option.item.id,
        section: option.section,
        position: option.position,
        surface: "mobile_modal",
      });
    },
    [commitRecentSuggestion, closeSearchDropdown, direction],
  );

  const continueMobileLocationStep = () => {
    if (isLocationEmpty) {
      mobileSearchInputRef.current?.focus();
      return;
    }

    closeSearchDropdown();
    setMobileStep(getNextMobileStepAfterLocation(direction));
  };

  const continueMobileDateStep = () => {
    if (direction === "housing") {
      if (!housingDates.checkIn || !housingDates.checkOut) {
        return;
      }

      setMobileStep("guests");
      return;
    }

    if (direction === "excursions") {
      if (!isExcursionAnyDate && !excursionDate) {
        return;
      }

      setMobileStep("guests");
    }
  };

  const resetMobileSearch = () => {
    setSearchValue("");
    setSelectedSuggestion(null);
    setHousingDates({
      checkIn: "",
      checkOut: "",
    });
    setExcursionDate("");
    setIsExcursionAnyDate(false);
    setHousingGuests({
      adults: 2,
      childrenAges: [],
    });
    setExcursionGuests({
      adults: 2,
      childrenAges: [],
    });
    setHousingNewChildAge("");
    setExcursionNewChildAge("");
    setTravelsWithPet(false);
    setMobileStep("location");
  };

  const goBackInMobileSearch = () => {
    if (mobileStep === "review") {
      closeMobileSearch();
      return;
    }

    if (mobileStep === "guests") {
      setMobileStep("date");
      return;
    }

    if (mobileStep === "date") {
      setMobileStep("location");
      return;
    }

    closeMobileSearch();
  };

  const updateAdults = (targetDirection: Direction, value: number) => {
    const next = clampGuests(value);

    if (targetDirection === "housing") {
      setHousingGuests((prev) => ({
        ...prev,
        adults: next,
      }));
      return;
    }

    setExcursionGuests((prev) => ({
      ...prev,
      adults: next,
    }));
  };

  const setPendingChildAge = (targetDirection: Direction, value: string) => {
    if (targetDirection === "housing") {
      setHousingNewChildAge(value);
      return;
    }

    setExcursionNewChildAge(value);
  };

  const addChild = (targetDirection: Direction, ageRaw: string) => {
    const age = Number.parseInt(ageRaw, 10);

    if (!Number.isFinite(age) || age < 0 || age > 17) {
      return;
    }

    const applyChild = (prev: GuestsState): GuestsState => {
      if (prev.adults + prev.childrenAges.length >= maxGuestsCount) {
        return prev;
      }

      return {
        ...prev,
        childrenAges: [...prev.childrenAges, age],
      };
    };

    if (targetDirection === "housing") {
      setHousingGuests(applyChild);
      setHousingNewChildAge("");
      setIsChildAgeSelectExpanded(false);
      return;
    }

    setExcursionGuests(applyChild);
    setExcursionNewChildAge("");
    setIsChildAgeSelectExpanded(false);
  };

  const updateChildAge = (targetDirection: Direction, index: number, ageRaw: string) => {
    const age = Number.parseInt(ageRaw, 10);
    if (!Number.isFinite(age) || age < 0 || age > 17) {
      return;
    }

    const applyChildAge = (prev: GuestsState): GuestsState => ({
      ...prev,
      childrenAges: prev.childrenAges.map((item, itemIndex) => (itemIndex === index ? age : item)),
    });

    if (targetDirection === "housing") {
      setHousingGuests(applyChildAge);
      return;
    }

    setExcursionGuests(applyChildAge);
  };

  const removeChild = (targetDirection: Direction, index: number) => {
    const applyChildRemoval = (prev: GuestsState): GuestsState => ({
      ...prev,
      childrenAges: prev.childrenAges.filter((_, itemIndex) => itemIndex !== index),
    });

    if (targetDirection === "housing") {
      setHousingGuests(applyChildRemoval);
      return;
    }

    setExcursionGuests(applyChildRemoval);
  };

  const onHousingDateSelect = (iso: string) => {
    if (iso < todayIso) {
      return;
    }

    if (!housingDates.checkIn || housingDates.checkOut) {
      setHousingDates({
        checkIn: iso,
        checkOut: "",
      });
      setHoverHousingDate("");
      return;
    }

    if (iso <= housingDates.checkIn) {
      setHousingDates({
        checkIn: iso,
        checkOut: "",
      });
      setHoverHousingDate("");
      return;
    }

    setHousingDates({
      checkIn: housingDates.checkIn,
      checkOut: iso,
    });
    setHoverHousingDate("");
    setOpenedPanel(null);
    setIsChildAgeSelectExpanded(false);
  };

  const onExcursionDateSelect = (iso: string) => {
    if (iso < todayIso) {
      return;
    }

    setIsExcursionAnyDate(false);
    setExcursionDate(iso);
    setOpenedPanel(null);
    setIsChildAgeSelectExpanded(false);
  };

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

  useEffect(() => {
    if (openedPanel !== "date") {
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      scrollToMonth(activeMonthKey, "auto");
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [openedPanel, activeMonthKey, scrollToMonth]);

  useEffect(() => {
    if (openedPanel === null) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (openedPanel === "date") {
        if (dateFieldRef.current?.contains(target)) {
          return;
        }

        closeDatePanelByOutside();
        return;
      }

      if (openedPanel === "guests") {
        if (guestsFieldRef.current?.contains(target)) {
          return;
        }

        setOpenedPanel(null);
        setIsChildAgeSelectExpanded(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setOpenedPanel(null);
      setIsChildAgeSelectExpanded(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openedPanel, closeDatePanelByOutside]);

  useEffect(() => {
    if (hasRestoredRecentSearchRef.current) {
      return;
    }
    hasRestoredRecentSearchRef.current = true;

    try {
      const raw = window.sessionStorage.getItem(homeSearchRecentStorageKey);
      if (!raw) {
        return;
      }

      setRecentEntries(parseRecentSearches(raw));
    } catch {
      // Ignore storage access errors (private mode, disabled storage).
    }
  }, []);

  useEffect(() => {
    closeSearchDropdown();
  }, [pathname, closeSearchDropdown]);

  useEffect(() => {
    if (openedPanel === null) {
      return;
    }

    closeSearchDropdown();
  }, [openedPanel, closeSearchDropdown]);

  useEffect(() => {
    if (openedPanel === "date") {
      clearDatePanelCloseTimer();
      setIsDatePanelMounted(true);
      return;
    }

    if (!isDatePanelMounted) {
      return;
    }

    clearDatePanelCloseTimer();
    datePanelCloseTimerRef.current = window.setTimeout(() => {
      setIsDatePanelMounted(false);
      datePanelCloseTimerRef.current = null;
    }, popoverExitDurationMs);

    return () => {
      clearDatePanelCloseTimer();
    };
  }, [clearDatePanelCloseTimer, isDatePanelMounted, openedPanel]);

  useEffect(() => {
    if (openedPanel === "guests") {
      clearGuestsPanelCloseTimer();
      setIsGuestsPanelMounted(true);
      return;
    }

    if (!isGuestsPanelMounted) {
      return;
    }

    clearGuestsPanelCloseTimer();
    guestsPanelCloseTimerRef.current = window.setTimeout(() => {
      setIsGuestsPanelMounted(false);
      guestsPanelCloseTimerRef.current = null;
    }, guestsPopoverTransitionMs);

    return () => {
      clearGuestsPanelCloseTimer();
    };
  }, [clearGuestsPanelCloseTimer, isGuestsPanelMounted, openedPanel]);

  useEffect(() => {
    if (isSearchDropdownOpen) {
      clearSearchDropdownCloseTimer();
      setIsSearchDropdownMounted(true);
      return;
    }

    if (!isSearchDropdownMounted) {
      return;
    }

    clearSearchDropdownCloseTimer();
    searchDropdownCloseTimerRef.current = window.setTimeout(() => {
      setIsSearchDropdownMounted(false);
      searchDropdownCloseTimerRef.current = null;
    }, popoverExitDurationMs);

    return () => {
      clearSearchDropdownCloseTimer();
    };
  }, [clearSearchDropdownCloseTimer, isSearchDropdownMounted, isSearchDropdownOpen]);

  useEffect(
    () => () => {
      clearDatePanelCloseTimer();
      clearGuestsPanelCloseTimer();
      clearSearchDropdownCloseTimer();
    },
    [clearDatePanelCloseTimer, clearGuestsPanelCloseTimer, clearSearchDropdownCloseTimer],
  );

  useEffect(() => {
    if (
      openedPanel !== "date" ||
      direction !== "housing" ||
      !housingDates.checkIn ||
      housingDates.checkOut
    ) {
      setHoverHousingDate("");
    }
  }, [openedPanel, direction, housingDates.checkIn, housingDates.checkOut]);

  useEffect(() => {
    if (openedPanel === "guests") {
      return;
    }

    setIsChildAgeSelectExpanded(false);
    setOpenedChildAgeDropdownKey(null);
  }, [openedPanel]);

  useEffect(() => {
    if (!isChildAgeSelectExpanded && !openedChildAgeDropdownKey) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        childAgeSelectRef.current?.contains(target) ||
        childAgeRowsRef.current?.contains(target)
      ) {
        return;
      }

      setIsChildAgeSelectExpanded(false);
      setOpenedChildAgeDropdownKey(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setIsChildAgeSelectExpanded(false);
      setOpenedChildAgeDropdownKey(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isChildAgeSelectExpanded, openedChildAgeDropdownKey]);

  useEffect(() => {
    if (!isSearchDropdownOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (searchFieldRef.current?.contains(target)) {
        return;
      }

      closeSearchDropdown();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Tab") {
        closeSearchDropdown();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isSearchDropdownOpen, closeSearchDropdown]);

  useEffect(() => {
    if (!isSearchDropdownOpen && !isMobileLocationStep) {
      setIsSuggestionsLoading(false);
      return;
    }

    const query = normalizedSearchQuery.slice(0, 120);
    const include = direction === "housing" ? "locations,hotels" : "locations,listings";
    const cacheKey = `${direction}|${query.toLowerCase()}`;
    const cached = suggestionsCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setPopularSuggestions(cached.payload.popular);
      setMatchSuggestions(cached.payload.matches);
      setIsSuggestionsLoading(false);

      trackSearchAnalytics("search_suggestion_shown", {
        direction,
        queryLength: query.length,
        recentCount: recentSuggestions.length,
        popularCount: cached.payload.popular.length,
        matchesCount: cached.payload.matches.length,
      });
      if (query.length > 0 && cached.payload.matches.length === 0) {
        trackSearchAnalytics("search_no_results", {
          direction,
          query,
        });
      }
      return;
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(
      async () => {
        setIsSuggestionsLoading(true);

        try {
          const isEmptyQuery = query.length === 0;
          const params = new URLSearchParams({
            direction: suggestionDirection,
            query,
            include: isEmptyQuery ? "locations" : include,
            limit: isEmptyQuery ? "8" : "12",
          });
          const response = await fetch(`/api/search/suggestions?${params.toString()}`, {
            credentials: "omit",
            signal: abortController.signal,
          });
          if (!response.ok) {
            return;
          }

          const payload = parseSuggestionsResponse(await response.json());
          suggestionsCacheRef.current.set(cacheKey, {
            payload,
            expiresAt: Date.now() + homeSearchSuggestionsCacheTtlMs,
          });
          setPopularSuggestions(payload.popular);
          setMatchSuggestions(payload.matches);

          trackSearchAnalytics("search_suggestion_shown", {
            direction,
            queryLength: query.length,
            recentCount: recentSuggestions.length,
            popularCount: payload.popular.length,
            matchesCount: payload.matches.length,
          });
          if (query.length > 0 && payload.matches.length === 0) {
            trackSearchAnalytics("search_no_results", {
              direction,
              query,
            });
          }
        } catch {
          // Ignore aborted or transient network errors in autocomplete flow.
        } finally {
          setIsSuggestionsLoading(false);
        }
      },
      query.length === 0 ? 0 : homeSearchSuggestionsDebounceMs,
    );

    return () => {
      abortController.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    isSearchDropdownOpen,
    isMobileLocationStep,
    normalizedSearchQuery,
    direction,
    suggestionDirection,
    recentSuggestions.length,
  ]);

  useEffect(() => {
    if (activeSuggestionIndex < searchDropdownOptions.length) {
      return;
    }

    setActiveSuggestionIndex(searchDropdownOptions.length - 1);
  }, [activeSuggestionIndex, searchDropdownOptions.length]);

  useEffect(() => {
    if (activeSuggestionIndex < 0) {
      return;
    }

    const option = searchDropdownOptions[activeSuggestionIndex];
    if (!option) {
      return;
    }

    const node = document.getElementById(getSearchOptionDomId(option.key));
    node?.scrollIntoView({ block: "nearest" });
  }, [activeSuggestionIndex, searchDropdownOptions]);

  useEffect(() => {
    if (hasRestoredSearchStateRef.current) {
      return;
    }
    hasRestoredSearchStateRef.current = true;

    try {
      const raw = window.localStorage.getItem(homeSearchStorageKey);
      if (raw) {
        // Parse legacy payload once, then clear so fields always start empty after reload.
        parsePersistedSearchState(raw);
      }
      window.localStorage.removeItem(homeSearchStorageKey);
      window.localStorage.removeItem(homeSearchQueryStorageKey);
    } catch {
      // Ignore storage access errors (private mode, disabled storage).
    }

    setDirection("housing");
    setSearchValue("");
    setSelectedSuggestion(null);
    setHousingDates({
      checkIn: "",
      checkOut: "",
    });
    setExcursionDate("");
    setIsExcursionAnyDate(false);
    setHousingGuests({
      adults: 2,
      childrenAges: [],
    });
    setExcursionGuests({
      adults: 2,
      childrenAges: [],
    });
    setHousingNewChildAge("");
    setExcursionNewChildAge("");
    setTravelsWithPet(false);
  }, []);

  useEffect(() => {
    if (!isMobileSearchOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSearchOpen]);

  useEffect(() => {
    if (!isMobileLocationStep) {
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      mobileSearchInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [isMobileLocationStep]);

  const submitSearch = () => {
    const normalizedQuery = searchValue.trim();

    if (!normalizedQuery) {
      return;
    }

    const matchedLocationName = locationByNormalizedName.get(normalizeLocation(normalizedQuery));
    const isSelectedSuggestionMatch =
      selectedSuggestion &&
      normalizeLocation(selectedSuggestion.name) === normalizeLocation(normalizedQuery);
    const safeGuests = clampGuests(activeGuestsTotal);
    const params = new URLSearchParams();

    if (usesDateGuests && safeGuests !== 2) {
      params.set("guests", String(safeGuests));
    }

    let locationSlug: string | null = null;

    if (isSelectedSuggestionMatch && selectedSuggestion) {
      if (selectedSuggestion.type === "location") {
        params.set("location", selectedSuggestion.name);
        locationSlug = resolveKnownCrimeaLocationSlug({
          location: selectedSuggestion.name,
          locationId: selectedSuggestion.locationId,
          suggestionId: selectedSuggestion.id,
        });
      } else {
        params.set("q", selectedSuggestion.name);
      }
      commitRecentSuggestion(selectedSuggestion);
    } else if (matchedLocationName) {
      params.set("location", matchedLocationName);
      locationSlug = resolveKnownCrimeaLocationSlug({ location: matchedLocationName });
      commitRecentSuggestion({
        type: "location",
        id: locationSlug ?? normalizeLocation(matchedLocationName).slice(0, 120),
        name: matchedLocationName,
        subtitle: "",
        locationId: locationSlug,
        activeListingsCount: 0,
      });
    } else {
      params.set("q", normalizedQuery);
      commitRecentSuggestion({
        type: direction === "housing" ? "hotel" : "listing",
        id: `query:${normalizeLocation(normalizedQuery).slice(0, 110)}`,
        name: normalizedQuery,
        subtitle: "",
        locationId: null,
        activeListingsCount: 0,
      });
    }

    if (direction === "housing") {
      const datesParam = buildDateRangeParam(housingDates.checkIn, housingDates.checkOut);
      if (datesParam) {
        params.set("dates", datesParam);
      } else {
        if (housingDates.checkIn) {
          params.set("checkIn", housingDates.checkIn);
        }
        if (housingDates.checkOut) {
          params.set("checkOut", housingDates.checkOut);
        }
      }
      if (travelsWithPet) {
        params.set("petsAllowed", "1");
      }
    } else if (direction === "excursions") {
      if (!isExcursionAnyDate && excursionDate) {
        params.set("checkIn", excursionDate);
      }
      if (excursionRadius !== 30) {
        params.set("radiusKm", String(excursionRadius));
      }
    } else if (usesRadius) {
      if (excursionRadius !== 30) {
        params.set("radiusKm", String(excursionRadius));
      }
    }

    closeSearchDropdown();
    const basePath =
      direction === "housing"
        ? buildHousingCatalogPath({
            location: params.get("location"),
            suggestionId: locationSlug,
          })
        : direction === "attractions"
          ? attractionsHubPath
          : direction === "transfers"
            ? transfersHubPath
            : excursionsHubPath;
    if (direction === "housing" && basePath !== housingHubPath) {
      params.delete("location");
    }
    const queryString = params.toString();
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch();
  };

  const renderSuggestionButton = (
    section: SearchSuggestionSection,
    item: HomeSearchSuggestionItem,
    index: number,
  ) => {
    const option = getSearchDropdownOption(section, item, index);
    if (!option) {
      return null;
    }

    const isActive = searchDropdownOptions[activeSuggestionIndex]?.key === option.key;
    const nameContent =
      section === "matches" ? renderSuggestionName(item.name, normalizedSearchQuery) : item.name;

    return (
      <button
        id={getSearchOptionDomId(option.key)}
        key={option.key}
        type="button"
        role="option"
        aria-selected={isActive}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => applySuggestionSelection(option)}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
          isActive ? "bg-cream" : "hover:bg-cream",
        )}
      >
        <SuggestionLeadingIcon section={section} type={item.type} />
        <span className="block min-w-0">
          <span className="block truncate text-sm font-semibold text-olive">{nameContent}</span>
          <span className="block truncate text-xs text-olive/64">
            {item.subtitle || (section === "popular" ? "Крым, Россия" : "Без деталей")}
          </span>
        </span>
      </button>
    );
  };

  const renderMobileSuggestionButton = (
    section: SearchSuggestionSection,
    item: HomeSearchSuggestionItem,
    index: number,
  ) => {
    const option = getSearchDropdownOption(section, item, index);
    if (!option) {
      return null;
    }

    const nameContent =
      section === "matches" ? renderSuggestionName(item.name, normalizedSearchQuery) : item.name;

    return (
      <button
        key={`mobile-${option.key}`}
        type="button"
        onClick={() => applyMobileSuggestionSelection(option)}
        className="flex min-h-13 w-full items-center gap-3 rounded-2xl px-1 py-2 text-left transition active:bg-cream"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center text-olive">
          <SuggestionLeadingIcon section={section} type={item.type} />
        </span>
        <span className="block min-w-0 border-b border-sand/70 py-2">
          <span className="block truncate text-base font-semibold text-midnight">
            {nameContent}
          </span>
          <span className="block truncate text-sm text-olive/58">
            {item.subtitle || (section === "popular" ? "Крым, Россия" : "Без деталей")}
          </span>
        </span>
      </button>
    );
  };

  const renderMobileSuggestionSections = () => (
    <div className="min-h-0 flex-1 overflow-y-auto pb-3">
      {isSuggestionsLoading ? (
        <div className="space-y-3 py-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`mobile-skeleton-${index}`}
              className="h-14 animate-pulse rounded-2xl bg-cream"
            />
          ))}
        </div>
      ) : null}

      {!isSuggestionsLoading && !isSuggestionQueryMode && recentSuggestions.length > 0 ? (
        <div className="pb-2">
          <p className="px-1 py-2 text-sm text-olive/58">История поиска</p>
          <div className="space-y-1">
            {recentSuggestions.map((item, index) =>
              renderMobileSuggestionButton("recent", item, index),
            )}
          </div>
        </div>
      ) : null}

      {!isSuggestionsLoading && !isSuggestionQueryMode && shownPopularSuggestions.length > 0 ? (
        <div className="pb-2">
          <p className="px-1 py-2 text-sm text-olive/58">Популярные направления</p>
          <div className="space-y-1">
            {shownPopularSuggestions.map((item, index) =>
              renderMobileSuggestionButton("popular", item, index),
            )}
          </div>
        </div>
      ) : null}

      {!isSuggestionsLoading && isSuggestionQueryMode && shownMatchSuggestions.length > 0 ? (
        <div className="pb-2">
          {matchLocationSuggestionEntries.length > 0 ? (
            <>
              <p className="px-1 py-2 text-sm text-olive/58">Локации</p>
              <div className="space-y-1">
                {matchLocationSuggestionEntries.map((entry) =>
                  renderMobileSuggestionButton("matches", entry.item, entry.index),
                )}
              </div>
            </>
          ) : null}

          {matchHotelSuggestionEntries.length > 0 ? (
            <>
              <p className="px-1 py-2 text-sm text-olive/58">Отели</p>
              <div className="space-y-1">
                {matchHotelSuggestionEntries.map((entry) =>
                  renderMobileSuggestionButton("matches", entry.item, entry.index),
                )}
              </div>
            </>
          ) : null}

          {matchListingSuggestionEntries.length > 0 ? (
            <>
              <p className="px-1 py-2 text-sm text-olive/58">{listingSuggestionGroupLabel}</p>
              <div className="space-y-1">
                {matchListingSuggestionEntries.map((entry) =>
                  renderMobileSuggestionButton("matches", entry.item, entry.index),
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {!isSuggestionsLoading &&
      !isSuggestionQueryMode &&
      recentSuggestions.length === 0 &&
      shownPopularSuggestions.length === 0 ? (
        <p className="px-1 py-6 text-base text-olive/65">
          Начните вводить город, курорт или адрес.
        </p>
      ) : null}

      {!isSuggestionsLoading && isSuggestionQueryMode && shownMatchSuggestions.length === 0 ? (
        <p className="px-1 py-6 text-base text-olive/65">Ничего не найдено.</p>
      ) : null}
    </div>
  );

  const renderMobileDateCalendar = () => {
    const isDateStepReady =
      direction === "housing"
        ? Boolean(housingDates.checkIn && housingDates.checkOut)
        : Boolean(isExcursionAnyDate || excursionDate);

    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "mb-4 grid overflow-hidden rounded-2xl border border-sand bg-white",
            direction === "housing" ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {direction === "housing" ? (
            <>
              <button
                type="button"
                onClick={() =>
                  setHousingDates((prev) => ({
                    checkIn: "",
                    checkOut: prev.checkOut && !prev.checkIn ? prev.checkOut : "",
                  }))
                }
                className="min-w-0 border-r border-sand px-4 py-3 text-left"
              >
                <span className="block text-sm text-olive/65">Заезд</span>
                <span className="block truncate text-base font-semibold text-midnight">
                  {housingDates.checkIn ? formatDayMonthWeekday(housingDates.checkIn) : "Дата"}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setHousingDates((prev) => ({
                    ...prev,
                    checkOut: "",
                  }))
                }
                className="min-w-0 px-4 py-3 text-left"
              >
                <span className="block text-sm text-olive/65">Отъезд</span>
                <span className="block truncate text-base font-semibold text-midnight">
                  {housingDates.checkOut ? formatDayMonthWeekday(housingDates.checkOut) : "Дата"}
                </span>
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setIsExcursionAnyDate(false);
                  setExcursionDate("");
                }}
                className="min-w-0 text-left"
              >
                <span className="block text-sm text-olive/65">Дата</span>
                <span className="block truncate text-base font-semibold text-midnight">
                  {isExcursionAnyDate
                    ? "Любая дата"
                    : excursionDate
                      ? formatDayMonthWeekday(excursionDate)
                      : "Выберите дату"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExcursionAnyDate(true);
                  setExcursionDate("");
                }}
                className={cn(
                  "rounded-full px-3 py-2 text-sm font-semibold transition",
                  isExcursionAnyDate
                    ? "bg-primary text-white"
                    : "bg-cream text-olive ring-1 ring-sand",
                )}
              >
                Любая
              </button>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {calendarMonths.map((month) => (
            <div
              key={`mobile-${month.key}`}
              ref={(node) => {
                monthSectionRefs.current[month.key] = node;
              }}
              className="mb-7 last:mb-4"
            >
              <h3 className="px-1 text-lg font-semibold text-midnight">{month.label}</h3>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-sm font-semibold text-olive/75">
                {weekdayShortLower.map((weekday) => (
                  <span key={`mobile-${month.key}-${weekday}`}>{weekday}</span>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-y-2">
                {month.cells.map((cell, cellIndex) => {
                  const iso = cell.iso;

                  if (!iso || !cell.day) {
                    return (
                      <span
                        key={`mobile-${month.key}-blank-${cellIndex}`}
                        className="h-11"
                        aria-hidden="true"
                      />
                    );
                  }

                  const isDisabled = iso < todayIso;
                  const isHousingStart = direction === "housing" && iso === housingDates.checkIn;
                  const isHousingEnd = direction === "housing" && iso === housingPreviewCheckOut;
                  const hasHousingRange =
                    direction === "housing" &&
                    Boolean(
                      housingDates.checkIn &&
                      housingPreviewCheckOut &&
                      housingPreviewCheckOut > housingDates.checkIn,
                    );
                  const isHousingMiddle =
                    direction === "housing" &&
                    Boolean(
                      housingDates.checkIn &&
                      housingPreviewCheckOut &&
                      iso > housingDates.checkIn &&
                      iso < housingPreviewCheckOut,
                    );
                  const isExcursionSelected =
                    direction === "excursions" && !isExcursionAnyDate && iso === excursionDate;
                  const isSelected = isHousingStart || isHousingEnd || isExcursionSelected;

                  return (
                    <button
                      key={`mobile-${iso}`}
                      type="button"
                      disabled={isDisabled}
                      onMouseEnter={() => {
                        if (
                          direction !== "housing" ||
                          !housingDates.checkIn ||
                          housingDates.checkOut ||
                          isDisabled
                        ) {
                          return;
                        }
                        setHoverHousingDate(iso > housingDates.checkIn ? iso : "");
                      }}
                      onFocus={() => {
                        if (
                          direction !== "housing" ||
                          !housingDates.checkIn ||
                          housingDates.checkOut ||
                          isDisabled
                        ) {
                          return;
                        }
                        setHoverHousingDate(iso > housingDates.checkIn ? iso : "");
                      }}
                      onClick={() =>
                        direction === "housing"
                          ? onHousingDateSelect(iso)
                          : onExcursionDateSelect(iso)
                      }
                      className={cn(
                        "mx-auto flex h-11 w-11 items-center justify-center rounded-full text-base transition",
                        isSelected
                          ? "bg-primary font-semibold text-white shadow-[0_8px_18px_-12px_rgba(15,118,110,0.95)]"
                          : isHousingMiddle
                            ? "w-full rounded-none bg-foam text-olive"
                            : isDisabled
                              ? "cursor-not-allowed text-olive/28"
                              : "text-midnight hover:bg-cream",
                        hasHousingRange && isHousingStart ? "rounded-r-[8px]" : "",
                        hasHousingRange && isHousingEnd ? "rounded-l-[8px]" : "",
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

        <Button
          type="button"
          onClick={continueMobileDateStep}
          disabled={!isDateStepReady}
          className="mt-3 h-14 w-full shrink-0 rounded-2xl text-base"
        >
          Сохранить
        </Button>
      </div>
    );
  };

  const renderMobileGuestsStep = () => (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
        <section className="rounded-2xl border border-sand bg-cream/65 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-midnight">Взрослые</p>
              <p className="text-sm text-olive/62">от 18 лет</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateAdults(direction, activeGuests.adults - 1)}
                disabled={activeGuests.adults <= 1}
                aria-label="Уменьшить количество взрослых"
                className="h-11 w-11 rounded-full border border-sand bg-white text-xl leading-none text-olive transition enabled:hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
              >
                -
              </button>
              <span className="w-8 text-center text-base font-semibold text-midnight">
                {activeGuests.adults}
              </span>
              <button
                type="button"
                onClick={() => updateAdults(direction, activeGuests.adults + 1)}
                disabled={activeGuests.adults + activeGuests.childrenAges.length >= maxGuestsCount}
                aria-label="Увеличить количество взрослых"
                className="h-11 w-11 rounded-full border border-sand bg-white text-xl leading-none text-olive transition enabled:hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-sand bg-cream/65 p-4">
          <div>
            <p className="text-base font-semibold text-midnight">Дети</p>
            <p className="text-sm text-olive/62">Возраст на момент выезда</p>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div ref={childAgeSelectRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsChildAgeSelectExpanded((prev) => !prev);
                  setOpenedChildAgeDropdownKey(null);
                }}
                aria-haspopup="listbox"
                aria-expanded={isChildAgeSelectExpanded}
                className="flex h-12 w-full items-center justify-between rounded-2xl border border-sand bg-white px-4 text-sm text-olive transition hover:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <span className="truncate">{pendingChildAgeLabel}</span>
                <AppIcon
                  icon={ChevronDown}
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isChildAgeSelectExpanded ? "rotate-180" : "",
                  )}
                />
              </button>

              <div
                role="listbox"
                className={cn(
                  "custom-scrollbar absolute left-0 top-[calc(100%+6px)] z-40 h-[190px] w-full overflow-y-auto rounded-2xl border border-sand bg-white p-1.5 shadow-lg transition-all duration-300 ease-out",
                  isChildAgeSelectExpanded
                    ? "visible translate-y-0 opacity-100 pointer-events-auto"
                    : "invisible -translate-y-[10px] opacity-0 pointer-events-none",
                )}
              >
                <div className="flex flex-col gap-0.5">
                  {Array.from({ length: 18 }, (_, age) => {
                    const value = String(age);
                    const isSelected = value === pendingChildAgeValue;

                    return (
                      <button
                        key={`mobile-child-age-${age}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setPendingChildAge(direction, value);
                          setIsChildAgeSelectExpanded(false);
                        }}
                        className={cn(
                          "cursor-pointer rounded-xl px-3 py-2.5 text-left text-sm text-olive transition active:bg-sand/30",
                          isSelected ? "bg-cream" : "hover:bg-cream",
                        )}
                      >
                        {formatChildAgeOption(age)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => addChild(direction, pendingChildAgeValue)}
              disabled={
                !pendingChildAgeValue ||
                activeGuests.adults + activeGuests.childrenAges.length >= maxGuestsCount
              }
              className="h-12 rounded-2xl border border-sand bg-white px-4 text-sm font-semibold text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45"
            >
              Добавить
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {activeGuests.childrenAges.length === 0 ? (
              <p className="text-sm text-olive/62">Без детей</p>
            ) : (
              <div ref={childAgeRowsRef} className="space-y-2">
                {activeGuests.childrenAges.map((age, index) => (
                  <div
                    key={`mobile-child-${direction}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2"
                  >
                    <span className="text-sm font-medium text-midnight">
                      Ребенок {index + 1}, {formatChildAgeOption(age)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeChild(direction, index)}
                      className="rounded-full px-3 py-1.5 text-sm font-semibold text-terra transition hover:bg-foam"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {direction === "housing" ? (
          <button
            type="button"
            aria-pressed={travelsWithPet}
            onClick={() => setTravelsWithPet((prev) => !prev)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition",
              travelsWithPet
                ? "border-primary bg-foam text-primary"
                : "border-sand bg-white text-olive hover:bg-cream",
            )}
          >
            <span>
              <span className="block text-base font-semibold">Питомец</span>
              <span className="block text-sm text-olive/62">
                {travelsWithPet ? "Едете с питомцем" : "Без питомцев"}
              </span>
            </span>
            <AppIcon icon={PawPrint} className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <Button
        type="button"
        onClick={() => setMobileStep("review")}
        className="mt-3 h-14 w-full shrink-0 rounded-2xl text-base"
      >
        Продолжить
      </Button>
    </div>
  );

  const renderMobileReviewStep = () => (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setMobileStep("location")}
          className="w-full rounded-2xl border border-sand bg-white px-4 py-3 text-left transition hover:bg-cream"
        >
          <span className="block text-sm text-olive/65">
            {getMobileLocationPlaceholder(direction)}
          </span>
          <span className="block truncate text-base font-semibold text-midnight">
            {searchValue.trim() || renderSearchDemoLabel()}
          </span>
        </button>

        {usesDateGuests ? (
          <>
            <button
              type="button"
              onClick={() => setMobileStep("date")}
              className="grid w-full grid-cols-2 overflow-hidden rounded-2xl border border-sand bg-white text-left transition hover:bg-cream"
            >
              {direction === "housing" ? (
                <>
                  <span className="min-w-0 border-r border-sand px-4 py-3">
                    <span className="block text-sm text-olive/65">Заезд</span>
                    <span className="block truncate text-base font-semibold text-midnight">
                      {housingDates.checkIn ? formatDayMonthWeekday(housingDates.checkIn) : "Дата"}
                    </span>
                  </span>
                  <span className="min-w-0 px-4 py-3">
                    <span className="block text-sm text-olive/65">Отъезд</span>
                    <span className="block truncate text-base font-semibold text-midnight">
                      {housingDates.checkOut
                        ? formatDayMonthWeekday(housingDates.checkOut)
                        : "Дата"}
                    </span>
                  </span>
                </>
              ) : (
                <span className="col-span-2 px-4 py-3">
                  <span className="block text-sm text-olive/65">Дата</span>
                  <span className="block truncate text-base font-semibold text-midnight">
                    {mobileDateSummary}
                  </span>
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileStep("guests")}
              className="w-full rounded-2xl border border-sand bg-white px-4 py-3 text-left transition hover:bg-cream"
            >
              <span className="block text-sm text-olive/65">
                {direction === "housing" ? "Гости" : "Участники"}
              </span>
              <span className="block truncate text-base font-semibold text-midnight">
                {activeMobileGuestsValue}
              </span>
            </button>
          </>
        ) : null}

        {usesRadius ? (
          <div className="rounded-2xl border border-sand bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-olive/65">
              <AppIcon icon={LocateFixed} className="h-4 w-4" />
              Радиус
            </div>
            <div className="grid grid-cols-4 gap-1 min-[420px]:grid-cols-7">
              {radiusOptions.map((km) => (
                <button
                  key={`mobile-radius-${km}`}
                  type="button"
                  onClick={() => setExcursionRadius(km)}
                  className={cn(
                    "h-10 rounded-xl text-sm font-semibold transition",
                    excursionRadius === km
                      ? "bg-primary text-white"
                      : "bg-cream text-olive hover:bg-foam",
                  )}
                >
                  {km} км
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-auto grid grid-cols-[1fr_1.35fr] gap-3 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={resetMobileSearch}
          className="h-14 rounded-2xl bg-white text-base"
        >
          Сбросить
        </Button>
        <Button
          type="button"
          onClick={() => {
            submitSearch();
            closeMobileSearch();
          }}
          disabled={isLocationEmpty}
          className="h-14 rounded-2xl text-base"
        >
          <AppIcon icon={Search} className="mr-2 h-5 w-5 text-white" />
          Найти
        </Button>
      </div>
    </div>
  );

  const renderMobileSearchModal = () => {
    if (!isMobileSearchOpen) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-[90] flex flex-col bg-[#1c1c1c] text-white md:hidden">
        <div className="flex h-[76px] shrink-0 items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            onClick={goBackInMobileSearch}
            aria-label={mobileStep === "review" ? "Закрыть поиск" : "Назад"}
            className="flex h-11 w-11 items-center justify-center border-r border-white/10 pr-3 text-white"
          >
            <AppIcon
              icon={mobileStep === "review" ? X : ChevronLeft}
              className="h-6 w-6 text-white"
            />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-base font-semibold">
              {mobileStep === "location"
                ? directionLabels[direction]
                : getMobileDirectionTitle(direction)}
            </div>
            {mobileStep !== "location" ? (
              <div className="mt-0.5 truncate text-sm text-white/72">
                {searchValue.trim() || searchDemoLabel}
                {usesDateGuests ? ` · ${mobileCompactSubtitle}` : ""}
              </div>
            ) : null}
          </div>
          <span className="h-11 w-11" aria-hidden="true" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[24px] bg-white px-4 py-4 text-olive">
          {mobileStep === "location" ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-cream p-1 ring-1 ring-sand min-[420px]:grid-cols-4">
                {(Object.keys(directionLabels) as Direction[]).map((item) => (
                  <button
                    key={`mobile-direction-${item}`}
                    type="button"
                    onClick={() => {
                      setDirection(item);
                      setSelectedSuggestion(null);
                      setActiveSuggestionIndex(-1);
                      setMobileStep("location");
                    }}
                    className={cn(
                      "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold transition",
                      direction === item
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : "text-olive/68 hover:bg-white",
                    )}
                  >
                    <DirectionIcon direction={item} className="h-4 w-4" />
                    <span className="truncate">{directionLabels[item]}</span>
                  </button>
                ))}
              </div>

              <div className="relative mb-2">
                <input
                  ref={mobileSearchInputRef}
                  value={searchValue}
                  onChange={(event) => {
                    setSearchValue(event.target.value.slice(0, 120));
                    setSelectedSuggestion(null);
                    setActiveSuggestionIndex(-1);
                  }}
                  autoComplete="off"
                  placeholder={searchDemoLabel}
                  className="h-15 w-full rounded-2xl border border-sand bg-white px-4 pr-12 text-base font-semibold text-midnight outline-none transition placeholder:font-normal placeholder:text-olive/54 focus:ring-2 focus:ring-primary/30"
                />
                {searchValue ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchValue("");
                      setSelectedSuggestion(null);
                      mobileSearchInputRef.current?.focus();
                    }}
                    aria-label="Очистить"
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-cream text-olive"
                  >
                    <AppIcon icon={X} className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {renderMobileSuggestionSections()}

              <Button
                type="button"
                onClick={continueMobileLocationStep}
                disabled={isLocationEmpty}
                className="h-14 w-full shrink-0 rounded-2xl text-base"
              >
                Продолжить
              </Button>
            </div>
          ) : mobileStep === "date" ? (
            renderMobileDateCalendar()
          ) : mobileStep === "guests" ? (
            renderMobileGuestsStep()
          ) : (
            renderMobileReviewStep()
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="relative mx-auto max-w-5xl rounded-3xl border border-white/65 bg-[linear-gradient(160deg,rgba(255,255,255,0.97)_0%,rgba(250,248,245,0.98)_44%,rgba(244,237,227,0.94)_100%)] p-4 shadow-[0_30px_70px_-42px_rgba(58,43,35,0.28)] ring-1 ring-olive/8 md:p-8">
        {/* Ambient decorative orbs — clipped to section, isolated so popovers can overflow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
        >
          <div className="absolute inset-0 bg-[linear-gradient(124deg,rgba(15,118,110,0.045)_0%,rgba(255,255,255,0)_34%),linear-gradient(180deg,rgba(242,196,77,0.07)_0%,rgba(255,255,255,0)_24%),linear-gradient(135deg,rgba(255,255,255,0)_58%,rgba(167,101,73,0.05)_84%,rgba(242,196,77,0.08)_100%)]" />
          <div className="absolute right-[-9%] top-6 h-40 w-[34%] rotate-[9deg] rounded-[36px] border border-white/35 bg-[linear-gradient(135deg,rgba(255,255,255,0.32),rgba(255,255,255,0.02))] opacity-60" />
          <div className="absolute -bottom-10 right-12 h-24 w-56 rounded-full bg-[linear-gradient(90deg,rgba(242,196,77,0.10),rgba(255,255,255,0))] opacity-70" />
          <div className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.9),transparent)]" />
        </div>
        <div className="mb-6 text-center">
          <h1 className="mt-3 text-3xl text-midnight sm:text-4xl md:text-5xl md:leading-tight">
            Поиск по Крыму
          </h1>
          <p className="mt-2 text-base text-olive/60 md:text-lg">
            Жильё, экскурсии, досуг и трансферы по всему полуострову
          </p>
        </div>

        <div className="mt-5 md:hidden">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-foam p-1 ring-1 ring-olive/12">
            {(Object.keys(directionLabels) as Direction[]).map((item) => (
              <button
                key={`mobile-compact-${item}`}
                type="button"
                onClick={() => {
                  setDirection(item);
                  setSelectedSuggestion(null);
                  setOpenedPanel(null);
                  setIsChildAgeSelectExpanded(false);
                  closeSearchDropdown();
                }}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold transition active:scale-[0.98]",
                  direction === item
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-olive/72 hover:bg-white/60",
                )}
              >
                <DirectionIcon direction={item} className="h-4 w-4" />
                <span className="truncate">{directionLabels[item]}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openMobileSearch("location")}
            className="flex w-full items-center gap-3 rounded-[28px] bg-white p-2 text-left shadow-[0_16px_34px_-24px_rgba(58,43,35,0.55)] ring-1 ring-sand transition active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1 px-3 py-2">
              <span className="block truncate text-base font-semibold text-midnight">
                {searchValue.trim() || renderSearchDemoLabel()}
              </span>
            </span>
            <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_12px_24px_-12px_rgba(15,118,110,0.9)]">
              <AppIcon icon={Search} className="h-6 w-6 text-white" />
            </span>
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-5 hidden rounded-2xl bg-cream/78 p-3 ring-1 ring-olive/12 md:block md:p-4"
        >
          <div className="relative mx-auto mb-4 grid w-full max-w-3xl grid-cols-2 gap-1 overflow-hidden rounded-xl bg-foam p-1 ring-1 ring-olive/12 sm:grid-cols-4">
            {(Object.keys(directionLabels) as Direction[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setDirection(item);
                  setOpenedPanel(null);
                  setIsChildAgeSelectExpanded(false);
                  setSelectedSuggestion(null);
                  closeSearchDropdown();
                }}
                className={cn(
                  "relative z-10 min-h-11 rounded-lg px-3 py-2 text-sm font-semibold",
                  "outline-none transition-all duration-300 ease-out active:scale-[0.97]",
                  "focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 focus-visible:ring-offset-foam motion-reduce:transition-none",
                  direction === item
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-olive/72 hover:bg-white/55 hover:text-olive",
                )}
              >
                {directionLabels[item]}
              </button>
            ))}
          </div>

          <div
            className={cn(
              "grid gap-3 md:items-end",
              usesDateGuests
                ? "md:grid-cols-[minmax(0,2fr)_minmax(0,1.7fr)_minmax(0,1.3fr)_155px]"
                : "md:grid-cols-[minmax(0,1fr)_155px]",
            )}
          >
            <div ref={searchFieldRef} className="relative min-w-0">
              <label htmlFor="home-search-input" className="sr-only">
                {direction === "housing"
                  ? "Город или отель"
                  : direction === "transfers"
                    ? "Город, маршрут или автомобиль"
                    : "Город или место"}
              </label>
              <input
                id="home-search-input"
                ref={searchInputRef}
                name="search"
                autoComplete="off"
                placeholder={searchDemoLabel}
                aria-label={
                  direction === "housing"
                    ? "Город или отель"
                    : direction === "transfers"
                      ? "Город, маршрут или автомобиль"
                      : "Город или место"
                }
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isSearchDropdownOpen}
                aria-controls={homeSearchSuggestionsListboxId}
                aria-activedescendant={
                  activeSuggestionIndex >= 0 && searchDropdownOptions[activeSuggestionIndex]
                    ? getSearchOptionDomId(searchDropdownOptions[activeSuggestionIndex].key)
                    : undefined
                }
                value={searchValue}
                onFocus={() => openSearchDropdown()}
                onClick={() => openSearchDropdown()}
                onChange={(event) => {
                  const nextValue = event.target.value.slice(0, 120);
                  setSearchValue(nextValue);
                  setSelectedSuggestion(null);
                  setActiveSuggestionIndex(-1);
                  openSearchDropdown();
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    openSearchDropdown();
                    setActiveSuggestionIndex((prev) => {
                      if (searchDropdownOptions.length === 0) {
                        return -1;
                      }
                      if (prev < 0) {
                        return 0;
                      }
                      return (prev + 1) % searchDropdownOptions.length;
                    });
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    openSearchDropdown();
                    setActiveSuggestionIndex((prev) => {
                      if (searchDropdownOptions.length === 0) {
                        return -1;
                      }
                      if (prev < 0) {
                        return searchDropdownOptions.length - 1;
                      }
                      return (
                        (prev - 1 + searchDropdownOptions.length) % searchDropdownOptions.length
                      );
                    });
                    return;
                  }

                  if (event.key === "Enter") {
                    if (!isSearchDropdownOpen || activeSuggestionIndex < 0) {
                      return;
                    }

                    const option = searchDropdownOptions[activeSuggestionIndex];
                    if (!option) {
                      return;
                    }

                    event.preventDefault();
                    applySuggestionSelection(option);
                    return;
                  }

                  if (event.key === "Escape") {
                    closeSearchDropdown();
                    return;
                  }

                  if (event.key === "Tab") {
                    closeSearchDropdown();
                  }
                }}
                className="h-[62px] w-full rounded-2xl border border-sand bg-white px-4 text-base text-olive transition placeholder:text-olive/50 hover:border-olive/32 focus:outline-none focus:ring-2 focus:ring-primary/35"
              />

              {isSearchDropdownMounted ? (
                <div
                  className={cn(
                    "animated-popover absolute left-0 top-[calc(100%+8px)] z-40 w-full overflow-hidden rounded-2xl border border-sand bg-white shadow-[0_18px_36px_-22px_rgba(15,118,110,0.6)]",
                    isSearchDropdownOpen ? "popover-enter" : "popover-exit pointer-events-none",
                  )}
                >
                  <div
                    id={homeSearchSuggestionsListboxId}
                    role="listbox"
                    className="max-h-[380px] overflow-y-auto p-1.5"
                  >
                    {isSuggestionsLoading ? (
                      <div className="space-y-1 p-1">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div
                            key={`skeleton-${index}`}
                            className="h-12 animate-pulse rounded-xl bg-cream/70"
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    ) : null}

                    {!isSuggestionsLoading &&
                    !isSuggestionQueryMode &&
                    recentSuggestions.length > 0 ? (
                      <div className="pb-1">
                        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                          Ранее вы уже искали
                        </p>
                        <div className="space-y-1">
                          {recentSuggestions.map((item, index) =>
                            renderSuggestionButton("recent", item, index),
                          )}
                        </div>
                      </div>
                    ) : null}

                    {!isSuggestionsLoading &&
                    !isSuggestionQueryMode &&
                    shownPopularSuggestions.length > 0 ? (
                      <div className="pb-1">
                        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                          Популярные направления
                        </p>
                        <div className="space-y-1">
                          {shownPopularSuggestions.map((item, index) =>
                            renderSuggestionButton("popular", item, index),
                          )}
                        </div>
                      </div>
                    ) : null}

                    {!isSuggestionsLoading &&
                    isSuggestionQueryMode &&
                    shownMatchSuggestions.length > 0 ? (
                      <div className="pb-1">
                        {matchLocationSuggestionEntries.length > 0 ? (
                          <>
                            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                              Локации
                            </p>
                            <div className="space-y-1">
                              {matchLocationSuggestionEntries.map((entry) =>
                                renderSuggestionButton("matches", entry.item, entry.index),
                              )}
                            </div>
                          </>
                        ) : null}
                        {matchHotelSuggestionEntries.length > 0 ? (
                          <>
                            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                              Отели
                            </p>
                            <div className="space-y-1">
                              {matchHotelSuggestionEntries.map((entry) =>
                                renderSuggestionButton("matches", entry.item, entry.index),
                              )}
                            </div>
                          </>
                        ) : null}
                        {matchListingSuggestionEntries.length > 0 ? (
                          <>
                            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                              {listingSuggestionGroupLabel}
                            </p>
                            <div className="space-y-1">
                              {matchListingSuggestionEntries.map((entry) =>
                                renderSuggestionButton("matches", entry.item, entry.index),
                              )}
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    {!isSuggestionsLoading &&
                    !isSuggestionQueryMode &&
                    recentSuggestions.length === 0 &&
                    shownPopularSuggestions.length === 0 ? (
                      <p className="px-3 py-5 text-sm text-olive/65">
                        Начните вводить город, место или отель.
                      </p>
                    ) : null}

                    {!isSuggestionsLoading &&
                    isSuggestionQueryMode &&
                    shownMatchSuggestions.length === 0 ? (
                      <p className="px-3 py-5 text-sm text-olive/65">Ничего не найдено.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {usesDateGuests ? (
              <>
                <div ref={dateFieldRef} className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (openedPanel === "date") {
                        setHoverHousingDate("");
                        setOpenedPanel(null);
                        return;
                      }

                      closeAllPopovers("date");
                      clearDatePanelCloseTimer();
                      setIsDatePanelMounted(true);
                      setIsChildAgeSelectExpanded(false);
                      setOpenedPanel("date");
                    }}
                    aria-haspopup="dialog"
                    aria-expanded={openedPanel === "date"}
                    className="h-[62px] w-full rounded-2xl border border-sand bg-white px-4 text-left text-olive transition hover:border-olive/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/35"
                  >
                    <div className="truncate pr-12 text-sm font-semibold">{dateFieldValue}</div>
                    <CalendarIcon className="right-3.5" />
                  </button>

                  {isDatePanelMounted ? (
                    <>
                      <button
                        type="button"
                        className={cn(
                          "fixed inset-0 z-20 bg-primary/30 xl:hidden",
                          openedPanel === "date"
                            ? "popover-overlay-enter"
                            : "popover-overlay-exit pointer-events-none",
                        )}
                        onClick={closeDatePanelByOutside}
                        aria-label="Закрыть календарь"
                      />
                      <div
                        className={cn(
                          "animated-popover date-picker-sheet fixed inset-x-2 bottom-2 top-auto z-30 max-h-[88dvh] overflow-hidden overscroll-y-contain rounded-2xl border border-sand bg-white p-3 shadow-[0_-8px_32px_-8px_rgba(15,118,110,0.28)] min-[480px]:inset-x-4 min-[480px]:bottom-3 sm:inset-x-5 sm:p-4 md:inset-x-8 md:bottom-4 md:max-h-[84dvh] xl:absolute xl:bottom-auto xl:right-auto xl:left-0 xl:top-[calc(100%+8px)] xl:max-h-none xl:w-[min(92vw,840px)] xl:overflow-visible xl:rounded-2xl xl:p-4 xl:shadow-[0_18px_40px_-20px_rgba(15,118,110,0.55)]",
                          openedPanel === "date"
                            ? "popover-enter"
                            : "popover-exit pointer-events-none",
                        )}
                      >
                        {/* Mobile drag handle */}
                        <div
                          aria-hidden="true"
                          className="mx-auto mb-3 h-1 w-10 rounded-full bg-olive/20 xl:hidden"
                        />
                        <div className="grid gap-3 xl:grid-cols-[180px_minmax(0,1fr)]">
                          <aside className="hidden max-h-[420px] overflow-y-auto rounded-xl bg-cream/65 p-2 xl:block">
                            {calendarMonths.map((month) => (
                              <button
                                key={month.key}
                                type="button"
                                onClick={() => scrollToMonth(month.key)}
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
                              {direction === "housing" ? (
                                housingDates.checkIn && !housingDates.checkOut ? (
                                  <span>Выберите дату выезда</span>
                                ) : (
                                  <span>Выберите даты проживания</span>
                                )
                              ) : (
                                <span>Выберите дату экскурсии</span>
                              )}
                              {direction === "excursions" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsExcursionAnyDate(true);
                                    setExcursionDate("");
                                    setOpenedPanel(null);
                                    setIsChildAgeSelectExpanded(false);
                                  }}
                                  className={cn(
                                    "inline-flex min-h-10 items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                                    isExcursionAnyDate
                                      ? "bg-primary text-white"
                                      : "bg-white text-olive ring-1 ring-olive/15 hover:bg-cream",
                                  )}
                                >
                                  Любая дата
                                </button>
                              ) : null}
                            </div>

                            <div
                              ref={monthListRef}
                              className="max-h-[68dvh] touch-pan-y overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch] min-[480px]:max-h-[70dvh] md:max-h-[66dvh] xl:max-h-[410px]"
                              onMouseLeave={() => {
                                if (
                                  direction === "housing" &&
                                  housingDates.checkIn &&
                                  !housingDates.checkOut
                                ) {
                                  setHoverHousingDate("");
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
                                  <h3 className="text-sm font-semibold text-olive">
                                    {month.label}
                                  </h3>
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
                                      const isHousingStart =
                                        direction === "housing" && iso === housingDates.checkIn;
                                      const isHousingEnd =
                                        direction === "housing" && iso === housingPreviewCheckOut;
                                      const hasHousingRange =
                                        direction === "housing" &&
                                        Boolean(
                                          housingDates.checkIn &&
                                          housingPreviewCheckOut &&
                                          housingPreviewCheckOut > housingDates.checkIn,
                                        );
                                      const isHousingMiddle =
                                        direction === "housing" &&
                                        Boolean(
                                          housingDates.checkIn &&
                                          housingPreviewCheckOut &&
                                          iso > housingDates.checkIn &&
                                          iso < housingPreviewCheckOut,
                                        );
                                      const isExcursionSelected =
                                        direction === "excursions" &&
                                        !isExcursionAnyDate &&
                                        iso === excursionDate;
                                      const isSelected =
                                        isHousingStart || isHousingEnd || isExcursionSelected;
                                      const isHousingRangeStart = isHousingStart && hasHousingRange;
                                      const isHousingRangeEnd = isHousingEnd && hasHousingRange;
                                      const isHousingPreviewEnd =
                                        direction === "housing" &&
                                        !housingDates.checkOut &&
                                        isHousingRangeEnd;

                                      return (
                                        <button
                                          key={iso}
                                          type="button"
                                          disabled={isDisabled}
                                          onMouseEnter={() => {
                                            if (
                                              direction !== "housing" ||
                                              !housingDates.checkIn ||
                                              housingDates.checkOut ||
                                              isDisabled
                                            ) {
                                              return;
                                            }
                                            setHoverHousingDate(
                                              iso > housingDates.checkIn ? iso : "",
                                            );
                                          }}
                                          onFocus={() => {
                                            if (
                                              direction !== "housing" ||
                                              !housingDates.checkIn ||
                                              housingDates.checkOut ||
                                              isDisabled
                                            ) {
                                              return;
                                            }
                                            setHoverHousingDate(
                                              iso > housingDates.checkIn ? iso : "",
                                            );
                                          }}
                                          onClick={() =>
                                            direction === "housing"
                                              ? onHousingDateSelect(iso)
                                              : onExcursionDateSelect(iso)
                                          }
                                          className={cn(
                                            "h-10 touch-manipulation text-sm transition-all duration-200 ease-out min-[390px]:h-11 min-[480px]:h-12 xl:h-9",
                                            isSelected
                                              ? isHousingRangeStart
                                                ? "rounded-l-lg rounded-r-[4px] bg-primary font-semibold text-white shadow-[0_5px_14px_-8px_rgba(15,118,110,0.9)]"
                                                : isHousingRangeEnd
                                                  ? cn(
                                                      "rounded-r-lg rounded-l-[4px] font-semibold text-white shadow-[0_5px_14px_-8px_rgba(15,118,110,0.9)]",
                                                      isHousingPreviewEnd
                                                        ? "calendar-range-pulse bg-primary/92"
                                                        : "bg-primary",
                                                    )
                                                  : "rounded-lg bg-primary font-semibold text-white shadow-[0_5px_14px_-8px_rgba(15,118,110,0.9)]"
                                              : isHousingMiddle
                                                ? "rounded-none bg-foam text-olive"
                                                : isDisabled
                                                  ? "cursor-not-allowed rounded-lg text-olive/28"
                                                  : cell.isWeekend
                                                    ? "rounded-lg text-terra hover:bg-cream"
                                                    : "rounded-lg text-olive hover:bg-cream",
                                            iso === todayIso && !isSelected && !isHousingMiddle
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

                <div ref={guestsFieldRef} className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChildAgeSelectExpanded(false);
                      if (openedPanel === "guests") {
                        setOpenedPanel(null);
                        return;
                      }

                      closeAllPopovers("guests");
                      clearGuestsPanelCloseTimer();
                      setIsGuestsPanelMounted(true);
                      setOpenedPanel("guests");
                    }}
                    aria-haspopup="dialog"
                    aria-expanded={openedPanel === "guests"}
                    className="h-[62px] w-full rounded-2xl border border-sand bg-white px-4 text-left text-olive transition hover:border-olive/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/35"
                  >
                    <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-olive/72">
                      {guestsFieldLabel}
                    </span>
                    <span className="block truncate pr-12 text-sm font-semibold">
                      {guestsFieldValue}
                    </span>
                    <UserIcon className="right-3.5" />
                  </button>

                  {isGuestsPanelMounted ? (
                    <div
                      className={cn(
                        "absolute left-0 top-[calc(100%+8px)] z-30 w-full rounded-2xl border border-sand bg-white p-4 shadow-[0_18px_38px_-20px_rgba(15,118,110,0.58)] origin-top transition-all duration-200 ease-out md:right-0 md:left-auto md:w-[412px]",
                        openedPanel === "guests"
                          ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                          : "pointer-events-none opacity-0 scale-95 -translate-y-2",
                      )}
                    >
                      <h3 className="text-lg font-semibold text-olive">
                        {direction === "housing" ? "Гости" : "Участники"}
                      </h3>

                      <div className="mt-3 space-y-3">
                        <section className="rounded-xl border border-sand bg-cream p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-olive">Взрослые</p>
                              <p className="text-xs text-olive">от 18 лет</p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateAdults(direction, activeGuests.adults - 1)}
                                disabled={activeGuests.adults <= 1}
                                aria-label="Уменьшить количество взрослых"
                                className="h-10 w-10 rounded-full border border-sand bg-white text-lg leading-none text-olive transition enabled:hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-sm font-semibold text-olive">
                                {activeGuests.adults}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateAdults(direction, activeGuests.adults + 1)}
                                disabled={
                                  activeGuests.adults + activeGuests.childrenAges.length >=
                                  maxGuestsCount
                                }
                                aria-label="Увеличить количество взрослых"
                                className="h-10 w-10 rounded-full border border-sand bg-white text-lg leading-none text-olive transition enabled:hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </section>

                        <section className="rounded-xl border border-sand bg-cream p-3">
                          <p className="text-sm font-semibold text-olive">Дети</p>
                          <p className="mt-0.5 text-xs text-olive">
                            Возраст на момент выезда из отеля
                          </p>

                          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                            <div ref={childAgeSelectRef} className="relative">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsChildAgeSelectExpanded((prev) => !prev);
                                  setOpenedChildAgeDropdownKey(null);
                                }}
                                aria-haspopup="listbox"
                                aria-expanded={isChildAgeSelectExpanded}
                                className="flex h-10 w-full items-center justify-between rounded-xl border border-sand bg-white px-3 text-sm text-olive transition hover:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                              >
                                <span className="truncate">{pendingChildAgeLabel}</span>
                                <AppIcon
                                  icon={ChevronDown}
                                  className={cn(
                                    "h-4 w-4 transition-transform duration-200",
                                    isChildAgeSelectExpanded ? "rotate-180" : "",
                                  )}
                                />
                              </button>

                              <div
                                role="listbox"
                                className={cn(
                                  "animated-popover custom-scrollbar absolute left-0 top-[calc(100%+4px)] z-40 h-[160px] w-full overflow-y-auto rounded-xl border border-sand bg-white p-1.5 shadow-lg transition-all duration-300 ease-out",
                                  isChildAgeSelectExpanded
                                    ? "visible translate-y-0 opacity-100 pointer-events-auto"
                                    : "invisible -translate-y-[10px] opacity-0 pointer-events-none",
                                )}
                              >
                                <div className="flex flex-col gap-0.5">
                                  {Array.from({ length: 18 }, (_, age) => {
                                    const value = String(age);
                                    const isSelected = value === pendingChildAgeValue;

                                    return (
                                      <button
                                        key={`child-age-${age}`}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => {
                                          setPendingChildAge(direction, value);
                                          setIsChildAgeSelectExpanded(false);
                                        }}
                                        className={cn(
                                          "cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-olive transition active:bg-sand/30",
                                          isSelected ? "bg-cream" : "hover:bg-cream",
                                        )}
                                      >
                                        {formatChildAgeOption(age)}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => addChild(direction, pendingChildAgeValue)}
                              disabled={
                                !pendingChildAgeValue ||
                                activeGuests.adults + activeGuests.childrenAges.length >=
                                  maxGuestsCount
                              }
                              className="h-10 rounded-xl border border-sand bg-white px-3 text-sm font-semibold text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              Добавить
                            </button>
                          </div>

                          <div className="mt-2 space-y-2">
                            {activeGuests.childrenAges.length === 0 ? (
                              <p className="text-xs text-olive">Дети не добавлены</p>
                            ) : (
                              <div ref={childAgeRowsRef} className="space-y-2">
                                {activeGuests.childrenAges.map((age, index) => {
                                  const ageKey = `${direction}-${index}`;
                                  const isAgeDropdownOpen = openedChildAgeDropdownKey === ageKey;

                                  return (
                                    <div
                                      key={`child-${direction}-${index}`}
                                      className="grid grid-cols-[1fr_minmax(0,120px)_auto] items-center gap-2 rounded-lg bg-white px-2 py-1.5"
                                    >
                                      <span className="text-xs font-medium text-olive">
                                        Ребенок {index + 1}
                                      </span>

                                      <div className="relative">
                                        <button
                                          type="button"
                                          aria-haspopup="listbox"
                                          aria-expanded={isAgeDropdownOpen}
                                          onClick={() => {
                                            setIsChildAgeSelectExpanded(false);
                                            setOpenedChildAgeDropdownKey((prev) =>
                                              prev === ageKey ? null : ageKey,
                                            );
                                          }}
                                          className="flex h-8 w-full items-center justify-between rounded-lg border border-sand bg-white px-2 text-xs text-olive outline-none transition hover:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                                        >
                                          <span className="truncate">
                                            {formatChildAgeOption(age)}
                                          </span>
                                          <AppIcon
                                            icon={ChevronDown}
                                            className={cn(
                                              "ml-1 h-4 w-4 shrink-0 transition-transform duration-200",
                                              isAgeDropdownOpen ? "rotate-180" : "",
                                            )}
                                          />
                                        </button>

                                        <div
                                          role="listbox"
                                          className={cn(
                                            "animated-popover custom-scrollbar absolute left-0 top-[calc(100%+4px)] z-40 h-[160px] w-full overflow-y-auto rounded-xl border border-sand bg-white p-1.5 shadow-lg transition-all duration-300 ease-out",
                                            isAgeDropdownOpen
                                              ? "visible translate-y-0 opacity-100 pointer-events-auto"
                                              : "invisible -translate-y-[10px] opacity-0 pointer-events-none",
                                          )}
                                        >
                                          <div className="flex flex-col gap-0.5">
                                            {Array.from({ length: 18 }, (_, ageOption) => {
                                              const optionValue = String(ageOption);
                                              const isSelected = ageOption === age;

                                              return (
                                                <button
                                                  key={`child-age-option-${direction}-${index}-${ageOption}`}
                                                  type="button"
                                                  role="option"
                                                  aria-selected={isSelected}
                                                  onClick={() => {
                                                    updateChildAge(direction, index, optionValue);
                                                    setOpenedChildAgeDropdownKey(null);
                                                  }}
                                                  className={cn(
                                                    "cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-olive transition active:bg-sand/30",
                                                    isSelected ? "bg-cream" : "hover:bg-cream",
                                                  )}
                                                >
                                                  {formatChildAgeOption(ageOption)}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenedChildAgeDropdownKey((prev) =>
                                            prev === ageKey ? null : prev,
                                          );
                                          removeChild(direction, index);
                                        }}
                                        aria-label={`Удалить ребенка ${index + 1}`}
                                        className="h-8 rounded-lg border border-terra bg-white px-2 text-xs font-semibold text-terra transition hover:bg-foam"
                                      >
                                        Удалить
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </section>
                      </div>

                      <Button
                        type="button"
                        onClick={() => {
                          setOpenedPanel(null);
                          setIsChildAgeSelectExpanded(false);
                        }}
                        className="mt-3 h-10 w-full rounded-xl"
                      >
                        Готово
                      </Button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            <Button
              type="submit"
              className="h-[62px] w-full rounded-2xl text-base"
              disabled={isLocationEmpty}
            >
              Найти
            </Button>
          </div>

          {/* ── Distance row: slides in for geo-based catalogs ── */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
              usesRadius ? "mt-3 max-h-20 opacity-100" : "max-h-0 opacity-0 pointer-events-none",
            )}
          >
            <div className="flex items-center gap-3 px-1">
              <span className="flex shrink-0 items-center gap-1.5 text-sm text-olive/55">
                <AppIcon icon={LocateFixed} className="h-4 w-4 shrink-0" />
                Радиус
              </span>
              {/* Segmented control track */}
              <div className="flex flex-1 rounded-2xl bg-olive/[0.07] p-[3px] ring-1 ring-olive/[0.09]">
                <div className="relative flex flex-1">
                  {/* Animated sliding pill */}
                  <div
                    className="pointer-events-none absolute inset-y-0 rounded-[13px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] transition-all duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                    style={{
                      width: `${100 / radiusOptions.length}%`,
                      left: `${radiusOptions.indexOf(excursionRadius as (typeof radiusOptions)[number]) * (100 / radiusOptions.length)}%`,
                    }}
                  />
                  {radiusOptions.map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => setExcursionRadius(km)}
                      className={cn(
                        "relative z-10 flex-1 min-h-10 min-w-10 py-2 text-center text-sm font-semibold",
                        "cursor-pointer rounded-[13px] outline-none",
                        "transition-colors duration-200",
                        "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1",
                        excursionRadius === km
                          ? "text-primary"
                          : "text-olive/45 hover:text-olive/70",
                      )}
                    >
                      {km}
                      <span className="ml-0.5 text-[0.68rem] font-medium opacity-55">км</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </form>
      </section>

      {renderMobileSearchModal()}

      <div className="mx-auto mt-6 flex max-w-5xl justify-center px-2">
        <Link
          href={contestPagePath}
          className="relative isolate inline-flex min-h-14 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-center text-base font-bold text-white shadow-[0_16px_36px_rgba(58,43,35,0.18)] shadow-primary/20 ring-1 ring-white/40 transition hover:bg-primary-hover hover:shadow-primary/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 sm:w-auto sm:min-w-72"
        >
          <span
            aria-hidden="true"
            className="absolute -inset-1 -z-10 rounded-[1.35rem] bg-primary/35 blur-sm motion-safe:animate-ping"
          />
          <AppIcon icon={Sparkles} className="h-5 w-5 text-white" />
          Разместиться бесплатно
        </Link>
      </div>

      {/* ── Why choose us ── */}
      <div className="mx-auto mt-6 max-w-5xl">
        <h2 className="mb-4 text-center font-heading text-xl text-midnight sm:text-2xl md:text-3xl">
          Почему выбирают «Крым Вокруг»?
        </h2>
        <div
          className="-mx-4 snap-x snap-mandatory overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
          aria-label="Преимущества"
        >
          <div className="flex w-max gap-3 sm:grid sm:w-full sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1 */}
            <div className="group relative w-[min(82vw,320px)] shrink-0 snap-start overflow-hidden rounded-2xl bg-white/80 p-5 ring-1 ring-olive/10 transition-shadow hover:shadow-lg hover:ring-olive/20 sm:w-auto">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <AppIcon icon={ShieldCheck} className="h-6 w-6 text-[color:var(--icon-stay)]" />
              </div>
              <h3 className="text-base font-bold text-midnight">Только проверенные объявления</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-olive/70">
                Каждый объект проходит ручную модерацию с видео-верификацией. Мы лично знаем многих
                владельцев жилья в Крыму.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group relative w-[min(82vw,320px)] shrink-0 snap-start overflow-hidden rounded-2xl bg-white/80 p-5 ring-1 ring-olive/10 transition-shadow hover:shadow-lg hover:ring-olive/20 sm:w-auto">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-terra/10 text-terra transition-transform group-hover:scale-110">
                <AppIcon icon={Phone} className="h-6 w-6 text-[color:var(--icon-location)]" />
              </div>
              <h3 className="text-base font-bold text-midnight">Без посредников и комиссий</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-olive/70">
                Общайтесь с владельцем напрямую по телефону или мессенджеру. Мы не берём комиссию —
                вы экономите!
              </p>
            </div>

            {/* Card 3 */}
            <div className="group relative w-[min(82vw,320px)] shrink-0 snap-start overflow-hidden rounded-2xl bg-white/80 p-5 ring-1 ring-olive/10 transition-shadow hover:shadow-lg hover:ring-olive/20 sm:col-span-2 sm:w-auto lg:col-span-1">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-success/10 text-success transition-transform group-hover:scale-110">
                <AppIcon icon={Globe2} className="h-6 w-6 text-[color:var(--icon-site)]" />
              </div>
              <h3 className="text-base font-bold text-midnight">Большой выбор по всему Крыму</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-olive/70">
                {housingStat.value} {housingStat.label}, {excursionStat.value} {excursionStat.label}{" "}
                и {locationSuggestions.length} {locationCountLabel} — всё на одном сайте.
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-5 rounded-[2rem] bg-sand/90 px-4 py-8 ring-1 ring-olive/12 md:px-8 md:py-10 lg:px-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl text-midnight md:text-3xl">Популярные города</h2>
            <p className="mt-1 text-sm text-olive/60 md:text-base">
              Выберите направление для путешествия
            </p>
          </div>
        </div>

        <div className="mt-6 -mx-4 snap-x snap-mandatory overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:snap-none md:overflow-visible md:px-0 md:pb-0">
          <div className="flex w-max gap-3 xs:gap-4 md:grid md:w-full md:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {cities.map((city, cityIndex) => {
              const price =
                direction === "housing" ? city.housingPriceFrom : city.excursionPriceFrom;
              const href = buildCityHref({
                direction,
                locationId: city.locationId,
                locationName: city.locationName,
              });

              return (
                <Link
                  key={city.key}
                  href={href}
                  className="group relative block w-[240px] shrink-0 snap-start overflow-hidden rounded-[36px] transition duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20 xs:w-[260px] md:w-full md:snap-align-none md:rounded-[44px]"
                >
                  <div className="relative aspect-[3/4] w-full bg-cream">
                    <Image
                      src={city.imageSrc}
                      alt={city.title}
                      fill
                      sizes="(max-width: 767px) 220px, (max-width: 1023px) 48vw, (max-width: 1279px) 32vw, 25vw"
                      priority={cityIndex < 4}
                      className="object-cover object-center transition duration-500 group-hover:scale-[1.06]"
                    />
                    {/* gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-midnight/75 via-midnight/15 to-transparent" />
                    {/* arrow badge */}
                    <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-sm transition duration-300 group-hover:opacity-100">
                      <AppIcon icon={ArrowUpRight} className="h-4 w-4 text-white" />
                    </div>
                    {/* city info on image */}
                    <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                      <p className="text-xl font-semibold leading-tight text-white md:text-2xl">
                        {city.title}
                      </p>
                      <p className="mt-1 text-sm text-white/70">
                        {formatCardPrice(price, direction)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

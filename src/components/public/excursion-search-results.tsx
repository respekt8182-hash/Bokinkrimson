"use client";

import {
  ArrowDown,
  ChevronDown,
  Clock3,
  LoaderCircle,
  MapPin,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import {
  YandexMapMultiViewer,
  type YandexMapPoint,
  type YandexMapRadiusCircle,
} from "@/components/maps/yandex-map-multi-viewer";
import type {
  PublicExcursionCatalogItem,
  PublicExcursionCatalogResult,
} from "@/lib/public-excursions";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterSectionKey =
  | "search"
  | "location"
  | "district"
  | "category"
  | "date"
  | "participants"
  | "format"
  | "duration"
  | "price"
  | "radius"
  | "extra"
  | "sort";

export type ExcursionSearchResultsProps = {
  items: PublicExcursionCatalogItem[];
  filters: PublicExcursionCatalogResult["filters"];
  pagination: { page: number; totalPages: number; total: number };
  districts: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
  locationNames: string[];
};

type ExcursionLocationSuggestionSection = "recent" | "popular" | "matches";

type ExcursionLocationSuggestionItem = {
  type: "location";
  id: string;
  name: string;
  subtitle: string;
};

type ExcursionLocationDropdownOption = {
  key: string;
  section: ExcursionLocationSuggestionSection;
  item: ExcursionLocationSuggestionItem;
};

type ExcursionLocationSuggestionsPayload = {
  popular: ExcursionLocationSuggestionItem[];
  matches: ExcursionLocationSuggestionItem[];
};

type ExcursionRecentStorageEntry = {
  type?: string;
  id?: string;
  name?: string;
  direction?: string;
  checkIn?: string;
  isAnyDate?: boolean;
  guests?: number;
  timestamp?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const rubFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatMoney(value: number): string {
  return `${rubFormatter.format(Math.round(value))} ₽`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} мин`;
  if (mins === 0) return `${hours} ч`;
  return `${hours} ч ${mins} мин`;
}

function pluralizeReviews(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${count} отзывов`;
  if (mod10 === 1) return `${count} отзыв`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} отзыва`;
  return `${count} отзывов`;
}

function buildSearchUrl(params: Record<string, string>): string {
  const query = new URLSearchParams({ direction: "excursions" });
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return `/search?${query.toString()}`;
}

const excursionLocationSuggestionsListboxId = "exc-search-suggestions-listbox";
const mobileExcursionLocationSuggestionsListboxId = "mob-exc-search-suggestions-listbox";
const excursionLocationRecentStorageKey = "boking.home_search_recent_v1";
const excursionLocationRecentLimit = 4;
const excursionLocationSuggestionsCacheTtlMs = 8 * 60_000;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

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

function normalizeLocationText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function normalizeStoredIsoDate(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  return isoDatePattern.test(normalized) ? normalized : "";
}

function formatDayMonth(iso: string): string {
  const [yearRaw, monthRaw, dayRaw] = iso.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return "";
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return "";
  }

  return `${day} ${monthNamesGenitive[month - 1]}`;
}

function pluralizeParticipants(value: number): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;
  if (abs > 10 && abs < 20) {
    return "участников";
  }
  if (mod > 1 && mod < 5) {
    return "участника";
  }
  if (mod === 1) {
    return "участник";
  }
  return "участников";
}

function formatExcursionRecentLocationSubtitle(input: {
  checkIn: string;
  isAnyDate: boolean;
  guests: number;
}): string {
  const normalizedGuests = Number.isFinite(input.guests) ? Math.max(1, Math.round(input.guests)) : 2;
  const guestsLabel = `${normalizedGuests} ${pluralizeParticipants(normalizedGuests)}`;

  if (input.isAnyDate) {
    return `Любая дата, ${guestsLabel}`;
  }

  if (input.checkIn) {
    const formattedDate = formatDayMonth(input.checkIn);
    if (formattedDate) {
      return `${formattedDate}, ${guestsLabel}`;
    }
  }

  return `Без даты, ${guestsLabel}`;
}

function parseExcursionRecentLocationSuggestions(raw: string): ExcursionLocationSuggestionItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const suggestions: ExcursionLocationSuggestionItem[] = [];
  const seenNames = new Set<string>();

  const sorted = parsed
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const candidate = entry as ExcursionRecentStorageEntry;
      return {
        type: candidate.type === "location" ? "location" : "",
        direction: candidate.direction === "excursions" ? "excursions" : "",
        id: typeof candidate.id === "string" ? candidate.id.trim() : "",
        name: typeof candidate.name === "string" ? candidate.name.trim() : "",
        checkIn: normalizeStoredIsoDate(candidate.checkIn),
        isAnyDate: Boolean(candidate.isAnyDate),
        guests: typeof candidate.guests === "number" ? candidate.guests : 2,
        timestamp:
          typeof candidate.timestamp === "number" && Number.isFinite(candidate.timestamp)
            ? candidate.timestamp
            : 0,
      };
    })
    .sort((left, right) => right.timestamp - left.timestamp);

  for (const entry of sorted) {
    if (entry.type !== "location" || entry.direction !== "excursions" || !entry.name) {
      continue;
    }

    const normalizedName = normalizeLocationText(entry.name);
    if (!normalizedName || seenNames.has(normalizedName)) {
      continue;
    }
    seenNames.add(normalizedName);

    suggestions.push({
      type: "location",
      id: entry.id || normalizedName,
      name: entry.name,
      subtitle: formatExcursionRecentLocationSubtitle({
        checkIn: entry.checkIn,
        isAnyDate: entry.isAnyDate,
        guests: entry.guests,
      }),
    });

    if (suggestions.length >= excursionLocationRecentLimit) {
      break;
    }
  }

  return suggestions;
}

function parseExcursionLocationSuggestionsPayload(raw: unknown): ExcursionLocationSuggestionsPayload {
  const fallback: ExcursionLocationSuggestionsPayload = {
    popular: [],
    matches: [],
  };

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const payload = raw as Partial<{
    popular: unknown;
    matches: unknown;
  }>;

  const parseList = (value: unknown): ExcursionLocationSuggestionItem[] =>
    Array.isArray(value)
      ? value
          .map((item) => {
            if (!item || typeof item !== "object") {
              return null;
            }

            const candidate = item as Partial<{
              type: string;
              id: string;
              name: string;
              subtitle: string;
            }>;

            if (
              candidate.type !== "location" ||
              typeof candidate.id !== "string" ||
              typeof candidate.name !== "string"
            ) {
              return null;
            }

            const id = candidate.id.trim();
            const name = candidate.name.trim();
            if (!id || !name) {
              return null;
            }

            return {
              type: "location",
              id,
              name,
              subtitle: typeof candidate.subtitle === "string" ? candidate.subtitle.trim() : "",
            } satisfies ExcursionLocationSuggestionItem;
          })
          .filter((item): item is ExcursionLocationSuggestionItem => Boolean(item))
      : [];

  return {
    popular: parseList(payload.popular),
    matches: parseList(payload.matches),
  };
}

function getExcursionLocationOptionDomId(scope: "desktop" | "mobile", optionKey: string): string {
  return `${scope}-exc-search-option-${optionKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function renderHighlightedLocationText(text: string, query: string): React.ReactNode {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return text;
  }

  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexp = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(regexp);

  if (parts.length <= 1) {
    return text;
  }

  return parts.map((part, index) =>
    part.toLowerCase() === normalizedQuery.toLowerCase() ? (
      <mark key={`exc-location-mark-${index}`} className="bg-transparent font-semibold text-olive">
        {part}
      </mark>
    ) : (
      <span key={`exc-location-text-${index}`}>{part}</span>
    ),
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Рейтинг ${rating.toFixed(1)}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <AppIcon
          key={i}
          className={cn(
            "h-3 w-3 shrink-0",
            i < full
              ? "text-amber-400"
              : i === full && half
                ? "text-amber-300"
                : "text-olive/20",
          )}
          icon={Star}
          filled
        />
      ))}
    </span>
  );
}

function FilterSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-olive/10 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-olive hover:bg-olive/5 transition-colors"
      >
        {label}
        <AppIcon
          icon={ChevronDown}
          className={cn("h-4 w-4 text-olive/50 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          open ? "max-h-[640px] opacity-100 overflow-visible" : "max-h-0 opacity-0 overflow-hidden",
        )}
      >
        <div className="px-4 pb-4 space-y-2">{children}</div>
      </div>
    </div>
  );
}

function ActiveFilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
        aria-label={`Убрать фильтр ${label}`}
      >
        <AppIcon icon={X} className="h-3 w-3" />
      </button>
    </span>
  );
}

function ClockIcon(props: { className?: string }) {
  return <AppIcon icon={Clock3} className={props.className} />;
}

function LocationPinIcon(props: { className?: string }) {
  return <AppIcon icon={MapPin} className={props.className} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExcursionSearchResults({
  items,
  filters,
  pagination,
  districts,
  categories,
  locationNames,
}: ExcursionSearchResultsProps) {
  const router = useRouter();

  // ── Filter state (mirrors URL params, user edits locally then submits) ──────
  const [query, setQuery] = useState(filters.query ?? "");
  const [location, setLocation] = useState(filters.locationName ?? "");
  const [district, setDistrict] = useState(filters.districtSlug ?? "");
  const [category, setCategory] = useState(filters.categorySlug ?? "");
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [guests, setGuests] = useState(String(filters.people ?? 2));
  const [format, setFormat] = useState(filters.format ?? "");
  const [durationBucket, setDurationBucket] = useState(filters.durationBucket ?? "");
  const [minPrice, setMinPrice] = useState(filters.minPrice ? String(filters.minPrice) : "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice ? String(filters.maxPrice) : "");
  const [radiusKm, setRadiusKm] = useState(String(filters.radiusKm));
  const [pickup, setPickup] = useState(filters.pickup ?? false);
  const [kids, setKids] = useState(filters.kids ?? false);
  const [sort, setSort] = useState(filters.sort === "relevance" ? "" : filters.sort);

  // ── Sidebar open/closed sections ────────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Set<FilterSectionKey>>(
    new Set(["search", "location", "radius"]),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // One shared dropdown mode keeps keyboard navigation logic identical for desktop and mobile.
  const [activeLocationDropdown, setActiveLocationDropdown] = useState<"desktop" | "mobile" | null>(
    null,
  );
  const [isLocationSuggestionsLoading, setIsLocationSuggestionsLoading] = useState(false);
  const [locationRecentSuggestions, setLocationRecentSuggestions] = useState<
    ExcursionLocationSuggestionItem[]
  >([]);
  const [locationPopularSuggestions, setLocationPopularSuggestions] = useState<
    ExcursionLocationSuggestionItem[]
  >([]);
  const [locationMatchSuggestions, setLocationMatchSuggestions] = useState<
    ExcursionLocationSuggestionItem[]
  >([]);
  const [activeLocationSuggestionIndex, setActiveLocationSuggestionIndex] = useState(-1);
  const desktopLocationComboboxRef = useRef<HTMLDivElement | null>(null);
  const desktopLocationInputRef = useRef<HTMLInputElement | null>(null);
  const mobileLocationComboboxRef = useRef<HTMLDivElement | null>(null);
  const mobileLocationInputRef = useRef<HTMLInputElement | null>(null);
  const locationSuggestionsCacheRef = useRef<
    Map<string, { payload: ExcursionLocationSuggestionsPayload; expiresAt: number }>
  >(new Map());

  // ── Load-more state ──────────────────────────────────────────────────────────
  const [displayItems, setDisplayItems] = useState<PublicExcursionCatalogItem[]>(items);
  const [loadedPage, setLoadedPage] = useState(pagination.page);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const hasMore = loadedPage < pagination.totalPages;
  const remaining = pagination.total - displayItems.length;

  // ── Map state ────────────────────────────────────────────────────────────────
  const [isMapActivated, setIsMapActivated] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  // ── Card refs for scroll-to-card on pin hover ────────────────────────────────
  const cardRefsMap = useRef<Map<string, HTMLElement>>(new Map());

  // Keep local form controls in sync with applied URL filters after navigation.
  useEffect(() => {
    setQuery(filters.query ?? "");
    setLocation(filters.locationName ?? "");
    setDistrict(filters.districtSlug ?? "");
    setCategory(filters.categorySlug ?? "");
    setDateFrom(filters.dateFrom ?? "");
    setGuests(String(filters.people ?? 2));
    setFormat(filters.format ?? "");
    setDurationBucket(filters.durationBucket ?? "");
    setMinPrice(filters.minPrice ? String(filters.minPrice) : "");
    setMaxPrice(filters.maxPrice ? String(filters.maxPrice) : "");
    setRadiusKm(String(filters.radiusKm));
    setPickup(filters.pickup ?? false);
    setKids(filters.kids ?? false);
    setSort(filters.sort === "relevance" ? "" : filters.sort);
    setActiveLocationDropdown(null);
    setActiveLocationSuggestionIndex(-1);
  }, [
    filters.query,
    filters.locationName,
    filters.districtSlug,
    filters.categorySlug,
    filters.dateFrom,
    filters.people,
    filters.format,
    filters.durationBucket,
    filters.minPrice,
    filters.maxPrice,
    filters.radiusKm,
    filters.pickup,
    filters.kids,
    filters.sort,
  ]);

  // Reset visible items when server returns a new search page.
  useEffect(() => {
    setDisplayItems(items);
    setLoadedPage(pagination.page);
    setIsLoadingMore(false);
    setHoveredCardId(null);
    setHoveredPinId(null);
    cardRefsMap.current.clear();
  }, [items, pagination.page]);

  const toggleSection = useCallback((key: FilterSectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const isLocationQueryMode = location.trim().length > 0;
  const locationDropdownOptions = useMemo<ExcursionLocationDropdownOption[]>(() => {
    const options: ExcursionLocationDropdownOption[] = [];

    // Empty query: show history + popular places. Typed query: show only matched places.
    if (!isLocationQueryMode) {
      for (const [index, item] of locationRecentSuggestions.entries()) {
        options.push({
          key: `recent:location:${item.id}:${index}`,
          section: "recent",
          item,
        });
      }
      for (const [index, item] of locationPopularSuggestions.entries()) {
        options.push({
          key: `popular:location:${item.id}:${index}`,
          section: "popular",
          item,
        });
      }
      return options;
    }

    for (const [index, item] of locationMatchSuggestions.entries()) {
      options.push({
        key: `matches:location:${item.id}:${index}`,
        section: "matches",
        item,
      });
    }

    return options;
  }, [
    isLocationQueryMode,
    locationMatchSuggestions,
    locationPopularSuggestions,
    locationRecentSuggestions,
  ]);
  const locationDropdownOptionIndexByKey = useMemo(
    () =>
      new Map(locationDropdownOptions.map((option, index) => [option.key, index])),
    [locationDropdownOptions],
  );
  const activeLocationOption = locationDropdownOptions[activeLocationSuggestionIndex] ?? null;
  const activeDesktopLocationOptionId =
    activeLocationDropdown === "desktop" && activeLocationOption
      ? getExcursionLocationOptionDomId("desktop", activeLocationOption.key)
      : undefined;
  const activeMobileLocationOptionId =
    activeLocationDropdown === "mobile" && activeLocationOption
      ? getExcursionLocationOptionDomId("mobile", activeLocationOption.key)
      : undefined;
  const isDesktopLocationDropdownVisible = activeLocationDropdown === "desktop";
  const isMobileLocationDropdownVisible = activeLocationDropdown === "mobile";

  useEffect(() => {
    setActiveLocationSuggestionIndex((prev) =>
      prev >= locationDropdownOptions.length ? -1 : prev,
    );
  }, [locationDropdownOptions.length]);

  useEffect(() => {
    if (!activeLocationDropdown) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(excursionLocationRecentStorageKey);
      if (!raw) {
        setLocationRecentSuggestions([]);
        return;
      }

      setLocationRecentSuggestions(parseExcursionRecentLocationSuggestions(raw));
    } catch {
      setLocationRecentSuggestions([]);
    }
  }, [activeLocationDropdown]);

  useEffect(() => {
    if (!activeLocationDropdown) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        desktopLocationComboboxRef.current?.contains(target) ||
        mobileLocationComboboxRef.current?.contains(target)
      ) {
        return;
      }

      setActiveLocationDropdown(null);
      setActiveLocationSuggestionIndex(-1);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [activeLocationDropdown]);

  useEffect(() => {
    if (!activeLocationDropdown) {
      return;
    }

    // Cache + debounce + abort prevents extra network traffic while typing.
    const query = location.trim().slice(0, 120);
    const cacheKey = `exc-location|${query.toLowerCase()}`;
    const cached = locationSuggestionsCacheRef.current.get(cacheKey);
    const fallbackPopular = locationNames.slice(0, 12).map((name, index) => ({
      type: "location" as const,
      id: `fallback:${normalizeLocationText(name) || index}`,
      name,
      subtitle: "Крым, Россия",
    }));

    if (cached && cached.expiresAt > Date.now()) {
      setLocationPopularSuggestions(
        cached.payload.popular.length > 0 ? cached.payload.popular : fallbackPopular,
      );
      setLocationMatchSuggestions(cached.payload.matches);
      setIsLocationSuggestionsLoading(false);
      return;
    }

    const abortController = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLocationSuggestionsLoading(true);

      try {
        const params = new URLSearchParams({
          direction: "excursions",
          include: "locations",
          query,
          limit: "12",
        });
        const response = await fetch(`/api/search/suggestions?${params.toString()}`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          return;
        }

        const payload = parseExcursionLocationSuggestionsPayload(await response.json());
        locationSuggestionsCacheRef.current.set(cacheKey, {
          payload,
          expiresAt: Date.now() + excursionLocationSuggestionsCacheTtlMs,
        });
        setLocationPopularSuggestions(
          payload.popular.length > 0 ? payload.popular : fallbackPopular,
        );
        setLocationMatchSuggestions(payload.matches);
      } catch {
        // Ignore transient autocomplete fetch errors.
      } finally {
        setIsLocationSuggestionsLoading(false);
      }
    }, query.length === 0 ? 0 : 220);

    return () => {
      abortController.abort();
      window.clearTimeout(timer);
    };
  }, [activeLocationDropdown, location, locationNames]);

  useEffect(() => {
    if (!activeLocationDropdown || activeLocationSuggestionIndex < 0) {
      return;
    }

    const option = locationDropdownOptions[activeLocationSuggestionIndex];
    if (!option) {
      return;
    }

    const node = document.getElementById(
      getExcursionLocationOptionDomId(activeLocationDropdown, option.key),
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [activeLocationDropdown, activeLocationSuggestionIndex, locationDropdownOptions]);

  const commitRecentExcursionLocation = useCallback(
    (locationName: string) => {
      const trimmedName = locationName.trim();
      if (!trimmedName) {
        return;
      }

      const normalizedName = normalizeLocationText(trimmedName);
      if (!normalizedName) {
        return;
      }

      const parsedGuests = Number.parseInt(guests, 10);
      const safeGuests = Number.isFinite(parsedGuests)
        ? Math.max(1, Math.min(40, parsedGuests))
        : 2;
      const nextEntry = {
        type: "location",
        id: normalizedName.slice(0, 120),
        name: trimmedName.slice(0, 120),
        locationId: null,
        direction: "excursions",
        checkIn: normalizeStoredIsoDate(dateFrom),
        checkOut: "",
        isAnyDate: false,
        guests: safeGuests,
        timestamp: Date.now(),
      };

      try {
        const raw = window.localStorage.getItem(excursionLocationRecentStorageKey);
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        const entries = Array.isArray(parsed) ? parsed : [];
        // Keep only one recent entry per normalized location name.
        const deduped = entries.filter((entry) => {
          if (!entry || typeof entry !== "object") {
            return true;
          }

          const candidate = entry as ExcursionRecentStorageEntry;
          if (candidate.direction !== "excursions" || candidate.type !== "location") {
            return true;
          }

          const candidateName =
            typeof candidate.name === "string" ? normalizeLocationText(candidate.name) : "";
          return candidateName !== normalizedName;
        });

        const updated = [nextEntry, ...deduped].slice(0, 20);
        const serialized = JSON.stringify(updated);
        window.localStorage.setItem(excursionLocationRecentStorageKey, serialized);
        setLocationRecentSuggestions(parseExcursionRecentLocationSuggestions(serialized));
      } catch {
        // Ignore storage write errors to keep filtering responsive.
      }
    },
    [dateFrom, guests],
  );

  const applyLocationSuggestion = useCallback(
    (item: ExcursionLocationSuggestionItem) => {
      setLocation(item.name);
      commitRecentExcursionLocation(item.name);
      const source = activeLocationDropdown;
      setActiveLocationDropdown(null);
      setActiveLocationSuggestionIndex(-1);

      if (source === "mobile") {
        mobileLocationInputRef.current?.focus();
      } else {
        desktopLocationInputRef.current?.focus();
      }
    },
    [activeLocationDropdown, commitRecentExcursionLocation],
  );

  const handleLocationInputKeyDown = useCallback(
    (scope: "desktop" | "mobile", event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveLocationDropdown(scope);
        if (locationDropdownOptions.length === 0) {
          return;
        }
        setActiveLocationSuggestionIndex((prev) =>
          prev < 0 ? 0 : (prev + 1) % locationDropdownOptions.length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveLocationDropdown(scope);
        if (locationDropdownOptions.length === 0) {
          return;
        }
        setActiveLocationSuggestionIndex((prev) =>
          prev < 0
            ? locationDropdownOptions.length - 1
            : (prev - 1 + locationDropdownOptions.length) % locationDropdownOptions.length,
        );
        return;
      }

      if (
        event.key === "Enter" &&
        activeLocationDropdown === scope &&
        activeLocationSuggestionIndex >= 0
      ) {
        const option = locationDropdownOptions[activeLocationSuggestionIndex];
        if (!option) {
          return;
        }
        event.preventDefault();
        applyLocationSuggestion(option.item);
        return;
      }

      if (event.key === "Escape") {
        setActiveLocationDropdown(null);
        setActiveLocationSuggestionIndex(-1);
        return;
      }

      if (event.key === "Tab") {
        setActiveLocationDropdown(null);
        setActiveLocationSuggestionIndex(-1);
      }
    },
    [
      activeLocationDropdown,
      activeLocationSuggestionIndex,
      applyLocationSuggestion,
      locationDropdownOptions,
    ],
  );

  const renderLocationSuggestionButton = useCallback(
    (
      scope: "desktop" | "mobile",
      section: ExcursionLocationSuggestionSection,
      item: ExcursionLocationSuggestionItem,
      index: number,
    ) => {
      const optionKey = `${section}:location:${item.id}:${index}`;
      const optionIndex = locationDropdownOptionIndexByKey.get(optionKey);
      if (optionIndex === undefined) {
        return null;
      }

      const isActive =
        activeLocationDropdown === scope &&
        optionIndex === activeLocationSuggestionIndex;
      const icon =
        section === "recent" ? <ClockIcon className="h-4 w-4" /> : <LocationPinIcon className="h-4 w-4" />;
      const nameContent =
        section === "matches"
          ? renderHighlightedLocationText(item.name, location)
          : item.name;

      return (
        <button
          id={getExcursionLocationOptionDomId(scope, optionKey)}
          key={optionKey}
          type="button"
          role="option"
          aria-selected={isActive}
          onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
          onClick={() => applyLocationSuggestion(item)}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
            isActive ? "bg-cream" : "hover:bg-cream",
          )}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-olive/70">
            {icon}
          </span>
          <span className="block min-w-0">
            <span className="block truncate text-sm font-semibold text-olive">{nameContent}</span>
            {item.subtitle ? <span className="block truncate text-xs text-olive/64">{item.subtitle}</span> : null}
          </span>
        </button>
      );
    },
    [
      activeLocationDropdown,
      activeLocationSuggestionIndex,
      applyLocationSuggestion,
      location,
      locationDropdownOptionIndexByKey,
    ],
  );

  // ── Map points ───────────────────────────────────────────────────────────────
  const mapPoints = useMemo<YandexMapPoint[]>(() => {
    const centerLat = filters.centerLat;
    const centerLng = filters.centerLng;
    // Use the same haversine threshold as the server (road radius / 1.3)
    const haversineRadius =
      centerLat !== null && centerLng !== null ? filters.radiusKm / 1.3 : null;

    return displayItems
      .filter(
        (item): item is typeof item & { latitude: number; longitude: number } => {
          if (
            item.latitude === null ||
            item.longitude === null ||
            !Number.isFinite(item.latitude) ||
            !Number.isFinite(item.longitude)
          ) {
            return false;
          }
          // Only show pins inside the radius circle when a location center is set
          if (
            haversineRadius !== null &&
            centerLat !== null &&
            centerLng !== null
          ) {
            const dist = haversineKm(centerLat, centerLng, item.latitude, item.longitude);
            return dist <= haversineRadius;
          }
          return true;
        },
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        latitude: item.latitude,
        longitude: item.longitude,
        priceLabel: item.priceFrom !== null ? formatMoney(item.priceFrom) : null,
        previewImageUrl: item.coverImageUrl,
        rating: item.avgRating > 0 ? item.avgRating : null,
        reviewsCount: item.reviewsCount,
      }));
  }, [displayItems, filters.centerLat, filters.centerLng, filters.radiusKm]);

  const radiusCircle = useMemo<YandexMapRadiusCircle | null>(() => {
    if (
      filters.centerLat !== null &&
      filters.centerLng !== null &&
      Number.isFinite(filters.centerLat) &&
      Number.isFinite(filters.centerLng)
    ) {
      return {
        center: [filters.centerLat, filters.centerLng],
        // Show the haversine-equivalent radius (user's requested radius / 1.3)
        radiusKm: filters.radiusKm / 1.3,
      };
    }
    return null;
  }, [filters.centerLat, filters.centerLng, filters.radiusKm]);

  // ── Navigation on pin click ──────────────────────────────────────────────────
  const handlePinClick = useCallback(
    (pointId: string) => {
      const item = displayItems.find((it) => it.id === pointId);
      if (item) router.push(item.path);
    },
    [displayItems, router],
  );

  // ── Load more ─────────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      // Continue pagination using applied server filters, not draft sidebar values.
      const p = new URLSearchParams({ page_size: "30", page: String(loadedPage + 1) });
      if (filters.query) p.set("q", filters.query);
      if (filters.locationName) p.set("location", filters.locationName);
      if (filters.districtSlug) p.set("district", filters.districtSlug);
      if (filters.categorySlug) p.set("category", filters.categorySlug);
      if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
      if (filters.people) p.set("people", String(filters.people));
      p.set("radiusKm", String(filters.radiusKm));
      if (filters.sort && filters.sort !== "relevance") p.set("sort", filters.sort);
      if (filters.durationBucket) p.set("durationBucket", filters.durationBucket);
      if (filters.minPrice) p.set("minPrice", String(filters.minPrice));
      if (filters.maxPrice) p.set("maxPrice", String(filters.maxPrice));
      if (filters.format) p.set("format", filters.format);
      if (filters.pickup) p.set("pickup", "1");
      if (filters.kids) p.set("kids", "1");

      const response = await fetch(`/api/search/excursions?${p.toString()}`);
      if (!response.ok) throw new Error("fetch_failed");
      const data = await response.json() as { items: PublicExcursionCatalogItem[]; page: number };
      setDisplayItems((prev) => [...prev, ...data.items]);
      setLoadedPage(data.page);
    } catch {
      // silent — keep button visible for retry
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, loadedPage, filters]);

  const handlePinHover = useCallback(
    (pointId: string | null) => {
      setHoveredPinId(pointId);
      if (pointId) {
        const el = cardRefsMap.current.get(pointId);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    [],
  );

  // ── Map helpers ───────────────────────────────────────────────────────────────
  function openMapFully() {
    setIsMapActivated(true);
    setMapExpanded(true);
  }

  function closeMapFully() {
    setMapExpanded(false);
    setIsMapActivated(false);
    setHoveredCardId(null);
    setHoveredPinId(null);
  }

  const mapStatsLabel = !isMapActivated
    ? `Предпросмотр: ${mapPoints.length} показанных`
    : `На карте: ${mapPoints.length}`;

  // ── Apply filters ─────────────────────────────────────────────────────────────
  const applyFilters = useCallback(
    (overrides: Record<string, string> = {}) => {
      // URL is the source of truth: push a new search URL and let server return canonical filters.
      const params: Record<string, string> = {
        q: query,
        location,
        district,
        category,
        checkIn: dateFrom,
        guests,
        format,
        durationBucket,
        minPrice,
        maxPrice,
        radiusKm,
        pickup: pickup ? "1" : "",
        kids: kids ? "1" : "",
        sort,
        page: "1",
        ...overrides,
      };
      router.push(buildSearchUrl(params));
    },
    [query, location, district, category, dateFrom, guests, format, durationBucket, minPrice, maxPrice, radiusKm, pickup, kids, sort, router],
  );

  const handleRadiusChange = useCallback(
    (nextRadiusKm: string) => {
      setRadiusKm(nextRadiusKm);
      applyFilters({ radiusKm: nextRadiusKm });
    },
    [applyFilters],
  );

  // ── Active filter chips data ──────────────────────────────────────────────────
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];

    if (filters.locationName) {
      chips.push({
        key: "location",
        label: filters.locationName,
        clear: () => applyFilters({ location: "", radiusKm: "" }),
      });
    }
    if (filters.radiusKm && filters.locationName) {
      chips.push({
        key: "radius",
        label: `${filters.radiusKm} км`,
        clear: () => applyFilters({ radiusKm: "30" }),
      });
    }
    if (filters.districtName) {
      chips.push({
        key: "district",
        label: filters.districtName,
        clear: () => applyFilters({ district: "" }),
      });
    }
    if (filters.categoryName) {
      chips.push({
        key: "category",
        label: filters.categoryName,
        clear: () => applyFilters({ category: "" }),
      });
    }
    if (filters.query) {
      chips.push({
        key: "query",
        label: `«${filters.query}»`,
        clear: () => applyFilters({ q: "" }),
      });
    }
    if (filters.minPrice) {
      chips.push({
        key: "minPrice",
        label: `от ${formatMoney(filters.minPrice)}`,
        clear: () => applyFilters({ minPrice: "" }),
      });
    }
    if (filters.maxPrice) {
      chips.push({
        key: "maxPrice",
        label: `до ${formatMoney(filters.maxPrice)}`,
        clear: () => applyFilters({ maxPrice: "" }),
      });
    }
    if (filters.durationBucket === "up_to_3h") {
      chips.push({ key: "duration", label: "До 3 ч", clear: () => applyFilters({ durationBucket: "" }) });
    } else if (filters.durationBucket === "between_3h_6h") {
      chips.push({ key: "duration", label: "3–6 ч", clear: () => applyFilters({ durationBucket: "" }) });
    } else if (filters.durationBucket === "more_6h") {
      chips.push({ key: "duration", label: "6+ ч", clear: () => applyFilters({ durationBucket: "" }) });
    }
    if (filters.format === "group") {
      chips.push({ key: "format", label: "Групповая", clear: () => applyFilters({ format: "" }) });
    } else if (filters.format === "private") {
      chips.push({ key: "format", label: "Индивидуальная", clear: () => applyFilters({ format: "" }) });
    }
    if (filters.pickup) {
      chips.push({ key: "pickup", label: "Трансфер", clear: () => applyFilters({ pickup: "" }) });
    }
    if (filters.kids) {
      chips.push({ key: "kids", label: "Для детей", clear: () => applyFilters({ kids: "" }) });
    }

    return chips;
  }, [filters, applyFilters]);


  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-24 md:px-6 md:py-8 md:pb-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-olive">
            {filters.locationName ? `Экскурсии · ${filters.locationName}` : "Экскурсии в Крыму"}
          </h1>
          <p className="mt-0.5 text-sm text-olive/60">
            Найдено: {pagination.total}{" "}
            {filters.locationName
              ? `· радиус ${filters.radiusKm} км`
              : "· весь Крым"}
          </p>
        </div>

        {/* Mobile filter toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-olive/20 bg-white px-4 py-2 text-sm font-medium text-olive hover:bg-cream transition-colors md:hidden"
        >
          <AppIcon icon={SlidersHorizontal} className="h-4 w-4" />
          Фильтры
        </button>
      </div>

      {/* ── Active filter chips ─────────────────────────────────────────────── */}
      {activeChips.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-olive/50">Активные:</span>
          {activeChips.map((chip) => (
            <ActiveFilterChip key={chip.key} label={chip.label} onRemove={chip.clear} />
          ))}
          {activeChips.length > 1 ? (
            <button
              type="button"
              onClick={() => router.push("/search?direction=excursions")}
              className="text-xs text-olive/50 hover:text-olive underline transition-colors"
            >
              Сбросить всё
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ── md-only map preview (tablet: md, hidden on lg) ──────────────────── */}
      <section className="hidden rounded-2xl bg-white/94 p-3 ring-1 ring-olive/10 md:block lg:hidden mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-olive">Карта экскурсий</p>
            <p className="text-xs text-olive/65">{mapStatsLabel}</p>
          </div>
          <button
            type="button"
            onClick={openMapFully}
            className="inline-flex h-9 items-center rounded-xl border border-olive/16 bg-white px-3 text-xs font-semibold text-olive transition hover:bg-cream/70"
          >
            Открыть карту
          </button>
        </div>
        <button
          type="button"
          onClick={openMapFully}
          className="relative mt-3 block h-[160px] w-full overflow-hidden rounded-xl border border-olive/16 text-left"
          aria-label="Открыть карту полностью"
        >
          <iframe
            src="https://yandex.ru/map-widget/v1/?ll=34.1%2C45.05&z=7&source=constructorsearch"
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ border: "none" }}
            title="Карта Крыма"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-midnight/55 via-midnight/20 to-transparent" />
        </button>
      </section>

      {/* ── Three-column layout ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 items-start md:flex-row">

        {/* ── Left: Filter sidebar (desktop) ─────────────────────────────── */}
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-6 rounded-2xl bg-white/94 ring-1 ring-olive/10 overflow-hidden">
            <div className="border-b border-olive/10 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-olive/50">Фильтры</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitRecentExcursionLocation(location);
                applyFilters();
              }}
            >
              <FilterSection
                label="Поиск"
                open={openSections.has("search")}
                onToggle={() => toggleSection("search")}
              >
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Название, маршрут..."
                  className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                />
              </FilterSection>

              <FilterSection
                label="Локация"
                open={openSections.has("location")}
                onToggle={() => toggleSection("location")}
              >
                <div
                  ref={desktopLocationComboboxRef}
                  className={cn("relative", isDesktopLocationDropdownVisible ? "z-[30]" : "")}
                >
                  <input
                    ref={desktopLocationInputRef}
                    value={location}
                    onChange={(event) => {
                      setLocation(event.target.value.slice(0, 120));
                      setActiveLocationDropdown("desktop");
                      setActiveLocationSuggestionIndex(-1);
                    }}
                    autoComplete="off"
                    placeholder="Ялта, Судак..."
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isDesktopLocationDropdownVisible}
                    aria-controls={excursionLocationSuggestionsListboxId}
                    aria-activedescendant={activeDesktopLocationOptionId}
                    onFocus={() => setActiveLocationDropdown("desktop")}
                    onClick={() => setActiveLocationDropdown("desktop")}
                    onKeyDown={(event) => handleLocationInputKeyDown("desktop", event)}
                    className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                  />

                  {isDesktopLocationDropdownVisible ? (
                    <div className="mt-1 overflow-hidden rounded-xl border border-sand bg-white shadow-[0_18px_36px_-22px_rgba(15,118,110,0.6)]">
                      <div
                        id={excursionLocationSuggestionsListboxId}
                        role="listbox"
                        className="max-h-[380px] overflow-y-auto p-1.5"
                      >
                        {isLocationSuggestionsLoading && locationDropdownOptions.length === 0 ? (
                          <p className="px-3 py-5 text-sm text-olive/65">Ищем подходящие варианты...</p>
                        ) : null}

                        {!isLocationSuggestionsLoading &&
                        !isLocationQueryMode &&
                        locationRecentSuggestions.length > 0 ? (
                          <div className="pb-1">
                            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                              Ранее вы уже искали
                            </p>
                            <div className="space-y-1">
                              {locationRecentSuggestions.map((item, index) =>
                                renderLocationSuggestionButton("desktop", "recent", item, index),
                              )}
                            </div>
                          </div>
                        ) : null}

                        {!isLocationSuggestionsLoading &&
                        !isLocationQueryMode &&
                        locationPopularSuggestions.length > 0 ? (
                          <div className="pb-1">
                            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                              Популярные направления
                            </p>
                            <div className="space-y-1">
                              {locationPopularSuggestions.map((item, index) =>
                                renderLocationSuggestionButton("desktop", "popular", item, index),
                              )}
                            </div>
                          </div>
                        ) : null}

                        {!isLocationSuggestionsLoading &&
                        isLocationQueryMode &&
                        locationMatchSuggestions.length > 0 ? (
                          <div className="pb-1">
                            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                              Локации
                            </p>
                            <div className="space-y-1">
                              {locationMatchSuggestions.map((item, index) =>
                                renderLocationSuggestionButton("desktop", "matches", item, index),
                              )}
                            </div>
                          </div>
                        ) : null}

                        {!isLocationSuggestionsLoading &&
                        !isLocationQueryMode &&
                        locationRecentSuggestions.length === 0 &&
                        locationPopularSuggestions.length === 0 ? (
                          <p className="px-3 py-5 text-sm text-olive/65">Начните вводить город.</p>
                        ) : null}

                        {!isLocationSuggestionsLoading &&
                        isLocationQueryMode &&
                        locationMatchSuggestions.length === 0 ? (
                          <p className="px-3 py-5 text-sm text-olive/65">Ничего не найдено.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </FilterSection>

              <FilterSection
                label="Округ"
                open={openSections.has("district")}
                onToggle={() => toggleSection("district")}
              >
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                >
                  <option value="">Все округа</option>
                  {districts.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </FilterSection>

              <FilterSection
                label="Категория"
                open={openSections.has("category")}
                onToggle={() => toggleSection("category")}
              >
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                >
                  <option value="">Все категории</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FilterSection>

              <FilterSection
                label="Дата"
                open={openSections.has("date")}
                onToggle={() => toggleSection("date")}
              >
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                />
              </FilterSection>

              <FilterSection
                label="Участники"
                open={openSections.has("participants")}
                onToggle={() => toggleSection("participants")}
              >
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                />
              </FilterSection>

              <FilterSection
                label="Формат"
                open={openSections.has("format")}
                onToggle={() => toggleSection("format")}
              >
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                >
                  <option value="">Любой</option>
                  <option value="group">Групповая</option>
                  <option value="private">Индивидуальная</option>
                </select>
              </FilterSection>

              <FilterSection
                label="Длительность"
                open={openSections.has("duration")}
                onToggle={() => toggleSection("duration")}
              >
                <div className="space-y-2">
                  {[
                    { value: "", label: "Любая" },
                    { value: "up_to_3h", label: "До 3 часов" },
                    { value: "between_3h_6h", label: "3–6 часов" },
                    { value: "more_6h", label: "Более 6 часов" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="durationBucket"
                        value={option.value}
                        checked={durationBucket === option.value}
                        onChange={() => setDurationBucket(option.value)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-olive">{option.label}</span>
                    </label>
                  ))}
                </div>
              </FilterSection>

              <FilterSection
                label="Цена"
                open={openSections.has("price")}
                onToggle={() => toggleSection("price")}
              >
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    placeholder="от"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-1/2 rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    step={100}
                    placeholder="до"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-1/2 rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                  />
                </div>
              </FilterSection>

              <FilterSection
                label="Радиус поиска"
                open={openSections.has("radius")}
                onToggle={() => toggleSection("radius")}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-olive/60">
                    <span>5 км</span>
                    <span className="font-semibold text-olive">{radiusKm} км</span>
                    <span>100 км</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={radiusKm}
                    onChange={(e) => handleRadiusChange(e.target.value)}
                    className="w-full accent-primary"
                  />
                  <p className="text-xs text-olive/50">Приблизительное расстояние по дорогам</p>
                </div>
              </FilterSection>

              <FilterSection
                label="Дополнительно"
                open={openSections.has("extra")}
                onToggle={() => toggleSection("extra")}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pickup}
                    onChange={(e) => setPickup(e.target.checked)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-olive">Нужен трансфер</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kids}
                    onChange={(e) => setKids(e.target.checked)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-olive">Подходит детям</span>
                </label>
              </FilterSection>

              <FilterSection
                label="Сортировка"
                open={openSections.has("sort")}
                onToggle={() => toggleSection("sort")}
              >
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                >
                  <option value="">По релевантности</option>
                  <option value="rating_desc">По рейтингу</option>
                  <option value="popular_desc">По отзывам</option>
                  <option value="price_asc">Сначала дешёвые</option>
                  <option value="price_desc">Сначала дорогие</option>
                  <option value="distance_asc">По расстоянию</option>
                  <option value="duration_asc">По длительности</option>
                </select>
              </FilterSection>

              <div className="px-4 py-3">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/88 transition-colors"
                >
                  Найти
                </button>
              </div>
            </form>
          </div>
        </aside>

        {/* ── Center: Results ─────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {displayItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-olive/25 bg-white/94 p-8 text-center">
              <p className="text-sm text-olive/60">
                По вашим параметрам экскурсии не найдены.
              </p>
              <p className="mt-1 text-xs text-olive/45">
                Попробуйте изменить локацию, увеличить радиус или снять часть фильтров.
              </p>
              <button
                type="button"
                onClick={() => router.push("/search?direction=excursions")}
                className="mt-4 rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                Сбросить все фильтры
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayItems.map((item) => (
                <ExcursionCard
                  key={item.id}
                  item={item}
                  isHighlighted={hoveredPinId === item.id}
                  onMouseEnter={() => setHoveredCardId(item.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  cardRef={(el) => {
                    if (el) cardRefsMap.current.set(item.id, el);
                    else cardRefsMap.current.delete(item.id);
                  }}
                />
              ))}
            </div>
          )}

          {/* ── Load more ───────────────────────────────────────────────── */}
          {hasMore ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className={cn(
                  "inline-flex items-center gap-2.5 rounded-2xl border border-primary/25 bg-white px-8 py-3.5 text-sm font-semibold text-primary shadow-sm transition-all duration-200",
                  isLoadingMore
                    ? "cursor-wait opacity-70"
                    : "hover:border-primary/50 hover:bg-primary/6 hover:shadow-md hover:-translate-y-px active:translate-y-0",
                )}
              >
                {isLoadingMore ? (
                  <>
                    <AppIcon icon={LoaderCircle} className="h-4 w-4 animate-spin text-primary/70" />
                    Загружаем...
                  </>
                ) : remaining > 30 ? (
                  <>
                    <AppIcon icon={ArrowDown} className="h-4 w-4 text-primary/70" />
                    Показать ещё 30
                  </>
                ) : (
                  <>
                    <AppIcon icon={ArrowDown} className="h-4 w-4 text-primary/70" />
                    Показать оставшиеся {remaining}
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>

        {/* ── Right: Map panel ────────────────────────────────────────────── */}
        <aside className="map-column hidden self-start lg:block lg:sticky lg:top-[96px] lg:h-[420px] w-[380px] xl:w-[440px] shrink-0">
          <section className="flex h-full flex-col rounded-2xl bg-white/94 p-3.5 ring-1 ring-olive/10 md:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-olive">Карта экскурсий</p>
                <p className="text-xs text-olive/65">{mapStatsLabel}</p>
              </div>
              <button
                type="button"
                onClick={openMapFully}
                className="inline-flex h-9 items-center rounded-xl border border-olive/16 bg-white px-3 text-xs font-semibold text-olive transition hover:bg-cream/70"
              >
                Открыть карту
              </button>
            </div>

            {isMapActivated ? (
              <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-xl border border-olive/14">
                <YandexMapMultiViewer
                  points={mapPoints}
                  activePointId={hoveredCardId}
                  hoveredPointId={hoveredPinId}
                  onPointClick={handlePinClick}
                  onPointHoverChange={handlePinHover}
                  radiusCircle={radiusCircle}
                  className="h-full w-full"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={openMapFully}
                className="group relative mt-3 block min-h-0 flex-1 overflow-hidden rounded-xl border border-olive/16 text-left"
                aria-label="Открыть карту полностью"
              >
                <iframe
                  src="https://yandex.ru/map-widget/v1/?ll=34.1%2C45.05&z=7&source=constructorsearch"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  style={{ border: "none" }}
                  title="Карта Крыма"
                  aria-hidden="true"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-midnight/60 via-midnight/25 to-midnight/10" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
                  <span className="inline-flex h-11 items-center rounded-full bg-white/92 px-5 text-sm font-semibold text-olive shadow-sm backdrop-blur transition group-hover:bg-white">
                    Открыть полностью
                  </span>
                </div>
              </button>
            )}
          </section>
        </aside>
      </div>

      {/* ── Floating mobile map button ───────────────────────────────────────── */}
      <button
        type="button"
        onClick={openMapFully}
        aria-expanded={mapExpanded}
        aria-controls="excursion-map-modal"
        className="float-map-btn z-[70] inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white lg:hidden"
      >
        <span>Карта ({mapPoints.length})</span>
      </button>

      {/* ── Expanded map modal ──────────────────────────────────────────────── */}
      {mapExpanded ? (
        <div id="excursion-map-modal" className="fixed inset-0 z-[90] bg-midnight/55 p-3 backdrop-blur-[1px] sm:p-5">
          <section className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white/97 p-3 ring-1 ring-olive/10 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-olive">Карта экскурсий</p>
                <p className="text-xs text-olive/65">
                  {filters.locationName ? `· ${filters.locationName}` : "· весь Крым"}
                  {radiusCircle ? ` · радиус ${filters.radiusKm} км` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeMapFully}
                className="inline-flex h-9 items-center rounded-xl border border-olive/16 bg-white px-3 text-xs font-semibold text-olive transition hover:bg-cream/70"
              >
                × Закрыть карту
              </button>
            </div>

            <div className="relative mt-3 min-h-0 flex-1">
              <YandexMapMultiViewer
                points={mapPoints}
                activePointId={hoveredCardId}
                hoveredPointId={hoveredPinId}
                onPointClick={(id) => {
                  handlePinClick(id);
                  closeMapFully();
                }}
                onPointHoverChange={handlePinHover}
                radiusCircle={radiusCircle}
                className="h-[calc(100dvh-190px)] min-h-[360px] w-full"
              />
            </div>
          </section>
        </div>
      ) : null}

      {/* ── Mobile filter drawer ────────────────────────────────────────────── */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSidebarOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-midnight/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative ml-auto h-full w-80 overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-olive/10 px-4 py-3">
              <span className="font-semibold text-olive">Фильтры</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-olive/50 hover:bg-olive/8 transition-colors"
              >
                <AppIcon icon={X} className="h-5 w-5" />
              </button>
            </div>

            {/* Reuse same form in mobile drawer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSidebarOpen(false);
                commitRecentExcursionLocation(location);
                applyFilters();
              }}
            >
              <div className="px-4 py-3 space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-olive/60">Поиск</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Название, маршрут..."
                    className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-olive/60">Локация</span>
                  <div
                    ref={mobileLocationComboboxRef}
                    className={cn("relative", isMobileLocationDropdownVisible ? "z-[30]" : "")}
                  >
                    <input
                      ref={mobileLocationInputRef}
                      value={location}
                      onChange={(event) => {
                        setLocation(event.target.value.slice(0, 120));
                        setActiveLocationDropdown("mobile");
                        setActiveLocationSuggestionIndex(-1);
                      }}
                      autoComplete="off"
                      placeholder="Ялта, Судак..."
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={isMobileLocationDropdownVisible}
                      aria-controls={mobileExcursionLocationSuggestionsListboxId}
                      aria-activedescendant={activeMobileLocationOptionId}
                      onFocus={() => setActiveLocationDropdown("mobile")}
                      onClick={() => setActiveLocationDropdown("mobile")}
                      onKeyDown={(event) => handleLocationInputKeyDown("mobile", event)}
                      className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                    />

                    {isMobileLocationDropdownVisible ? (
                      <div className="mt-1 overflow-hidden rounded-xl border border-sand bg-white shadow-[0_18px_36px_-22px_rgba(15,118,110,0.6)]">
                        <div
                          id={mobileExcursionLocationSuggestionsListboxId}
                          role="listbox"
                          className="max-h-[380px] overflow-y-auto p-1.5"
                        >
                          {isLocationSuggestionsLoading && locationDropdownOptions.length === 0 ? (
                            <p className="px-3 py-5 text-sm text-olive/65">Ищем подходящие варианты...</p>
                          ) : null}

                          {!isLocationSuggestionsLoading &&
                          !isLocationQueryMode &&
                          locationRecentSuggestions.length > 0 ? (
                            <div className="pb-1">
                              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                                Ранее вы уже искали
                              </p>
                              <div className="space-y-1">
                                {locationRecentSuggestions.map((item, index) =>
                                  renderLocationSuggestionButton("mobile", "recent", item, index),
                                )}
                              </div>
                            </div>
                          ) : null}

                          {!isLocationSuggestionsLoading &&
                          !isLocationQueryMode &&
                          locationPopularSuggestions.length > 0 ? (
                            <div className="pb-1">
                              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                                Популярные направления
                              </p>
                              <div className="space-y-1">
                                {locationPopularSuggestions.map((item, index) =>
                                  renderLocationSuggestionButton("mobile", "popular", item, index),
                                )}
                              </div>
                            </div>
                          ) : null}

                          {!isLocationSuggestionsLoading &&
                          isLocationQueryMode &&
                          locationMatchSuggestions.length > 0 ? (
                            <div className="pb-1">
                              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                                Локации
                              </p>
                              <div className="space-y-1">
                                {locationMatchSuggestions.map((item, index) =>
                                  renderLocationSuggestionButton("mobile", "matches", item, index),
                                )}
                              </div>
                            </div>
                          ) : null}

                          {!isLocationSuggestionsLoading &&
                          !isLocationQueryMode &&
                          locationRecentSuggestions.length === 0 &&
                          locationPopularSuggestions.length === 0 ? (
                            <p className="px-3 py-5 text-sm text-olive/65">Начните вводить город.</p>
                          ) : null}

                          {!isLocationSuggestionsLoading &&
                          isLocationQueryMode &&
                          locationMatchSuggestions.length === 0 ? (
                            <p className="px-3 py-5 text-sm text-olive/65">Ничего не найдено.</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-olive/60">Округ</span>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                  >
                    <option value="">Все округа</option>
                    {districts.map((d) => (
                      <option key={d.slug} value={d.slug}>{d.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-olive/60">Категория</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                  >
                    <option value="">Все категории</option>
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-olive/60">Радиус, км</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={radiusKm}
                      onChange={(e) => handleRadiusChange(e.target.value)}
                      className="flex-1 accent-primary"
                    />
                    <span className="w-14 text-right text-sm font-medium text-olive">{radiusKm} км</span>
                  </div>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-olive/60">Сортировка</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="w-full rounded-xl border border-olive/20 bg-foam px-3 py-2 text-sm text-olive outline-none focus:border-primary"
                  >
                    <option value="">По релевантности</option>
                    <option value="rating_desc">По рейтингу</option>
                    <option value="popular_desc">По отзывам</option>
                    <option value="price_asc">Сначала дешёвые</option>
                    <option value="price_desc">Сначала дорогие</option>
                    <option value="distance_asc">По расстоянию</option>
                    <option value="duration_asc">По длительности</option>
                  </select>
                </label>
              </div>
              <div className="border-t border-olive/10 px-4 py-3">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/88 transition-colors"
                >
                  Применить
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

// ─── Excursion Card ───────────────────────────────────────────────────────────

function ExcursionCard({
  item,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
  cardRef,
}: {
  item: PublicExcursionCatalogItem;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  cardRef: (el: HTMLElement | null) => void;
}) {
  const duration = formatDuration(item.durationMinutes);

  return (
    <article
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "rounded-2xl bg-white/94 p-4 ring-1 transition-all duration-200",
        isHighlighted
          ? "ring-primary/50 shadow-md shadow-primary/10"
          : "ring-olive/10 hover:ring-olive/20 hover:shadow-sm",
      )}
    >
      <div className="flex gap-4">
        {/* Cover image */}
        <div className="hidden shrink-0 overflow-hidden rounded-xl bg-cream sm:block sm:h-36 sm:w-48">
          {item.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverImageUrl}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-olive/40">
              Без фото
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-olive/50">Экскурсия</p>
              <h2 className="mt-0.5 truncate text-lg font-semibold text-olive leading-snug">
                {item.title}
              </h2>
              <p className="mt-0.5 truncate text-sm text-olive/60">
                {item.mainLocationName ?? item.locationName ?? "Крым"}
                {item.anchorCityName && item.anchorCityName !== item.mainLocationName
                  ? ` · ${item.anchorCityName}`
                  : ""}
              </p>
            </div>

            {/* Price */}
            {item.priceFrom !== null ? (
              <div className="shrink-0 text-right">
                <p className="text-xs text-olive/50">от</p>
                <p className="text-lg font-bold text-olive leading-tight">
                  {formatMoney(item.priceFrom)}
                </p>
              </div>
            ) : null}
          </div>

          {/* Rating + chips row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {item.avgRating > 0 ? (
              <div className="flex items-center gap-1.5">
                <StarRating rating={item.avgRating} />
                <span className="text-xs text-olive/60">
                  {item.avgRating.toFixed(1)} · {pluralizeReviews(item.reviewsCount)}
                </span>
              </div>
            ) : (
              <span className="text-xs text-olive/40">Нет отзывов</span>
            )}

            {duration ? (
              <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs text-olive/70">
                {duration}
              </span>
            ) : null}

            {item.distanceKm !== null ? (
              <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs text-olive/70">
                ~{item.distanceKm} км
              </span>
            ) : null}

            {item.districtName ? (
              <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs text-olive/70">
                {item.districtName}
              </span>
            ) : null}

            {item.categoryName ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {item.categoryName}
              </span>
            ) : null}

            {item.pickupAvailable ? (
              <span className="rounded-full bg-terra/10 px-2.5 py-0.5 text-xs font-medium text-terra">
                Трансфер
              </span>
            ) : null}

            {item.hasAvailableSession ? (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Есть места
              </span>
            ) : null}
          </div>

          <div className="mt-3">
            <Link
              href={item.path}
              className="inline-flex rounded-xl bg-terra px-4 py-1.5 text-sm font-semibold text-white hover:bg-terra/88 transition-colors"
            >
              Подробнее
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

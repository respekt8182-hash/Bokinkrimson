"use client";

import {
  ArrowDown,
  Check,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  WalletCards,
  ArrowRight,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { FirstListingPromo } from "@/components/public/first-listing-promo";
import { AppIcon } from "@/components/ui/app-icon";
import { AvatarImage } from "@/components/ui/avatar-image";
import {
  CatalogFieldGroup,
  CatalogFilterChipButton,
  CatalogFilterPanelActions,
  CatalogFilterShell,
  ResponsiveFilterPanel,
  useIsMobileViewport,
} from "@/components/public/catalog-filter-shell";
import { UnifiedCalendarContent } from "@/components/ui/unified-calendar-content";
import { UnifiedGuestsEditor } from "@/components/ui/unified-guests-editor";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useCatalogMapPlacement } from "@/hooks/use-catalog-map-placement";
import { cn } from "@/lib/cn";
import {
  setPublicMobileBottomNavForceHidden,
  setPublicMobileBottomNavProgress,
} from "@/lib/public-mobile-nav-visibility";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { stripSearchParamsFromPath } from "@/lib/seo/url-normalize";
import {
  formatProgramDuration,
  formatProgramPrice,
  getOfferTypeLabel,
} from "@/lib/excursion-offers";
import { getFavoriteEntityTypeFromOfferType } from "@/lib/favorite-entities";
import { excursionsHubPath, toursHubPath } from "@/lib/seo/routes";
import {
  YandexMapMultiViewer,
  type YandexMapPoint,
  type YandexMapRadiusCircle,
  type YandexMapViewport,
} from "@/components/maps/yandex-map-multi-viewer";
import { MapExcursionPopupCard } from "@/components/public/map-excursion-popup-card";
import type {
  PublicExcursionCatalogItem,
  PublicExcursionCatalogResult,
} from "@/lib/public-excursions";

export type ExcursionSearchResultsProps = {
  items: PublicExcursionCatalogItem[];
  filters: PublicExcursionCatalogResult["filters"];
  pagination: { page: number; totalPages: number; total: number };
  districts: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
  locationNames: string[];
  initialPopularLocationSuggestions: ExcursionLocationSuggestionItem[];
  catalogDirection?: "excursions" | "tours";
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

type MobileSheetSnap = "expanded" | "preview" | "collapsed";

type MobileSheetDragState = {
  pointerId: number;
  startY: number;
  startTop: number;
  didMove: boolean;
};

type MobileSheetSnaps = Record<MobileSheetSnap, number>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOBILE_SHEET_HANDLE_HEIGHT = 76;
const MOBILE_SHEET_BOTTOM_CLEARANCE = -12;
const MOBILE_STAGE_MIN_HEIGHT = 360;
const MOBILE_STAGE_MAX_HEIGHT = 820;
const MOBILE_SHEET_CHROME_SCROLL_RANGE = 140;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getNearestMobileSheetSnap(top: number, snaps: MobileSheetSnaps): MobileSheetSnap {
  return (Object.entries(snaps) as Array<[MobileSheetSnap, number]>).reduce(
    (nearest, entry) => (Math.abs(entry[1] - top) < Math.abs(nearest[1] - top) ? entry : nearest),
    ["preview", snaps.preview],
  )[0];
}

const rubFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const ruPluralRules = new Intl.PluralRules("ru-RU");

function formatRuCount(value: number, one: string, few: string, many: string): string {
  const plural = ruPluralRules.select(Math.abs(value));
  const label = plural === "one" ? one : plural === "few" ? few : many;

  return `${rubFormatter.format(value)} ${label}`;
}

function formatMoney(value: number): string {
  return `${rubFormatter.format(Math.round(value))} ₽`;
}

function pluralizeReviews(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${count} отзывов`;
  if (mod10 === 1) return `${count} отзыв`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} отзыва`;
  return `${count} отзывов`;
}

function buildSearchUrl(direction: "excursions" | "tours", params: Record<string, string>): string {
  const basePath = direction === "tours" ? toursHubPath : excursionsHubPath;
  const entries = Object.entries(params).filter(([, value]) => value);

  return buildCanonicalPath(basePath, entries, [
    "location",
    "district",
    "category",
    "dateFrom",
    "dateTo",
    "guests",
    "format",
    "durationBucket",
    "minPrice",
    "maxPrice",
    "radiusKm",
    "pickup",
    "kids",
    "sort",
    "offerType",
    "q",
    "page",
  ]);
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

const offerTypeOptions = [
  { value: "", label: "Все программы" },
  { value: "excursion", label: "Экскурсии" },
  { value: "tour", label: "Туры" },
] as const;

const formatOptions = [
  { value: "", label: "Любой формат" },
  { value: "group", label: "Групповая" },
  { value: "private", label: "Индивидуальная" },
] as const;

const durationOptions = [
  { value: "", label: "Любая длительность" },
  { value: "up_to_3h", label: "До 3 часов" },
  { value: "between_3h_6h", label: "3–6 часов" },
  { value: "more_6h", label: "Более 6 часов" },
] as const;

const sortOptions = [
  { value: "", label: "По релевантности" },
  { value: "rating_desc", label: "По рейтингу" },
  { value: "popular_desc", label: "По отзывам" },
  { value: "price_asc", label: "Сначала дешевле" },
  { value: "price_desc", label: "Сначала дороже" },
  { value: "distance_asc", label: "По расстоянию" },
  { value: "duration_asc", label: "По длительности" },
] as const;

const EXCURSION_PRICE_MIN_BOUND = 0;
const EXCURSION_PRICE_MAX_BOUND = 100_000;
const EXCURSION_PRICE_STEP = 100;
const DATE_PANEL_WIDTH = 840;
const DATE_PANEL_MAX_HEIGHT = 720;

function normalizeLocationText(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
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

function pluralizeGuests(value: number): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;
  if (abs > 10 && abs < 20) {
    return "гостей";
  }
  if (mod > 1 && mod < 5) {
    return "гостя";
  }
  if (mod === 1) {
    return "гость";
  }
  return "гостей";
}

function getOfferTypeFilterLabel(
  value: PublicExcursionCatalogResult["filters"]["offerType"] | "",
): string {
  if (!value) {
    return "Программы";
  }

  return offerTypeOptions.find((option) => option.value === value)?.label ?? "Программы";
}

function getFormatFilterLabel(value: string | null): string {
  if (!value) {
    return "Формат";
  }

  return formatOptions.find((option) => option.value === value)?.label ?? "Формат";
}

function getDurationShortFilterLabel(
  value: PublicExcursionCatalogResult["filters"]["durationBucket"] | "",
): string {
  if (!value) {
    return "Длительность";
  }

  if (value === "up_to_3h") {
    return "До 3 ч";
  }

  if (value === "between_3h_6h") {
    return "3-6 ч";
  }

  if (value === "more_6h") {
    return "6+ ч";
  }

  return "Длительность";
}

function getSortFilterLabel(value: PublicExcursionCatalogResult["filters"]["sort"] | ""): string {
  if (!value) {
    return "Сортировка";
  }

  return sortOptions.find((option) => option.value === value)?.label ?? "Сортировка";
}

function getExcursionBudgetLabel(minPrice: number | null, maxPrice: number | null): string {
  if (minPrice && maxPrice) {
    return `${formatMoney(minPrice)} - ${formatMoney(maxPrice)}`;
  }

  if (minPrice) {
    return `от ${formatMoney(minPrice)}`;
  }

  if (maxPrice) {
    return `до ${formatMoney(maxPrice)}`;
  }

  return "Цена";
}

function getProgramFilterChipLabel(input: {
  query: string | null;
  offerType: PublicExcursionCatalogResult["filters"]["offerType"] | "";
  format: PublicExcursionCatalogResult["filters"]["format"] | null;
  durationBucket: PublicExcursionCatalogResult["filters"]["durationBucket"] | "";
}): string {
  const appliedCount =
    Number(Boolean(input.query?.trim())) +
    Number(Boolean(input.offerType)) +
    Number(Boolean(input.format)) +
    Number(Boolean(input.durationBucket));

  if (appliedCount === 0) {
    return "Программа";
  }

  if (appliedCount === 1 && input.query?.trim()) {
    return `«${input.query.trim()}»`;
  }

  if (appliedCount === 1 && input.offerType) {
    return getOfferTypeFilterLabel(input.offerType);
  }

  if (appliedCount === 1 && input.format) {
    return getFormatFilterLabel(input.format);
  }

  if (appliedCount === 1 && input.durationBucket) {
    return getDurationShortFilterLabel(input.durationBucket);
  }

  return `Программа · ${appliedCount}`;
}

function getLocationFilterChipLabel(locationName: string | null, radiusKm: number): string {
  if (!locationName) {
    return "Весь Крым";
  }

  if (radiusKm !== 30) {
    return `${locationName} · ${radiusKm} км`;
  }

  return locationName;
}

function getParticipantsFilterChipLabel(people: number | null): string {
  if (!people || people === 2) {
    return "Гости";
  }

  return `${people} ${pluralizeGuests(people)}`;
}

function formatExcursionRecentLocationSubtitle(input: {
  checkIn: string;
  isAnyDate: boolean;
  guests: number;
}): string {
  const normalizedGuests = Number.isFinite(input.guests)
    ? Math.max(1, Math.round(input.guests))
    : 2;
  const guestsLabel = `${normalizedGuests} ${pluralizeGuests(normalizedGuests)}`;

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

function parseExcursionLocationSuggestionsPayload(
  raw: unknown,
): ExcursionLocationSuggestionsPayload {
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

function ClockIcon(props: { className?: string }) {
  return <AppIcon icon={Clock3} className={props.className} />;
}

function LocationPinIcon(props: { className?: string }) {
  return <AppIcon icon={MapPin} className={props.className} />;
}

function ExcursionOptionPill(props: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition",
        props.selected
          ? "border-primary/22 bg-primary text-white shadow-[0_14px_24px_-18px_rgba(15,118,110,0.55)]"
          : "border-olive/12 bg-white text-olive hover:bg-cream/55",
      )}
    >
      {props.children}
    </button>
  );
}

function ExcursionToggleCard(props: {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "flex min-h-[74px] w-full items-start justify-between gap-3 rounded-[22px] border px-4 py-3.5 text-left transition",
        props.selected
          ? "border-primary/22 bg-primary/10 text-primary shadow-[0_16px_30px_-26px_rgba(15,118,110,0.45)]"
          : "border-olive/12 bg-white text-olive hover:bg-cream/55",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">{props.label}</span>
        {props.description ? (
          <span className="mt-1 block text-xs leading-5 text-olive/55">{props.description}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition",
          props.selected
            ? "border-primary bg-primary text-white"
            : "border-olive/14 bg-cream/50 text-transparent",
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExcursionSearchResults({
  items,
  filters,
  pagination,
  districts,
  categories,
  locationNames,
  initialPopularLocationSuggestions,
  catalogDirection = "excursions",
}: ExcursionSearchResultsProps) {
  const router = useRouter();
  const isMobileViewport = useIsMobileViewport();

  // ── Filter state (mirrors URL params, user edits locally then submits) ──────
  const [offerType, setOfferType] = useState(filters.offerType ?? "");
  const [query, setQuery] = useState(filters.query ?? "");
  const [location, setLocation] = useState(filters.locationName ?? "");
  const [district, setDistrict] = useState(filters.districtSlug ?? "");
  const [category, setCategory] = useState(filters.categorySlug ?? "");
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");
  const [guests, setGuests] = useState(String(filters.people ?? 2));
  const [format, setFormat] = useState(filters.format ?? "");
  const [durationBucket, setDurationBucket] = useState(filters.durationBucket ?? "");
  const [minPrice, setMinPrice] = useState(filters.minPrice ? String(filters.minPrice) : "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice ? String(filters.maxPrice) : "");
  const [radiusKm, setRadiusKm] = useState(String(filters.radiusKm));
  const [pickup, setPickup] = useState(filters.pickup ?? false);
  const [kids, setKids] = useState(filters.kids ?? false);
  const [sort, setSort] = useState(filters.sort === "relevance" ? "" : filters.sort);
  const [openFilterPanel, setOpenFilterPanel] = useState<string | null>(null);
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
  >(initialPopularLocationSuggestions);
  const [locationMatchSuggestions, setLocationMatchSuggestions] = useState<
    ExcursionLocationSuggestionItem[]
  >([]);
  const [activeLocationSuggestionIndex, setActiveLocationSuggestionIndex] = useState(-1);
  const desktopLocationComboboxRef = useRef<HTMLDivElement | null>(null);
  const desktopLocationInputRef = useRef<HTMLInputElement | null>(null);
  const mobileLocationComboboxRef = useRef<HTMLDivElement | null>(null);
  const mobileLocationInputRef = useRef<HTMLInputElement | null>(null);
  const locationDropdownSuppressUntilRef = useRef(0);
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
  const mapPlacement = useCatalogMapPlacement();
  const mobileStageRef = useRef<HTMLDivElement | null>(null);
  const mobileResultsScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileSheetDragRef = useRef<MobileSheetDragState | null>(null);
  const mobileSheetTopRef = useRef<number | null>(null);
  const mobileDragStartYRef = useRef<number | null>(null);
  const mobileDragHandledRef = useRef(false);
  const mobileResultsScrollTopRef = useRef(0);
  const mobileChromeProgressRef = useRef(0);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [isMobileMapCollapsed, setIsMobileMapCollapsed] = useState(false);
  const [mobileSheetSnap, setMobileSheetSnap] = useState<MobileSheetSnap>("preview");
  const [mobileSheetTop, setMobileSheetTop] = useState<number | null>(null);
  const [mobileStageHeight, setMobileStageHeight] = useState(0);
  const [isMobileSheetDragging, setIsMobileSheetDragging] = useState(false);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [mapItems, setMapItems] = useState<PublicExcursionCatalogItem[]>(items);
  const [isMapPointsLoading, setIsMapPointsLoading] = useState(false);
  const [mapPointsError, setMapPointsError] = useState("");
  useBodyScrollLock(mapExpanded);

  // ── Card refs for scroll-to-card on pin hover ────────────────────────────────
  const cardRefsMap = useRef<Map<string, HTMLElement>>(new Map());

  // Keep local form controls in sync with applied URL filters after navigation.
  useEffect(() => {
    setOfferType(filters.offerType ?? "");
    setQuery(filters.query ?? "");
    setLocation(filters.locationName ?? "");
    setDistrict(filters.districtSlug ?? "");
    setCategory(filters.categorySlug ?? "");
    setDateFrom(filters.dateFrom ?? "");
    setDateTo(filters.dateTo ?? "");
    setGuests(String(filters.people ?? 2));
    setFormat(filters.format ?? "");
    setDurationBucket(filters.durationBucket ?? "");
    setMinPrice(filters.minPrice ? String(filters.minPrice) : "");
    setMaxPrice(filters.maxPrice ? String(filters.maxPrice) : "");
    setRadiusKm(String(filters.radiusKm));
    setPickup(filters.pickup ?? false);
    setKids(filters.kids ?? false);
    setSort(filters.sort === "relevance" ? "" : filters.sort);
    setOpenFilterPanel(null);
    setActiveLocationDropdown(null);
    setActiveLocationSuggestionIndex(-1);
  }, [
    filters.offerType,
    filters.query,
    filters.locationName,
    filters.districtSlug,
    filters.categorySlug,
    filters.dateFrom,
    filters.dateTo,
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
    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPinId(null);
    setIsMobileMapCollapsed(false);
    setMobileSheetSnap("preview");
    setMobileSheetTop(null);
    mobileSheetTopRef.current = null;
    setMapItems(items);
    setIsMapPointsLoading(false);
    setMapPointsError("");
    cardRefsMap.current.clear();
  }, [items, pagination.page]);

  useEffect(() => {
    if (!mapExpanded) {
      return;
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMapFully();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mapExpanded]);

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
    () => new Map(locationDropdownOptions.map((option, index) => [option.key, index])),
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
  const locationScope: "desktop" | "mobile" = isMobileViewport ? "mobile" : "desktop";
  const isLocationDropdownVisible =
    locationScope === "mobile" ? isMobileLocationDropdownVisible : isDesktopLocationDropdownVisible;
  const activeLocationOptionId =
    locationScope === "mobile" ? activeMobileLocationOptionId : activeDesktopLocationOptionId;
  const activeLocationListboxId =
    locationScope === "mobile"
      ? mobileExcursionLocationSuggestionsListboxId
      : excursionLocationSuggestionsListboxId;

  useEffect(() => {
    if (initialPopularLocationSuggestions.length === 0) {
      return;
    }

    locationSuggestionsCacheRef.current.set("exc-location|", {
      payload: {
        popular: initialPopularLocationSuggestions,
        matches: [],
      },
      expiresAt: Date.now() + excursionLocationSuggestionsCacheTtlMs,
    });

    if (location.trim().length === 0) {
      setLocationPopularSuggestions(initialPopularLocationSuggestions);
      setLocationMatchSuggestions([]);
    }
  }, [initialPopularLocationSuggestions, location]);

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
    const timer = window.setTimeout(
      async () => {
        setIsLocationSuggestionsLoading(true);

        try {
          const isEmptyQuery = query.length === 0;
          const params = new URLSearchParams({
            direction: "excursions",
            include: "locations",
            query,
            limit: isEmptyQuery ? "8" : "12",
          });
          const response = await fetch(`/api/search/suggestions?${params.toString()}`, {
            credentials: "omit",
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
      },
      query.length === 0 ? 0 : 220,
    );

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

  const openLocationDropdown = useCallback((scope: "desktop" | "mobile") => {
    if (Date.now() < locationDropdownSuppressUntilRef.current) {
      return;
    }

    setActiveLocationDropdown(scope);
  }, []);

  const applyLocationSuggestion = useCallback(
    (item: ExcursionLocationSuggestionItem) => {
      setLocation(item.name);
      commitRecentExcursionLocation(item.name);
      locationDropdownSuppressUntilRef.current = Date.now() + 250;
      setActiveLocationDropdown(null);
      setActiveLocationSuggestionIndex(-1);
    },
    [commitRecentExcursionLocation],
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
        activeLocationDropdown === scope && optionIndex === activeLocationSuggestionIndex;
      const icon =
        section === "recent" ? (
          <ClockIcon className="h-4 w-4" />
        ) : (
          <LocationPinIcon className="h-4 w-4" />
        );
      const nameContent =
        section === "matches" ? renderHighlightedLocationText(item.name, location) : item.name;

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
            {item.subtitle ? (
              <span className="block truncate text-xs text-olive/64">{item.subtitle}</span>
            ) : null}
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

  const mapQuery = useMemo(() => {
    const params = new URLSearchParams({ page: "1" });

    if (filters.query) params.set("q", filters.query);
    if (filters.locationName) params.set("location", filters.locationName);
    if (filters.offerType) params.set("offerType", filters.offerType);
    if (filters.districtSlug) params.set("district", filters.districtSlug);
    if (filters.categorySlug) params.set("category", filters.categorySlug);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.people) params.set("people", String(filters.people));
    params.set("radiusKm", String(filters.radiusKm));
    if (filters.sort && filters.sort !== "relevance") params.set("sort", filters.sort);
    if (filters.durationBucket) params.set("durationBucket", filters.durationBucket);
    if (filters.minPrice) params.set("minPrice", String(filters.minPrice));
    if (filters.maxPrice) params.set("maxPrice", String(filters.maxPrice));
    if (filters.format) params.set("format", filters.format);
    if (filters.pickup) params.set("pickup", "1");
    if (filters.kids) params.set("kids", "1");
    if (filters.language) params.set("language", filters.language);
    if (filters.difficulty) params.set("difficulty", filters.difficulty);

    return params.toString();
  }, [
    filters.categorySlug,
    filters.dateFrom,
    filters.dateTo,
    filters.difficulty,
    filters.districtSlug,
    filters.durationBucket,
    filters.format,
    filters.kids,
    filters.language,
    filters.locationName,
    filters.maxPrice,
    filters.minPrice,
    filters.offerType,
    filters.people,
    filters.pickup,
    filters.query,
    filters.radiusKm,
    filters.sort,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    setMapItems(items);
    setIsMapPointsLoading(true);
    setMapPointsError("");

    const fetchMapItems = async () => {
      try {
        const response = await fetch(`/api/map/excursions?${mapQuery}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("map_fetch_failed");
        }

        const body = (await response.json()) as { map_points?: PublicExcursionCatalogItem[] };
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        setMapItems(Array.isArray(body.map_points) ? body.map_points : items);
      } catch {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        setMapItems(items);
        setMapPointsError("Не удалось обновить все точки карты. Показана текущая выдача.");
      } finally {
        if (isMounted && !controller.signal.aborted) {
          setIsMapPointsLoading(false);
        }
      }
    };

    void fetchMapItems();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [items, mapQuery]);

  // ── Map points ───────────────────────────────────────────────────────────────
  const mapPoints = useMemo<YandexMapPoint[]>(() => {
    const centerLat = filters.centerLat;
    const centerLng = filters.centerLng;
    const radiusKm = Number.isFinite(filters.radiusKm) ? filters.radiusKm : null;
    const hasRadiusCenter =
      centerLat !== null &&
      centerLng !== null &&
      Number.isFinite(centerLat) &&
      Number.isFinite(centerLng);

    return mapItems
      .filter((item): item is typeof item & { latitude: number; longitude: number } => {
        if (
          item.latitude === null ||
          item.longitude === null ||
          !Number.isFinite(item.latitude) ||
          !Number.isFinite(item.longitude)
        ) {
          return false;
        }

        if (hasRadiusCenter && radiusKm !== null) {
          const dist = haversineKm(centerLat!, centerLng!, item.latitude, item.longitude);
          return dist <= radiusKm;
        }
        return true;
      })
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
  }, [filters.centerLat, filters.centerLng, filters.radiusKm, mapItems]);
  const visibleMapPointIds = useMemo(
    () => new Set(mapPoints.map((point) => point.id)),
    [mapPoints],
  );
  const mapItemById = useMemo(
    () => new Map(mapItems.map((item) => [item.id, item] as const)),
    [mapItems],
  );
  const activePopupItem =
    activePointId && visibleMapPointIds.has(activePointId)
      ? (mapItemById.get(activePointId) ?? null)
      : null;
  const foundProgramsLabel = formatRuCount(pagination.total, "программа", "программы", "программ");
  const mobileSheetSnaps = useMemo<MobileSheetSnaps>(() => {
    const height = mobileStageHeight || 640;
    const collapsed = Math.max(
      0,
      height - MOBILE_SHEET_HANDLE_HEIGHT - MOBILE_SHEET_BOTTOM_CLEARANCE,
    );
    const preview = clamp(Math.round(height * 0.36), 150, Math.max(150, collapsed - 118));

    return {
      expanded: 0,
      preview,
      collapsed,
    };
  }, [mobileStageHeight]);
  const resolvedMobileSheetTop =
    isMobileSheetDragging && mobileSheetTop !== null
      ? mobileSheetTop
      : mobileSheetSnaps[mobileSheetSnap];
  const mobileSheetVisibleHeight = Math.max(
    MOBILE_SHEET_HANDLE_HEIGHT,
    (mobileStageHeight || 640) - resolvedMobileSheetTop,
  );
  const mobilePopupBottom = clamp(mobileSheetVisibleHeight + 14, 92, 180);

  const radiusCircle = useMemo<YandexMapRadiusCircle | null>(() => {
    if (
      filters.centerLat !== null &&
      filters.centerLng !== null &&
      Number.isFinite(filters.centerLat) &&
      Number.isFinite(filters.centerLng)
    ) {
      return {
        center: [filters.centerLat, filters.centerLng],
        radiusKm: filters.radiusKm,
      };
    }
    return null;
  }, [filters.centerLat, filters.centerLng, filters.radiusKm]);
  const mapViewport = useMemo<YandexMapViewport | null>(() => {
    if (
      filters.centerLat !== null &&
      filters.centerLng !== null &&
      Number.isFinite(filters.centerLat) &&
      Number.isFinite(filters.centerLng)
    ) {
      return {
        center: [filters.centerLat, filters.centerLng],
        zoom: filters.radiusKm <= 15 ? 12 : filters.radiusKm <= 35 ? 11 : 10,
      };
    }

    return null;
  }, [filters.centerLat, filters.centerLng, filters.radiusKm]);
  const mapViewportKey = useMemo(() => {
    if (!mapViewport) {
      return undefined;
    }

    return [
      filters.locationName ?? "",
      filters.centerLat,
      filters.centerLng,
      filters.radiusKm,
      offerType,
    ].join(":");
  }, [
    filters.centerLat,
    filters.centerLng,
    filters.locationName,
    filters.radiusKm,
    mapViewport,
    offerType,
  ]);

  const focusCardById = useCallback((pointId: string) => {
    const node = cardRefsMap.current.get(pointId);
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  // ── Navigation on pin click ──────────────────────────────────────────────────
  const handleMapPointClick = useCallback(
    (pointId: string) => {
      setActivePointId(pointId);
      setHoveredPinId(pointId);
      if (!mapExpanded) {
        focusCardById(pointId);
      }
    },
    [focusCardById, mapExpanded],
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
      if (filters.offerType) p.set("offerType", filters.offerType);
      if (filters.districtSlug) p.set("district", filters.districtSlug);
      if (filters.categorySlug) p.set("category", filters.categorySlug);
      if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) p.set("dateTo", filters.dateTo);
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
      const data = (await response.json()) as { items: PublicExcursionCatalogItem[]; page: number };
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
      if (pointId && !mapExpanded) {
        const el = cardRefsMap.current.get(pointId);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    [mapExpanded],
  );

  // ── Map helpers ───────────────────────────────────────────────────────────────
  function openMapFully() {
    setMapExpanded(true);
  }

  function closeMapFully() {
    setMapExpanded(false);
    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPinId(null);
  }

  function handleMobileSheetPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    mobileDragStartYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleMobileSheetPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const startY = mobileDragStartYRef.current;
    mobileDragStartYRef.current = null;

    if (startY === null) {
      return;
    }

    const deltaY = event.clientY - startY;
    if (deltaY < -18) {
      mobileDragHandledRef.current = true;
      setIsMobileMapCollapsed(true);
      return;
    }

    if (deltaY > 18) {
      mobileDragHandledRef.current = true;
      setIsMobileMapCollapsed(false);
    }
  }

  function handleMobileSheetClick() {
    if (mobileDragHandledRef.current) {
      mobileDragHandledRef.current = false;
      return;
    }

    setIsMobileMapCollapsed((current) => !current);
  }

  const setMobileChromeProgress = useCallback((progress: number, force = false) => {
    const nextProgress = clamp(Math.round(progress * 1000) / 1000, 0, 1);

    if (!force && Math.abs(mobileChromeProgressRef.current - nextProgress) < 0.004) {
      return;
    }

    mobileChromeProgressRef.current = nextProgress;
    setPublicMobileBottomNavProgress(nextProgress);
  }, []);

  const snapMobileSheet = useCallback(
    (snap: MobileSheetSnap) => {
      mobileSheetTopRef.current = mobileSheetSnaps[snap];
      setMobileSheetSnap(snap);
      setMobileSheetTop(mobileSheetSnaps[snap]);
    },
    [mobileSheetSnaps],
  );

  function handleCatalogMobileMapPointClick(pointId: string) {
    setActivePointId(pointId);
    setHoveredPinId(pointId);
    snapMobileSheet("collapsed");
  }

  function openCatalogMobileMapInSearch() {
    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPinId(null);
    setMobileChromeProgress(0, true);
    snapMobileSheet("collapsed");
  }

  function handleCatalogMobileMapPointerDown() {
    if (mapPlacement !== "mobile") {
      setActivePointId(null);
      setHoveredCardId(null);
      setHoveredPinId(null);
      return;
    }

    if (mobileSheetSnap !== "collapsed") {
      snapMobileSheet("collapsed");
    }

    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPinId(null);
  }

  function handleCatalogMobileSheetPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    mobileSheetTopRef.current = resolvedMobileSheetTop;
    mobileSheetDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop: resolvedMobileSheetTop,
      didMove: false,
    };
    setIsMobileSheetDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCatalogMobileSheetPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = mobileSheetDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = event.clientY - dragState.startY;
    const nextTop = clamp(
      dragState.startTop + deltaY,
      mobileSheetSnaps.expanded,
      mobileSheetSnaps.collapsed,
    );

    if (Math.abs(deltaY) > 3) {
      dragState.didMove = true;
      mobileDragHandledRef.current = true;
    }

    mobileSheetTopRef.current = nextTop;
    setMobileSheetTop(nextTop);
    event.preventDefault();
  }

  function handleCatalogMobileSheetPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = mobileSheetDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    mobileSheetDragRef.current = null;
    setIsMobileSheetDragging(false);

    if (!dragState.didMove) {
      return;
    }

    const currentTop =
      mobileSheetTopRef.current ?? mobileSheetTop ?? mobileSheetSnaps[mobileSheetSnap];
    const nextSnap = getNearestMobileSheetSnap(currentTop, mobileSheetSnaps);
    snapMobileSheet(nextSnap);
  }

  function handleCatalogMobileSheetPointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = mobileSheetDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    mobileSheetDragRef.current = null;
    setIsMobileSheetDragging(false);
    snapMobileSheet(mobileSheetSnap);
  }

  function handleCatalogMobileSheetClick() {
    if (mobileDragHandledRef.current) {
      mobileDragHandledRef.current = false;
      return;
    }

    if (mobileSheetSnap === "collapsed") {
      snapMobileSheet("preview");
      return;
    }

    if (mobileSheetSnap === "expanded") {
      snapMobileSheet("preview");
      return;
    }

    snapMobileSheet("expanded");
  }

  function handleCatalogMobileResultsScroll(event: ReactUIEvent<HTMLDivElement>) {
    const currentScrollTop = event.currentTarget.scrollTop;
    const previousScrollTop = mobileResultsScrollTopRef.current;
    mobileResultsScrollTopRef.current = currentScrollTop;

    if (mapPlacement !== "mobile" || mobileSheetSnap !== "expanded" || mapExpanded) {
      return;
    }

    if (currentScrollTop < 8) {
      setMobileChromeProgress(0);
      return;
    }

    const delta = currentScrollTop - previousScrollTop;
    if (Math.abs(delta) < 1) {
      return;
    }

    setMobileChromeProgress(
      mobileChromeProgressRef.current + delta / MOBILE_SHEET_CHROME_SCROLL_RANGE,
    );
  }

  useEffect(() => {
    const shouldControlMobileChrome =
      mapPlacement === "mobile" && mobileSheetSnap === "expanded" && !mapExpanded;

    if (shouldControlMobileChrome) {
      mobileResultsScrollTopRef.current = mobileResultsScrollRef.current?.scrollTop ?? 0;
    }

    setMobileChromeProgress(0, true);
  }, [mapExpanded, mapPlacement, mobileSheetSnap, setMobileChromeProgress]);

  useEffect(() => {
    return () => {
      setPublicMobileBottomNavProgress(0);
    };
  }, []);

  useEffect(() => {
    if (mapPlacement !== "mobile" || mapExpanded || mobileSheetSnap !== "expanded") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const results = mobileResultsScrollRef.current;
      if (!results) {
        return;
      }

      results.scrollTop = MOBILE_SHEET_HANDLE_HEIGHT;
      mobileResultsScrollTopRef.current = results.scrollTop;
      setMobileChromeProgress(0, true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mapExpanded, mapPlacement, mobileSheetSnap, setMobileChromeProgress]);

  useEffect(() => {
    const shouldHideNav =
      mapPlacement === "mobile" && (mapExpanded || mobileSheetSnap === "collapsed");

    setPublicMobileBottomNavForceHidden(`${catalogDirection}-catalog-map`, shouldHideNav);

    return () => {
      setPublicMobileBottomNavForceHidden(`${catalogDirection}-catalog-map`, false);
    };
  }, [catalogDirection, mapExpanded, mapPlacement, mobileSheetSnap]);

  useLayoutEffect(() => {
    if (mapPlacement !== "mobile") {
      return;
    }

    const updateHeight = () => {
      const stage = mobileStageRef.current;
      const viewportHeight = window.innerHeight || MOBILE_STAGE_MIN_HEIGHT;
      const top = stage?.getBoundingClientRect().top ?? 0;
      const available = viewportHeight - Math.max(0, top);
      const nextHeight = clamp(
        Math.round(available),
        Math.min(MOBILE_STAGE_MIN_HEIGHT, viewportHeight),
        Math.min(MOBILE_STAGE_MAX_HEIGHT, viewportHeight),
      );

      setMobileStageHeight(nextHeight);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    window.addEventListener("orientationchange", updateHeight);
    window.addEventListener("scroll", updateHeight, { passive: true });

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      updateHeight();
      secondFrame = window.requestAnimationFrame(updateHeight);
    });
    const settleTimer = window.setTimeout(updateHeight, 240);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("orientationchange", updateHeight);
      window.removeEventListener("scroll", updateHeight);
    };
  }, [mapPlacement]);

  const shouldShowMobileMapButton =
    mapPlacement === "mobile" &&
    !mapExpanded &&
    mobileSheetSnap === "expanded" &&
    resolvedMobileSheetTop <= mobileSheetSnaps.expanded + 1;
  const isCatalogMobileSheetExpanded = mobileSheetSnap === "expanded";
  const catalogMobileSheetHandle = (
    <button
      type="button"
      onClick={handleCatalogMobileSheetClick}
      onPointerDown={handleCatalogMobileSheetPointerDown}
      onPointerMove={handleCatalogMobileSheetPointerMove}
      onPointerUp={handleCatalogMobileSheetPointerUp}
      onPointerCancel={handleCatalogMobileSheetPointerCancel}
      className="flex h-[76px] w-full touch-none cursor-grab flex-col items-center gap-2 rounded-t-[26px] px-2 pb-3 pt-2 text-center text-olive active:cursor-grabbing"
      aria-expanded={mobileSheetSnap !== "collapsed"}
      aria-controls="catalog-results"
    >
      <span
        className="h-1 w-16 rounded-full bg-white/70 shadow-[0_1px_5px_rgba(255,255,255,0.72)] ring-1 ring-white/80"
        aria-hidden="true"
      />
      <span className="relative isolate inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,255,255,0.48)_52%,rgba(255,255,255,0.72))] px-4 py-2 text-sm font-semibold shadow-[0_18px_36px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-12px_24px_rgba(255,255,255,0.18)] ring-1 ring-white/72 backdrop-blur-xl">
        Найдено {foundProgramsLabel}
        <AppIcon
          icon={mobileSheetSnap === "expanded" ? ChevronDown : ChevronUp}
          className="h-4 w-4 text-olive/48"
        />
      </span>
    </button>
  );

  const mapStatsLabel = `На карте: ${mapPoints.length}`;
  const renderMapStatusOverlay = () => {
    if (isMapPointsLoading) {
      return (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 inline-flex items-center gap-2 rounded-full bg-white/94 px-3 py-1.5 text-xs font-semibold text-olive shadow-sm ring-1 ring-black/5">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-olive/30 border-t-olive" />
          Обновляем точки
        </div>
      );
    }

    if (mapPointsError) {
      return (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 rounded-2xl bg-white/94 px-3 py-2 text-xs font-medium text-amber-700 shadow-sm ring-1 ring-black/5 sm:right-auto sm:max-w-sm">
          {mapPointsError}
        </div>
      );
    }

    return null;
  };

  // ── Apply filters ─────────────────────────────────────────────────────────────
  const applyFilters = useCallback(
    (overrides: Record<string, string> = {}) => {
      // URL is the source of truth: push a new search URL and let server return canonical filters.
      const params: Record<string, string> = {
        q: query,
        offerType,
        location,
        district,
        category,
        checkIn: dateFrom,
        checkOut: dateTo,
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
      const nextDirection = params.offerType === "tour" ? "tours" : "excursions";

      if (
        (nextDirection === "tours" && params.offerType === "tour") ||
        (nextDirection === "excursions" && params.offerType === "excursion")
      ) {
        params.offerType = "";
      }

      setOpenFilterPanel(null);
      setActiveLocationDropdown(null);
      router.push(buildSearchUrl(nextDirection, params));
    },
    [
      query,
      offerType,
      location,
      district,
      category,
      dateFrom,
      dateTo,
      guests,
      format,
      durationBucket,
      minPrice,
      maxPrice,
      radiusKm,
      pickup,
      kids,
      sort,
      router,
    ],
  );

  const resetAllFilters = useCallback(() => {
    router.push(catalogDirection === "tours" ? toursHubPath : excursionsHubPath);
  }, [catalogDirection, router]);

  const defaultCatalogOfferType = catalogDirection === "tours" ? "tour" : "excursion";
  const isDefaultCatalogOffer = filters.offerType === defaultCatalogOfferType;

  // ── Active filter chips data ──────────────────────────────────────────────────
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];

    if (filters.locationName) {
      chips.push({
        key: "location",
        label: filters.locationName,
        onClear: () => applyFilters({ location: "", radiusKm: "30" }),
      });
    }
    if (filters.locationName && filters.radiusKm !== 30) {
      chips.push({
        key: "radius",
        label: `${filters.radiusKm} км`,
        onClear: () => applyFilters({ radiusKm: "30" }),
      });
    }
    if (filters.districtName) {
      chips.push({
        key: "district",
        label: filters.districtName,
        onClear: () => applyFilters({ district: "" }),
      });
    }
    if (filters.categoryName) {
      chips.push({
        key: "category",
        label: filters.categoryName,
        onClear: () => applyFilters({ category: "" }),
      });
    }
    if (filters.offerType === "excursion" && !isDefaultCatalogOffer) {
      chips.push({
        key: "offerType",
        label: "Экскурсии",
        onClear: () => applyFilters({ offerType: "" }),
      });
    } else if (filters.offerType === "tour" && !isDefaultCatalogOffer) {
      chips.push({
        key: "offerType",
        label: "Туры",
        onClear: () => applyFilters({ offerType: "" }),
      });
    }
    if (filters.query) {
      chips.push({
        key: "query",
        label: `«${filters.query}»`,
        onClear: () => applyFilters({ q: "" }),
      });
    }
    if (filters.dateFrom) {
      const dateLabel = filters.dateTo
        ? `${formatDayMonth(filters.dateFrom)} - ${formatDayMonth(filters.dateTo)}`
        : formatDayMonth(filters.dateFrom);
      chips.push({
        key: "date",
        label: dateLabel,
        onClear: () => applyFilters({ checkIn: "", checkOut: "" }),
      });
    }
    if (filters.people && filters.people !== 2) {
      chips.push({
        key: "people",
        label: `${filters.people} ${pluralizeGuests(filters.people)}`,
        onClear: () => applyFilters({ guests: "2" }),
      });
    }
    if (filters.minPrice || filters.maxPrice) {
      chips.push({
        key: "price",
        label: getExcursionBudgetLabel(filters.minPrice, filters.maxPrice),
        onClear: () => applyFilters({ minPrice: "", maxPrice: "" }),
      });
    }
    if (filters.durationBucket === "up_to_3h") {
      chips.push({
        key: "duration",
        label: getDurationShortFilterLabel(filters.durationBucket),
        onClear: () => applyFilters({ durationBucket: "" }),
      });
    } else if (filters.durationBucket === "between_3h_6h") {
      chips.push({
        key: "duration",
        label: getDurationShortFilterLabel(filters.durationBucket),
        onClear: () => applyFilters({ durationBucket: "" }),
      });
    } else if (filters.durationBucket === "more_6h") {
      chips.push({
        key: "duration",
        label: getDurationShortFilterLabel(filters.durationBucket),
        onClear: () => applyFilters({ durationBucket: "" }),
      });
    }
    if (filters.format === "group") {
      chips.push({
        key: "format",
        label: "Групповая",
        onClear: () => applyFilters({ format: "" }),
      });
    } else if (filters.format === "private") {
      chips.push({
        key: "format",
        label: "Индивидуальная",
        onClear: () => applyFilters({ format: "" }),
      });
    }
    if (filters.pickup) {
      chips.push({ key: "pickup", label: "Трансфер", onClear: () => applyFilters({ pickup: "" }) });
    }
    if (filters.kids) {
      chips.push({ key: "kids", label: "Для детей", onClear: () => applyFilters({ kids: "" }) });
    }
    if (filters.sort && filters.sort !== "relevance") {
      chips.push({
        key: "sort",
        label: getSortFilterLabel(filters.sort),
        onClear: () => applyFilters({ sort: "" }),
      });
    }

    return chips;
  }, [filters, applyFilters, isDefaultCatalogOffer]);

  const moreFiltersCount =
    Number(Boolean(filters.districtName)) +
    Number(Boolean(filters.categoryName)) +
    Number(filters.pickup) +
    Number(filters.kids);
  const effectiveProgramOfferType = isDefaultCatalogOffer ? "" : (filters.offerType ?? "");
  const programFiltersCount =
    Number(Boolean(filters.query?.trim())) +
    Number(Boolean(effectiveProgramOfferType)) +
    Number(Boolean(filters.format)) +
    Number(Boolean(filters.durationBucket));
  const moreFiltersLabel = moreFiltersCount > 0 ? `Еще · ${moreFiltersCount}` : "Еще";
  const programChipLabel =
    isDefaultCatalogOffer && programFiltersCount === 0
      ? getOfferTypeFilterLabel(defaultCatalogOfferType)
      : getProgramFilterChipLabel({
          query: filters.query,
          offerType: effectiveProgramOfferType,
          format: filters.format,
          durationBucket: filters.durationBucket ?? "",
        });
  const resetProgramFilters = () => {
    const baseOfferType = defaultCatalogOfferType;

    setQuery("");
    setOfferType(baseOfferType);
    setFormat("");
    setDurationBucket("");
    applyFilters({ q: "", offerType: baseOfferType, format: "", durationBucket: "" });
  };
  const locationChipLabel = getLocationFilterChipLabel(filters.locationName, filters.radiusKm);
  const appliedDateLabel = filters.dateFrom
    ? filters.dateTo
      ? `${formatDayMonth(filters.dateFrom)} - ${formatDayMonth(filters.dateTo)}`
      : formatDayMonth(filters.dateFrom)
    : "Даты";
  const participantsChipLabel = getParticipantsFilterChipLabel(filters.people);
  const budgetChipLabel = getExcursionBudgetLabel(filters.minPrice, filters.maxPrice);
  const mapTitle =
    filters.offerType === "tour"
      ? "Карта туров"
      : filters.offerType === "excursion"
        ? "Карта экскурсий"
        : "Карта программ";
  const resultsTitle =
    filters.offerType === "tour"
      ? "туры"
      : filters.offerType === "excursion"
        ? "экскурсии"
        : "варианты";
  const draftGuestsValue = Number.isFinite(Number.parseInt(guests, 10))
    ? Math.max(1, Math.min(40, Number.parseInt(guests, 10)))
    : 2;
  const radiusIsEnabled = Boolean(location.trim() || filters.locationName);
  const leftPricePct =
    ((Number(minPrice || EXCURSION_PRICE_MIN_BOUND) - EXCURSION_PRICE_MIN_BOUND) /
      (EXCURSION_PRICE_MAX_BOUND - EXCURSION_PRICE_MIN_BOUND)) *
    100;
  const rightPricePct =
    ((Number(maxPrice || EXCURSION_PRICE_MAX_BOUND) - EXCURSION_PRICE_MIN_BOUND) /
      (EXCURSION_PRICE_MAX_BOUND - EXCURSION_PRICE_MIN_BOUND)) *
    100;

  const updatePriceRange = useCallback(
    (patch: { minPrice?: number; maxPrice?: number }) => {
      const currentMin = Number(minPrice || EXCURSION_PRICE_MIN_BOUND);
      const currentMax = Number(maxPrice || EXCURSION_PRICE_MAX_BOUND);
      const nextMin = patch.minPrice ?? currentMin;
      const nextMax = patch.maxPrice ?? currentMax;
      const safeMin = Math.min(
        nextMax,
        Math.max(
          EXCURSION_PRICE_MIN_BOUND,
          Math.floor(nextMin / EXCURSION_PRICE_STEP) * EXCURSION_PRICE_STEP,
        ),
      );
      const safeMax = Math.max(
        safeMin,
        Math.min(
          EXCURSION_PRICE_MAX_BOUND,
          Math.ceil(nextMax / EXCURSION_PRICE_STEP) * EXCURSION_PRICE_STEP,
        ),
      );

      setMinPrice(safeMin > EXCURSION_PRICE_MIN_BOUND ? String(safeMin) : "");
      setMaxPrice(safeMax < EXCURSION_PRICE_MAX_BOUND ? String(safeMax) : "");
    },
    [maxPrice, minPrice],
  );

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 pb-24 md:px-6 md:pb-8">
      <CatalogFilterShell
        className="-mx-4 md:-mx-6"
        chips={
          <>
            <ResponsiveFilterPanel
              open={openFilterPanel === "program"}
              className="order-3 md:order-1"
              title="Программа"
              onClose={() => setOpenFilterPanel(null)}
              width={520}
              trigger={
                <CatalogFilterChipButton
                  icon={Sparkles}
                  label={programChipLabel}
                  active={programFiltersCount > 0}
                  open={openFilterPanel === "program"}
                  onClick={() =>
                    setOpenFilterPanel((current) => (current === "program" ? null : "program"))
                  }
                  onClear={programFiltersCount > 0 ? resetProgramFilters : undefined}
                />
              }
              footer={
                <CatalogFilterPanelActions
                  onApply={() => applyFilters()}
                  onClear={resetProgramFilters}
                  applyLabel="Показать варианты"
                />
              }
            >
              <div className="space-y-5">
                <CatalogFieldGroup label="Что хочется найти">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-olive/35" />
                    <input
                      name="searchQuery"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Название, маршрут, формат..."
                      className="h-12 w-full rounded-[20px] border border-olive/14 bg-white px-4 pl-11 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </CatalogFieldGroup>

                <div className="grid gap-4 md:grid-cols-2">
                  <CatalogFieldGroup label="Тип программы">
                    <div className="flex flex-wrap gap-2">
                      {offerTypeOptions.map((option) => (
                        <ExcursionOptionPill
                          key={option.label}
                          selected={offerType === option.value}
                          onClick={() => setOfferType(option.value)}
                        >
                          {option.label}
                        </ExcursionOptionPill>
                      ))}
                    </div>
                  </CatalogFieldGroup>

                  <CatalogFieldGroup label="Формат">
                    <div className="flex flex-wrap gap-2">
                      {formatOptions.map((option) => (
                        <ExcursionOptionPill
                          key={option.value || "any"}
                          selected={format === option.value}
                          onClick={() => setFormat(option.value)}
                        >
                          {option.label}
                        </ExcursionOptionPill>
                      ))}
                    </div>
                  </CatalogFieldGroup>
                </div>

                <CatalogFieldGroup label="Длительность">
                  <div className="flex flex-wrap gap-2">
                    {durationOptions.map((option) => (
                      <ExcursionOptionPill
                        key={option.value || "any"}
                        selected={durationBucket === option.value}
                        onClick={() => setDurationBucket(option.value)}
                      >
                        {option.label}
                      </ExcursionOptionPill>
                    ))}
                  </div>
                </CatalogFieldGroup>
              </div>
            </ResponsiveFilterPanel>

            <ResponsiveFilterPanel
              open={openFilterPanel === "location"}
              className="order-1 md:order-2"
              title="Локация"
              onClose={() => {
                setOpenFilterPanel(null);
                setActiveLocationDropdown(null);
                setActiveLocationSuggestionIndex(-1);
              }}
              width={440}
              trigger={
                <CatalogFilterChipButton
                  icon={MapPin}
                  label={locationChipLabel}
                  active={Boolean(filters.locationName)}
                  open={openFilterPanel === "location"}
                  onClick={() =>
                    setOpenFilterPanel((current) => (current === "location" ? null : "location"))
                  }
                  onClear={
                    filters.locationName
                      ? () => applyFilters({ location: "", radiusKm: "30" })
                      : undefined
                  }
                />
              }
              footer={
                <CatalogFilterPanelActions
                  onApply={() => {
                    commitRecentExcursionLocation(location);
                    applyFilters();
                  }}
                  onClear={() => {
                    setLocation("");
                    setRadiusKm("30");
                    setActiveLocationDropdown(null);
                    setActiveLocationSuggestionIndex(-1);
                    applyFilters({ location: "", radiusKm: "30" });
                  }}
                  applyLabel="Показать варианты"
                />
              }
            >
              <div className="space-y-5">
                <div
                  ref={isMobileViewport ? mobileLocationComboboxRef : desktopLocationComboboxRef}
                  className={cn("relative", isLocationDropdownVisible ? "z-[30]" : "")}
                >
                  <input
                    name="location"
                    ref={isMobileViewport ? mobileLocationInputRef : desktopLocationInputRef}
                    value={location}
                    onChange={(event) => {
                      setLocation(event.target.value.slice(0, 120));
                      setActiveLocationDropdown(locationScope);
                      setActiveLocationSuggestionIndex(-1);
                    }}
                    autoComplete="off"
                    placeholder="Ялта, Судак..."
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isLocationDropdownVisible}
                    aria-controls={activeLocationListboxId}
                    aria-activedescendant={activeLocationOptionId}
                    onClick={() => openLocationDropdown(locationScope)}
                    onKeyDown={(event) => handleLocationInputKeyDown(locationScope, event)}
                    className="h-12 w-full rounded-[20px] border border-olive/14 bg-white px-4 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />

                  {isLocationDropdownVisible ? (
                    <div className="mt-2 overflow-hidden rounded-[24px] border border-sand bg-white shadow-[0_20px_36px_-24px_rgba(15,118,110,0.52)]">
                      <div
                        id={activeLocationListboxId}
                        role="listbox"
                        className="max-h-[320px] overflow-y-auto p-1.5"
                      >
                        {isLocationSuggestionsLoading && locationDropdownOptions.length === 0 ? (
                          <p className="px-3 py-5 text-sm text-olive/65">
                            Ищем подходящие варианты...
                          </p>
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
                                renderLocationSuggestionButton(
                                  locationScope,
                                  "recent",
                                  item,
                                  index,
                                ),
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
                                renderLocationSuggestionButton(
                                  locationScope,
                                  "popular",
                                  item,
                                  index,
                                ),
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
                                renderLocationSuggestionButton(
                                  locationScope,
                                  "matches",
                                  item,
                                  index,
                                ),
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

                <CatalogFieldGroup
                  label="Радиус поиска"
                  description={
                    radiusIsEnabled
                      ? "Подберем программы рядом с выбранной локацией."
                      : "Сначала выберите локацию, затем уточните расстояние."
                  }
                >
                  <div className="rounded-[24px] border border-olive/10 bg-cream/40 px-4 py-4">
                    <div className="flex items-center justify-between text-xs text-olive/60">
                      <span>5 км</span>
                      <span className="text-sm font-semibold text-olive">{radiusKm} км</span>
                      <span>100 км</span>
                    </div>
                    <input
                      name="radiusKm"
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={radiusKm}
                      onChange={(event) => setRadiusKm(event.target.value)}
                      disabled={!radiusIsEnabled}
                      className="mt-3 w-full accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </div>
                </CatalogFieldGroup>
              </div>
            </ResponsiveFilterPanel>

            <ResponsiveFilterPanel
              open={openFilterPanel === "date"}
              className="order-2 md:order-3"
              title="Даты"
              onClose={() => setOpenFilterPanel(null)}
              width={DATE_PANEL_WIDTH}
              maxHeight={DATE_PANEL_MAX_HEIGHT}
              trigger={
                <CatalogFilterChipButton
                  icon={CalendarDays}
                  label={appliedDateLabel}
                  active={Boolean(filters.dateFrom || filters.dateTo)}
                  open={openFilterPanel === "date"}
                  onClick={() =>
                    setOpenFilterPanel((current) => (current === "date" ? null : "date"))
                  }
                  onClear={
                    filters.dateFrom || filters.dateTo
                      ? () => applyFilters({ checkIn: "", checkOut: "" })
                      : undefined
                  }
                />
              }
              footer={
                <CatalogFilterPanelActions
                  onApply={() => applyFilters()}
                  onClear={() => {
                    setDateFrom("");
                    setDateTo("");
                    applyFilters({ checkIn: "", checkOut: "" });
                  }}
                  applyLabel="Показать варианты"
                />
              }
            >
              <UnifiedCalendarContent
                mode="range"
                value={{ checkIn: dateFrom, checkOut: dateTo }}
                onChange={({ checkIn, checkOut }) => {
                  setDateFrom(checkIn);
                  setDateTo(checkOut);
                }}
                renderHeaderAside={
                  dateFrom || dateTo ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                      className="rounded-md px-2 py-0.5 text-olive/65 transition hover:bg-foam hover:text-olive"
                    >
                      Очистить
                    </button>
                  ) : null
                }
              />
            </ResponsiveFilterPanel>

            <ResponsiveFilterPanel
              open={openFilterPanel === "guests"}
              className="order-4"
              title="Гости"
              onClose={() => setOpenFilterPanel(null)}
              width={412}
              trigger={
                <CatalogFilterChipButton
                  icon={Users}
                  label={participantsChipLabel}
                  active={Boolean(filters.people && filters.people !== 2)}
                  open={openFilterPanel === "guests"}
                  onClick={() =>
                    setOpenFilterPanel((current) => (current === "guests" ? null : "guests"))
                  }
                  onClear={
                    filters.people && filters.people !== 2
                      ? () => applyFilters({ guests: "2" })
                      : undefined
                  }
                />
              }
              footer={
                <CatalogFilterPanelActions
                  onApply={() => applyFilters()}
                  onClear={() => {
                    setGuests("2");
                    applyFilters({ guests: "2" });
                  }}
                  applyLabel="Показать варианты"
                />
              }
            >
              <UnifiedGuestsEditor
                mode="simple"
                value={draftGuestsValue}
                onChange={(nextValue) => setGuests(String(nextValue))}
                min={1}
                max={40}
                label="Гости"
                description="От 1 до 40 человек"
              />
            </ResponsiveFilterPanel>

            <ResponsiveFilterPanel
              open={openFilterPanel === "price"}
              className="order-5"
              title="Цена"
              onClose={() => setOpenFilterPanel(null)}
              width={420}
              trigger={
                <CatalogFilterChipButton
                  icon={WalletCards}
                  label={budgetChipLabel}
                  active={Boolean(filters.minPrice || filters.maxPrice)}
                  open={openFilterPanel === "price"}
                  onClick={() =>
                    setOpenFilterPanel((current) => (current === "price" ? null : "price"))
                  }
                  onClear={
                    filters.minPrice || filters.maxPrice
                      ? () => applyFilters({ minPrice: "", maxPrice: "" })
                      : undefined
                  }
                />
              }
              footer={
                <CatalogFilterPanelActions
                  onApply={() => applyFilters()}
                  onClear={() => {
                    setMinPrice("");
                    setMaxPrice("");
                    applyFilters({ minPrice: "", maxPrice: "" });
                  }}
                  applyLabel="Показать варианты"
                />
              }
            >
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <CatalogFieldGroup label="От">
                    <input
                      name="minPrice"
                      type="number"
                      min={EXCURSION_PRICE_MIN_BOUND}
                      max={EXCURSION_PRICE_MAX_BOUND}
                      step={EXCURSION_PRICE_STEP}
                      value={minPrice}
                      onChange={(event) =>
                        updatePriceRange({
                          minPrice: Number(event.target.value || EXCURSION_PRICE_MIN_BOUND),
                        })
                      }
                      className="h-12 w-full rounded-2xl border border-olive/16 bg-white px-4 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="Без минимума"
                    />
                  </CatalogFieldGroup>
                  <CatalogFieldGroup label="До">
                    <input
                      name="maxPrice"
                      type="number"
                      min={EXCURSION_PRICE_MIN_BOUND}
                      max={EXCURSION_PRICE_MAX_BOUND}
                      step={EXCURSION_PRICE_STEP}
                      value={maxPrice}
                      onChange={(event) =>
                        updatePriceRange({
                          maxPrice: Number(event.target.value || EXCURSION_PRICE_MAX_BOUND),
                        })
                      }
                      className="h-12 w-full rounded-2xl border border-olive/16 bg-white px-4 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="Без лимита"
                    />
                  </CatalogFieldGroup>
                </div>
                <div className="rounded-2xl border border-olive/10 bg-cream/45 px-4 py-4">
                  <div className="relative h-8">
                    <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-olive/10" />
                    <div
                      className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary/70"
                      style={{
                        left: `${leftPricePct}%`,
                        width: `${Math.max(0, rightPricePct - leftPricePct)}%`,
                      }}
                    />
                    <input
                      name="minPriceRange"
                      type="range"
                      min={EXCURSION_PRICE_MIN_BOUND}
                      max={EXCURSION_PRICE_MAX_BOUND}
                      step={EXCURSION_PRICE_STEP}
                      value={Number(minPrice || EXCURSION_PRICE_MIN_BOUND)}
                      onChange={(event) =>
                        updatePriceRange({ minPrice: Number(event.target.value) })
                      }
                      className="pointer-events-none absolute inset-x-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white"
                    />
                    <input
                      name="maxPriceRange"
                      type="range"
                      min={EXCURSION_PRICE_MIN_BOUND}
                      max={EXCURSION_PRICE_MAX_BOUND}
                      step={EXCURSION_PRICE_STEP}
                      value={Number(maxPrice || EXCURSION_PRICE_MAX_BOUND)}
                      onChange={(event) =>
                        updatePriceRange({ maxPrice: Number(event.target.value) })
                      }
                      className="pointer-events-none absolute inset-x-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-medium text-olive/55">
                    <span>0 ₽</span>
                    <span>50 000 ₽</span>
                    <span>100 000 ₽+</span>
                  </div>
                </div>
              </div>
            </ResponsiveFilterPanel>

            <ResponsiveFilterPanel
              open={openFilterPanel === "more"}
              className="order-6"
              title="Еще параметры"
              onClose={() => setOpenFilterPanel(null)}
              width={440}
              align="end"
              trigger={
                <CatalogFilterChipButton
                  icon={SlidersHorizontal}
                  label={moreFiltersLabel}
                  active={moreFiltersCount > 0}
                  open={openFilterPanel === "more"}
                  onClick={() =>
                    setOpenFilterPanel((current) => (current === "more" ? null : "more"))
                  }
                  onClear={
                    moreFiltersCount > 0
                      ? () => applyFilters({ district: "", category: "", pickup: "", kids: "" })
                      : undefined
                  }
                />
              }
              footer={
                <CatalogFilterPanelActions
                  onApply={() => applyFilters()}
                  onClear={() => {
                    setDistrict("");
                    setCategory("");
                    setPickup(false);
                    setKids(false);
                    applyFilters({ district: "", category: "", pickup: "", kids: "" });
                  }}
                  applyLabel="Показать варианты"
                />
              }
            >
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <CatalogFieldGroup label="Округ">
                    <select
                      name="district"
                      value={district}
                      onChange={(event) => setDistrict(event.target.value)}
                      className="h-12 w-full rounded-[20px] border border-olive/14 bg-white px-4 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Все округа</option>
                      {districts.map((item) => (
                        <option key={item.slug} value={item.slug}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </CatalogFieldGroup>

                  <CatalogFieldGroup label="Категория">
                    <select
                      name="category"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className="h-12 w-full rounded-[20px] border border-olive/14 bg-white px-4 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Все категории</option>
                      {categories.map((item) => (
                        <option key={item.slug} value={item.slug}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </CatalogFieldGroup>
                </div>

                <CatalogFieldGroup label="Полезные детали">
                  <div className="grid gap-2 md:grid-cols-2">
                    <ExcursionToggleCard
                      label="Нужен трансфер"
                      selected={pickup}
                      onClick={() => setPickup((current) => !current)}
                    />
                    <ExcursionToggleCard
                      label="Подходит для детей"
                      selected={kids}
                      onClick={() => setKids((current) => !current)}
                    />
                  </div>
                </CatalogFieldGroup>
              </div>
            </ResponsiveFilterPanel>
          </>
        }
        totalLabel={`Найдено: ${foundProgramsLabel}`}
        hasActiveFilters={activeChips.length > 0}
        onResetAll={resetAllFilters}
      />

      {mapPlacement === "mobile" ? (
        <section ref={mobileStageRef} className="-mx-4 -mt-2 md:hidden">
          <div
            className="relative min-h-[360px] overflow-hidden bg-[#e7eef3]"
            style={{
              height: mobileStageHeight
                ? `${mobileStageHeight}px`
                : `min(${MOBILE_STAGE_MAX_HEIGHT}px, 100dvh)`,
            }}
          >
            <div
              className="absolute inset-0"
              onPointerDownCapture={handleCatalogMobileMapPointerDown}
            >
              <YandexMapMultiViewer
                points={mapPoints}
                activePointId={activePointId ?? hoveredCardId}
                hoveredPointId={hoveredPinId}
                onPointClick={handleCatalogMobileMapPointClick}
                onPointHoverChange={handlePinHover}
                initialViewport={mapViewport}
                viewportKey={mapViewportKey}
                radiusCircle={radiusCircle}
                controls={[]}
                showBalloons={false}
                frameless
                className="h-full w-full"
              />
            </div>

            {activePopupItem && mobileSheetSnap !== "expanded" ? (
              <div
                className="pointer-events-none absolute inset-x-3 z-30 flex justify-center transition-[bottom] duration-200 ease-out"
                style={{ bottom: `${mobilePopupBottom}px` }}
              >
                <MapExcursionPopupCard
                  key={activePopupItem.id}
                  item={activePopupItem}
                  onClose={() => setActivePointId(null)}
                  className="pointer-events-auto w-full max-w-[500px]"
                />
              </div>
            ) : null}
            {renderMapStatusOverlay()}

            <div
              className={cn(
                "absolute inset-x-0 top-0 z-40 h-full bg-transparent will-change-transform",
                isMobileSheetDragging
                  ? "transition-none"
                  : "transition-transform duration-300 ease-out",
              )}
              style={{ transform: `translate3d(0, ${resolvedMobileSheetTop}px, 0)` }}
            >
              <div className={cn("md:hidden", isCatalogMobileSheetExpanded && "hidden")}>
                {catalogMobileSheetHandle}
              </div>
              <div
                ref={mobileResultsScrollRef}
                onScroll={handleCatalogMobileResultsScroll}
                className={cn(
                  "overflow-y-auto overscroll-y-auto bg-[#f4f6fb] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)] shadow-[0_-18px_38px_rgba(15,23,42,0.15)] transition-opacity duration-150",
                  isCatalogMobileSheetExpanded
                    ? "h-full pt-0"
                    : "h-[calc(100%-76px)] rounded-t-[28px] pt-4",
                  mobileSheetSnap === "collapsed" ? "pointer-events-none opacity-0" : "opacity-100",
                )}
              >
                {isCatalogMobileSheetExpanded ? (
                  <div className="-mx-4">{catalogMobileSheetHandle}</div>
                ) : null}
                <section
                  id="catalog-results"
                  className={cn(
                    "min-w-0 flex-1 space-y-4 lg:w-full",
                    isCatalogMobileSheetExpanded && "pt-4",
                  )}
                >
                  {displayItems.length === 0 ? (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-dashed border-olive/25 bg-white/94 p-8 text-center">
                        <p className="text-sm text-olive/60">
                          По вашим параметрам {resultsTitle} не найдены.
                        </p>
                        <p className="mt-1 text-xs text-olive/45">
                          Попробуйте изменить локацию, увеличить радиус или снять часть фильтров.
                        </p>
                        <button
                          type="button"
                          onClick={resetAllFilters}
                          className="mt-4 rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          Сбросить все фильтры
                        </button>
                      </div>
                      <FirstListingPromo kind="excursions" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {displayItems.map((item) => (
                        <ExcursionCard
                          key={item.id}
                          item={item}
                          isHighlighted={hoveredPinId === item.id || activePointId === item.id}
                          onMouseEnter={() => {
                            setActivePointId(null);
                            setHoveredCardId(item.id);
                          }}
                          onMouseLeave={() => setHoveredCardId(null)}
                          cardRef={(el) => {
                            if (el) cardRefsMap.current.set(item.id, el);
                            else cardRefsMap.current.delete(item.id);
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {hasMore ? (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className={cn(
                          "load-more-btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto",
                          isLoadingMore ? "loading" : "",
                        )}
                      >
                        {isLoadingMore ? (
                          <AppIcon icon={LoaderCircle} className="h-4 w-4 animate-spin" />
                        ) : null}
                        {isLoadingMore
                          ? "Загружаем..."
                          : remaining > 30
                            ? "Показать ещё 30"
                            : `Показать оставшиеся ${remaining}`}
                      </button>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </div>
          {shouldShowMobileMapButton ? (
            <button
              type="button"
              onClick={openCatalogMobileMapInSearch}
              className="float-map-btn md:hidden"
              aria-label="Показать карту"
            >
              Карта
            </button>
          ) : null}
        </section>
      ) : null}

      {false && mapPlacement === "mobile" ? (
        <section className="-mx-4 -mt-2 overflow-hidden bg-[#e7eef3] md:hidden">
          <div
            className={cn(
              "relative transition-[height] duration-300 ease-out",
              isMobileMapCollapsed ? "h-[220px]" : "h-[42dvh] min-h-[310px] max-h-[520px]",
            )}
          >
            <YandexMapMultiViewer
              points={mapPoints}
              activePointId={activePointId ?? hoveredCardId}
              hoveredPointId={hoveredPinId}
              onPointClick={handleMapPointClick}
              onPointHoverChange={handlePinHover}
              initialViewport={mapViewport}
              viewportKey={mapViewportKey}
              radiusCircle={radiusCircle}
              controls={[]}
              className="h-full w-full rounded-none border-0"
            />

            <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
              <div className="min-w-0 rounded-[24px] bg-white/94 px-4 py-3 text-olive shadow-[0_16px_32px_rgba(15,23,42,0.14)] ring-1 ring-white/70 backdrop-blur">
                <p className="text-sm font-semibold leading-tight">{mapTitle}</p>
                <p className="mt-0.5 truncate text-xs text-olive/62">
                  {filters.locationName || "Крым"} · {foundProgramsLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={openMapFully}
                className="pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/94 text-olive shadow-[0_16px_32px_rgba(15,23,42,0.14)] ring-1 ring-white/70 backdrop-blur transition hover:bg-white"
                aria-label="Раскрыть карту полностью"
              >
                <AppIcon icon={MapIcon} className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {mapPlacement === "tablet" ? (
        <section className="mb-4 hidden overflow-hidden bg-[#e7eef3] md:block lg:hidden">
          <div className="hidden">
            <div>
              <p className="text-sm font-semibold text-olive">{mapTitle}</p>
              <p className="text-xs text-olive/65">{mapStatsLabel}</p>
            </div>
          </div>
          <div className="relative h-[320px] overflow-hidden">
            <YandexMapMultiViewer
              points={mapPoints}
              activePointId={activePointId ?? hoveredCardId}
              hoveredPointId={hoveredPinId}
              onPointClick={handleMapPointClick}
              onPointHoverChange={handlePinHover}
              initialViewport={mapViewport}
              viewportKey={mapViewportKey}
              radiusCircle={radiusCircle}
              showBalloons={false}
              frameless
              className="h-full w-full"
            />
            <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-start justify-end">
              <button
                type="button"
                onClick={openMapFully}
                className="pointer-events-auto inline-flex h-12 items-center gap-3 rounded-2xl bg-white px-4 text-sm font-semibold text-[#202124] shadow-[0_12px_28px_rgba(15,23,42,0.18)] ring-1 ring-black/5 transition hover:bg-white/96"
                aria-label="Раскрыть карту полностью"
              >
                <AppIcon icon={ExternalLink} className="h-5 w-5" />
                Раскрыть карту
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Three-column layout ─────────────────────────────────────────────── */}
      <div
        className={cn(
          mapPlacement === "mobile"
            ? "hidden"
            : "catalog-layout mt-6 grid gap-4 md:mt-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,46vw)] xl:grid-cols-[minmax(0,1fr)_minmax(500px,48vw)] 2xl:grid-cols-[minmax(0,0.92fr)_minmax(560px,760px)]",
        )}
      >
        {mapPlacement === "mobile" ? (
          <div className="w-full md:hidden">
            <button
              type="button"
              onClick={handleMobileSheetClick}
              onPointerDown={handleMobileSheetPointerDown}
              onPointerUp={handleMobileSheetPointerUp}
              className="flex w-full flex-col items-center gap-2 rounded-t-[26px] px-2 pb-3 pt-1 text-center text-olive"
              aria-expanded={!isMobileMapCollapsed}
              aria-controls="catalog-results"
            >
              <span className="h-1 w-16 rounded-full bg-olive/10" aria-hidden="true" />
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                Найдено: {foundProgramsLabel}
                <AppIcon
                  icon={isMobileMapCollapsed ? ChevronDown : ChevronUp}
                  className="h-4 w-4 text-olive/48"
                />
              </span>
            </button>
          </div>
        ) : null}
        {/* ── Center: Results ─────────────────────────────────────────────── */}
        <div id="catalog-results" className="min-w-0 flex-1 lg:w-full">
          {displayItems.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-dashed border-olive/25 bg-white/94 p-8 text-center">
                <p className="text-sm text-olive/60">
                  По вашим параметрам {resultsTitle} не найдены.
                </p>
                <p className="mt-1 text-xs text-olive/45">
                  Попробуйте изменить локацию, увеличить радиус или снять часть фильтров.
                </p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="mt-4 rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  Сбросить все фильтры
                </button>
              </div>
              <FirstListingPromo kind="excursions" />
            </div>
          ) : (
            <div className="space-y-4">
              {displayItems.map((item) => (
                <ExcursionCard
                  key={item.id}
                  item={item}
                  isHighlighted={hoveredPinId === item.id || activePointId === item.id}
                  onMouseEnter={() => {
                    setActivePointId(null);
                    setHoveredCardId(item.id);
                  }}
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
        <aside className="catalog-map-sticky map-column hidden self-start overflow-hidden lg:block lg:sticky lg:top-[96px] lg:h-[calc(100dvh-120px)] lg:min-h-[520px] lg:w-full">
          <section className="relative h-full overflow-hidden bg-[#e7eef3]">
            <div className="hidden">
              <div>
                <p className="text-sm font-semibold text-olive">{mapTitle}</p>
                <p className="text-xs text-olive/65">{mapStatsLabel}</p>
              </div>
            </div>

            {mapPlacement === "desktop" ? (
              <div className="absolute inset-0">
                <YandexMapMultiViewer
                  points={mapPoints}
                  activePointId={activePointId ?? hoveredCardId}
                  hoveredPointId={hoveredPinId}
                  onPointClick={handleMapPointClick}
                  onPointHoverChange={handlePinHover}
                  initialViewport={mapViewport}
                  viewportKey={mapViewportKey}
                  radiusCircle={radiusCircle}
                  controls={["zoomControl"]}
                  showBalloons={false}
                  frameless
                  className="h-full w-full"
                />

                <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-start justify-end">
                  <button
                    type="button"
                    onClick={openMapFully}
                    className="pointer-events-auto inline-flex h-12 items-center gap-3 rounded-2xl bg-white px-4 text-sm font-semibold text-[#202124] shadow-[0_12px_28px_rgba(15,23,42,0.18)] ring-1 ring-black/5 transition hover:bg-white/96"
                    aria-label="Раскрыть карту полностью"
                  >
                    <AppIcon icon={ExternalLink} className="h-5 w-5" />
                    Раскрыть карту
                  </button>
                </div>

                {activePopupItem ? (
                  <div className="pointer-events-none absolute left-1/2 top-20 z-20 w-[312px] max-w-[calc(100%-24px)] -translate-x-1/2">
                    <MapExcursionPopupCard
                      key={activePopupItem.id}
                      item={activePopupItem}
                      onClose={() => setActivePointId(null)}
                      className="pointer-events-auto w-full"
                    />
                  </div>
                ) : null}
                {renderMapStatusOverlay()}
              </div>
            ) : null}
          </section>
        </aside>
      </div>

      {/* ── Expanded map modal ──────────────────────────────────────────────── */}
      {mapExpanded ? (
        <div
          id="excursion-map-modal"
          className="fixed inset-0 z-[90] bg-[#e7eef3]"
          role="dialog"
          aria-modal="true"
          aria-label={mapTitle}
        >
          <section className="relative h-full w-full overflow-hidden">
            <div className="absolute inset-0">
              <YandexMapMultiViewer
                points={mapPoints}
                activePointId={activePointId ?? hoveredCardId}
                hoveredPointId={hoveredPinId}
                onPointClick={(id) => {
                  handleMapPointClick(id);
                }}
                onPointHoverChange={handlePinHover}
                initialViewport={mapViewport}
                viewportKey={mapViewportKey}
                radiusCircle={radiusCircle}
                controls={["zoomControl"]}
                showBalloons={false}
                frameless
                className="h-full min-h-[100dvh] w-full"
              />
            </div>

            <div className="pointer-events-none absolute right-3 top-3 z-30 sm:right-5 sm:top-5">
              <button
                type="button"
                onClick={closeMapFully}
                className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[#202124] shadow-[0_12px_28px_rgba(15,23,42,0.18)] ring-1 ring-black/5 transition hover:bg-white/96"
                aria-label="Закрыть карту"
              >
                <AppIcon icon={X} className="h-5 w-5" />
                Закрыть карту
              </button>
            </div>

            {activePopupItem ? (
              <div className="pointer-events-none absolute left-1/2 top-20 z-20 w-[312px] max-w-[calc(100%-24px)] -translate-x-1/2 sm:top-24">
                <MapExcursionPopupCard
                  key={activePopupItem.id}
                  item={activePopupItem}
                  onClose={() => setActivePointId(null)}
                  className="pointer-events-auto w-full"
                />
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRatingText(rating: number): string {
  if (rating >= 4.8) return "Превосходно";
  if (rating >= 4.5) return "Отлично";
  if (rating >= 4.0) return "Очень хорошо";
  if (rating >= 3.5) return "Хорошо";
  return "Нормально";
}

function truncateAvailability(summary: string): string {
  if (summary.length <= 40) return summary;
  const seasonMatch = summary.match(/^(Круглый год|Сезонно|[А-Яа-яЁё]+ — [А-Яа-яЁё]+)/);
  if (seasonMatch) return seasonMatch[1];
  return summary.slice(0, 37) + "…";
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
  const duration = formatProgramDuration(item);
  const priceLabel = formatProgramPrice(item);
  const titleId = `excursion-card-title-${item.id}`;
  const ownerName =
    [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ") || "Организатор";
  const ownerInitials = `${item.owner.firstName.slice(0, 1)}${item.owner.lastName.slice(0, 1)}`
    .trim()
    .toUpperCase();
  const detailsHref = useMemo(() => stripSearchParamsFromPath(item.path), [item.path]);

  return (
    <article
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "result-card group relative overflow-hidden rounded-2xl border bg-white transition-all duration-300",
        isHighlighted
          ? "border-primary/30 shadow-[0_0_0_2px_rgba(15,118,110,0.2),0_16px_40px_rgba(15,118,110,0.15)]"
          : "border-olive/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] hover:border-primary/15 hover:shadow-[0_8px_30px_-8px_rgba(15,118,110,0.15)]",
      )}
    >
      {/* Full-card overlay link */}
      <Link
        href={detailsHref}
        aria-labelledby={titleId}
        aria-label={`Открыть ${item.title}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
      />

      <div className="pointer-events-none relative z-20 flex flex-col md:flex-row">
        {/* Cover image */}
        <div
          className={cn(
            "card-img-wrap relative shrink-0 overflow-hidden bg-sand",
            "h-40 w-full rounded-xl xs:h-44 sm:h-48 md:aspect-[4/3] md:h-auto md:w-[240px] md:rounded-l-xl md:rounded-r-none lg:w-[280px]",
          )}
        >
          {item.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverImageUrl}
              alt={item.title}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              width={400}
              height={300}
              sizes="(min-width: 1024px) 280px, (min-width: 768px) 240px, 100vw"
              className="card-img h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full min-h-[160px] items-center justify-center text-sm text-olive/40">
              Без фото
            </div>
          )}

          <div className="pointer-events-auto absolute right-2 top-2 z-30 p-1 sm:right-2.5 sm:top-2.5">
            <FavoriteToggleButton
              itemId={item.id}
              entityType={getFavoriteEntityTypeFromOfferType(item.offerType)}
              initialIsFavorite={false}
              variant="icon"
            />
          </div>

          {/* Type badge on image */}
          <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5">
            <span className="rounded-lg bg-gradient-to-r from-primary to-emerald-500 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
              {getOfferTypeLabel(item.offerType)}
            </span>
            {item.subtypeLabel ? (
              <span className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-olive/70 shadow-sm backdrop-blur-sm">
                {item.subtypeLabel}
              </span>
            ) : null}
          </div>

          {/* Availability badge on image */}
          {item.hasAvailableSession && (
            <div className="pointer-events-none absolute bottom-2.5 left-2.5">
              <span className="inline-flex items-center gap-1 rounded-lg bg-green-600/90 px-2 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-sm">
                Есть места
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4 md:flex-row md:gap-4">
          {/* Center content */}
          <div className="flex flex-1 flex-col gap-1.5">
            {/* Title */}
            <h2
              id={titleId}
              className="line-clamp-2 text-[16px] font-bold leading-snug tracking-tight text-olive sm:text-[18px]"
            >
              {item.title}
            </h2>

            {/* Route / Location */}
            {item.routeSummary && (
              <p className="flex items-start gap-1.5 text-[13px] leading-snug text-olive/50">
                <AppIcon
                  icon={MapPin}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--icon-location)] opacity-75"
                />
                <span className="line-clamp-2">{item.routeSummary}</span>
              </p>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex max-w-full items-center gap-2 rounded-xl bg-cream/78 py-1 pl-1 pr-2.5 text-xs font-semibold text-olive/70 ring-1 ring-olive/8">
                <span className="inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-olive/10">
                  <AvatarImage
                    src={item.owner.avatarUrl}
                    alt={ownerName}
                    className="h-full w-full object-cover"
                  >
                    <span className="flex h-full w-full items-center justify-center text-[11px] text-olive/60">
                      {ownerInitials || "?"}
                    </span>
                  </AvatarImage>
                </span>
                <span className="truncate">{ownerName}</span>
              </span>
            </div>

            {/* Info chips row */}
            <div className="mt-1 flex flex-wrap gap-1.5">
              {duration ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-primary/8 px-2 py-1 text-[11px] font-semibold text-primary">
                  <AppIcon icon={Clock3} className="h-3 w-3 shrink-0 text-primary" />
                  {duration}
                </span>
              ) : null}

              {item.availabilitySummary && (
                <span
                  className="inline-flex items-center gap-1 rounded-lg bg-sand/60 px-2 py-1 text-[11px] font-medium text-olive/60"
                  title={item.availabilitySummary}
                >
                  <AppIcon
                    icon={CalendarDays}
                    className="h-3 w-3 shrink-0 text-[color:var(--icon-booking)]"
                  />
                  {truncateAvailability(item.availabilitySummary)}
                </span>
              )}

              {item.distanceKm !== null ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-sand/60 px-2 py-1 text-[11px] font-medium text-olive/60">
                  <AppIcon
                    icon={Route}
                    className="h-3 w-3 shrink-0 text-[color:var(--icon-location)]"
                  />
                  ~{item.distanceKm} км
                </span>
              ) : null}

              {item.districtName ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-sand/60 px-2 py-1 text-[11px] font-medium text-olive/60">
                  <AppIcon
                    icon={MapPin}
                    className="h-3 w-3 shrink-0 text-[color:var(--icon-location)]"
                  />
                  {item.districtName}
                </span>
              ) : null}
            </div>

            {/* Feature tags */}
            <div className="flex flex-wrap gap-1.5 md:hidden">
              {item.categoryName ? (
                <span className="inline-flex items-center rounded-md bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {item.categoryName}
                </span>
              ) : null}

              {item.pickupAvailable ? (
                <span className="inline-flex items-center rounded-md bg-terra/8 px-2 py-0.5 text-[11px] font-medium text-terra">
                  Трансфер
                </span>
              ) : null}

              {item.hasAccommodation ? (
                <span className="inline-flex items-center rounded-md bg-sand/50 px-2 py-0.5 text-[11px] font-medium text-olive/60">
                  Проживание
                </span>
              ) : null}
            </div>

            {/* Mobile: price + CTA (below md) */}
            <div className="mt-auto flex items-end justify-between gap-3 border-t border-olive/[0.06] pt-3 md:hidden">
              <div className="min-w-0">
                <p className="text-[17px] font-extrabold leading-tight tracking-tight text-olive">
                  {priceLabel}
                </p>
              </div>
              <Link
                href={detailsHref}
                className="pointer-events-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-5 text-[13px] font-bold text-white shadow-sm transition-all hover:brightness-95 active:scale-[0.97]"
              >
                Подробнее
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Right column: rating + price + CTA (desktop only) */}
          <div className="hidden shrink-0 flex-col items-end justify-between border-l border-olive/[0.06] pl-4 md:flex md:w-[190px] lg:w-[210px]">
            <div className="text-right">
              {item.avgRating > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[12px] font-semibold text-olive">
                      {getRatingText(item.avgRating)}
                    </span>
                    {item.reviewsCount > 0 ? (
                      <p className="text-[11px] text-olive/40">
                        {pluralizeReviews(item.reviewsCount)}
                      </p>
                    ) : null}
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-[14px] font-bold text-white">
                    {item.avgRating.toFixed(1)}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-olive/35">Нет отзывов</span>
              )}
            </div>

            <div className="mt-auto text-right">
              <p className="text-[18px] font-extrabold leading-tight tracking-tight text-olive">
                {priceLabel}
              </p>
              <Link
                href={detailsHref}
                className="pointer-events-auto mt-2.5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-[13px] font-bold text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md active:scale-[0.97]"
              >
                Подробнее
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

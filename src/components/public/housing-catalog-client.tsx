"use client";

import {
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  MapPin,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { HousingSearchDateRangeField } from "@/components/public/housing-search-date-range-field";
import { HousingSearchGuestsField } from "@/components/public/housing-search-guests-field";
import { PublicHousingResultsWithMap } from "@/components/public/public-housing-results-with-map";
import { useLoadMore } from "@/hooks/use-load-more";
import {
  buildHousingCatalogUrl,
  buildHousingMapQuery,
  fetchAccommodationSearch,
} from "@/lib/api/search";
import { cn } from "@/lib/cn";
import { propertyTypes } from "@/lib/constants";
import type { EmptyStateSuggestion, SearchFilters, SearchResponse } from "@/types/catalog";

const PRICE_MIN_BOUND = 0;
const PRICE_MAX_BOUND = 50_000;
const PRICE_STEP = 500;
const RATING_MIN_BOUND = 0;
const RATING_MAX_BOUND = 5;
const RATING_STEP = 0.5;
const SIDEBAR_LOCATION_SUGGESTIONS_LISTBOX_ID = "home-search-suggestions-listbox";
const SIDEBAR_LOCATION_RECENT_STORAGE_KEY = "boking.home_search_recent_v1";
const SIDEBAR_LOCATION_RECENT_LIMIT = 4;
const SIDEBAR_LOCATION_SUGGESTIONS_CACHE_TTL_MS = 8 * 60_000;
const dayMonthFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});
const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

type SidebarLocationSuggestionSection = "recent" | "popular" | "matches";

type SidebarLocationSuggestionItem = {
  type: "location";
  id: string;
  name: string;
  subtitle: string;
};

type SidebarLocationDropdownOption = {
  key: string;
  section: SidebarLocationSuggestionSection;
  item: SidebarLocationSuggestionItem;
};

type SidebarLocationSuggestionsPayload = {
  popular: SidebarLocationSuggestionItem[];
  matches: SidebarLocationSuggestionItem[];
};

const DEFAULT_DESKTOP_OPEN_SECTIONS = [] as const;
const DEFAULT_MOBILE_OPEN_SECTIONS = [] as const;
const SORT_OPTIONS = [
  { value: "", label: "Рекомендуемые" },
  { value: "price_asc", label: "Сначала дешёвые" },
  { value: "price_desc", label: "Сначала дорогие" },
  { value: "rating_desc", label: "По рейтингу" },
  { value: "popular_desc", label: "По отзывам" },
] as const satisfies ReadonlyArray<{
  value: SearchFilters["sort"];
  label: string;
}>;

function FilterSection({
  label,
  summary,
  active = false,
  open,
  onToggle,
  children,
  mobileMode = false,
}: {
  label: string;
  summary: string;
  active?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  mobileMode?: boolean;
}) {
  return (
    <div
      className={cn(
        mobileMode
          ? "overflow-hidden rounded-[24px] border border-olive/12 bg-white/92 shadow-[0_20px_36px_-32px_rgba(15,74,64,0.55)]"
          : "border-b border-olive/12 last:border-0",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group flex min-h-[68px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-200",
          "hover:bg-olive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          open ? "bg-foam/70 text-olive" : "text-olive",
          mobileMode ? "min-h-[74px] px-4 py-3.5 active:scale-[0.995]" : "",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold">{label}</span>
            {active ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
          </span>
          <span className="mt-1 block truncate text-xs text-olive/60">{summary}</span>
        </span>
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-200",
            open || active ? "bg-primary/12 text-primary" : "bg-olive/8 text-olive/55",
          )}
        >
          <ChevronDownIcon
            className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
          />
        </span>
      </button>
      <div
        className={cn(
          "origin-top transition-all duration-300 ease-out",
          open
            ? mobileMode
              ? "max-h-[860px] opacity-100 overflow-visible"
              : "max-h-[520px] opacity-100 overflow-visible"
            : "max-h-0 opacity-0 overflow-hidden",
        )}
      >
        <div
          className={cn(
            "space-y-2.5 px-4 pb-4 pt-1",
            mobileMode && "border-t border-olive/10 bg-white/96 pt-3",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SortSelectField({
  value,
  onChange,
  className,
  ariaLabel = "Сортировка",
}: {
  value: SearchFilters["sort"];
  onChange: (value: SearchFilters["sort"]) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const listboxId = useId();
  const selectedIndex = Math.max(
    0,
    SORT_OPTIONS.findIndex((option) => option.value === value),
  );
  const selectedOption = SORT_OPTIONS[selectedIndex] ?? SORT_OPTIONS[0];

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsOpen(false);

    if (!restoreFocus) {
      return;
    }

    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  const openMenu = useCallback(() => {
    setIsOpen(true);
  }, []);

  const commitValue = useCallback(
    (nextValue: SearchFilters["sort"]) => {
      onChange(nextValue);
      closeMenu(true);
    },
    [closeMenu, onChange],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu(true);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeMenu, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      optionRefs.current[selectedIndex]?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isOpen, selectedIndex]);

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen((current) => !current);
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeMenu();
    }
  }

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, optionIndex: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      optionRefs.current[(optionIndex + 1) % SORT_OPTIONS.length]?.focus();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      optionRefs.current[(optionIndex - 1 + SORT_OPTIONS.length) % SORT_OPTIONS.length]?.focus();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      optionRefs.current[0]?.focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      optionRefs.current[SORT_OPTIONS.length - 1]?.focus();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", isOpen && "z-[35]", className)}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-[20px] border border-olive/12",
          "bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.12),_transparent_58%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(243,247,245,0.92))]",
          "shadow-[0_18px_36px_-30px_rgba(15,74,64,0.5)] transition-all duration-200",
          "hover:border-olive/22 hover:shadow-[0_22px_42px_-32px_rgba(15,74,64,0.58)]",
          "focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/18",
          isOpen &&
            "border-primary/28 shadow-[0_26px_48px_-34px_rgba(15,74,64,0.62)] ring-2 ring-primary/16",
        )}
      >
        <div className="pointer-events-none absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[14px] bg-white/90 text-primary ring-1 ring-primary/12 shadow-[0_10px_20px_-16px_rgba(15,118,110,0.7)]">
          <SortDirectionIcon className="h-4 w-4" />
        </div>
        <span className="pointer-events-none absolute left-[60px] top-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-olive/42">
          Порядок выдачи
        </span>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          onKeyDown={handleTriggerKeyDown}
          className="flex h-[62px] w-full items-end bg-transparent pb-2 pl-[60px] pr-12 pt-5 text-left text-sm font-semibold text-olive outline-none"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
        >
          <span className="truncate">{selectedOption.label}</span>
        </button>
        <div className="pointer-events-none absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/86 text-[color:var(--icon-nav)] ring-1 ring-primary/10">
          <ChevronDownIcon
            className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")}
          />
        </div>
      </div>

      {isOpen ? (
        <div className="absolute inset-x-0 top-[calc(100%+10px)]">
            <div className="overflow-hidden rounded-[24px] border border-olive/12 bg-[linear-gradient(180deg,_rgba(255,255,255,0.99),_rgba(243,247,245,0.97))] p-2 shadow-[0_28px_58px_-36px_rgba(15,74,64,0.72)] backdrop-blur">
              <div className="mb-1 px-2 pb-2 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-olive/42">
                  Сортировка
                </span>
              </div>

            <div id={listboxId} role="listbox" aria-label={ariaLabel} className="space-y-1">
              {SORT_OPTIONS.map((option, optionIndex) => {
                const isSelected = option.value === value || (!value && option.value === "");

                return (
                  <button
                    key={option.value || "recommended"}
                    ref={(node) => {
                      optionRefs.current[optionIndex] = node;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => commitValue(option.value)}
                    onKeyDown={(event) => handleOptionKeyDown(event, optionIndex)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-[18px] px-3.5 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/26",
                      isSelected
                        ? "bg-[linear-gradient(135deg,_rgba(15,118,110,0.15),_rgba(15,118,110,0.08))] text-olive shadow-[inset_0_0_0_1px_rgba(15,118,110,0.18)]"
                        : "bg-white/82 text-olive/88 hover:bg-cream/72",
                    )}
                  >
                    <span className="min-w-0 truncate text-sm font-semibold">{option.label}</span>

                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                        isSelected
                          ? "border-primary/18 bg-primary text-white shadow-[0_14px_24px_-18px_rgba(15,118,110,0.88)]"
                          : "border-olive/10 bg-white text-olive/30",
                      )}
                    >
                      <CheckIcon className="h-4 w-4" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type HousingCatalogClientProps = {
  initialResponse: SearchResponse;
  initialFilters: SearchFilters;
  locationNames: string[];
  initialLocationLabel: string;
};

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

type ActiveFilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

const PAGE_SIZE = 30;

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function shiftIso(value: string, days: number): string {
  const date = parseIsoDate(value);
  if (!date) {
    return "";
  }
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function getNights(checkIn: string, checkOut: string): number {
  const from = parseIsoDate(checkIn);
  const to = parseIsoDate(checkOut);
  if (!from || !to) {
    return 0;
  }
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function getSortLabel(sort: SearchFilters["sort"]): string {
  return SORT_OPTIONS.find((option) => option.value === sort)?.label ?? SORT_OPTIONS[0].label;
}

function normalizeLocation(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

function parseSidebarLocationSuggestionsPayload(raw: unknown): SidebarLocationSuggestionsPayload {
  const fallback: SidebarLocationSuggestionsPayload = {
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

  const parseList = (value: unknown): SidebarLocationSuggestionItem[] =>
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

            const name = candidate.name.trim();
            const id = candidate.id.trim();
            if (!name || !id) {
              return null;
            }

            return {
              type: "location",
              id,
              name,
              subtitle: typeof candidate.subtitle === "string" ? candidate.subtitle.trim() : "",
            } satisfies SidebarLocationSuggestionItem;
          })
          .filter((item): item is SidebarLocationSuggestionItem => Boolean(item))
      : [];

  return {
    popular: parseList(payload.popular),
    matches: parseList(payload.matches),
  };
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

function formatIsoDayMonth(value: string): string {
  const date = parseIsoDate(value);
  if (!date) {
    return "";
  }

  return dayMonthFormatter.format(date);
}

function formatCurrency(value: number): string {
  return `${currencyFormatter.format(Math.max(0, value))} ₽`;
}

function formatPriceSummary(minPrice: number, maxPrice: number): string {
  const hasMin = minPrice > PRICE_MIN_BOUND;
  const hasMax = maxPrice < PRICE_MAX_BOUND;

  if (!hasMin && !hasMax) {
    return "Любая цена";
  }

  if (hasMin && hasMax) {
    return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;
  }

  if (hasMin) {
    return `От ${formatCurrency(minPrice)}`;
  }

  return `До ${formatCurrency(maxPrice)}`;
}

function minRatingToNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.min(RATING_MAX_BOUND, Math.max(RATING_MIN_BOUND, Math.round(parsed * 2) / 2));
}

function ratingNumberToFilterValue(value: number): string {
  const normalized =
    Math.round(Math.max(RATING_MIN_BOUND, Math.min(RATING_MAX_BOUND, value)) * 2) / 2;
  if (normalized <= 0) {
    return "";
  }

  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
}

function formatRatingValue(value: number): string {
  return value.toFixed(1);
}

function formatRatingSummary(value: string): string {
  const normalized = minRatingToNumber(value);
  return normalized > 0 ? `От ${formatRatingValue(normalized)}` : "Любой рейтинг";
}

function formatDateSummary(checkIn: string, checkOut: string): string {
  if (!checkIn) {
    return "Без дат";
  }

  const from = formatIsoDayMonth(checkIn);
  if (!from) {
    return "Без дат";
  }

  if (!checkOut) {
    return `С ${from}`;
  }

  const to = formatIsoDayMonth(checkOut);
  const nights = getNights(checkIn, checkOut);
  if (!to || nights <= 0) {
    return from;
  }

  return `${from} - ${to}, ${nights} ${pluralize(nights, ["ночь", "ночи", "ночей"])}`;
}

function formatGuestsSummary(guests: string): string {
  const parsedGuests = Number.parseInt(guests, 10);
  const totalGuests = Number.isFinite(parsedGuests) && parsedGuests > 0 ? parsedGuests : 2;
  return `${totalGuests} ${pluralize(totalGuests, ["гость", "гостя", "гостей"])}`;
}

function formatExtrasSummary(options: {
  hasPhotos: boolean;
  hasReviews: boolean;
  familyFriendly: boolean;
  petsAllowed: boolean;
}): string {
  const count =
    Number(options.hasPhotos) +
    Number(options.hasReviews) +
    Number(options.familyFriendly) +
    Number(options.petsAllowed);

  return count > 0
    ? `${count} ${pluralize(count, ["опция", "опции", "опций"])}`
    : "Без ограничений";
}

function formatRecentLocationSubtitle(checkIn: string, checkOut: string, guests: number): string {
  const normalizedGuests = Number.isFinite(guests) ? Math.max(1, Math.round(guests)) : 2;
  const guestsLabel = `${normalizedGuests} ${pluralize(normalizedGuests, ["гость", "гостя", "гостей"])}`;

  if (checkIn && checkOut) {
    const from = formatIsoDayMonth(checkIn);
    const to = formatIsoDayMonth(checkOut);
    if (from && to) {
      return `${from} - ${to}, ${guestsLabel}`;
    }
  }

  if (checkIn) {
    const from = formatIsoDayMonth(checkIn);
    if (from) {
      return `${from}, ${guestsLabel}`;
    }
  }

  return `Без дат, ${guestsLabel}`;
}

function parseSidebarRecentLocationSuggestions(raw: string): SidebarLocationSuggestionItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const uniqueByName = new Set<string>();
  const suggestions: SidebarLocationSuggestionItem[] = [];

  const sorted = parsed
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const candidate = entry as Partial<{
        id: string;
        type: string;
        direction: string;
        name: string;
        checkIn: string;
        checkOut: string;
        guests: number;
        timestamp: number;
      }>;

      return {
        id: typeof candidate.id === "string" ? candidate.id.trim() : "",
        type: candidate.type === "location" ? "location" : "",
        direction: candidate.direction === "housing" ? "housing" : "",
        name: typeof candidate.name === "string" ? candidate.name.trim() : "",
        checkIn:
          typeof candidate.checkIn === "string" && parseIsoDate(candidate.checkIn.trim())
            ? candidate.checkIn.trim()
            : "",
        checkOut:
          typeof candidate.checkOut === "string" && parseIsoDate(candidate.checkOut.trim())
            ? candidate.checkOut.trim()
            : "",
        guests: typeof candidate.guests === "number" ? candidate.guests : 2,
        timestamp:
          typeof candidate.timestamp === "number" && Number.isFinite(candidate.timestamp)
            ? candidate.timestamp
            : 0,
      };
    })
    .sort((left, right) => right.timestamp - left.timestamp);

  for (const entry of sorted) {
    if (entry.type !== "location" || entry.direction !== "housing" || !entry.name) {
      continue;
    }

    const normalizedName = normalizeLocation(entry.name);
    if (!normalizedName || uniqueByName.has(normalizedName)) {
      continue;
    }

    uniqueByName.add(normalizedName);
    suggestions.push({
      type: "location",
      id: entry.id || `recent:${normalizedName}`,
      name: entry.name,
      subtitle: formatRecentLocationSubtitle(entry.checkIn, entry.checkOut, entry.guests),
    });

    if (suggestions.length >= SIDEBAR_LOCATION_RECENT_LIMIT) {
      break;
    }
  }

  return suggestions;
}

function getSidebarLocationOptionDomId(optionKey: string): string {
  return `home-search-option-${optionKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
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
      <mark key={`location-mark-${index}`} className="bg-transparent font-semibold text-olive">
        {part}
      </mark>
    ) : (
      <span key={`location-text-${index}`}>{part}</span>
    ),
  );
}

function ClockIcon(props: { className?: string }) {
  return <AppIcon icon={Clock3} className={props.className} />;
}

function LocationPinIcon(props: { className?: string }) {
  return <AppIcon icon={MapPin} className={props.className} />;
}

function ClearIcon(props: { className?: string }) {
  return <AppIcon icon={X} className={props.className} />;
}

function CalendarIcon(props: { className?: string }) {
  return <AppIcon icon={CalendarDays} className={props.className} />;
}

function UsersIcon(props: { className?: string }) {
  return <AppIcon icon={Users} className={props.className} />;
}

function SlidersIcon(props: { className?: string }) {
  return <AppIcon icon={SlidersHorizontal} className={props.className} />;
}

function SortDirectionIcon(props: { className?: string }) {
  return <AppIcon icon={ArrowUpDown} className={props.className} />;
}

function ChevronDownIcon(props: { className?: string }) {
  return <AppIcon icon={ChevronDown} className={props.className} />;
}

function CheckIcon(props: { className?: string }) {
  return <AppIcon icon={Check} className={props.className} />;
}

function EmptyStateIcon() {
  return (
    <svg
      viewBox="0 0 280 200"
      className="h-[200px] w-auto text-primary/80"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="42" y="76" width="196" height="92" rx="18" fill="currentColor" fillOpacity="0.08" />
      <path d="M58 92L140 36L222 92V162H58V92Z" fill="currentColor" fillOpacity="0.16" />
      <circle cx="140" cy="114" r="22" fill="white" />
      <circle cx="140" cy="114" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M151 126L166 142" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M90 170H190"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ToastContainer({
  toasts,
  hasFloatingMapButton,
  onClose,
}: {
  toasts: Toast[];
  hasFloatingMapButton: boolean;
  onClose: (id: number) => void;
}) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[9999] mx-auto flex w-full max-w-md flex-col gap-2 px-3",
        hasFloatingMapButton ? "bottom-24" : "bottom-6",
      )}
      role="alert"
      aria-live="assertive"
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => onClose(toast.id)}
          className={cn(
            "pointer-events-auto w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-white shadow-[0_14px_28px_rgba(15,118,110,0.25)] transition",
            toast.type === "success"
              ? "bg-primary"
              : toast.type === "error"
                ? "bg-terra"
                : "bg-olive",
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}

export function HousingCatalogClient({
  initialResponse,
  initialFilters,
  locationNames,
  initialLocationLabel,
}: HousingCatalogClientProps) {
  const [filters, setFilters] = useState(initialFilters);
  const view = "list" as const;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newItemIds, setNewItemIds] = useState<string[]>([]);
  const [locationLabel, setLocationLabel] = useState(initialLocationLabel);
  const [emptySuggestions, setEmptySuggestions] = useState<EmptyStateSuggestion[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Monotonic request id prevents stale responses from older fetches from overwriting fresh state.
  const requestSeqRef = useRef(0);
  // Prevents repeating the same empty-state fallback probes for unchanged filter combinations.
  const fallbackSignatureRef = useRef("");

  // ── Sidebar filter state ──────────────────────────────────────────────────
  const [desktopOpenSections, setDesktopOpenSections] = useState<Set<string>>(
    () => new Set(DEFAULT_DESKTOP_OPEN_SECTIONS),
  );
  const [mobileOpenSections, setMobileOpenSections] = useState<Set<string>>(
    () => new Set(DEFAULT_MOBILE_OPEN_SECTIONS),
  );
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [sbLocation, setSbLocation] = useState(initialFilters.location || "");
  const [sbCheckIn, setSbCheckIn] = useState(initialFilters.checkIn || "");
  const [sbCheckOut, setSbCheckOut] = useState(initialFilters.checkOut || "");
  const [sbGuests, setSbGuests] = useState(initialFilters.guests || "2");
  const [sbGuestsAdults, setSbGuestsAdults] = useState(initialFilters.guestsAdults || "2");
  const [sbGuestsChildren, setSbGuestsChildren] = useState(initialFilters.guestsChildren || "0");
  const [sbPropertyType, setSbPropertyType] = useState(initialFilters.propertyType || "");
  const [sbSort, setSbSort] = useState<SearchFilters["sort"]>(
    initialFilters.sort === "relevance" ? "" : initialFilters.sort,
  );
  const [sbMinRating, setSbMinRating] = useState(() =>
    ratingNumberToFilterValue(minRatingToNumber(initialFilters.minRating)),
  );
  const [sbHasPhotos, setSbHasPhotos] = useState(initialFilters.hasPhotos);
  const [sbHasReviews, setSbHasReviews] = useState(initialFilters.hasReviews);
  const [sbFamilyFriendly, setSbFamilyFriendly] = useState(initialFilters.familyFriendly);
  const [sbPetsAllowed, setSbPetsAllowed] = useState(initialFilters.petsAllowed);
  const [isSidebarLocationDropdownOpen, setIsSidebarLocationDropdownOpen] = useState(false);
  const [isSidebarLocationSuggestionsLoading, setIsSidebarLocationSuggestionsLoading] =
    useState(false);
  const [sidebarLocationRecentSuggestions, setSidebarLocationRecentSuggestions] = useState<
    SidebarLocationSuggestionItem[]
  >([]);
  const [sidebarLocationPopularSuggestions, setSidebarLocationPopularSuggestions] = useState<
    SidebarLocationSuggestionItem[]
  >([]);
  const [sidebarLocationMatchSuggestions, setSidebarLocationMatchSuggestions] = useState<
    SidebarLocationSuggestionItem[]
  >([]);
  const [activeSidebarLocationSuggestionIndex, setActiveSidebarLocationSuggestionIndex] =
    useState(-1);
  const sidebarLocationComboboxRef = useRef<HTMLDivElement | null>(null);
  const sidebarLocationInputRef = useRef<HTMLInputElement | null>(null);
  const sidebarLocationSuggestionsCacheRef = useRef<
    Map<string, { payload: SidebarLocationSuggestionsPayload; expiresAt: number }>
  >(new Map());

  // Price slider state
  const [rangeMin, setRangeMin] = useState(() =>
    Math.max(PRICE_MIN_BOUND, Number(initialFilters.minPrice) || PRICE_MIN_BOUND),
  );
  const [rangeMax, setRangeMax] = useState(() =>
    Math.min(PRICE_MAX_BOUND, Number(initialFilters.maxPrice) || PRICE_MAX_BOUND),
  );

  const sliderSpan = PRICE_MAX_BOUND - PRICE_MIN_BOUND;
  const leftPercent = ((rangeMin - PRICE_MIN_BOUND) / sliderSpan) * 100;
  const rightPercent = ((rangeMax - PRICE_MIN_BOUND) / sliderSpan) * 100;

  function updatePriceMin(next: number) {
    const snapped = Math.floor(next / PRICE_STEP) * PRICE_STEP;
    setRangeMin(Math.max(PRICE_MIN_BOUND, Math.min(rangeMax, snapped)));
  }

  function updatePriceMax(next: number) {
    const snapped = Math.ceil(next / PRICE_STEP) * PRICE_STEP;
    setRangeMax(Math.min(PRICE_MAX_BOUND, Math.max(rangeMin, snapped)));
  }

  const syncSidebarDraftFromFilters = useCallback((source: SearchFilters) => {
    setSbLocation(source.location || "");
    setSbCheckIn(source.checkIn || "");
    setSbCheckOut(source.checkOut || "");
    setSbGuests(source.guests || "2");
    setSbGuestsAdults(source.guestsAdults || source.guests || "2");
    setSbGuestsChildren(source.guestsChildren || "0");
    setSbPropertyType(source.propertyType || "");
    setSbSort(source.sort === "relevance" ? "" : source.sort);
    setSbMinRating(ratingNumberToFilterValue(minRatingToNumber(source.minRating)));
    setSbHasPhotos(source.hasPhotos);
    setSbHasReviews(source.hasReviews);
    setSbFamilyFriendly(source.familyFriendly);
    setSbPetsAllowed(source.petsAllowed);
    setRangeMin(Math.max(PRICE_MIN_BOUND, Number(source.minPrice) || PRICE_MIN_BOUND));
    setRangeMax(Math.min(PRICE_MAX_BOUND, Number(source.maxPrice) || PRICE_MAX_BOUND));
  }, []);

  useEffect(() => {
    syncSidebarDraftFromFilters(filters);
  }, [filters, syncSidebarDraftFromFilters]);

  const closeMobileFilters = useCallback(
    (discardDraft = false) => {
      setIsSidebarLocationDropdownOpen(false);
      setActiveSidebarLocationSuggestionIndex(-1);
      if (discardDraft) {
        syncSidebarDraftFromFilters(filters);
      }
      setIsMobileFiltersOpen(false);
    },
    [filters, syncSidebarDraftFromFilters],
  );

  useEffect(() => {
    if (!isMobileFiltersOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileFilters(true);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeMobileFilters, isMobileFiltersOpen]);

  useEffect(() => {
    if (!isSidebarLocationDropdownOpen) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(SIDEBAR_LOCATION_RECENT_STORAGE_KEY);
      if (!raw) {
        setSidebarLocationRecentSuggestions([]);
        return;
      }
      setSidebarLocationRecentSuggestions(parseSidebarRecentLocationSuggestions(raw));
    } catch {
      setSidebarLocationRecentSuggestions([]);
    }
  }, [isSidebarLocationDropdownOpen]);

  useEffect(() => {
    if (!isSidebarLocationDropdownOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (sidebarLocationComboboxRef.current?.contains(target)) {
        return;
      }

      setIsSidebarLocationDropdownOpen(false);
      setActiveSidebarLocationSuggestionIndex(-1);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isSidebarLocationDropdownOpen]);

  useEffect(() => {
    if (!isSidebarLocationDropdownOpen) {
      return;
    }

    const query = sbLocation.trim().slice(0, 120);
    // Cache + debounce + abort keeps autocomplete responsive under fast typing.
    const cacheKey = `catalog-location|${query.toLowerCase()}`;
    const cached = sidebarLocationSuggestionsCacheRef.current.get(cacheKey);
    const fallbackPopular = locationNames.slice(0, 12).map((name, index) => ({
      type: "location" as const,
      id: `fallback:${normalizeLocation(name) || index}`,
      name,
      subtitle: "Крым, Россия",
    }));

    if (cached && cached.expiresAt > Date.now()) {
      setSidebarLocationPopularSuggestions(
        cached.payload.popular.length > 0 ? cached.payload.popular : fallbackPopular,
      );
      setSidebarLocationMatchSuggestions(cached.payload.matches);
      setIsSidebarLocationSuggestionsLoading(false);
      return;
    }

    const abortController = new AbortController();
    const timer = window.setTimeout(
      async () => {
        setIsSidebarLocationSuggestionsLoading(true);

        try {
          const params = new URLSearchParams({
            direction: "housing",
            include: "location",
            query,
            limit: "12",
          });
          const response = await fetch(`/api/search/suggestions?${params.toString()}`, {
            signal: abortController.signal,
          });
          if (!response.ok) {
            return;
          }

          const payload = parseSidebarLocationSuggestionsPayload(await response.json());
          sidebarLocationSuggestionsCacheRef.current.set(cacheKey, {
            payload,
            expiresAt: Date.now() + SIDEBAR_LOCATION_SUGGESTIONS_CACHE_TTL_MS,
          });
          setSidebarLocationPopularSuggestions(
            payload.popular.length > 0 ? payload.popular : fallbackPopular,
          );
          setSidebarLocationMatchSuggestions(payload.matches);
        } catch {
          // Ignore transient autocomplete fetch errors.
        } finally {
          setIsSidebarLocationSuggestionsLoading(false);
        }
      },
      query.length === 0 ? 0 : 220,
    );

    return () => {
      abortController.abort();
      window.clearTimeout(timer);
    };
  }, [isSidebarLocationDropdownOpen, locationNames, sbLocation]);

  const isSidebarLocationQueryMode = sbLocation.trim().length > 0;
  const sidebarLocationDropdownOptions = useMemo<SidebarLocationDropdownOption[]>(() => {
    const options: SidebarLocationDropdownOption[] = [];

    if (!isSidebarLocationQueryMode) {
      for (const [index, item] of sidebarLocationRecentSuggestions.entries()) {
        options.push({
          key: `recent:location:${item.id}:${index}`,
          section: "recent",
          item,
        });
      }
      for (const [index, item] of sidebarLocationPopularSuggestions.entries()) {
        options.push({
          key: `popular:location:${item.id}:${index}`,
          section: "popular",
          item,
        });
      }
      return options;
    }

    for (const [index, item] of sidebarLocationMatchSuggestions.entries()) {
      options.push({
        key: `matches:location:${item.id}:${index}`,
        section: "matches",
        item,
      });
    }

    return options;
  }, [
    isSidebarLocationQueryMode,
    sidebarLocationMatchSuggestions,
    sidebarLocationPopularSuggestions,
    sidebarLocationRecentSuggestions,
  ]);

  const activeSidebarLocationOption =
    sidebarLocationDropdownOptions[activeSidebarLocationSuggestionIndex] ?? null;
  const activeSidebarLocationOptionId = activeSidebarLocationOption
    ? getSidebarLocationOptionDomId(activeSidebarLocationOption.key)
    : undefined;
  const isSidebarLocationDropdownVisible = isSidebarLocationDropdownOpen;

  useEffect(() => {
    setActiveSidebarLocationSuggestionIndex((prev) =>
      prev >= sidebarLocationDropdownOptions.length ? -1 : prev,
    );
  }, [sidebarLocationDropdownOptions.length]);

  const applySidebarLocationSuggestion = useCallback((item: SidebarLocationSuggestionItem) => {
    setSbLocation(item.name);
    setIsSidebarLocationDropdownOpen(false);
    setActiveSidebarLocationSuggestionIndex(-1);
    sidebarLocationInputRef.current?.focus();
  }, []);

  const {
    items,
    total,
    hasMore,
    loading: loadingMore,
    error: loadMoreError,
    replaceAll,
    loadMore,
  } = useLoadMore({
    // Additional pages are always fetched using currently applied filters (not draft sidebar fields).
    initialData: initialResponse,
    loadPage: (nextPage) => fetchAccommodationSearch(filters, nextPage, PAGE_SIZE),
  });

  const hasFloatingMapButton = items.length > 0;

  const pushToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 10_000);
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4_000);
  }, []);

  useEffect(() => {
    if (!loadMoreError) {
      return;
    }
    pushToast("error", loadMoreError);
  }, [loadMoreError, pushToast]);

  useEffect(() => {
    if (newItemIds.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => setNewItemIds([]), 900);
    return () => window.clearTimeout(timer);
  }, [newItemIds]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.location) count += 1;
    if (filters.checkIn || filters.checkOut) count += 1;
    if (filters.guests !== "2" || filters.guestsAdults !== "2" || filters.guestsChildren !== "0") {
      count += 1;
    }
    if (filters.propertyType) count += 1;
    if (filters.minPrice) count += 1;
    if (filters.maxPrice) count += 1;
    if (filters.minRating) count += 1;
    if (filters.hasPhotos) count += 1;
    if (filters.hasReviews) count += 1;
    if (filters.familyFriendly) count += 1;
    if (filters.petsAllowed) count += 1;
    if (filters.sort && filters.sort !== "relevance") count += 1;
    return count;
  }, [filters]);

  const appliedMinPrice = Math.max(PRICE_MIN_BOUND, Number(filters.minPrice) || PRICE_MIN_BOUND);
  const appliedMaxPrice = Math.min(PRICE_MAX_BOUND, Number(filters.maxPrice) || PRICE_MAX_BOUND);
  const normalizedAppliedRating = ratingNumberToFilterValue(minRatingToNumber(filters.minRating));
  const normalizedDraftRating = ratingNumberToFilterValue(minRatingToNumber(sbMinRating));
  const ratingSliderValue = minRatingToNumber(sbMinRating);
  const ratingPercent =
    ((ratingSliderValue - RATING_MIN_BOUND) / (RATING_MAX_BOUND - RATING_MIN_BOUND)) * 100;
  const draftExtrasSummary = useMemo(
    () =>
      formatExtrasSummary({
        hasPhotos: sbHasPhotos,
        hasReviews: sbHasReviews,
        familyFriendly: sbFamilyFriendly,
        petsAllowed: sbPetsAllowed,
      }),
    [sbFamilyFriendly, sbHasPhotos, sbHasReviews, sbPetsAllowed],
  );
  const locationSummary = sbLocation.trim() || "Весь Крым";
  const propertyTypeSummary =
    propertyTypes.find((pt) => pt.id === sbPropertyType)?.name ?? "Все типы";
  const datesSummary = formatDateSummary(sbCheckIn, sbCheckOut);
  const guestsSummary = formatGuestsSummary(sbGuests);
  const priceSummary = formatPriceSummary(rangeMin, rangeMax);
  const ratingSummary = formatRatingSummary(sbMinRating);
  const sortSummary = getSortLabel((sbSort || "relevance") as SearchFilters["sort"]);
  const activeSortValue = filters.sort === "relevance" ? "" : filters.sort;
  const totalLabel = `${total} ${pluralize(total, ["вариант", "варианта", "вариантов"])}`;
  const activeFiltersLabel =
    activeFiltersCount > 0
      ? `${activeFiltersCount} ${pluralize(activeFiltersCount, [
          "активный фильтр",
          "активных фильтра",
          "активных фильтров",
        ])}`
      : "Без активных фильтров";
  const mobileLocationTitle = locationLabel || "Весь Крым";
  const hasDraftChanges =
    sbLocation.trim() !== (filters.location || "").trim() ||
    sbCheckIn !== (filters.checkIn || "") ||
    sbCheckOut !== (filters.checkOut || "") ||
    sbGuests !== (filters.guests || "2") ||
    sbGuestsAdults !== (filters.guestsAdults || filters.guests || "2") ||
    sbGuestsChildren !== (filters.guestsChildren || "0") ||
    sbPropertyType !== (filters.propertyType || "") ||
    sbSort !== (filters.sort === "relevance" ? "" : filters.sort) ||
    normalizedDraftRating !== normalizedAppliedRating ||
    sbHasPhotos !== filters.hasPhotos ||
    sbHasReviews !== filters.hasReviews ||
    sbFamilyFriendly !== filters.familyFriendly ||
    sbPetsAllowed !== filters.petsAllowed ||
    rangeMin !== appliedMinPrice ||
    rangeMax !== appliedMaxPrice;
  const showResetAction = activeFiltersCount > 0 || hasDraftChanges;

  const mapQuery = useMemo(() => buildHousingMapQuery(filters), [filters]);

  const applyFilters = useCallback(
    async (nextFilters: SearchFilters, announceMessage?: string) => {
      const normalizedFilters: SearchFilters = {
        ...nextFilters,
        direction: "housing",
      };
      const prevFilters = filters;

      setFilters(normalizedFilters);
      setIsRefreshing(true);
      setEmptySuggestions([]);
      // Every apply call invalidates previous in-flight requests.
      requestSeqRef.current += 1;
      const requestId = requestSeqRef.current;

      try {
        const nextResponse = await fetchAccommodationSearch(normalizedFilters, 1, PAGE_SIZE);
        if (requestId !== requestSeqRef.current) {
          // A newer filter request already started; drop outdated response.
          return;
        }

        replaceAll(nextResponse);
        setLocationLabel(normalizedFilters.location || "весь Крым");
        setNewItemIds([]);
        fallbackSignatureRef.current = "";
        const nextUrl = buildHousingCatalogUrl(normalizedFilters, 1, false);
        window.history.replaceState({}, "", nextUrl);
        if (announceMessage) {
          pushToast("info", announceMessage);
        }
      } catch {
        if (requestId === requestSeqRef.current) {
          setFilters(prevFilters);
          pushToast("error", "Ошибка загрузки каталога");
        }
      } finally {
        if (requestId === requestSeqRef.current) {
          setIsRefreshing(false);
        }
      }
    },
    [filters, pushToast, replaceAll],
  );

  const handleLoadMore = useCallback(async () => {
    const response = await loadMore();
    if (!response) {
      return;
    }
    setNewItemIds(response.items.map((item) => item.id));
  }, [loadMore]);

  const resetFilters = useCallback(async () => {
    await applyFilters(
      {
        ...filters,
        query: "",
        location: "",
        locationId: "",
        propertyType: "",
        checkIn: "",
        checkOut: "",
        guests: "2",
        guestsAdults: "2",
        guestsChildren: "0",
        minPrice: "",
        maxPrice: "",
        sort: "",
        minRating: "",
        hasPhotos: false,
        hasReviews: false,
        familyFriendly: false,
        petsAllowed: false,
      },
      "Фильтры сброшены",
    );
  }, [applyFilters, filters]);

  const fallbackSignature = useMemo(
    () =>
      JSON.stringify({
        location: filters.location,
        checkIn: filters.checkIn,
        checkOut: filters.checkOut,
        hasPhotos: filters.hasPhotos,
        hasReviews: filters.hasReviews,
        familyFriendly: filters.familyFriendly,
        petsAllowed: filters.petsAllowed,
        minRating: filters.minRating,
      }),
    [filters],
  );

  useEffect(() => {
    if (isRefreshing || items.length > 0) {
      setEmptySuggestions([]);
      fallbackSignatureRef.current = "";
      return;
    }

    // Do not rerun expensive fallback probes until relevant filters actually change.
    if (fallbackSignatureRef.current === fallbackSignature) {
      return;
    }
    fallbackSignatureRef.current = fallbackSignature;

    const controller = new AbortController();

    const runFallbacks = async () => {
      const suggestions: EmptyStateSuggestion[] = [];

      const nights = getNights(filters.checkIn, filters.checkOut);
      const canShiftDates = Boolean(filters.checkIn && filters.checkOut && nights > 0);

      // 1) Try nearby dates first when requested date window is too strict.
      if (canShiftDates) {
        const plusOneFilters: SearchFilters = {
          ...filters,
          checkIn: shiftIso(filters.checkIn, 1),
          checkOut: shiftIso(filters.checkOut, 1),
        };
        try {
          const plusOne = await fetchAccommodationSearch(plusOneFilters, 1, 5, controller.signal);
          if (plusOne.total > 0) {
            suggestions.push({
              title: "Сдвинуть даты на +1 день",
              description: `Найдено ${plusOne.total} вариантов при сдвиге дат на день вперёд.`,
              ctaLabel: "Показать +1 день",
              filters: {
                checkIn: plusOneFilters.checkIn,
                checkOut: plusOneFilters.checkOut,
              },
              count: plusOne.total,
            });
          }
        } catch {
          // Ignore fallback fetch errors.
        }

        const minusOneFilters: SearchFilters = {
          ...filters,
          checkIn: shiftIso(filters.checkIn, -1),
          checkOut: shiftIso(filters.checkOut, -1),
        };
        try {
          const minusOne = await fetchAccommodationSearch(minusOneFilters, 1, 5, controller.signal);
          if (minusOne.total > 0) {
            suggestions.push({
              title: "Сдвинуть даты на -1 день",
              description: `Найдено ${minusOne.total} вариантов при сдвиге дат на день назад.`,
              ctaLabel: "Показать -1 день",
              filters: {
                checkIn: minusOneFilters.checkIn,
                checkOut: minusOneFilters.checkOut,
              },
              count: minusOne.total,
            });
          }
        } catch {
          // Ignore fallback fetch errors.
        }
      }

      // 2) Relax quality-only constraints (photos/reviews/etc.) to widen pool.
      const relaxedFilters: SearchFilters = {
        ...filters,
        hasPhotos: false,
        hasReviews: false,
        familyFriendly: false,
        petsAllowed: false,
        minRating: "",
      };
      try {
        const relaxed = await fetchAccommodationSearch(relaxedFilters, 1, 5, controller.signal);
        if (relaxed.total > 0) {
          suggestions.push({
            title: "Ослабить жёсткие фильтры",
            description: `Мы нашли ${relaxed.total} вариантов, если снять строгие ограничения.`,
            ctaLabel: "Показать похожие",
            filters: {
              hasPhotos: false,
              hasReviews: false,
              familyFriendly: false,
              petsAllowed: false,
              minRating: "",
            },
            count: relaxed.total,
          });
        }
      } catch {
        // Ignore fallback fetch errors.
      }

      // 3) If city is too narrow, suggest nearby areas by removing location constraint.
      if (filters.location) {
        const nearbyFilters: SearchFilters = {
          ...relaxedFilters,
          location: "",
          locationId: "",
        };
        try {
          const nearby = await fetchAccommodationSearch(nearbyFilters, 1, 8, controller.signal);
          const locationNormalized = normalizeLocation(filters.location);
          const differentLocations = nearby.items.filter(
            (item) =>
              item.locationName && normalizeLocation(item.locationName) !== locationNormalized,
          );
          if (differentLocations.length > 0) {
            suggestions.push({
              title: "Похожие варианты рядом",
              description: `Есть ${differentLocations.length} вариантов в соседних посёлках.`,
              ctaLabel: "Показать рядом",
              filters: {
                location: "",
                locationId: "",
                hasPhotos: false,
                hasReviews: false,
                familyFriendly: false,
                petsAllowed: false,
                minRating: "",
              },
              count: differentLocations.length,
            });
          }
        } catch {
          // Ignore fallback fetch errors.
        }
      }

      setEmptySuggestions(suggestions.slice(0, 3));
    };

    void runFallbacks();
    return () => controller.abort();
  }, [fallbackSignature, filters, isRefreshing, items.length]);

  const toggleSection = useCallback((key: string, mode: "desktop" | "mobile") => {
    if (mode === "mobile") {
      setMobileOpenSections((prev) => {
        if (prev.has(key)) {
          const next = new Set(prev);
          next.delete(key);
          return next;
        }
        return new Set([key]);
      });
      return;
    }

    setDesktopOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const sectionMode: "desktop" | "mobile" = isMobileFiltersOpen ? "mobile" : "desktop";
  const openSections = sectionMode === "mobile" ? mobileOpenSections : desktopOpenSections;

  const renderSidebarLocationSuggestionButton = useCallback(
    (
      section: SidebarLocationSuggestionSection,
      item: SidebarLocationSuggestionItem,
      index: number,
    ) => {
      const optionKey = `${section}:location:${item.id}:${index}`;
      const optionIndex = sidebarLocationDropdownOptions.findIndex(
        (candidate) => candidate.key === optionKey,
      );
      if (optionIndex < 0) {
        return null;
      }

      const option = sidebarLocationDropdownOptions[optionIndex];
      if (!option) {
        return null;
      }

      const isActive = optionIndex === activeSidebarLocationSuggestionIndex;
      const icon =
        section === "recent" ? (
          <ClockIcon className="h-4 w-4" />
        ) : (
          <LocationPinIcon className="h-4 w-4" />
        );
      const nameContent =
        section === "matches" ? renderHighlightedLocationText(item.name, sbLocation) : item.name;

      return (
        <button
          id={getSidebarLocationOptionDomId(option.key)}
          key={option.key}
          type="button"
          role="option"
          aria-selected={isActive}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applySidebarLocationSuggestion(option.item)}
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
      activeSidebarLocationSuggestionIndex,
      applySidebarLocationSuggestion,
      sbLocation,
      sidebarLocationDropdownOptions,
    ],
  );

  const handleSidebarGuestsChange = useCallback(
    ({ guests, adults, children }: { guests: string; adults: string; children: string }) => {
      setSbGuests(guests);
      setSbGuestsAdults(adults);
      setSbGuestsChildren(children);
    },
    [],
  );

  const handleSidebarSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await applyFilters({
        ...filters,
        location: sbLocation.trim(),
        // If label changed manually, clear stale id so backend can resolve the new location.
        locationId: sbLocation.trim() !== filters.location ? "" : filters.locationId,
        checkIn: sbCheckIn,
        checkOut: sbCheckOut,
        guests: sbGuests || "2",
        guestsAdults: sbGuestsAdults || sbGuests || "2",
        guestsChildren: sbGuestsChildren || "0",
        propertyType: sbPropertyType,
        sort: sbSort,
        minRating: normalizedDraftRating,
        hasPhotos: sbHasPhotos,
        hasReviews: sbHasReviews,
        familyFriendly: sbFamilyFriendly,
        petsAllowed: sbPetsAllowed,
        minPrice: rangeMin > PRICE_MIN_BOUND ? String(rangeMin) : "",
        maxPrice: rangeMax < PRICE_MAX_BOUND ? String(rangeMax) : "",
      });
      closeMobileFilters();
    },
    [
      applyFilters,
      closeMobileFilters,
      filters,
      sbLocation,
      sbCheckIn,
      sbCheckOut,
      sbGuests,
      sbGuestsAdults,
      sbGuestsChildren,
      sbPropertyType,
      sbSort,
      normalizedDraftRating,
      sbHasPhotos,
      sbHasReviews,
      sbFamilyFriendly,
      sbPetsAllowed,
      rangeMin,
      rangeMax,
    ],
  );

  const appliedFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];

    if (filters.location) {
      chips.push({
        key: "location",
        label: filters.location,
        onRemove: () => void applyFilters({ ...filters, location: "", locationId: "" }),
      });
    }

    if (filters.checkIn || filters.checkOut) {
      chips.push({
        key: "dates",
        label: formatDateSummary(filters.checkIn, filters.checkOut),
        onRemove: () => void applyFilters({ ...filters, checkIn: "", checkOut: "" }),
      });
    }

    if (filters.guests !== "2" || filters.guestsAdults !== "2" || filters.guestsChildren !== "0") {
      chips.push({
        key: "guests",
        label: formatGuestsSummary(filters.guests),
        onRemove: () =>
          void applyFilters({
            ...filters,
            guests: "2",
            guestsAdults: "2",
            guestsChildren: "0",
          }),
      });
    }

    if (filters.propertyType) {
      chips.push({
        key: "propertyType",
        label:
          propertyTypes.find((propertyType) => propertyType.id === filters.propertyType)?.name ??
          filters.propertyType,
        onRemove: () => void applyFilters({ ...filters, propertyType: "" }),
      });
    }

    if (filters.minPrice || filters.maxPrice) {
      chips.push({
        key: "price",
        label: formatPriceSummary(appliedMinPrice, appliedMaxPrice),
        onRemove: () => void applyFilters({ ...filters, minPrice: "", maxPrice: "" }),
      });
    }

    if (filters.minRating) {
      chips.push({
        key: "rating",
        label: formatRatingSummary(filters.minRating),
        onRemove: () => void applyFilters({ ...filters, minRating: "" }),
      });
    }

    if (filters.hasPhotos) {
      chips.push({
        key: "hasPhotos",
        label: "Только с фото",
        onRemove: () => void applyFilters({ ...filters, hasPhotos: false }),
      });
    }

    if (filters.hasReviews) {
      chips.push({
        key: "hasReviews",
        label: "С отзывами",
        onRemove: () => void applyFilters({ ...filters, hasReviews: false }),
      });
    }

    if (filters.familyFriendly) {
      chips.push({
        key: "familyFriendly",
        label: "Для детей",
        onRemove: () => void applyFilters({ ...filters, familyFriendly: false }),
      });
    }

    if (filters.petsAllowed) {
      chips.push({
        key: "petsAllowed",
        label: "С животными",
        onRemove: () => void applyFilters({ ...filters, petsAllowed: false }),
      });
    }

    if (activeSortValue) {
      chips.push({
        key: "sort",
        label: getSortLabel(filters.sort),
        onRemove: () => void applyFilters({ ...filters, sort: "" }),
      });
    }

    return chips;
  }, [activeSortValue, applyFilters, appliedMaxPrice, appliedMinPrice, filters]);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-6 pb-28 md:px-6 md:py-8 md:pb-8 lg:pb-8">
      <div className="mb-4 space-y-3 md:hidden">
        <section className="relative overflow-hidden rounded-[30px] border border-olive/12 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_56%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(243,247,245,0.94))] p-4 shadow-[0_22px_46px_-34px_rgba(15,74,64,0.58)]">
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />

          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-olive/48">
                  Подбор проживания
                </p>
                <h1 className="mt-2 text-[26px] font-bold leading-none tracking-tight text-olive">
                  {mobileLocationTitle}
                </h1>
              </div>

              <div className="shrink-0 rounded-[24px] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(232,245,241,0.94))] px-4 py-3 text-center shadow-[0_18px_30px_-24px_rgba(15,74,64,0.28)] backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-olive/45">
                  Найдено
                </p>
                <p className="mt-2 text-center text-[28px] font-black leading-none tracking-tight text-olive">
                  {total}
                </p>
                <p className="mt-2 text-center text-[11px] font-medium text-olive/60">вариант</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/88 px-3 py-1.5 text-xs font-semibold text-olive shadow-[0_12px_24px_-22px_rgba(15,74,64,0.44)]">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {datesSummary}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/88 px-3 py-1.5 text-xs font-semibold text-olive shadow-[0_12px_24px_-22px_rgba(15,74,64,0.44)]">
                <UsersIcon className="h-4 w-4 text-primary" />
                {guestsSummary}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(true)}
                aria-expanded={isMobileFiltersOpen}
                aria-controls="catalog-mobile-filters"
                className="inline-flex h-12 items-center justify-center gap-2.5 rounded-[20px] bg-olive px-4 text-sm font-semibold text-white shadow-[0_18px_30px_-24px_rgba(15,74,64,0.55)] transition active:scale-[0.98]"
              >
                <SlidersIcon className="h-4 w-4" />
                <span>Фильтры</span>
                {activeFiltersCount > 0 ? (
                  <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-white/16 px-1.5 text-[11px] font-bold text-white">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </button>

              {showResetAction ? (
                <button
                  type="button"
                  onClick={() => void resetFilters()}
                  className="inline-flex h-12 items-center justify-center rounded-[20px] border border-olive/14 bg-white/88 px-4 text-sm font-semibold text-olive transition hover:bg-white"
                >
                  Сбросить
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {appliedFilterChips.length > 0 ? (
          <section className="rounded-[24px] border border-olive/10 bg-white/92 px-3 py-3 shadow-[0_18px_34px_-34px_rgba(15,74,64,0.45)]">
            <div className="mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-olive/45">
                Активные фильтры
              </p>
            </div>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {appliedFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-primary/14 bg-primary/8 px-3.5 text-xs font-semibold text-primary transition active:scale-[0.98]"
                >
                  <span>{chip.label}</span>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/12">
                    <ClearIcon className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[26px] border border-olive/10 bg-white/94 p-3 shadow-[0_18px_38px_-34px_rgba(15,74,64,0.48)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-olive/45">
                Сортировка
              </p>
              <p className="mt-1 text-sm font-semibold text-olive">{getSortLabel(filters.sort)}</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {activeFiltersLabel}
            </span>
          </div>

          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value || "recommended"}
                type="button"
                onClick={() =>
                  void applyFilters({
                    ...filters,
                    sort: option.value as SearchFilters["sort"],
                  })
                }
                className={cn(
                  "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition",
                  activeSortValue === option.value
                    ? "border-primary bg-primary text-white shadow-[0_14px_26px_-20px_rgba(15,118,110,0.78)]"
                    : "border-olive/14 bg-white text-olive hover:bg-cream/70",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

      </div>

      {appliedFilterChips.length > 0 ? (
        <div className="mb-4 hidden flex-wrap items-center gap-2 md:flex">
          <span className="text-xs text-olive/50">Активные:</span>
          {appliedFilterChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-primary/20"
                aria-label={`Убрать фильтр ${chip.label}`}
              >
                <AppIcon icon={X} className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* ── Three-column layout ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-start gap-4 md:flex-row md:gap-5">
        {/* ── Left: Filter sidebar / mobile drawer ────────────────────────── */}
        <aside
          id="catalog-mobile-filters"
          className={cn(
            "fixed inset-0 z-[70] flex items-end justify-center transition-opacity duration-300 md:static md:z-auto md:w-72 md:shrink-0 md:items-start md:justify-start",
            isMobileFiltersOpen
              ? "opacity-100"
              : "pointer-events-none opacity-0 md:pointer-events-auto md:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={() => closeMobileFilters(true)}
            aria-label="Закрыть фильтры"
            className={cn(
              "absolute inset-0 bg-black/30 transition-opacity duration-300 md:hidden",
              isMobileFiltersOpen ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            className={cn(
              "relative mt-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-white shadow-[0_-24px_60px_-26px_rgba(18,72,63,0.58)] transition-transform duration-300 ease-out sm:max-w-[430px] md:mt-0 md:h-auto md:max-h-none md:w-auto md:max-w-none md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none",
              isMobileFiltersOpen ? "translate-y-0" : "translate-y-full md:translate-y-0",
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[30px] bg-gradient-to-b from-white via-white to-foam/45 md:sticky md:top-6 md:rounded-[24px] md:ring-1 md:ring-olive/12 md:shadow-[0_28px_48px_-40px_rgba(18,72,63,0.72)]">
              <form onSubmit={handleSidebarSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-olive/12 bg-white/88 px-4 pb-4 pt-2 backdrop-blur md:bg-transparent md:pt-4 md:backdrop-blur-0">
                  <div className="flex justify-center md:hidden">
                    <div className="h-1 w-11 rounded-full bg-olive/18" />
                  </div>

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive/55">
                        Фильтры поиска
                      </p>
                      <p className="mt-2 text-base font-semibold text-olive">
                        {activeFiltersCount > 0
                          ? `${activeFiltersCount} ${pluralize(activeFiltersCount, ["активный фильтр", "активных фильтра", "активных фильтров"])}`
                          : "Настройте выдачу под себя"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => closeMobileFilters(true)}
                      className="rounded-xl p-2 text-[color:var(--icon-nav)] transition-colors hover:bg-primary/8 md:hidden"
                      aria-label="Закрыть"
                    >
                      <AppIcon icon={X} className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pb-4 custom-scrollbar">
                  <div className="space-y-2.5 px-3 py-3 md:space-y-0 md:px-0 md:py-0">
                    <FilterSection
                      label="Локация"
                      summary={locationSummary}
                      active={Boolean(sbLocation.trim())}
                      open={openSections.has("location")}
                      onToggle={() => toggleSection("location", sectionMode)}
                      mobileMode={sectionMode === "mobile"}
                    >
                      <div
                        ref={sidebarLocationComboboxRef}
                        className={cn(
                          "relative",
                          isSidebarLocationDropdownVisible ? "z-[1300]" : "",
                        )}
                      >
                        <input
                          id="home-search-input"
                          ref={sidebarLocationInputRef}
                          autoComplete="off"
                          placeholder="Город или отель"
                          aria-label="Город или отель"
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={isSidebarLocationDropdownVisible}
                          aria-controls={SIDEBAR_LOCATION_SUGGESTIONS_LISTBOX_ID}
                          aria-activedescendant={activeSidebarLocationOptionId}
                          value={sbLocation}
                          onFocus={() => setIsSidebarLocationDropdownOpen(true)}
                          onClick={() => setIsSidebarLocationDropdownOpen(true)}
                          onChange={(event) => {
                            setSbLocation(event.target.value.slice(0, 120));
                            setIsSidebarLocationDropdownOpen(true);
                            setActiveSidebarLocationSuggestionIndex(-1);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              setIsSidebarLocationDropdownOpen(true);
                              if (sidebarLocationDropdownOptions.length === 0) {
                                return;
                              }
                              setActiveSidebarLocationSuggestionIndex((prev) =>
                                prev < 0 ? 0 : (prev + 1) % sidebarLocationDropdownOptions.length,
                              );
                              return;
                            }

                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              setIsSidebarLocationDropdownOpen(true);
                              if (sidebarLocationDropdownOptions.length === 0) {
                                return;
                              }
                              setActiveSidebarLocationSuggestionIndex((prev) =>
                                prev < 0
                                  ? sidebarLocationDropdownOptions.length - 1
                                  : (prev - 1 + sidebarLocationDropdownOptions.length) %
                                    sidebarLocationDropdownOptions.length,
                              );
                              return;
                            }

                            if (
                              event.key === "Enter" &&
                              activeSidebarLocationSuggestionIndex >= 0
                            ) {
                              const option =
                                sidebarLocationDropdownOptions[
                                  activeSidebarLocationSuggestionIndex
                                ];
                              if (!option) {
                                return;
                              }
                              event.preventDefault();
                              applySidebarLocationSuggestion(option.item);
                              return;
                            }

                            if (event.key === "Escape") {
                              setIsSidebarLocationDropdownOpen(false);
                              setActiveSidebarLocationSuggestionIndex(-1);
                              return;
                            }

                            if (event.key === "Tab") {
                              setIsSidebarLocationDropdownOpen(false);
                              setActiveSidebarLocationSuggestionIndex(-1);
                            }
                          }}
                          className="h-12 w-full rounded-xl border border-olive/18 bg-white/95 px-3.5 pr-11 text-[15px] text-olive transition-all duration-200 placeholder:text-olive/50 hover:border-olive/32 focus:outline-none focus:ring-2 focus:ring-primary/32"
                        />

                        {sbLocation.trim().length > 0 ? (
                          <button
                            type="button"
                            aria-label="Очистить локацию"
                            onClick={() => {
                              setSbLocation("");
                              setActiveSidebarLocationSuggestionIndex(-1);
                              setIsSidebarLocationDropdownOpen(true);
                              sidebarLocationInputRef.current?.focus();
                            }}
                            className="absolute top-1/2 right-2.5 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--icon-nav)] transition-colors duration-200 hover:bg-cream hover:text-[color:var(--icon-default)]"
                          >
                            <ClearIcon className="h-4 w-4" />
                          </button>
                        ) : null}

                        {isSidebarLocationDropdownVisible ? (
                          <div
                            className={cn(
                              "w-full overflow-hidden rounded-2xl border border-olive/14 bg-white shadow-[0_20px_44px_-26px_rgba(15,74,64,0.58)]",
                              sectionMode === "mobile"
                                ? "relative z-[1300] mt-2"
                                : "absolute left-0 top-[calc(100%+8px)] z-[1300]",
                            )}
                          >
                            <div
                              id={SIDEBAR_LOCATION_SUGGESTIONS_LISTBOX_ID}
                              role="listbox"
                              className="max-h-[380px] overflow-y-auto p-1.5"
                            >
                              {isSidebarLocationSuggestionsLoading &&
                              sidebarLocationDropdownOptions.length === 0 ? (
                                <p className="px-3 py-5 text-sm text-olive/65">
                                  Ищем подходящие варианты...
                                </p>
                              ) : null}

                              {!isSidebarLocationSuggestionsLoading &&
                              !isSidebarLocationQueryMode &&
                              sidebarLocationRecentSuggestions.length > 0 ? (
                                <div className="pb-1">
                                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                                    Ранее вы уже искали
                                  </p>
                                  <div className="space-y-1">
                                    {sidebarLocationRecentSuggestions.map((item, index) =>
                                      renderSidebarLocationSuggestionButton("recent", item, index),
                                    )}
                                  </div>
                                </div>
                              ) : null}

                              {!isSidebarLocationSuggestionsLoading &&
                              !isSidebarLocationQueryMode &&
                              sidebarLocationPopularSuggestions.length > 0 ? (
                                <div className="pb-1">
                                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                                    Популярные направления
                                  </p>
                                  <div className="space-y-1">
                                    {sidebarLocationPopularSuggestions.map((item, index) =>
                                      renderSidebarLocationSuggestionButton("popular", item, index),
                                    )}
                                  </div>
                                </div>
                              ) : null}

                              {!isSidebarLocationSuggestionsLoading &&
                              isSidebarLocationQueryMode &&
                              sidebarLocationMatchSuggestions.length > 0 ? (
                                <div className="pb-1">
                                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                                    Локации
                                  </p>
                                  <div className="space-y-1">
                                    {sidebarLocationMatchSuggestions.map((item, index) =>
                                      renderSidebarLocationSuggestionButton("matches", item, index),
                                    )}
                                  </div>
                                </div>
                              ) : null}

                              {!isSidebarLocationSuggestionsLoading &&
                              !isSidebarLocationQueryMode &&
                              sidebarLocationRecentSuggestions.length === 0 &&
                              sidebarLocationPopularSuggestions.length === 0 ? (
                                <p className="px-3 py-5 text-sm text-olive/65">
                                  Начните вводить город.
                                </p>
                              ) : null}

                              {!isSidebarLocationSuggestionsLoading &&
                              isSidebarLocationQueryMode &&
                              sidebarLocationMatchSuggestions.length === 0 ? (
                                <p className="px-3 py-5 text-sm text-olive/65">
                                  Ничего не найдено.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </FilterSection>

                    <FilterSection
                      label="Тип жилья"
                      summary={propertyTypeSummary}
                      active={Boolean(sbPropertyType)}
                      open={openSections.has("type")}
                      onToggle={() => toggleSection("type", sectionMode)}
                      mobileMode={sectionMode === "mobile"}
                    >
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSbPropertyType("")}
                          className={cn(
                            "inline-flex h-10 items-center rounded-full border px-3.5 text-xs font-semibold transition-colors duration-200",
                            !sbPropertyType
                              ? "border-primary bg-primary text-white shadow-[0_8px_18px_-14px_rgba(15,118,110,0.7)]"
                              : "border-olive/18 bg-white text-olive hover:bg-cream/70",
                          )}
                        >
                          Все
                        </button>
                        {propertyTypes.map((pt) => (
                          <button
                            key={pt.id}
                            type="button"
                            onClick={() => setSbPropertyType(pt.id)}
                            className={cn(
                              "inline-flex h-10 items-center rounded-full border px-3.5 text-xs font-semibold transition-colors duration-200",
                              sbPropertyType === pt.id
                                ? "border-primary bg-primary text-white shadow-[0_8px_18px_-14px_rgba(15,118,110,0.7)]"
                                : "border-olive/18 bg-white text-olive hover:bg-cream/70",
                            )}
                          >
                            {pt.name}
                          </button>
                        ))}
                      </div>
                    </FilterSection>

                    <FilterSection
                      label="Даты"
                      summary={datesSummary}
                      active={Boolean(sbCheckIn || sbCheckOut)}
                      open={openSections.has("dates")}
                      onToggle={() => toggleSection("dates", sectionMode)}
                      mobileMode={sectionMode === "mobile"}
                    >
                      <HousingSearchDateRangeField
                        initialCheckIn={sbCheckIn}
                        initialCheckOut={sbCheckOut}
                        showHiddenInputs={false}
                        autoSubmitOnComplete={false}
                        onRangeChange={({ checkIn, checkOut }) => {
                          setSbCheckIn(checkIn);
                          setSbCheckOut(checkOut);
                        }}
                        buttonClassName="h-12 rounded-xl border border-olive/18 bg-white/95 px-3.5 py-2 text-sm font-semibold text-olive transition-all duration-200 hover:border-olive/32"
                      />
                    </FilterSection>

                    <FilterSection
                      label="Гости"
                      summary={guestsSummary}
                      active={
                        sbGuests !== "2" || sbGuestsAdults !== "2" || sbGuestsChildren !== "0"
                      }
                      open={openSections.has("guests")}
                      onToggle={() => toggleSection("guests", sectionMode)}
                      mobileMode={sectionMode === "mobile"}
                    >
                      <HousingSearchGuestsField
                        key={`${sbGuests}-${sbGuestsAdults}-${sbGuestsChildren}`}
                        initialGuests={sbGuests || "2"}
                        initialAdults={sbGuestsAdults || sbGuests || "2"}
                        initialChildren={sbGuestsChildren || "0"}
                        autoSubmitOnComplete={false}
                        onGuestsChange={handleSidebarGuestsChange}
                      />
                    </FilterSection>

                    <FilterSection
                      label="Цена за ночь"
                      summary={priceSummary}
                      active={rangeMin > PRICE_MIN_BOUND || rangeMax < PRICE_MAX_BOUND}
                      open={openSections.has("price")}
                      onToggle={() => toggleSection("price", sectionMode)}
                      mobileMode={sectionMode === "mobile"}
                    >
                      <div className="space-y-4 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-olive/12 bg-white/90 px-3 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                              От
                            </p>
                            <p className="mt-1 text-sm font-semibold text-olive">
                              {rangeMin > PRICE_MIN_BOUND ? formatCurrency(rangeMin) : "Любая"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-olive/12 bg-white/90 px-3 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                              До
                            </p>
                            <p className="mt-1 text-sm font-semibold text-olive">
                              {rangeMax < PRICE_MAX_BOUND ? formatCurrency(rangeMax) : "Без лимита"}
                            </p>
                          </div>
                        </div>
                        <div className="relative px-1">
                          <div className="relative h-7">
                            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-olive/10" />
                            <div
                              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary/70"
                              style={{
                                left: `${leftPercent}%`,
                                width: `${Math.max(0, rightPercent - leftPercent)}%`,
                              }}
                            />
                            <input
                              type="range"
                              min={PRICE_MIN_BOUND}
                              max={PRICE_MAX_BOUND}
                              step={PRICE_STEP}
                              value={rangeMin}
                              onChange={(event) => updatePriceMin(Number(event.target.value))}
                              className="pointer-events-none absolute inset-x-0 top-1/2 h-7 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
                            />
                            <input
                              type="range"
                              min={PRICE_MIN_BOUND}
                              max={PRICE_MAX_BOUND}
                              step={PRICE_STEP}
                              value={rangeMax}
                              onChange={(event) => updatePriceMax(Number(event.target.value))}
                              className="pointer-events-none absolute inset-x-0 top-1/2 h-7 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-medium text-olive/55">
                          <span>0 ₽</span>
                          <span>25 000 ₽</span>
                          <span>50 000 ₽+</span>
                        </div>
                      </div>
                    </FilterSection>

                    <FilterSection
                      label="Рейтинг"
                      summary={ratingSummary}
                      active={Boolean(normalizedDraftRating)}
                      open={openSections.has("rating")}
                      onToggle={() => toggleSection("rating", sectionMode)}
                      mobileMode={sectionMode === "mobile"}
                    >
                      <div className="space-y-4 pt-1">
                        <div className="flex items-center justify-between rounded-2xl border border-olive/12 bg-white/90 px-3 py-2.5">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                              Минимальный рейтинг
                            </p>
                            <p className="mt-1 text-sm font-semibold text-olive">
                              {ratingSliderValue > 0
                                ? `${formatRatingValue(ratingSliderValue)}+`
                                : "Любой"}
                            </p>
                          </div>
                          {ratingSliderValue > 0 ? (
                            <button
                              type="button"
                              onClick={() => setSbMinRating("")}
                              className="inline-flex h-9 items-center rounded-full border border-olive/16 bg-white px-3 text-xs font-semibold text-olive transition hover:bg-cream/70"
                            >
                              Сбросить
                            </button>
                          ) : null}
                        </div>
                        <div className="space-y-3 px-1">
                          <div className="relative h-7">
                            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-olive/10" />
                            <div
                              className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary/70"
                              style={{ width: `${ratingPercent}%` }}
                            />
                            <input
                              type="range"
                              min={RATING_MIN_BOUND}
                              max={RATING_MAX_BOUND}
                              step={RATING_STEP}
                              value={ratingSliderValue}
                              onChange={(event) =>
                                setSbMinRating(
                                  ratingNumberToFilterValue(Number(event.target.value)),
                                )
                              }
                              aria-label="Минимальный рейтинг"
                              aria-valuetext={
                                ratingSliderValue > 0
                                  ? `От ${formatRatingValue(ratingSliderValue)}`
                                  : "Любой рейтинг"
                              }
                              className="absolute inset-x-0 top-1/2 h-7 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_8px_18px_-10px_rgba(15,118,110,0.75)]"
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-medium text-olive/55">
                            <span>Любой</span>
                            <span>3.0</span>
                            <span>4.0</span>
                            <span>5.0</span>
                          </div>
                        </div>
                      </div>
                    </FilterSection>

                    <FilterSection
                      label="Дополнительно"
                      summary={draftExtrasSummary}
                      active={Boolean(
                        sbHasPhotos || sbHasReviews || sbFamilyFriendly || sbPetsAllowed,
                      )}
                      open={openSections.has("extra")}
                      onToggle={() => toggleSection("extra", sectionMode)}
                      mobileMode={sectionMode === "mobile"}
                    >
                      {[
                        {
                          label: "Только с фото",
                          checked: sbHasPhotos,
                          onChange: setSbHasPhotos,
                        },
                        {
                          label: "С отзывами",
                          checked: sbHasReviews,
                          onChange: setSbHasReviews,
                        },
                        {
                          label: "Для детей",
                          checked: sbFamilyFriendly,
                          onChange: setSbFamilyFriendly,
                        },
                        {
                          label: "С животными",
                          checked: sbPetsAllowed,
                          onChange: setSbPetsAllowed,
                        },
                      ].map((item) => (
                        <label
                          key={item.label}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all duration-200",
                            item.checked
                              ? "border-primary/28 bg-primary/8"
                              : "border-olive/12 bg-white/85 hover:bg-cream/60",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(event) => item.onChange(event.target.checked)}
                            className="h-4 w-4 shrink-0 accent-primary"
                          />
                          <span className="text-sm font-medium text-olive">{item.label}</span>
                        </label>
                      ))}
                    </FilterSection>

                    {sectionMode === "mobile" ? (
                      <FilterSection
                        label="Сортировка"
                        summary={sortSummary}
                        active={Boolean(sbSort)}
                        open={openSections.has("sort")}
                        onToggle={() => toggleSection("sort", sectionMode)}
                        mobileMode
                      >
                        <SortSelectField value={sbSort} onChange={setSbSort} />
                      </FilterSection>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 border-t border-olive/10 bg-white/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] backdrop-blur md:static md:border-t-0 md:bg-transparent md:px-4 md:py-4 md:pb-4">
                  {hasDraftChanges ? (
                    <p className="mb-2 text-[11px] font-medium text-olive/60">
                      Подтвердите изменения, чтобы обновить выдачу.
                    </p>
                  ) : null}
                  <div
                    className={cn(
                      "grid gap-2",
                      showResetAction ? "grid-cols-2 md:grid-cols-1" : "grid-cols-1",
                    )}
                  >
                    {showResetAction ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await resetFilters();
                          closeMobileFilters();
                        }}
                        className="inline-flex h-12 items-center justify-center rounded-2xl border border-olive/18 bg-white px-3 text-sm font-semibold text-olive transition-colors hover:bg-cream"
                      >
                        Сбросить
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-white transition-all duration-200 hover:brightness-95"
                    >
                      Показать варианты
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1 space-y-3">
          <section
            id="catalog-sort"
            className="hidden flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-white/95 p-3.5 ring-1 ring-olive/10 shadow-[0_16px_38px_-32px_rgba(15,74,64,0.68)] md:flex"
          >
            <div>
              <p className="text-sm font-semibold text-olive">{`Найдено ${totalLabel}`}</p>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <SortSelectField
                value={activeSortValue}
                onChange={(value) =>
                  void applyFilters({
                    ...filters,
                    sort: value,
                  })
                }
                className="min-w-[260px]"
              />
            </div>
          </section>

          {items.length === 0 && !isRefreshing ? (
            <section className="rounded-2xl border border-dashed border-olive/25 bg-white/94 p-6 text-center">
              <div className="flex justify-center">
                <EmptyStateIcon />
              </div>
              <h2 className="mt-2 text-[22px] text-olive">Ничего не найдено</h2>
              <p className="mt-1 text-sm text-olive/65">Попробуйте изменить параметры поиска</p>

              {emptySuggestions.length > 0 ? (
                <div className="mx-auto mt-4 grid max-w-3xl gap-2 text-left">
                  {emptySuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.title}-${suggestion.ctaLabel}`}
                      type="button"
                      onClick={() =>
                        void applyFilters(
                          {
                            ...filters,
                            ...suggestion.filters,
                          },
                          `${suggestion.count} вариантов`,
                        )
                      }
                      className="rounded-xl border border-primary/22 bg-foam/60 px-3 py-2.5 text-sm text-olive transition hover:bg-foam"
                    >
                      <span className="font-semibold text-primary">{suggestion.title}</span>
                      <span className="mt-0.5 block text-xs text-olive/72">
                        {suggestion.description}
                      </span>
                      <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {suggestion.ctaLabel}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void applyFilters({ ...filters, minRating: "", hasReviews: false })
                    }
                    className="rounded-full border border-olive/16 bg-cream/60 px-3 py-1.5 text-xs font-semibold text-olive"
                  >
                    Расширить фильтры
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyFilters({ ...filters, location: "", locationId: "" })}
                    className="rounded-full border border-olive/16 bg-cream/60 px-3 py-1.5 text-xs font-semibold text-olive"
                  >
                    Другой город
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => void resetFilters()}
                className="mt-4 inline-flex h-10 items-center rounded-xl border border-olive/18 bg-white px-3.5 text-sm font-semibold text-olive transition hover:bg-cream/70"
              >
                Сбросить все фильтры
              </button>
            </section>
          ) : (
            <PublicHousingResultsWithMap
              items={items}
              mapQuery={mapQuery}
              selectedLocationName={locationLabel}
              view={view}
              searchGuests={Number.parseInt(filters.guests, 10) || 2}
              hasMore={hasMore}
              loadingMore={loadingMore}
              loadingInitial={isRefreshing && items.length === 0}
              newItemIds={newItemIds}
              onLoadMore={handleLoadMore}
              onWishlistToggle={(isFavorite) =>
                pushToast("success", isFavorite ? "Добавлено в избранное" : "Удалено из избранного")
              }
            />
          )}
        </div>
      </div>

      <ToastContainer
        toasts={toasts}
        hasFloatingMapButton={hasFloatingMapButton}
        onClose={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))}
      />

      <section className="sr-only" aria-live="polite">
        {`Показано ${items.length} из ${total}. Сортировка: ${getSortLabel(filters.sort)}.`}
      </section>
    </div>
  );
}

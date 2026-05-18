"use client";

import {
  Building2,
  CalendarDays,
  MapPin,
  SlidersHorizontal,
  Star,
  Users,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CatalogFieldGroup,
  CatalogFilterChipButton,
  CatalogFilterPanelActions,
  CatalogFilterShell,
  ResponsiveFilterPanel,
} from "@/components/public/catalog-filter-shell";
import { AppIcon } from "@/components/ui/app-icon";
import { UnifiedCalendarContent } from "@/components/ui/unified-calendar-content";
import { UnifiedGuestsEditor } from "@/components/ui/unified-guests-editor";
import { cn } from "@/lib/cn";
import { propertyTypes } from "@/lib/constants";
import type { SearchFilters } from "@/types/catalog";

const PRICE_MIN_BOUND = 0;
const PRICE_MAX_BOUND = 50_000;
const PRICE_STEP = 500;
const DATE_PANEL_WIDTH = 840;
const DATE_PANEL_MAX_HEIGHT = 720;
const LOCATION_SUGGESTIONS_CACHE_TTL_MS = 8 * 60_000;
const LOCATION_RECENT_STORAGE_KEY = "boking.home_search_recent_v1";
const LOCATION_RECENT_LIMIT = 4;
const EMPTY_DATE_LABEL = "Даты";
const EMPTY_PRICE_LABEL = "Цена";
const RATING_OPTIONS = [
  { value: "", label: "Любой" },
  { value: "3", label: "3+" },
  { value: "3.5", label: "3.5+" },
  { value: "4", label: "4+" },
  { value: "4.5", label: "4.5+" },
] as const;

type PanelKey = "location" | "dates" | "guests" | "type" | "price" | "rating" | "more";

type LocationSuggestionItem = {
  type: "location";
  id: string;
  name: string;
  subtitle: string;
};

type LocationSuggestionsPayload = {
  popular: LocationSuggestionItem[];
  matches: LocationSuggestionItem[];
};

export type CatalogFilterBarProps = {
  filters: SearchFilters;
  onApplyFilters: (next: SearchFilters, toast?: string) => void;
  onResetFilters: () => void;
  totalCount: number;
  isLoading?: boolean;
  locationLabel: string;
  locationNames: string[];
  initialPopularSuggestions: LocationSuggestionItem[];
};

function pluralize(value: number, variants: [string, string, string]): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;
  if (abs > 10 && abs < 20) return variants[2];
  if (mod > 1 && mod < 5) return variants[1];
  if (mod === 1) return variants[0];
  return variants[2];
}

function parseIsoDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLocation(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDayMonth(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

function formatDateChip(checkIn: string, checkOut: string): string {
  if (!checkIn) return EMPTY_DATE_LABEL;
  const from = formatDayMonth(checkIn);
  if (!checkOut) return from ? `С ${from}` : EMPTY_DATE_LABEL;
  const to = formatDayMonth(checkOut);
  return from && to ? `${from} - ${to}` : EMPTY_DATE_LABEL;
}

const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatCurrency(value: number): string {
  return `${ruNumberFormat.format(value)} ₽`;
}

function formatFoundObjectsLabel(value: number): string {
  return `Найдено: ${ruNumberFormat.format(value)} ${pluralize(value, [
    "вариант жилья",
    "варианта жилья",
    "вариантов жилья",
  ])}`;
}

function CatalogLoadingLabel() {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-olive/62">
      <span className="truncate">Ищем лучшие варианты жилья</span>
      <span className="catalog-loading-inline-dots text-terra" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}

function formatGuestsChip(filters: SearchFilters): string {
  const guests = Number.parseInt(filters.guests, 10) || 2;
  return `${guests} ${pluralize(guests, ["гость", "гостя", "гостей"])}`;
}

function formatTypeChip(value: string): string {
  if (!value) return "Все типы";
  return propertyTypes.find((item) => item.id === value)?.name ?? value;
}

function formatLocationChipLabel(value: string): string {
  const normalizedValue = value.trim();
  if (normalizedValue.toLocaleLowerCase("ru-RU") === "весь крым") {
    return "Весь Крым";
  }

  return normalizedValue;
}

function formatPriceChip(minPrice: string, maxPrice: string): string {
  const min = Number.parseInt(minPrice, 10);
  const max = Number.parseInt(maxPrice, 10);
  const hasMin = Number.isFinite(min) && min > PRICE_MIN_BOUND;
  const hasMax = Number.isFinite(max) && max < PRICE_MAX_BOUND;
  if (hasMin && hasMax) return `${formatCurrency(min)} - ${formatCurrency(max)}`;
  if (hasMin) return `от ${formatCurrency(min)}`;
  if (hasMax) return `до ${formatCurrency(max)}`;
  return EMPTY_PRICE_LABEL;
}

function formatRatingChip(value: string): string {
  return value ? `${value}+` : "Рейтинг";
}

function getNightsCount(checkIn: string, checkOut: string): number {
  const from = parseIsoDate(checkIn);
  const to = parseIsoDate(checkOut);
  if (!from || !to) return 0;
  const diff = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

function extrasCount(filters: SearchFilters): number {
  return Number(filters.hasPhotos) + Number(filters.hasReviews) + Number(filters.familyFriendly) + Number(filters.petsAllowed);
}

function readRecentLocations(): LocationSuggestionItem[] {
  try {
    const raw = localStorage.getItem(LOCATION_RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      id?: string;
      type?: string;
      direction?: string;
      name?: string;
      subtitle?: string;
    }>;
    if (!Array.isArray(parsed)) return [];
    const result: LocationSuggestionItem[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (item.type !== "location" || item.direction !== "housing" || !item.name) continue;
      const key = normalizeLocation(item.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push({ type: "location", id: item.id ?? key, name: item.name, subtitle: item.subtitle ?? "" });
      if (result.length >= LOCATION_RECENT_LIMIT) break;
    }
    return result;
  } catch {
    return [];
  }
}

function storeRecentLocation(name: string, id: string) {
  try {
    const current = readRecentLocations();
    const next = [{ type: "location", direction: "housing", id: id || normalizeLocation(name), name, subtitle: "" }, ...current].filter(
      (item, index, items) =>
        items.findIndex((candidate) => normalizeLocation(candidate.name) === normalizeLocation(item.name)) === index,
    );
    localStorage.setItem(LOCATION_RECENT_STORAGE_KEY, JSON.stringify(next.slice(0, LOCATION_RECENT_LIMIT)));
  } catch {
    // Ignore localStorage failures.
  }
}

function LocationSuggestionsField({
  value,
  locationNames,
  initialPopularSuggestions,
  onChange,
  onSelect,
}: {
  value: string;
  locationNames: string[];
  initialPopularSuggestions: LocationSuggestionItem[];
  onChange: (next: string) => void;
  onSelect: (name: string, id: string) => void;
}) {
  const [recentSuggestions, setRecentSuggestions] = useState<LocationSuggestionItem[]>([]);
  const [suggestions, setSuggestions] = useState<LocationSuggestionsPayload>({
    popular: initialPopularSuggestions,
    matches: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const cacheRef = useRef<Map<string, { payload: LocationSuggestionsPayload; expiresAt: number }>>(new Map());

  useEffect(() => {
    setRecentSuggestions(readRecentLocations());
  }, []);

  useEffect(() => {
    if (initialPopularSuggestions.length === 0) {
      return;
    }

    const payload = {
      popular: initialPopularSuggestions,
      matches: [],
    } satisfies LocationSuggestionsPayload;

    cacheRef.current.set("", {
      payload,
      expiresAt: Date.now() + LOCATION_SUGGESTIONS_CACHE_TTL_MS,
    });

    if (value.trim().length === 0) {
      setSuggestions(payload);
    }
  }, [initialPopularSuggestions, value]);

  useEffect(() => {
    const query = value.trim();
    const cacheKey = query.toLowerCase();
    const cached = cacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setSuggestions(cached.payload);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search/suggestions?query=${encodeURIComponent(query)}&direction=housing`,
          {
            credentials: "omit",
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error("suggestions_request_failed");
        }
        const payload = (await response.json()) as { popular?: unknown[]; matches?: unknown[] };
        const parseList = (items: unknown[]): LocationSuggestionItem[] =>
          items
            .filter(
              (item): item is { type: string; id: string; name: string; subtitle?: string } =>
                Boolean(item) &&
                typeof item === "object" &&
                (item as { type?: string }).type === "location" &&
                typeof (item as { id?: string }).id === "string" &&
                typeof (item as { name?: string }).name === "string",
            )
            .map((item) => ({ type: "location", id: item.id, name: item.name, subtitle: item.subtitle ?? "" }));
        const nextPayload = { popular: parseList(payload.popular ?? []), matches: parseList(payload.matches ?? []) };
        cacheRef.current.set(cacheKey, { payload: nextPayload, expiresAt: Date.now() + LOCATION_SUGGESTIONS_CACHE_TTL_MS });
        setSuggestions(nextPayload);
      } catch {
        const normalizedQuery = normalizeLocation(query);
        const localMatches =
          normalizedQuery.length < 2
            ? []
            : locationNames
                .filter((name) => normalizeLocation(name).includes(normalizedQuery))
                .slice(0, 8)
                .map((name) => ({ type: "location" as const, id: normalizeLocation(name), name, subtitle: "Локация Крыма" }));
        setSuggestions({ popular: [], matches: localMatches });
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [locationNames, value]);

  const isQueryMode = value.trim().length >= 2;
  const visibleGroups = isQueryMode
    ? [{ label: "Локации", items: suggestions.matches }]
    : [
        { label: "Недавние", items: recentSuggestions },
        { label: "Популярные направления", items: suggestions.popular },
      ];

  return (
    <div className="space-y-3">
      <label className="block">
        <input
          name="location"
          type="text"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value.slice(0, 120))}
          placeholder="Город или курорт"
          className="h-12 w-full rounded-2xl border border-olive/16 bg-white px-4 text-sm text-olive outline-none transition placeholder:text-olive/45 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      <div className="max-h-[320px] space-y-3 overflow-y-auto rounded-2xl border border-olive/10 bg-cream/35 p-2.5">
        {isLoading ? <p className="px-2 py-2 text-sm text-olive/60">Ищем подходящие варианты...</p> : null}
        {!isLoading
          ? visibleGroups.map((group) =>
              group.items.length > 0 ? (
                <div key={group.label} className="space-y-1">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-olive/50">{group.label}</p>
                  {group.items.map((item) => (
                    <button
                      key={`${group.label}-${item.id}`}
                      type="button"
                      onClick={() => onSelect(item.name, item.id)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-white"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-olive/55">
                        <AppIcon icon={MapPin} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-olive">{item.name}</span>
                        {item.subtitle ? <span className="block truncate text-xs text-olive/55">{item.subtitle}</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null,
            )
          : null}
        {!isLoading && visibleGroups.every((group) => group.items.length === 0) ? (
          <p className="px-2 py-2 text-sm text-olive/60">
            {isQueryMode ? "Ничего не найдено. Попробуйте другой город." : "Начните вводить название локации."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function CatalogFilterBar({
  filters,
  onApplyFilters,
  onResetFilters,
  totalCount,
  isLoading = false,
  locationLabel,
  locationNames,
  initialPopularSuggestions,
}: CatalogFilterBarProps) {
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(filters);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const openDraftPanel = useCallback(
    (panel: PanelKey) => {
      setDraftFilters(filters);
      setOpenPanel((current) => (current === panel ? null : panel));
    },
    [filters],
  );

  const closePanel = useCallback(() => setOpenPanel(null), []);

  const updateDraft = useCallback((patch: Partial<SearchFilters>) => {
    setDraftFilters((current) => ({ ...current, ...patch }));
  }, []);

  const hasActiveFilters = (() => {
    if (filters.location) return true;
    if (filters.checkIn || filters.checkOut) return true;
    if (filters.guests !== "2") return true;
    if ((filters.guestsAdults || "2") !== "2" || (filters.guestsChildren || "0") !== "0") return true;
    if (filters.propertyType) return true;
    if (filters.minPrice || filters.maxPrice) return true;
    if (filters.minRating) return true;
    if (filters.hasPhotos || filters.hasReviews || filters.familyFriendly || filters.petsAllowed) return true;
    return Boolean(filters.sort && filters.sort !== "relevance");
  })();

  const extras = extrasCount(filters);
  const draftAdults = clamp(Number.parseInt(draftFilters.guestsAdults || draftFilters.guests || "2", 10) || 2, 1, 12);
  const draftChildren = clamp(Number.parseInt(draftFilters.guestsChildren || "0", 10) || 0, 0, 8);
  const leftPct = ((Number(draftFilters.minPrice || 0) - PRICE_MIN_BOUND) / (PRICE_MAX_BOUND - PRICE_MIN_BOUND)) * 100;
  const rightPct = ((Number(draftFilters.maxPrice || PRICE_MAX_BOUND) - PRICE_MIN_BOUND) / (PRICE_MAX_BOUND - PRICE_MIN_BOUND)) * 100;
  const nights = getNightsCount(draftFilters.checkIn, draftFilters.checkOut);

  const commitPanel = useCallback(
    (patch?: Partial<SearchFilters>, toast?: string) => {
      onApplyFilters({ ...filters, ...draftFilters, ...patch }, toast);
      closePanel();
    },
    [closePanel, draftFilters, filters, onApplyFilters],
  );

  const updateDraftGuests = useCallback(
    (nextAdults: number, nextChildren: number) => {
      const adults = clamp(nextAdults, 1, 12);
      const children = clamp(nextChildren, 0, Math.min(8, 20 - adults));
      updateDraft({
        guests: String(adults + children),
        guestsAdults: String(adults),
        guestsChildren: String(children),
      });
    },
    [updateDraft],
  );

  const updateDraftPrice = useCallback(
    (patch: { minPrice?: number; maxPrice?: number }) => {
      const currentMin = Number(draftFilters.minPrice || PRICE_MIN_BOUND);
      const currentMax = Number(draftFilters.maxPrice || PRICE_MAX_BOUND);
      const nextMin = patch.minPrice ?? currentMin;
      const nextMax = patch.maxPrice ?? currentMax;
      const safeMin = clamp(Math.floor(nextMin / PRICE_STEP) * PRICE_STEP, PRICE_MIN_BOUND, nextMax);
      const safeMax = clamp(Math.ceil(nextMax / PRICE_STEP) * PRICE_STEP, safeMin, PRICE_MAX_BOUND);
      updateDraft({
        minPrice: safeMin > PRICE_MIN_BOUND ? String(safeMin) : "",
        maxPrice: safeMax < PRICE_MAX_BOUND ? String(safeMax) : "",
      });
    },
    [draftFilters.maxPrice, draftFilters.minPrice, updateDraft],
  );

  return (
    <CatalogFilterShell
      chips={
        <>
          <ResponsiveFilterPanel
            open={openPanel === "location"}
            title="Локация"
            onClose={closePanel}
            width={420}
            trigger={
              <CatalogFilterChipButton
                icon={MapPin}
                label={formatLocationChipLabel(filters.location || locationLabel || "Весь Крым")}
                active={Boolean(filters.location)}
                open={openPanel === "location"}
                onClick={() => openDraftPanel("location")}
                onClear={filters.location ? () => onApplyFilters({ ...filters, location: "", locationId: "" }) : undefined}
              />
            }
            footer={
              <CatalogFilterPanelActions
                onApply={() => {
                  if (draftFilters.location) {
                    storeRecentLocation(draftFilters.location, draftFilters.locationId || normalizeLocation(draftFilters.location));
                  }
                  commitPanel();
                }}
                onClear={() => updateDraft({ location: "", locationId: "" })}
                applyLabel="Показать варианты"
              />
            }
          >
            <LocationSuggestionsField
              value={draftFilters.location}
              locationNames={locationNames}
              initialPopularSuggestions={initialPopularSuggestions}
              onChange={(next) => updateDraft({ location: next, locationId: "" })}
              onSelect={(name, id) => updateDraft({ location: name, locationId: id })}
            />
          </ResponsiveFilterPanel>

          <ResponsiveFilterPanel
            open={openPanel === "dates"}
            title="Даты проживания"
            onClose={closePanel}
            width={DATE_PANEL_WIDTH}
            maxHeight={DATE_PANEL_MAX_HEIGHT}
            trigger={
              <CatalogFilterChipButton
                icon={CalendarDays}
                label={formatDateChip(filters.checkIn, filters.checkOut)}
                active={Boolean(filters.checkIn || filters.checkOut)}
                open={openPanel === "dates"}
                onClick={() => openDraftPanel("dates")}
                onClear={filters.checkIn || filters.checkOut ? () => onApplyFilters({ ...filters, checkIn: "", checkOut: "" }) : undefined}
              />
            }
            footer={
              <CatalogFilterPanelActions
                onApply={() => commitPanel()}
                onClear={() => updateDraft({ checkIn: "", checkOut: "" })}
                applyLabel={nights > 0 ? `Показать на ${nights} ${pluralize(nights, ["ночь", "ночи", "ночей"])}` : "Показать варианты"}
              />
            }
          >
            <UnifiedCalendarContent
              mode="range"
              value={{ checkIn: draftFilters.checkIn, checkOut: draftFilters.checkOut }}
              onChange={(nextValue) => updateDraft(nextValue)}
              renderHeaderAside={
                draftFilters.checkIn || draftFilters.checkOut ? (
                  <button
                    type="button"
                    onClick={() => updateDraft({ checkIn: "", checkOut: "" })}
                    className="rounded-md px-2 py-0.5 text-olive/65 transition hover:bg-foam hover:text-olive"
                  >
                    Очистить
                  </button>
                ) : null
              }
            />
          </ResponsiveFilterPanel>

          <ResponsiveFilterPanel
            open={openPanel === "guests"}
            title="Гости"
            onClose={closePanel}
            width={420}
            trigger={
              <CatalogFilterChipButton
                icon={Users}
                label={formatGuestsChip(filters)}
                active={
                  filters.guests !== "2" ||
                  (filters.guestsAdults || "2") !== "2" ||
                  (filters.guestsChildren || "0") !== "0"
                }
                open={openPanel === "guests"}
                onClick={() => openDraftPanel("guests")}
              />
            }
            footer={
              <CatalogFilterPanelActions
                onApply={() => commitPanel()}
                onClear={() => updateDraft({ guests: "2", guestsAdults: "2", guestsChildren: "0" })}
                applyLabel="Применить"
              />
            }
          >
            <UnifiedGuestsEditor
              mode="detailed"
              value={{
                adults: draftAdults,
                childrenAges: Array.from({ length: draftChildren }, () => 0),
              }}
              onChange={(nextValue) =>
                updateDraftGuests(nextValue.adults, nextValue.childrenAges.length)
              }
            />
          </ResponsiveFilterPanel>

          <ResponsiveFilterPanel
            open={openPanel === "type"}
            title="Тип жилья"
            onClose={closePanel}
            width={420}
            trigger={
              <CatalogFilterChipButton
                icon={Building2}
                label={formatTypeChip(filters.propertyType)}
                active={Boolean(filters.propertyType)}
                open={openPanel === "type"}
                onClick={() => openDraftPanel("type")}
                onClear={filters.propertyType ? () => onApplyFilters({ ...filters, propertyType: "" }) : undefined}
              />
            }
            footer={
              <CatalogFilterPanelActions
                onApply={() => commitPanel()}
                onClear={() => updateDraft({ propertyType: "" })}
                applyLabel="Показать варианты"
              />
            }
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateDraft({ propertyType: "" })}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition",
                  !draftFilters.propertyType
                    ? "border-primary bg-primary text-white"
                    : "border-olive/16 bg-white text-olive hover:bg-cream/70",
                )}
              >
                Все типы
              </button>
              {propertyTypes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => updateDraft({ propertyType: item.id })}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition",
                    draftFilters.propertyType === item.id
                      ? "border-primary bg-primary text-white"
                      : "border-olive/16 bg-white text-olive hover:bg-cream/70",
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </ResponsiveFilterPanel>

          <ResponsiveFilterPanel
            open={openPanel === "price"}
            title="Цена за ночь"
            onClose={closePanel}
            width={420}
            trigger={
              <CatalogFilterChipButton
                icon={WalletCards}
                label={formatPriceChip(filters.minPrice, filters.maxPrice)}
                active={Boolean(filters.minPrice || filters.maxPrice)}
                open={openPanel === "price"}
                onClick={() => openDraftPanel("price")}
                onClear={filters.minPrice || filters.maxPrice ? () => onApplyFilters({ ...filters, minPrice: "", maxPrice: "" }) : undefined}
              />
            }
            footer={
              <CatalogFilterPanelActions
                onApply={() => commitPanel()}
                onClear={() => updateDraft({ minPrice: "", maxPrice: "" })}
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
                    min={PRICE_MIN_BOUND}
                    max={PRICE_MAX_BOUND}
                    step={PRICE_STEP}
                    value={draftFilters.minPrice}
                    onChange={(event) => updateDraftPrice({ minPrice: Number(event.target.value || PRICE_MIN_BOUND) })}
                    className="h-12 w-full rounded-2xl border border-olive/16 bg-white px-4 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Без минимума"
                  />
                </CatalogFieldGroup>
                <CatalogFieldGroup label="До">
                  <input
                    name="maxPrice"
                    type="number"
                    min={PRICE_MIN_BOUND}
                    max={PRICE_MAX_BOUND}
                    step={PRICE_STEP}
                    value={draftFilters.maxPrice}
                    onChange={(event) => updateDraftPrice({ maxPrice: Number(event.target.value || PRICE_MAX_BOUND) })}
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
                    style={{ left: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%` }}
                  />
                  <input
                    name="minPriceRange"
                    type="range"
                    min={PRICE_MIN_BOUND}
                    max={PRICE_MAX_BOUND}
                    step={PRICE_STEP}
                    value={Number(draftFilters.minPrice || PRICE_MIN_BOUND)}
                    onChange={(event) => updateDraftPrice({ minPrice: Number(event.target.value) })}
                    className="pointer-events-none absolute inset-x-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white"
                  />
                  <input
                    name="maxPriceRange"
                    type="range"
                    min={PRICE_MIN_BOUND}
                    max={PRICE_MAX_BOUND}
                    step={PRICE_STEP}
                    value={Number(draftFilters.maxPrice || PRICE_MAX_BOUND)}
                    onChange={(event) => updateDraftPrice({ maxPrice: Number(event.target.value) })}
                    className="pointer-events-none absolute inset-x-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-medium text-olive/55">
                  <span>0 ₽</span>
                  <span>25 000 ₽</span>
                  <span>50 000 ₽+</span>
                </div>
              </div>
            </div>
          </ResponsiveFilterPanel>

          <ResponsiveFilterPanel
            open={openPanel === "rating"}
            title="Минимальный рейтинг"
            onClose={closePanel}
            width={360}
            trigger={
              <CatalogFilterChipButton
                icon={Star}
                label={formatRatingChip(filters.minRating)}
                active={Boolean(filters.minRating)}
                open={openPanel === "rating"}
                onClick={() => openDraftPanel("rating")}
                onClear={filters.minRating ? () => onApplyFilters({ ...filters, minRating: "" }) : undefined}
              />
            }
            footer={
              <CatalogFilterPanelActions
                onApply={() => commitPanel()}
                onClear={() => updateDraft({ minRating: "" })}
                applyLabel="Применить"
              />
            }
          >
            <div className="flex flex-wrap gap-2">
              {RATING_OPTIONS.map((option) => (
                <button
                  key={option.value || "any"}
                  type="button"
                  onClick={() => updateDraft({ minRating: option.value })}
                  className={cn(
                    "inline-flex min-h-11 min-w-[64px] items-center justify-center rounded-full border px-4 text-sm font-semibold transition",
                    draftFilters.minRating === option.value
                      ? "border-primary bg-primary text-white"
                      : "border-olive/16 bg-white text-olive hover:bg-cream/70",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </ResponsiveFilterPanel>

          <ResponsiveFilterPanel
            open={openPanel === "more"}
            title="Дополнительные параметры"
            onClose={closePanel}
            width={420}
            align="end"
            trigger={
              <CatalogFilterChipButton
                icon={SlidersHorizontal}
                label={extras > 0 ? `Ещё (${extras})` : "Ещё"}
                active={extras > 0}
                open={openPanel === "more"}
                onClick={() => openDraftPanel("more")}
              />
            }
            footer={
              <CatalogFilterPanelActions
                onApply={() => commitPanel()}
                onClear={() => updateDraft({ hasPhotos: false, hasReviews: false, familyFriendly: false, petsAllowed: false })}
                applyLabel="Показать варианты"
              />
            }
          >
            <div className="space-y-2">
              {[
                { key: "hasPhotos" as const, label: "Только с фото" },
                { key: "hasReviews" as const, label: "С отзывами" },
                { key: "familyFriendly" as const, label: "Для отдыха с детьми" },
                { key: "petsAllowed" as const, label: "Можно с животными" },
              ].map((item) => (
                <label
                  key={item.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition",
                    draftFilters[item.key] ? "border-primary/25 bg-primary/8" : "border-olive/12 bg-white hover:bg-cream/60",
                  )}
                >
                  <input
                    name={String(item.key)}
                    type="checkbox"
                    checked={draftFilters[item.key]}
                    onChange={(event) => updateDraft({ [item.key]: event.target.checked })}
                    className="h-5 w-5 shrink-0 rounded accent-primary"
                  />
                  <span className="text-sm font-medium text-olive">{item.label}</span>
                </label>
              ))}
            </div>
          </ResponsiveFilterPanel>
        </>
      }
      totalLabel={isLoading ? <CatalogLoadingLabel /> : formatFoundObjectsLabel(totalCount)}
      hasActiveFilters={hasActiveFilters}
      onResetAll={onResetFilters}
    />
  );
}

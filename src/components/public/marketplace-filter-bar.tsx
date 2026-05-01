"use client";

import { ArrowUpDown, Car, Landmark, MapPin, Route, Search, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CatalogFilterShell,
  CatalogFieldGroup,
  CatalogFilterChipButton,
  CatalogFilterPanelActions,
  ResponsiveFilterPanel,
} from "@/components/public/catalog-filter-shell";
import { cn } from "@/lib/cn";
import type {
  PublicAttractionCatalogResult,
  PublicMarketplaceLocationSuggestion,
  PublicTransferCatalogResult,
} from "@/lib/public-marketplace";

type AttractionFilters = PublicAttractionCatalogResult["filters"];
type TransferFilters = PublicTransferCatalogResult["filters"];
type MarketplaceKind = "attractions" | "transfers";

type MarketplaceFilterBarProps =
  | {
      kind: "attractions";
      filters: AttractionFilters;
      total: number;
      categories: string[];
      locationSuggestions: PublicMarketplaceLocationSuggestion[];
    }
  | {
      kind: "transfers";
      filters: TransferFilters;
      total: number;
      transferTypes: string[];
      locationSuggestions: PublicMarketplaceLocationSuggestion[];
    };

type PanelKey = "search" | "location" | "entity" | "price" | "sort";

type FilterPatch = Partial<{
  q: string;
  location: string;
  radiusKm: string;
  category: string;
  transferType: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
}>;

type LocationSuggestionItem = {
  id: string;
  name: string;
  subtitle: string;
  activeListingsCount: number;
  searchTerms: string[];
};

const DEFAULT_RADIUS_KM = "30";
const PRICE_MIN_BOUND = 0;
const PRICE_MAX_BOUND = 100_000;
const PRICE_STEP = 500;
const LOCATION_RECENT_STORAGE_KEY = "boking.home_search_recent_v1";
const LOCATION_RECENT_LIMIT = 4;

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const TRANSFER_SORT_OPTIONS = [
  { value: "", label: "Рекомендуемые" },
  { value: "price_asc", label: "Сначала дешевле" },
  { value: "price_desc", label: "Сначала дороже" },
  { value: "rating_desc", label: "С высоким рейтингом" },
  { value: "popular_desc", label: "Популярные" },
  { value: "newest", label: "Новые" },
] as const;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeLocationKey(value: string | null | undefined): string {
  return normalizeText(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
}

function compactLabel(value: string, fallback: string, limit = 28): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return fallback;
  }

  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trim()}…` : normalized;
}

function formatCurrency(value: number): string {
  return `${numberFormatter.format(value)} ₽`;
}

function formatFoundLabel(kind: MarketplaceKind, value: number): string {
  if (kind === "transfers") {
    return `Найдено: ${numberFormatter.format(value)} ${formatPlural(value, "трансфер", "трансфера", "трансферов")}`;
  }

  return `Найдено: ${numberFormatter.format(value)} ${formatPlural(value, "место", "места", "мест")}`;
}

function formatPlural(value: number, one: string, few: string, many: string): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;

  if (abs >= 11 && abs <= 14) {
    return many;
  }
  if (mod === 1) {
    return one;
  }
  if (mod >= 2 && mod <= 4) {
    return few;
  }

  return many;
}

function formatPriceChip(
  minPrice: string | number | null,
  maxPrice: string | number | null,
): string {
  const min = Number(minPrice);
  const max = Number(maxPrice);
  const hasMin = Number.isFinite(min) && min > PRICE_MIN_BOUND;
  const hasMax = Number.isFinite(max) && max > PRICE_MIN_BOUND;

  if (hasMin && hasMax) {
    return `${formatCurrency(min)} - ${formatCurrency(max)}`;
  }

  if (hasMin) {
    return `от ${formatCurrency(min)}`;
  }

  if (hasMax) {
    return `до ${formatCurrency(max)}`;
  }

  return "Цена";
}

function formatTransferSortChip(sort: string | null | undefined): string {
  const normalized = normalizeText(sort);
  if (!normalized || normalized === "relevance") {
    return "Сортировка";
  }

  return TRANSFER_SORT_OPTIONS.find((option) => option.value === normalized)?.label ?? "Сортировка";
}

function formatLocationChip(
  location: string | null | undefined,
  radiusKm: number | string,
): string {
  const normalizedLocation = normalizeText(location);
  const radius = String(radiusKm || DEFAULT_RADIUS_KM);

  if (normalizedLocation) {
    return `${compactLabel(normalizedLocation, normalizedLocation, 22)} · ${radius} км`;
  }

  return radius !== DEFAULT_RADIUS_KM ? `Весь Крым · ${radius} км` : "Весь Крым";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getRecentLocationSubtitle(kind: MarketplaceKind): string {
  return kind === "transfers" ? "Трансферы и маршруты рядом с локацией" : "Досуг рядом с локацией";
}

function toLocationSuggestion(item: PublicMarketplaceLocationSuggestion): LocationSuggestionItem {
  return {
    id: item.id,
    name: item.name,
    subtitle: item.subtitle,
    activeListingsCount: item.activeListingsCount,
    searchTerms: item.searchTerms,
  };
}

function readRecentLocations(kind: MarketplaceKind): LocationSuggestionItem[] {
  try {
    const raw = localStorage.getItem(LOCATION_RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      type?: string;
      direction?: string;
      id?: string;
      name?: string;
      subtitle?: string;
      activeListingsCount?: number;
    }>;
    if (!Array.isArray(parsed)) return [];

    const result: LocationSuggestionItem[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (item.type !== "location" || item.direction !== kind || !item.name) continue;
      const name = normalizeText(item.name);
      const key = normalizeLocationKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: item.id?.trim() || key,
        name,
        subtitle: normalizeText(item.subtitle) || getRecentLocationSubtitle(kind),
        activeListingsCount:
          typeof item.activeListingsCount === "number" && Number.isFinite(item.activeListingsCount)
            ? item.activeListingsCount
            : 0,
        searchTerms: [name],
      });
      if (result.length >= LOCATION_RECENT_LIMIT) break;
    }
    return result;
  } catch {
    return [];
  }
}

function storeRecentLocation(kind: MarketplaceKind, item: LocationSuggestionItem) {
  try {
    const raw = localStorage.getItem(LOCATION_RECENT_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const current = Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object",
        )
      : [];
    const itemKey = normalizeLocationKey(item.name);
    const next = {
      type: "location",
      direction: kind,
      id: item.id || itemKey,
      name: item.name,
      subtitle: item.subtitle,
      locationId: item.id || null,
      activeListingsCount: item.activeListingsCount,
      searchTerms: item.searchTerms,
      timestamp: Date.now(),
    };
    const deduped = current.filter((entry) => {
      const entryDirection = typeof entry.direction === "string" ? entry.direction : "";
      const entryType = typeof entry.type === "string" ? entry.type : "";
      const entryName = typeof entry.name === "string" ? entry.name : "";
      return !(
        entryDirection === kind &&
        entryType === "location" &&
        normalizeLocationKey(entryName) === itemKey
      );
    });

    localStorage.setItem(
      LOCATION_RECENT_STORAGE_KEY,
      JSON.stringify([next, ...deduped].slice(0, 10)),
    );
  } catch {
    // Ignore localStorage failures.
  }
}

function LocationSuggestionsField({
  kind,
  value,
  suggestions,
  onChange,
  onSelect,
  onSubmit,
}: {
  kind: MarketplaceKind;
  value: string;
  suggestions: LocationSuggestionItem[];
  onChange: (next: string) => void;
  onSelect: (item: LocationSuggestionItem) => void;
  onSubmit: () => void;
}) {
  const [recentSuggestions, setRecentSuggestions] = useState<LocationSuggestionItem[]>([]);
  const query = normalizeLocationKey(value);
  const isQueryMode = query.length >= 2;
  const matchSuggestions = useMemo(() => {
    if (!isQueryMode) return [];
    return suggestions
      .filter((item) =>
        [item.name, ...item.searchTerms].some((term) => normalizeLocationKey(term).includes(query)),
      )
      .slice(0, 8);
  }, [isQueryMode, query, suggestions]);
  const popularSuggestions = suggestions.slice(0, 8);
  const visibleGroups = isQueryMode
    ? [{ label: "Локации", items: matchSuggestions }]
    : [
        { label: "Недавние", items: recentSuggestions },
        { label: "Популярные направления", items: popularSuggestions },
      ];

  useEffect(() => {
    setRecentSuggestions(readRecentLocations(kind));
  }, [kind]);

  return (
    <div className="space-y-3">
      <label className="block">
        <input
          name="location"
          value={value}
          onChange={(event) => onChange(event.target.value.slice(0, 120))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
          autoComplete="off"
          placeholder={kind === "transfers" ? "Город или направление" : "Город или место"}
          className="h-12 w-full rounded-2xl border border-olive/16 bg-white px-4 text-sm text-olive outline-none transition placeholder:text-olive/45 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      <div className="max-h-[280px] space-y-3 overflow-y-auto rounded-2xl border border-olive/10 bg-cream/35 p-2.5">
        {visibleGroups.map((group) =>
          group.items.length > 0 ? (
            <div key={group.label} className="space-y-1">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-olive/50">
                {group.label}
              </p>
              {group.items.map((item) => (
                <button
                  key={`${group.label}-${item.id}-${item.name}`}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-white"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-olive/55">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-olive">
                      {item.name}
                    </span>
                    {item.subtitle ? (
                      <span className="block truncate text-xs text-olive/55">{item.subtitle}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          ) : null,
        )}
        {visibleGroups.every((group) => group.items.length === 0) ? (
          <p className="px-2 py-2 text-sm text-olive/60">
            {isQueryMode
              ? "Ничего не найдено. Попробуйте другой город или место."
              : "Популярные направления появятся после публикации вариантов."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MarketplaceFilterFrame({
  children,
  hasActiveFilters,
  onResetAll,
  totalLabel,
}: {
  children: React.ReactNode;
  hasActiveFilters: boolean;
  onResetAll: () => void;
  totalLabel: string;
}) {
  return (
    <CatalogFilterShell
      className="-mx-4 md:-mx-6 md:mb-8"
      chips={children}
      totalLabel={totalLabel}
      hasActiveFilters={hasActiveFilters}
      onResetAll={onResetAll}
    />
  );
}

function OptionPill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition",
        selected
          ? "border-primary bg-primary text-white"
          : "border-olive/16 bg-white text-olive hover:bg-cream/70",
      )}
    >
      {children}
    </button>
  );
}

export function MarketplaceFilterBar(props: MarketplaceFilterBarProps) {
  const router = useRouter();
  const { kind, filters, total } = props;
  const basePath = kind === "attractions" ? "/attractions" : "/transfers";
  const isTransfer = kind === "transfers";
  const entityOptions = isTransfer ? props.transferTypes : props.categories;
  const locationSuggestions = props.locationSuggestions.map(toLocationSuggestion);
  const appliedLocation = normalizeText(filters.locationName);
  const appliedLocationSuggestion = locationSuggestions.find(
    (item) => normalizeLocationKey(item.name) === normalizeLocationKey(appliedLocation),
  );
  const appliedLocationLabel = appliedLocationSuggestion?.name ?? appliedLocation;
  const appliedEntity = isTransfer
    ? normalizeText(filters.transferType)
    : normalizeText(filters.category);
  const appliedMinPrice = isTransfer ? filters.minPrice : null;
  const appliedMaxPrice = isTransfer ? filters.maxPrice : null;
  const appliedSort = filters.sort === "relevance" ? "" : filters.sort;

  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const [query, setQuery] = useState(normalizeText(filters.query));
  const [location, setLocation] = useState(appliedLocationLabel);
  const [radiusKm, setRadiusKm] = useState(String(filters.radiusKm || DEFAULT_RADIUS_KM));
  const [entity, setEntity] = useState(appliedEntity);
  const [minPrice, setMinPrice] = useState(
    appliedMinPrice !== null && appliedMinPrice !== undefined ? String(appliedMinPrice) : "",
  );
  const [maxPrice, setMaxPrice] = useState(
    appliedMaxPrice !== null && appliedMaxPrice !== undefined ? String(appliedMaxPrice) : "",
  );
  const [sort, setSort] = useState(appliedSort);

  const hasActiveFilters =
    Boolean(normalizeText(filters.query)) ||
    Boolean(appliedLocation) ||
    String(filters.radiusKm || DEFAULT_RADIUS_KM) !== DEFAULT_RADIUS_KM ||
    Boolean(appliedEntity) ||
    Boolean(appliedMinPrice || appliedMaxPrice) ||
    Boolean(appliedSort);

  const pricePercentages = useMemo(() => {
    const min = Number(minPrice || PRICE_MIN_BOUND);
    const max = Number(maxPrice || PRICE_MAX_BOUND);
    const left = ((Number.isFinite(min) ? min : PRICE_MIN_BOUND) / PRICE_MAX_BOUND) * 100;
    const right = ((Number.isFinite(max) ? max : PRICE_MAX_BOUND) / PRICE_MAX_BOUND) * 100;
    return {
      left: clamp(left, 0, 100),
      right: clamp(right, 0, 100),
    };
  }, [maxPrice, minPrice]);

  const updatePriceRange = useCallback(
    (patch: { minPrice?: number; maxPrice?: number }) => {
      const currentMin = Number(minPrice || PRICE_MIN_BOUND);
      const currentMax = Number(maxPrice || PRICE_MAX_BOUND);
      const nextMin = patch.minPrice ?? currentMin;
      const nextMax = patch.maxPrice ?? currentMax;
      const safeMin = clamp(
        Math.floor(nextMin / PRICE_STEP) * PRICE_STEP,
        PRICE_MIN_BOUND,
        nextMax,
      );
      const safeMax = clamp(Math.ceil(nextMax / PRICE_STEP) * PRICE_STEP, safeMin, PRICE_MAX_BOUND);

      setMinPrice(safeMin > PRICE_MIN_BOUND ? String(safeMin) : "");
      setMaxPrice(safeMax < PRICE_MAX_BOUND ? String(safeMax) : "");
    },
    [maxPrice, minPrice],
  );

  const buildPath = useCallback(
    (patch: FilterPatch = {}) => {
      const nextQuery = normalizeText(patch.q ?? query);
      const nextLocation = normalizeText(patch.location ?? location);
      const nextRadius = String((patch.radiusKm ?? radiusKm) || DEFAULT_RADIUS_KM);
      const nextEntity = normalizeText(
        isTransfer ? (patch.transferType ?? entity) : (patch.category ?? entity),
      );
      const nextMinPrice = normalizeText(patch.minPrice ?? minPrice);
      const nextMaxPrice = normalizeText(patch.maxPrice ?? maxPrice);
      const nextSort = normalizeText(patch.sort ?? sort);
      const params = new URLSearchParams();

      if (nextQuery) params.set("q", nextQuery);
      if (nextLocation) params.set("location", nextLocation);
      if (nextLocation || nextRadius !== DEFAULT_RADIUS_KM) params.set("radiusKm", nextRadius);
      if (nextEntity) params.set(isTransfer ? "transferType" : "category", nextEntity);
      if (isTransfer && nextMinPrice) params.set("minPrice", nextMinPrice);
      if (isTransfer && nextMaxPrice) params.set("maxPrice", nextMaxPrice);
      if (nextSort && nextSort !== "relevance") params.set("sort", nextSort);

      const search = params.toString();
      return search ? `${basePath}?${search}` : basePath;
    },
    [basePath, entity, isTransfer, location, maxPrice, minPrice, query, radiusKm, sort],
  );

  const applyFilters = useCallback(
    (patch?: FilterPatch) => {
      const nextLocation = normalizeText(patch?.location ?? location);
      if (nextLocation) {
        const knownSuggestion = locationSuggestions.find(
          (item) => normalizeLocationKey(item.name) === normalizeLocationKey(nextLocation),
        );
        storeRecentLocation(
          kind,
          knownSuggestion ?? {
            id: normalizeLocationKey(nextLocation),
            name: nextLocation,
            subtitle: getRecentLocationSubtitle(kind),
            activeListingsCount: 0,
            searchTerms: [nextLocation],
          },
        );
      }
      router.push(buildPath(patch));
      setOpenPanel(null);
    },
    [buildPath, kind, location, locationSuggestions, router],
  );

  const resetAllFilters = useCallback(() => {
    setQuery("");
    setLocation("");
    setRadiusKm(DEFAULT_RADIUS_KM);
    setEntity("");
    setMinPrice("");
    setMaxPrice("");
    setSort("");
    setOpenPanel(null);
    router.push(basePath);
  }, [basePath, router]);

  const togglePanel = useCallback((panel: PanelKey) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  }, []);

  const searchLabel = compactLabel(normalizeText(filters.query), isTransfer ? "Маршрут" : "Поиск");
  const locationLabel = formatLocationChip(appliedLocationLabel, filters.radiusKm);
  const entityLabel = compactLabel(appliedEntity, isTransfer ? "Вид" : "Категория");
  const radiusIsEnabled = Boolean(location.trim() || appliedLocation);
  return (
    <MarketplaceFilterFrame
      hasActiveFilters={hasActiveFilters}
      onResetAll={resetAllFilters}
      totalLabel={formatFoundLabel(kind, total)}
    >
      <ResponsiveFilterPanel
        open={openPanel === "search"}
        title={isTransfer ? "Маршрут" : "Поиск"}
        onClose={() => setOpenPanel(null)}
        width={460}
        trigger={
          <CatalogFilterChipButton
            icon={isTransfer ? Route : Search}
            label={searchLabel}
            active={Boolean(normalizeText(filters.query))}
            open={openPanel === "search"}
            onClick={() => togglePanel("search")}
            onClear={
              normalizeText(filters.query)
                ? () => {
                    setQuery("");
                    applyFilters({ q: "" });
                  }
                : undefined
            }
          />
        }
        footer={
          <CatalogFilterPanelActions
            onApply={() => applyFilters()}
            onClear={() => setQuery("")}
            applyLabel="Показать варианты"
          />
        }
      >
        <CatalogFieldGroup label={isTransfer ? "Что нужно найти" : "Что хочется найти"}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-olive/35" />
            <input
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 140))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyFilters();
                }
              }}
              placeholder={isTransfer ? "Маршрут, авто, водитель..." : "Название или описание..."}
              className="h-12 w-full rounded-[20px] border border-olive/14 bg-white px-4 pl-11 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </CatalogFieldGroup>
      </ResponsiveFilterPanel>

      <ResponsiveFilterPanel
        open={openPanel === "location"}
        title="Локация"
        onClose={() => setOpenPanel(null)}
        width={440}
        trigger={
          <CatalogFilterChipButton
            icon={MapPin}
            label={locationLabel}
            active={
              Boolean(appliedLocation) ||
              String(filters.radiusKm || DEFAULT_RADIUS_KM) !== DEFAULT_RADIUS_KM
            }
            open={openPanel === "location"}
            onClick={() => togglePanel("location")}
            onClear={
              appliedLocation || String(filters.radiusKm || DEFAULT_RADIUS_KM) !== DEFAULT_RADIUS_KM
                ? () => {
                    setLocation("");
                    setRadiusKm(DEFAULT_RADIUS_KM);
                    applyFilters({ location: "", radiusKm: DEFAULT_RADIUS_KM });
                  }
                : undefined
            }
          />
        }
        footer={
          <CatalogFilterPanelActions
            onApply={() => applyFilters()}
            onClear={() => {
              setLocation("");
              setRadiusKm(DEFAULT_RADIUS_KM);
            }}
            applyLabel="Показать варианты"
          />
        }
      >
        <div className="space-y-5">
          <LocationSuggestionsField
            kind={kind}
            value={location}
            suggestions={locationSuggestions}
            onChange={setLocation}
            onSelect={(item) => setLocation(item.name)}
            onSubmit={() => applyFilters()}
          />

          <CatalogFieldGroup
            label="Радиус поиска"
            description={
              radiusIsEnabled
                ? "Покажем варианты рядом с выбранной локацией."
                : "Выберите город или место, если нужно искать рядом."
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
        open={openPanel === "entity"}
        title={isTransfer ? "Вид трансфера" : "Категория"}
        onClose={() => setOpenPanel(null)}
        width={440}
        trigger={
          <CatalogFilterChipButton
            icon={isTransfer ? Car : Landmark}
            label={entityLabel}
            active={Boolean(appliedEntity)}
            open={openPanel === "entity"}
            onClick={() => togglePanel("entity")}
            onClear={
              appliedEntity
                ? () => {
                    setEntity("");
                    applyFilters(isTransfer ? { transferType: "" } : { category: "" });
                  }
                : undefined
            }
          />
        }
        footer={
          <CatalogFilterPanelActions
            onApply={() => applyFilters()}
            onClear={() => setEntity("")}
            applyLabel="Показать варианты"
          />
        }
      >
        <div className="flex flex-wrap gap-2">
          <OptionPill selected={!entity} onClick={() => setEntity("")}>
            {isTransfer ? "Любой вид" : "Любая"}
          </OptionPill>
          {entityOptions.map((option) => (
            <OptionPill key={option} selected={entity === option} onClick={() => setEntity(option)}>
              {option}
            </OptionPill>
          ))}
        </div>
      </ResponsiveFilterPanel>

      {isTransfer ? (
        <ResponsiveFilterPanel
          open={openPanel === "price"}
          title="Цена"
          onClose={() => setOpenPanel(null)}
          width={420}
          trigger={
            <CatalogFilterChipButton
              icon={WalletCards}
              label={formatPriceChip(filters.minPrice, filters.maxPrice)}
              active={Boolean(filters.minPrice || filters.maxPrice)}
              open={openPanel === "price"}
              onClick={() => togglePanel("price")}
              onClear={
                filters.minPrice || filters.maxPrice
                  ? () => {
                      setMinPrice("");
                      setMaxPrice("");
                      applyFilters({ minPrice: "", maxPrice: "" });
                    }
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
                  min={PRICE_MIN_BOUND}
                  max={PRICE_MAX_BOUND}
                  step={PRICE_STEP}
                  value={minPrice}
                  onChange={(event) =>
                    updatePriceRange({
                      minPrice: Number(event.target.value || PRICE_MIN_BOUND),
                    })
                  }
                  placeholder="Без минимума"
                  className="h-12 w-full rounded-2xl border border-olive/16 bg-white px-4 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </CatalogFieldGroup>
              <CatalogFieldGroup label="До">
                <input
                  name="maxPrice"
                  type="number"
                  min={PRICE_MIN_BOUND}
                  max={PRICE_MAX_BOUND}
                  step={PRICE_STEP}
                  value={maxPrice}
                  onChange={(event) =>
                    updatePriceRange({
                      maxPrice: Number(event.target.value || PRICE_MAX_BOUND),
                    })
                  }
                  placeholder="Без лимита"
                  className="h-12 w-full rounded-2xl border border-olive/16 bg-white px-4 text-sm text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </CatalogFieldGroup>
            </div>
            <div className="rounded-2xl border border-olive/10 bg-cream/45 px-4 py-4">
              <div className="relative h-8">
                <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-olive/10" />
                <div
                  className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary/70"
                  style={{
                    left: `${pricePercentages.left}%`,
                    width: `${Math.max(0, pricePercentages.right - pricePercentages.left)}%`,
                  }}
                />
                <input
                  name="minPriceRange"
                  type="range"
                  min={PRICE_MIN_BOUND}
                  max={PRICE_MAX_BOUND}
                  step={PRICE_STEP}
                  value={Number(minPrice || PRICE_MIN_BOUND)}
                  onChange={(event) => updatePriceRange({ minPrice: Number(event.target.value) })}
                  className="pointer-events-none absolute inset-x-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white"
                />
                <input
                  name="maxPriceRange"
                  type="range"
                  min={PRICE_MIN_BOUND}
                  max={PRICE_MAX_BOUND}
                  step={PRICE_STEP}
                  value={Number(maxPrice || PRICE_MAX_BOUND)}
                  onChange={(event) => updatePriceRange({ maxPrice: Number(event.target.value) })}
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
      ) : null}

      {isTransfer ? (
        <ResponsiveFilterPanel
          open={openPanel === "sort"}
          title="Сортировка"
          onClose={() => setOpenPanel(null)}
          width={420}
          trigger={
            <CatalogFilterChipButton
              icon={ArrowUpDown}
              label={formatTransferSortChip(filters.sort)}
              active={Boolean(appliedSort)}
              open={openPanel === "sort"}
              onClick={() => togglePanel("sort")}
              onClear={
                appliedSort
                  ? () => {
                      setSort("");
                      applyFilters({ sort: "" });
                    }
                  : undefined
              }
            />
          }
          footer={
            <CatalogFilterPanelActions
              onApply={() => applyFilters()}
              onClear={() => setSort("")}
              applyLabel="Показать варианты"
            />
          }
        >
          <div className="flex flex-wrap gap-2">
            {TRANSFER_SORT_OPTIONS.map((option) => (
              <OptionPill
                key={option.value || "relevance"}
                selected={sort === option.value}
                onClick={() => setSort(option.value)}
              >
                {option.label}
              </OptionPill>
            ))}
          </div>
        </ResponsiveFilterPanel>
      ) : null}
    </MarketplaceFilterFrame>
  );
}

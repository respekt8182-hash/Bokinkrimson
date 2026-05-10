"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogFilterBar } from "@/components/public/catalog-filter-bar";
import { FirstListingPromo } from "@/components/public/first-listing-promo";
import { PublicHousingResultsWithMap } from "@/components/public/public-housing-results-with-map";
import { useLoadMore } from "@/hooks/use-load-more";
import {
  buildHousingCatalogUrl,
  buildHousingMapQuery,
  fetchAccommodationSearch,
} from "@/lib/api/search";
import { cn } from "@/lib/cn";
import { resolveKnownCrimeaLocationName } from "@/lib/seo/routes";
import { formatLocationInPrepositional } from "@/lib/seo/site";
import { parseDateRangeParam } from "@/lib/seo/url-normalize";
import type { SearchFilters, SearchResponse } from "@/types/catalog";

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;
const MAP_BOUNDS_REFRESH_DELAY_MS = 260;

const SORT_OPTIONS = [
  { value: "", label: "Рекомендуемые" },
  { value: "price_asc", label: "Сначала дешёвые" },
  { value: "price_desc", label: "Сначала дорогие" },
  { value: "rating_desc", label: "По рейтингу" },
  { value: "popular_desc", label: "По отзывам" },
] as const satisfies ReadonlyArray<{ value: SearchFilters["sort"]; label: string }>;

// ── Types ────────────────────────────────────────────────────────────────────

type HousingCatalogClientProps = {
  initialResponse: SearchResponse;
  initialFilters: SearchFilters;
  locationNames: string[];
  initialPopularLocationSuggestions: Array<{
    type: "location";
    id: string;
    name: string;
    subtitle: string;
  }>;
  initialLocationLabel: string;
  initialLocationActiveHousingCount: number | null;
};

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSortLabel(sort: SearchFilters["sort"]): string {
  return SORT_OPTIONS.find((option) => option.value === sort)?.label ?? SORT_OPTIONS[0].label;
}

function parseBooleanParam(params: URLSearchParams, key: string): boolean {
  const value = params.get(key);
  return value === "1" || value === "true";
}

function readCatalogLocationFromPath(pathname: string): string {
  const [, base, location] = pathname.split("/");

  if (base !== "crimea" || !location) {
    return "";
  }

  try {
    return (
      resolveKnownCrimeaLocationName({
        location: decodeURIComponent(location),
        locationId: decodeURIComponent(location),
      }) ?? ""
    );
  } catch {
    return resolveKnownCrimeaLocationName({ location, locationId: location }) ?? "";
  }
}

function normalizeCatalogLocationKey(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

function parseUrlFilters(search: string, pathname = ""): SearchFilters {
  const params = new URLSearchParams(search);
  const compactDates = parseDateRangeParam(params.get("dates"));
  const sortValue = params.get("sort") ?? "";
  const normalizedSort =
    sortValue === "price_asc" ||
    sortValue === "price_desc" ||
    sortValue === "rating_desc" ||
    sortValue === "popular_desc"
      ? sortValue
      : "";

  return {
    direction: "housing",
    query: params.get("q")?.trim() ?? "",
    location: params.get("location")?.trim() ?? readCatalogLocationFromPath(pathname),
    locationId: params.get("locationId")?.trim() ?? "",
    propertyType: params.get("propertyType")?.trim() ?? "",
    checkIn: params.get("checkIn")?.trim() ?? compactDates.checkIn,
    checkOut: params.get("checkOut")?.trim() ?? compactDates.checkOut,
    guests: params.get("guests")?.trim() ?? "2",
    guestsAdults: params.get("guestsAdults")?.trim() ?? params.get("guests")?.trim() ?? "2",
    guestsChildren: params.get("guestsChildren")?.trim() ?? "0",
    minPrice: params.get("minPrice")?.trim() ?? "",
    maxPrice: params.get("maxPrice")?.trim() ?? "",
    sort: normalizedSort,
    minRating: params.get("minRating")?.trim() ?? "",
    hasPhotos: parseBooleanParam(params, "hasPhotos"),
    hasReviews: parseBooleanParam(params, "hasReviews"),
    familyFriendly: parseBooleanParam(params, "familyFriendly"),
    petsAllowed: parseBooleanParam(params, "petsAllowed"),
  };
}

// ── Internal components ──────────────────────────────────────────────────────

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
        hasFloatingMapButton ? "bottom-40 lg:bottom-6" : "bottom-28 lg:bottom-6",
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

function HousingLocationConnectionEmptyState({ locationName }: { locationName: string | null }) {
  const locationPhrase = formatLocationInPrepositional(locationName);
  const title = locationPhrase
    ? `Идёт подключение жилья ${locationPhrase}`
    : "Идёт подключение жилья в этом регионе";

  return (
    <section className="rounded-2xl border border-dashed border-olive/24 bg-white/94 p-6 text-left shadow-[0_14px_34px_-30px_rgba(15,74,64,0.45)]">
      <p className="text-base font-semibold leading-6 text-olive">{title}</p>
      <p className="mt-2 text-sm leading-6 text-olive/60">
        Мы постепенно подключаем владельцев жилья по этому направлению. Скоро здесь появятся
        реальные объекты с ценами, фото и прямыми контактами.
      </p>
      <p className="mt-2 text-sm leading-6 text-olive/60">
        Если вы сдаёте жильё в этом регионе, сейчас можно попасть в стартовую программу размещения.
      </p>
    </section>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function HousingCatalogClient({
  initialResponse,
  initialFilters,
  locationNames,
  initialPopularLocationSuggestions,
  initialLocationLabel,
  initialLocationActiveHousingCount,
}: HousingCatalogClientProps) {
  const [filters, setFilters] = useState(initialFilters);
  const view = "list" as const;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newItemIds, setNewItemIds] = useState<string[]>([]);
  const [locationLabel, setLocationLabel] = useState(initialLocationLabel);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mapBoundsFilter, setMapBoundsFilter] = useState<string | null>(null);
  const requestSeqRef = useRef(0);
  const mapBoundsFilterRef = useRef<string | null>(null);
  const mapBoundsRefreshTimerRef = useRef<number | null>(null);
  const mapBoundsAbortControllerRef = useRef<AbortController | null>(null);

  const {
    items,
    total,
    hasMore,
    loading: loadingMore,
    error: loadMoreError,
    replaceAll,
    loadMore,
  } = useLoadMore({
    initialData: initialResponse,
    loadPage: (nextPage) =>
      fetchAccommodationSearch(filters, nextPage, PAGE_SIZE, undefined, mapBoundsFilter),
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
    mapBoundsFilterRef.current = mapBoundsFilter;
  }, [mapBoundsFilter]);

  useEffect(() => {
    return () => {
      if (mapBoundsRefreshTimerRef.current) {
        window.clearTimeout(mapBoundsRefreshTimerRef.current);
      }
      mapBoundsAbortControllerRef.current?.abort();
    };
  }, []);

  const handleWishlistToggle = useCallback(
    (isFavorite: boolean) => {
      pushToast("success", isFavorite ? "Добавлено в избранное" : "Удалено из избранного");
    },
    [pushToast],
  );

  const handleMapBoundsFilterChange = useCallback(
    (nextBounds: string | null) => {
      const normalizedBounds = nextBounds?.trim() || null;
      if (normalizedBounds === mapBoundsFilterRef.current) {
        return;
      }

      mapBoundsFilterRef.current = normalizedBounds;
      setMapBoundsFilter(normalizedBounds);

      if (mapBoundsRefreshTimerRef.current) {
        window.clearTimeout(mapBoundsRefreshTimerRef.current);
        mapBoundsRefreshTimerRef.current = null;
      }
      mapBoundsAbortControllerRef.current?.abort();

      if (!normalizedBounds) {
        return;
      }

      requestSeqRef.current += 1;
      const requestId = requestSeqRef.current;

      mapBoundsRefreshTimerRef.current = window.setTimeout(() => {
        mapBoundsRefreshTimerRef.current = null;
        const controller = new AbortController();
        mapBoundsAbortControllerRef.current = controller;
        setIsRefreshing(true);

        fetchAccommodationSearch(filters, 1, PAGE_SIZE, controller.signal, normalizedBounds)
          .then((nextResponse) => {
            if (requestId !== requestSeqRef.current || controller.signal.aborted) {
              return;
            }

            replaceAll(nextResponse);
            setNewItemIds([]);
          })
          .catch(() => {
            if (!controller.signal.aborted && requestId === requestSeqRef.current) {
              pushToast("error", "Не удалось обновить выдачу по карте");
            }
          })
          .finally(() => {
            if (requestId === requestSeqRef.current) {
              setIsRefreshing(false);
            }
          });
      }, MAP_BOUNDS_REFRESH_DELAY_MS);
    },
    [filters, pushToast, replaceAll],
  );

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

  const mapQuery = useMemo(() => buildHousingMapQuery(filters), [filters]);

  const runFilterRequest = useCallback(
    async (
      nextFilters: SearchFilters,
      options?: { historyMode?: "push" | "replace" | "none"; announceMessage?: string },
    ) => {
      const normalizedFilters: SearchFilters = {
        ...nextFilters,
        direction: "housing",
      };
      const prevFilters = filters;

      setFilters(normalizedFilters);
      setIsRefreshing(true);
      if (mapBoundsRefreshTimerRef.current) {
        window.clearTimeout(mapBoundsRefreshTimerRef.current);
        mapBoundsRefreshTimerRef.current = null;
      }
      mapBoundsAbortControllerRef.current?.abort();
      requestSeqRef.current += 1;
      const requestId = requestSeqRef.current;
      const boundsForRequest = mapBoundsFilterRef.current;

      try {
        const nextResponse = await fetchAccommodationSearch(
          normalizedFilters,
          1,
          PAGE_SIZE,
          undefined,
          boundsForRequest,
        );
        if (requestId !== requestSeqRef.current) {
          return;
        }

        replaceAll(nextResponse);
        setLocationLabel(normalizedFilters.location || "Весь Крым");
        setNewItemIds([]);

        const historyMode = options?.historyMode ?? "push";
        if (historyMode !== "none") {
          const nextUrl = buildHousingCatalogUrl(normalizedFilters, 1, false);
          if (historyMode === "replace") {
            window.history.replaceState({}, "", nextUrl);
          } else {
            window.history.pushState({}, "", nextUrl);
          }
        }

        if (options?.announceMessage) {
          pushToast("info", options.announceMessage);
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

  const applyFilters = useCallback(
    async (nextFilters: SearchFilters, announceMessage?: string) => {
      await runFilterRequest(nextFilters, {
        historyMode: "push",
        announceMessage,
      });
    },
    [runFilterRequest],
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

  useEffect(() => {
    const handlePopState = () => {
      void runFilterRequest(parseUrlFilters(window.location.search, window.location.pathname), {
        historyMode: "none",
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [runFilterRequest]);

  const initialLocationKey = normalizeCatalogLocationKey(
    initialFilters.locationId || initialFilters.location,
  );
  const currentLocationKey = normalizeCatalogLocationKey(filters.locationId || filters.location);
  const shouldShowLocationConnectionEmpty =
    initialLocationActiveHousingCount === 0 &&
    initialLocationKey.length > 0 &&
    currentLocationKey === initialLocationKey;

  const emptyCatalogContent = shouldShowLocationConnectionEmpty ? (
    <HousingLocationConnectionEmptyState locationName={initialLocationLabel || null} />
  ) : (
    <div className="space-y-3">
      <section className="rounded-2xl border border-olive/10 bg-white/94 p-5 text-left shadow-[0_14px_34px_-30px_rgba(15,74,64,0.45)]">
        <p className="text-sm font-semibold text-olive">
          По вашим параметрам вариантов ничего не найдено.
        </p>
        <p className="mt-1 text-xs leading-5 text-olive/45">
          Попробуйте изменить локацию, даты или снять часть фильтров.
        </p>
        <button
          type="button"
          onClick={() => void resetFilters()}
          className="mt-4 rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          Сбросить все фильтры
        </button>
      </section>
      <FirstListingPromo kind="housing" />
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <CatalogFilterBar
        filters={filters}
        onApplyFilters={(next, toast) => void applyFilters(next, toast)}
        onResetFilters={() => void resetFilters()}
        totalCount={total}
        locationLabel={locationLabel}
        locationNames={locationNames}
        initialPopularSuggestions={initialPopularLocationSuggestions}
      />

      <div className="mx-auto w-full max-w-[1680px] px-4 py-6 pb-28 md:px-6 md:py-8 md:pb-8 lg:pb-8">
        <div className="space-y-3">
          <PublicHousingResultsWithMap
            items={items}
            mapQuery={mapQuery}
            selectedLocationName={locationLabel}
            view={view}
            searchGuests={Number.parseInt(filters.guests, 10) || 2}
            hasMore={hasMore}
            loadingMore={loadingMore}
            loadingInitial={isRefreshing && items.length === 0}
            totalCount={total}
            emptyContent={emptyCatalogContent}
            newItemIds={newItemIds}
            onLoadMore={handleLoadMore}
            onWishlistToggle={handleWishlistToggle}
            onMapBoundsFilterChange={handleMapBoundsFilterChange}
          />
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
    </>
  );
}

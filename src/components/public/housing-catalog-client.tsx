"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogFilterBar } from "@/components/public/catalog-filter-bar";
import { CatalogScrollRestorer } from "@/components/public/catalog-scroll-memory";
import { FirstListingPromo } from "@/components/public/first-listing-promo";
import { PublicHousingResultsWithMap } from "@/components/public/public-housing-results-with-map";
import { useLoadMore } from "@/hooks/use-load-more";
import {
  buildHousingCatalogUrl,
  buildHousingMapQuery,
  fetchAccommodationSearch,
} from "@/lib/api/search";
import { cn } from "@/lib/cn";
import { getCatalogPageFromSearch } from "@/lib/catalog-pagination";
import { propertyTypes } from "@/lib/constants";
import { resolveKnownCrimeaLocationName } from "@/lib/seo/routes";
import { formatLocationInPrepositional } from "@/lib/seo/site";
import { parseDateRangeParam } from "@/lib/seo/url-normalize";
import type { SearchFilters, SearchResponse } from "@/types/catalog";

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;
const MAP_BOUNDS_REFRESH_DELAY_MS = 300;

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
  initialPriceMax: number;
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

function parseListParam(params: URLSearchParams, key: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of [...params.getAll(key), ...params.getAll(`${key}[]`)]) {
    for (const item of rawValue.split(",")) {
      const normalized = item.trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
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
    nearSea: parseBooleanParam(params, "nearSea"),
    hasPool: parseBooleanParam(params, "hasPool"),
    hasKitchen: parseBooleanParam(params, "hasKitchen"),
    hasAirConditioner: parseBooleanParam(params, "hasAirConditioner"),
    hasParking: parseBooleanParam(params, "hasParking"),
    smokingForbidden: parseBooleanParam(params, "smokingForbidden"),
    quietHours: parseBooleanParam(params, "quietHours"),
    amenityIds: parseListParam(params, "amenityIds"),
    roomFeatureIds: parseListParam(params, "roomFeatureIds"),
  };
}

function restoreWindowScrollY(targetY: number): void {
  const safeTargetY = Math.max(0, Math.round(targetY));

  window.requestAnimationFrame(() => {
    window.scrollTo({ top: safeTargetY, left: 0, behavior: "auto" });
    window.requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - safeTargetY) > 2) {
        window.scrollTo({ top: safeTargetY, left: 0, behavior: "auto" });
      }
    });
  });
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

function getHousingActiveFilterLabels(filters: SearchFilters): string[] {
  const labels: string[] = [];
  const typeLabel = propertyTypes.find((item) => item.id === filters.propertyType)?.name;

  if (filters.query.trim()) labels.push(`Поиск: ${filters.query.trim()}`);
  if (filters.location.trim()) labels.push(`Локация: ${filters.location.trim()}`);
  if (typeLabel || filters.propertyType) labels.push(`Тип: ${typeLabel ?? filters.propertyType}`);
  if (filters.checkIn || filters.checkOut) labels.push("Даты проживания");
  if (filters.guests !== "2") labels.push(`Гостей: ${filters.guests}`);
  if (filters.minPrice || filters.maxPrice) labels.push("Цена");
  if (filters.minRating) labels.push(`Рейтинг ${filters.minRating}+`);
  if (filters.hasReviews) labels.push("С отзывами");
  if (filters.familyFriendly) labels.push("Можно с детьми");
  if (filters.petsAllowed) labels.push("Можно с животными");
  if (filters.nearSea) labels.push("У моря");
  if (filters.hasPool) labels.push("С бассейном");
  if (filters.hasKitchen) labels.push("С кухней");
  if (filters.hasAirConditioner) labels.push("Кондиционер");
  if (filters.hasParking) labels.push("Парковка");
  if (filters.smokingForbidden) labels.push("Курение запрещено");
  if (filters.quietHours) labels.push("Тихие часы");
  if (filters.amenityIds.length > 0) labels.push(`Удобства: ${filters.amenityIds.length}`);
  if (filters.roomFeatureIds.length > 0) labels.push(`В номере: ${filters.roomFeatureIds.length}`);

  return labels;
}

function EmptyActionButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-primary/16 bg-primary/8 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/14"
    >
      {children}
    </button>
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
  initialPriceMax,
}: HousingCatalogClientProps) {
  const [filters, setFilters] = useState(initialFilters);
  const view = "list" as const;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newItemIds, setNewItemIds] = useState<string[]>([]);
  const [locationLabel, setLocationLabel] = useState(initialLocationLabel);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mapBoundsFilter, setMapBoundsFilter] = useState<string | null>(null);
  const [isMapBoundsRefreshing, setIsMapBoundsRefreshing] = useState(false);
  const requestSeqRef = useRef(0);
  const mapBoundsFilterRef = useRef<string | null>(null);
  const pendingMapBoundsFilterRef = useRef<string | null>(null);
  const mapBoundsRefreshTimerRef = useRef<number | null>(null);
  const mapBoundsAbortControllerRef = useRef<AbortController | null>(null);
  const filterAbortControllerRef = useRef<AbortController | null>(null);

  const {
    items,
    total,
    page,
    totalPages,
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

  useEffect(() => {
    requestSeqRef.current += 1;
    if (mapBoundsRefreshTimerRef.current) {
      window.clearTimeout(mapBoundsRefreshTimerRef.current);
      mapBoundsRefreshTimerRef.current = null;
    }
    mapBoundsAbortControllerRef.current?.abort();
    filterAbortControllerRef.current?.abort();
    pendingMapBoundsFilterRef.current = null;
    mapBoundsFilterRef.current = null;

    replaceAll(initialResponse);
    setFilters(initialFilters);
    setLocationLabel(initialLocationLabel);
    setMapBoundsFilter(null);
    setIsRefreshing(false);
    setIsMapBoundsRefreshing(false);
    setNewItemIds([]);
  }, [initialFilters, initialLocationLabel, initialResponse, replaceAll]);

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
      filterAbortControllerRef.current?.abort();
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
      if (
        normalizedBounds === mapBoundsFilterRef.current ||
        normalizedBounds === pendingMapBoundsFilterRef.current
      ) {
        return;
      }

      pendingMapBoundsFilterRef.current = normalizedBounds;

      if (mapBoundsRefreshTimerRef.current) {
        window.clearTimeout(mapBoundsRefreshTimerRef.current);
        mapBoundsRefreshTimerRef.current = null;
      }
      mapBoundsAbortControllerRef.current?.abort();
      requestSeqRef.current += 1;

      if (!normalizedBounds) {
        mapBoundsFilterRef.current = null;
        pendingMapBoundsFilterRef.current = null;
        setMapBoundsFilter(null);
        setIsRefreshing(false);
        setIsMapBoundsRefreshing(false);
        return;
      }

      const requestId = requestSeqRef.current;

      mapBoundsRefreshTimerRef.current = window.setTimeout(() => {
        mapBoundsRefreshTimerRef.current = null;
        if (pendingMapBoundsFilterRef.current !== normalizedBounds) {
          return;
        }

        const controller = new AbortController();
        mapBoundsAbortControllerRef.current = controller;
        const scrollYBeforeRefresh = window.scrollY || window.pageYOffset || 0;
        filterAbortControllerRef.current?.abort();
        setIsRefreshing(true);
        setIsMapBoundsRefreshing(true);

        fetchAccommodationSearch(filters, 1, PAGE_SIZE, controller.signal, normalizedBounds)
          .then((nextResponse) => {
            if (requestId !== requestSeqRef.current || controller.signal.aborted) {
              return;
            }

            pendingMapBoundsFilterRef.current = null;
            mapBoundsFilterRef.current = normalizedBounds;
            setMapBoundsFilter(normalizedBounds);
            replaceAll(nextResponse);
            restoreWindowScrollY(scrollYBeforeRefresh);
            setNewItemIds([]);
          })
          .catch(() => {
            if (!controller.signal.aborted && requestId === requestSeqRef.current) {
              pushToast("error", "Не удалось обновить выдачу по карте");
            }
          })
          .finally(() => {
            if (mapBoundsAbortControllerRef.current === controller) {
              mapBoundsAbortControllerRef.current = null;
            }

            if (requestId === requestSeqRef.current) {
              pendingMapBoundsFilterRef.current = null;
              setIsRefreshing(false);
              setIsMapBoundsRefreshing(false);
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
      options?: {
        historyMode?: "push" | "replace" | "none";
        announceMessage?: string;
        page?: number;
      },
    ) => {
      const normalizedFilters: SearchFilters = {
        ...nextFilters,
        direction: "housing",
      };
      const prevFilters = filters;

      setFilters(normalizedFilters);
      setIsRefreshing(true);
      setIsMapBoundsRefreshing(false);
      mapBoundsFilterRef.current = null;
      pendingMapBoundsFilterRef.current = null;
      setMapBoundsFilter(null);
      if (mapBoundsRefreshTimerRef.current) {
        window.clearTimeout(mapBoundsRefreshTimerRef.current);
        mapBoundsRefreshTimerRef.current = null;
      }
      mapBoundsAbortControllerRef.current?.abort();
      filterAbortControllerRef.current?.abort();
      requestSeqRef.current += 1;
      const requestId = requestSeqRef.current;
      const controller = new AbortController();
      filterAbortControllerRef.current = controller;

      try {
        const nextResponse = await fetchAccommodationSearch(
          normalizedFilters,
          options?.page ?? 1,
          PAGE_SIZE,
          controller.signal,
          null,
        );
        if (requestId !== requestSeqRef.current || controller.signal.aborted) {
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
        if (controller.signal.aborted) {
          return;
        }

        if (requestId === requestSeqRef.current) {
          setFilters(prevFilters);
          pushToast("error", "Ошибка загрузки каталога");
        }
      } finally {
        if (filterAbortControllerRef.current === controller) {
          filterAbortControllerRef.current = null;
        }

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

  const handlePageChange = useCallback(
    async (nextPage: number) => {
      const safePage = Math.min(Math.max(1, Math.floor(nextPage)), totalPages);
      if (safePage === page || isRefreshing || loadingMore) {
        return;
      }

      if (mapBoundsRefreshTimerRef.current) {
        window.clearTimeout(mapBoundsRefreshTimerRef.current);
        mapBoundsRefreshTimerRef.current = null;
      }
      mapBoundsAbortControllerRef.current?.abort();
      filterAbortControllerRef.current?.abort();
      requestSeqRef.current += 1;
      const requestId = requestSeqRef.current;
      const controller = new AbortController();
      filterAbortControllerRef.current = controller;

      document.getElementById("catalog-results")?.scrollIntoView({
        block: "start",
        behavior: "instant" as ScrollBehavior,
      });
      setIsRefreshing(true);
      setIsMapBoundsRefreshing(false);

      try {
        const nextResponse = await fetchAccommodationSearch(
          filters,
          safePage,
          PAGE_SIZE,
          controller.signal,
          mapBoundsFilterRef.current,
        );
        if (requestId !== requestSeqRef.current || controller.signal.aborted) {
          return;
        }

        replaceAll(nextResponse);
        setNewItemIds(nextResponse.items.map((item) => item.id));
        window.history.pushState({}, "", buildHousingCatalogUrl(filters, nextResponse.page, true));
      } catch {
        if (!controller.signal.aborted && requestId === requestSeqRef.current) {
          pushToast("error", "Не удалось открыть страницу каталога");
        }
      } finally {
        if (filterAbortControllerRef.current === controller) {
          filterAbortControllerRef.current = null;
        }

        if (requestId === requestSeqRef.current) {
          setIsRefreshing(false);
        }
      }
    },
    [filters, isRefreshing, loadingMore, page, pushToast, replaceAll, totalPages],
  );

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
        nearSea: false,
        hasPool: false,
        hasKitchen: false,
        hasAirConditioner: false,
        hasParking: false,
        smokingForbidden: false,
        quietHours: false,
        amenityIds: [],
        roomFeatureIds: [],
      },
      "Фильтры сброшены",
    );
  }, [applyFilters, filters]);

  useEffect(() => {
    const handlePopState = () => {
      void runFilterRequest(parseUrlFilters(window.location.search, window.location.pathname), {
        historyMode: "none",
        page: getCatalogPageFromSearch(window.location.search),
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
  const activeEmptyFilterLabels = getHousingActiveFilterLabels(filters);

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
        {activeEmptyFilterLabels.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeEmptyFilterLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-olive/12 bg-cream/60 px-3 py-1.5 text-xs font-semibold text-olive/64"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.minPrice || filters.maxPrice ? (
            <EmptyActionButton
              onClick={() =>
                void applyFilters({ ...filters, minPrice: "", maxPrice: "" }, "Цена сброшена")
              }
            >
              Сбросить цену
            </EmptyActionButton>
          ) : null}
          {filters.checkIn || filters.checkOut ? (
            <EmptyActionButton
              onClick={() =>
                void applyFilters({ ...filters, checkIn: "", checkOut: "" }, "Даты убраны")
              }
            >
              Убрать даты
            </EmptyActionButton>
          ) : null}
          {filters.location ? (
            <EmptyActionButton
              onClick={() =>
                void applyFilters(
                  { ...filters, location: "", locationId: "" },
                  "Показываем весь Крым",
                )
              }
            >
              Расширить локацию
            </EmptyActionButton>
          ) : null}
          {filters.hasReviews ? (
            <EmptyActionButton
              onClick={() =>
                void applyFilters({ ...filters, hasReviews: false }, "Фильтр по отзывам убран")
              }
            >
              Показать без отзывов
            </EmptyActionButton>
          ) : null}
        </div>
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
      <CatalogScrollRestorer catalogKey="housing" />
      <CatalogFilterBar
        filters={filters}
        onApplyFilters={(next, toast) => void applyFilters(next, toast)}
        onResetFilters={() => void resetFilters()}
        totalCount={total}
        isLoading={isRefreshing}
        locationLabel={locationLabel}
        locationNames={locationNames}
        initialPopularSuggestions={initialPopularLocationSuggestions}
        priceMax={initialPriceMax}
      />

      <div className="mx-auto w-full max-w-[1680px] px-4 py-6 pb-28 md:px-6 md:py-8 md:pb-8 lg:max-w-none lg:px-0 lg:pb-8">
        <div className="space-y-3">
          <PublicHousingResultsWithMap
            items={items}
            mapQuery={mapQuery}
            selectedLocationName={locationLabel}
            view={view}
            searchGuests={Number.parseInt(filters.guests, 10) || 2}
            hasMore={hasMore}
            loadingMore={loadingMore}
            page={page}
            totalPages={totalPages}
            loadingInitial={isRefreshing && !isMapBoundsRefreshing}
            mapBoundsRefreshing={isMapBoundsRefreshing}
            totalCount={total}
            emptyContent={emptyCatalogContent}
            newItemIds={newItemIds}
            onLoadMore={handleLoadMore}
            onPageChange={handlePageChange}
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

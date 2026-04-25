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
import { propertyTypes } from "@/lib/constants";
import { formatLocationInPrepositional } from "@/lib/seo/site";
import type { EmptyStateSuggestion, SearchFilters, SearchResponse } from "@/types/catalog";

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

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
};

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseIsoDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function parseBooleanParam(params: URLSearchParams, key: string): boolean {
  const value = params.get(key);
  return value === "1" || value === "true";
}

function parseUrlFilters(search: string): SearchFilters {
  const params = new URLSearchParams(search);
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
    location: params.get("location")?.trim() ?? "",
    locationId: params.get("locationId")?.trim() ?? "",
    propertyType: params.get("propertyType")?.trim() ?? "",
    checkIn: params.get("checkIn")?.trim() ?? "",
    checkOut: params.get("checkOut")?.trim() ?? "",
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

// ── Main component ───────────────────────────────────────────────────────────

export function HousingCatalogClient({
  initialResponse,
  initialFilters,
  locationNames,
  initialPopularLocationSuggestions,
  initialLocationLabel,
}: HousingCatalogClientProps) {
  const [filters, setFilters] = useState(initialFilters);
  const view = "list" as const;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newItemIds, setNewItemIds] = useState<string[]>([]);
  const [locationLabel, setLocationLabel] = useState(initialLocationLabel);
  const [emptySuggestions, setEmptySuggestions] = useState<EmptyStateSuggestion[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const requestSeqRef = useRef(0);
  const fallbackSignatureRef = useRef("");

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

  const handleWishlistToggle = useCallback(
    (isFavorite: boolean) => {
      pushToast(
        "success",
        isFavorite ? "Добавлено в избранное" : "Удалено из избранного",
      );
    },
    [pushToast],
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
      setEmptySuggestions([]);
      requestSeqRef.current += 1;
      const requestId = requestSeqRef.current;

      try {
        const nextResponse = await fetchAccommodationSearch(normalizedFilters, 1, PAGE_SIZE);
        if (requestId !== requestSeqRef.current) {
          return;
        }

        replaceAll(nextResponse);
        setLocationLabel(normalizedFilters.location || "Весь Крым");
        setNewItemIds([]);
        fallbackSignatureRef.current = "";

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

  // ── Empty-state fallback suggestions ─────────────────────────────────────

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

    if (fallbackSignatureRef.current === fallbackSignature) {
      return;
    }
    fallbackSignatureRef.current = fallbackSignature;

    const controller = new AbortController();

    const runFallbacks = async () => {
      const suggestions: EmptyStateSuggestion[] = [];

      const nights = getNights(filters.checkIn, filters.checkOut);
      const canShiftDates = Boolean(filters.checkIn && filters.checkOut && nights > 0);

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

  useEffect(() => {
    const handlePopState = () => {
      void runFilterRequest(parseUrlFilters(window.location.search), {
        historyMode: "none",
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [runFilterRequest]);

  const activeLocationName = filters.location ? locationLabel || filters.location : "";
  const locationPhrase = activeLocationName
    ? (formatLocationInPrepositional(activeLocationName) ?? `в городе ${activeLocationName}`)
    : null;
  const propertyTypeLabel =
    propertyTypes.find((item) => item.id === filters.propertyType)?.name ?? "";
  const catalogTitle =
    activeLocationName && propertyTypeLabel
      ? `${propertyTypeLabel} ${locationPhrase ?? `в городе ${activeLocationName}`} у моря`
      : activeLocationName
        ? `Жильё ${locationPhrase ?? `в городе ${activeLocationName}`} у моря`
        : "Жильё в Крыму у моря";
  const catalogSubtitle = activeLocationName
    ? `Найдено ${total} вариантов${propertyTypeLabel ? ` в категории «${propertyTypeLabel}»` : ""}.`
    : `Найдено ${total} вариантов жилья по всему Крыму.`;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 md:px-6 md:pt-8">
        <div className="mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-olive">{catalogTitle}</h1>
            <p className="mt-0.5 text-sm text-olive/60">{catalogSubtitle}</p>
          </div>
        </div>
      </div>

      <CatalogFilterBar
        filters={filters}
        onApplyFilters={(next, toast) => void applyFilters(next, toast)}
        onResetFilters={() => void resetFilters()}
        locationLabel={locationLabel}
        locationNames={locationNames}
        initialPopularSuggestions={initialPopularLocationSuggestions}
      />

      <div className="mx-auto w-full max-w-[1680px] px-4 py-6 pb-28 md:px-6 md:py-8 md:pb-8 lg:pb-8">
        <div className="space-y-3">
          {items.length === 0 && !isRefreshing ? (
            <>
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
                      onClick={() =>
                        void applyFilters({ ...filters, location: "", locationId: "" })
                      }
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
              <FirstListingPromo kind="housing" />
            </>
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
              onWishlistToggle={handleWishlistToggle}
            />
          )}
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

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
import type { SearchFilters, SearchResponse } from "@/types/catalog";

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

function getSortLabel(sort: SearchFilters["sort"]): string {
  return SORT_OPTIONS.find((option) => option.value === sort)?.label ?? SORT_OPTIONS[0].label;
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const requestSeqRef = useRef(0);

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
  const emptyCatalogContent = (
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
          <PublicHousingResultsWithMap
            items={items}
            mapQuery={mapQuery}
            selectedLocationName={locationLabel}
            view={view}
            searchGuests={Number.parseInt(filters.guests, 10) || 2}
            hasMore={hasMore}
            loadingMore={loadingMore}
            loadingInitial={isRefreshing && items.length === 0}
            emptyContent={emptyCatalogContent}
            newItemIds={newItemIds}
            onLoadMore={handleLoadMore}
            onWishlistToggle={handleWishlistToggle}
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

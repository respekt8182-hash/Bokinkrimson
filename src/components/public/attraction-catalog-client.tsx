"use client";

import {
  ArrowRight,
  Clock3,
  ImageIcon,
  Landmark,
  MapPin,
  Route,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  Fragment,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { AppIcon } from "@/components/ui/app-icon";
import { CatalogPagination } from "@/components/public/catalog-pagination";
import { MarketplaceCatalogMap } from "@/components/public/marketplace-catalog-map";
import { MarketplaceFilterBar } from "@/components/public/marketplace-filter-bar";
import { CatalogScrollRestorer } from "@/components/public/catalog-scroll-memory";
import { FirstListingPromo } from "@/components/public/first-listing-promo";
import { cn } from "@/lib/cn";
import type { FavoriteEntityType } from "@/lib/favorite-entities";
import {
  type PublicAttractionCatalogItem,
  type PublicAttractionCatalogResult,
  type PublicAttractionMapItem,
  type PublicMarketplaceLocationSuggestion,
} from "@/lib/public-marketplace";
import { buildCanonicalPath } from "@/lib/seo/canonical";

type AttractionCatalogClientProps = {
  result: PublicAttractionCatalogResult;
  mapItems?: PublicAttractionMapItem[];
  categories: string[];
  locationSuggestions: PublicMarketplaceLocationSuggestion[];
  activeBounds?: string | null;
  catalogActiveTotal?: number;
};

type CatalogParams = Record<string, string | null | undefined>;

const PAGE_SIZE = 30;
const REQUEST_CACHE_TTL_MS = 45_000;
const MAP_BOUNDS_REFRESH_DELAY_MS = 320;
const responseCache = new Map<
  string,
  { expiresAt: number; response: PublicAttractionCatalogResult }
>();
const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const ruPluralRules = new Intl.PluralRules("ru-RU");

function compactText(value: string | null | undefined, limit = 170): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1).trim()}…`;
}

function formatDistance(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return `~${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км`;
}

function formatRuCount(value: number, one: string, few: string, many: string): string {
  const plural = ruPluralRules.select(Math.abs(value));
  const label = plural === "one" ? one : plural === "few" ? few : many;

  return `${ruNumberFormat.format(value)} ${label}`;
}

function buildCatalogPath(basePath: string, params: CatalogParams): string {
  return buildCanonicalPath(
    basePath,
    Object.entries(params)
      .filter(([, value]) => value)
      .map(([key, value]) => [key, String(value)]),
    ["q", "location", "category", "radiusKm", "sort", "bounds", "page"],
  );
}

function toAttractionMapItem(item: PublicAttractionCatalogItem): PublicAttractionMapItem {
  return {
    id: item.id,
    path: item.path,
    title: item.title,
    category: item.category,
    tags: item.tags.slice(0, 1),
    locationName: item.locationName,
    districtName: item.districtName,
    address: item.address,
    latitude: item.latitude,
    longitude: item.longitude,
    shortDescription: item.shortDescription,
    coverImageUrl: item.coverImageUrl,
  };
}

function getParamsFromResult(
  result: PublicAttractionCatalogResult,
  bounds: string | null,
): CatalogParams {
  return {
    q: result.filters.query,
    location: result.filters.locationName,
    category: result.filters.category,
    radiusKm: String(result.filters.radiusKm),
    sort: result.filters.sort === "relevance" ? "" : result.filters.sort,
    bounds,
  };
}

function hasStrictLocationRadiusScope(result: PublicAttractionCatalogResult): boolean {
  const { centerLat, centerLng, locationName, radiusKm } = result.filters;

  return (
    Boolean(locationName) &&
    centerLat !== null &&
    centerLng !== null &&
    Number.isFinite(centerLat) &&
    Number.isFinite(centerLng) &&
    Number.isFinite(radiusKm) &&
    radiusKm > 0
  );
}

function buildApiRequestPath(href: string, page: number, bounds?: string | null): string {
  const url = new URL(href, window.location.origin);
  const params = new URLSearchParams(url.search);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  if (bounds !== undefined) {
    if (bounds) {
      params.set("bounds", bounds);
    } else {
      params.delete("bounds");
    }
  }

  return `/api/search/attractions?${params.toString()}`;
}

function getPageHrefFromWindow(): string {
  return `${window.location.pathname || "/attractions"}${window.location.search}`;
}

function mergeBoundsResultFilters(
  nextResult: PublicAttractionCatalogResult,
  currentResult: PublicAttractionCatalogResult,
  bounds: string | null,
): PublicAttractionCatalogResult {
  if (!bounds) {
    return nextResult;
  }

  return {
    ...nextResult,
    filters: {
      ...nextResult.filters,
      query: currentResult.filters.query,
      locationName: currentResult.filters.locationName,
      centerLat: currentResult.filters.centerLat,
      centerLng: currentResult.filters.centerLng,
      category: currentResult.filters.category,
      radiusKm: currentResult.filters.radiusKm,
      sort: currentResult.filters.sort,
    },
  };
}

async function fetchAttractionCatalog(
  href: string,
  page: number,
  signal?: AbortSignal,
  bounds?: string | null,
): Promise<PublicAttractionCatalogResult> {
  const requestPath = buildApiRequestPath(href, page, bounds);
  const cached = responseCache.get(requestPath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.response;
  }

  const response = await fetch(requestPath, {
    method: "GET",
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("attractions_fetch_failed");
  }

  const payload = (await response.json()) as PublicAttractionCatalogResult;
  responseCache.set(requestPath, {
    response: payload,
    expiresAt: Date.now() + REQUEST_CACHE_TTL_MS,
  });
  return payload;
}

function CatalogShell({ children }: { children: ReactNode }) {
  return (
    <main>
      <div className="mx-auto w-full max-w-[1680px] px-4 pb-28 md:px-6 md:pb-8 lg:max-w-none lg:px-0">
        {children}
      </div>
    </main>
  );
}

function ImageBox({
  src,
  alt,
  fallback,
  favoriteItemId,
  favoriteEntityType,
  eager = false,
}: {
  src: string | null;
  alt: string;
  fallback: string;
  favoriteItemId: string;
  favoriteEntityType: FavoriteEntityType;
  eager?: boolean;
}) {
  return (
    <div className="card-img-wrap relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-sand sm:aspect-[3/2] md:aspect-[4/3] md:w-[240px] md:rounded-l-xl md:rounded-r-none lg:w-[280px]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="card-img h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-full min-h-[170px] flex-col items-center justify-center gap-2 text-sm text-olive/45">
          <AppIcon icon={ImageIcon} className="h-6 w-6" />
          {fallback}
        </div>
      )}
      <div className="pointer-events-auto absolute right-2 top-2 z-30 p-1 sm:right-2.5 sm:top-2.5">
        <FavoriteToggleButton
          itemId={favoriteItemId}
          entityType={favoriteEntityType}
          initialIsFavorite={false}
          variant="icon"
        />
      </div>
    </div>
  );
}

function SummaryPill({ icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-foam px-2 py-1 text-[11px] font-semibold text-accent">
      {icon ? <AppIcon icon={icon} className="h-3.5 w-3.5 text-olive/40" /> : null}
      {children}
    </span>
  );
}

function AttractionCard({
  item,
  eagerImage = false,
}: {
  item: PublicAttractionCatalogItem;
  eagerImage?: boolean;
}) {
  const description = compactText(item.shortDescription ?? item.description, 180);
  const distance = formatDistance(item.distanceKm);
  const tags = item.tags.slice(0, 3);
  const locationLine = [item.locationName, item.address].filter(Boolean).join(", ") || "Крым";

  return (
    <article
      data-catalog-map-item-id={item.id}
      className="result-card group relative overflow-hidden rounded-2xl border border-olive/[0.07] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-primary/15 hover:shadow-[0_8px_30px_-8px_rgba(15,118,110,0.15)]"
    >
      <Link
        href={item.path}
        data-catalog-detail-link="attractions"
        data-catalog-item-id={item.id}
        aria-label={`Открыть ${item.title}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
      />

      <div className="pointer-events-none relative z-20 flex flex-col md:flex-row">
        <ImageBox
          src={item.coverImageUrl}
          alt={item.title}
          fallback="Фото места"
          favoriteItemId={item.id}
          favoriteEntityType="attraction"
          eager={eagerImage}
        />

        <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4 md:flex-row md:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
                Досуг
              </span>
              {item.category ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-olive/40">
                  {item.category}
                </span>
              ) : null}
            </div>

            <h2 className="line-clamp-2 text-[16px] font-bold leading-snug tracking-tight text-olive [overflow-wrap:anywhere] sm:text-[18px]">
              {item.title}
            </h2>

            <p className="flex items-start gap-1.5 text-[13px] leading-snug text-olive/50">
              <AppIcon icon={MapPin} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive/30" />
              <span className="line-clamp-2 [overflow-wrap:anywhere]">{locationLine}</span>
            </p>

            <div className="flex max-h-[70px] flex-wrap gap-1.5 overflow-hidden">
              {item.districtName ? (
                <SummaryPill icon={Landmark}>{item.districtName}</SummaryPill>
              ) : null}
              {distance ? <SummaryPill icon={Route}>{distance}</SummaryPill> : null}
              <SummaryPill icon={Clock3}>Свободный день</SummaryPill>
            </div>

            {description ? (
              <p className="text-sm leading-6 text-olive/62 md:hidden">{description}</p>
            ) : null}

            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 md:hidden">
                {tags.map((tag) => (
                  <span
                    key={`${item.id}-tag-${tag}`}
                    className="inline-flex items-center gap-1 rounded-md bg-sand/50 px-2 py-0.5 text-[11px] font-medium text-olive/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-auto flex items-end justify-between gap-3 border-t border-olive/[0.06] pt-3 md:hidden">
              <div className="min-w-0">
                <p className="text-[17px] font-extrabold leading-tight tracking-tight text-olive">
                  Карточка места
                </p>
                <p className="mt-0.5 text-[11px] text-olive/40">Маршрут, фото и карта</p>
              </div>
              <Link
                href={item.path}
                data-catalog-detail-link="attractions"
                data-catalog-item-id={item.id}
                className="pointer-events-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-5 text-[13px] font-bold text-white shadow-sm transition-all hover:brightness-95 active:scale-[0.97]"
              >
                Подробнее
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="hidden shrink-0 flex-col items-end justify-between border-l border-olive/[0.06] pl-4 md:flex md:w-[190px] lg:w-[210px]">
            <div className="text-right">
              <p className="text-[12px] font-semibold text-olive">Самостоятельно</p>
            </div>

            <div className="mt-auto text-right">
              <Link
                href={item.path}
                data-catalog-detail-link="attractions"
                data-catalog-item-id={item.id}
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

function SkeletonCard() {
  return (
    <article
      className="overflow-hidden rounded-2xl border border-olive/[0.07] bg-white"
      aria-hidden="true"
    >
      <div className="flex flex-col md:flex-row">
        <div className="catalog-skeleton aspect-[4/3] w-full shrink-0 md:aspect-[4/3] md:w-[240px] lg:w-[280px]" />
        <div className="flex flex-1 flex-col p-4 md:flex-row md:gap-4">
          <div className="flex-1 space-y-2.5">
            <div className="catalog-skeleton h-3 w-16 rounded-md" />
            <div className="catalog-skeleton h-6 w-3/5 rounded-md" />
            <div className="catalog-skeleton h-4 w-2/5 rounded-md" />
            <div className="flex gap-2">
              <div className="catalog-skeleton h-6 w-6 rounded-lg" />
              <div className="catalog-skeleton h-6 w-24 rounded-lg" />
            </div>
            <div className="flex gap-1.5">
              <div className="catalog-skeleton h-5 w-16 rounded-md" />
              <div className="catalog-skeleton h-5 w-16 rounded-md" />
              <div className="catalog-skeleton h-5 w-16 rounded-md" />
            </div>
          </div>
          <div className="hidden shrink-0 flex-col items-end justify-between border-l border-olive/[0.06] pl-4 md:flex md:w-[190px]">
            <div className="catalog-skeleton h-4 w-28 rounded-md" />
            <div className="mt-auto space-y-2 text-right">
              <div className="catalog-skeleton ml-auto h-6 w-28 rounded-md" />
              <div className="catalog-skeleton h-10 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function CatalogLoadingInlineLabel() {
  return (
    <>
      <span>Ищем лучшие достопримечательности</span>
      <span className="catalog-loading-inline-dots ml-1.5 text-terra" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </>
  );
}

function EmptyState({ resetHref, onReset }: { resetHref: string; onReset: () => void }) {
  return (
    <section className="rounded-2xl border border-dashed border-olive/24 bg-white/92 p-8 text-center">
      <p className="text-base font-semibold text-olive">Досуг не найден</p>
      <p className="mt-2 text-sm leading-6 text-olive/58">
        Попробуйте другой город, увеличьте радиус или очистите поиск.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
      >
        Сбросить фильтры
      </button>
      <Link href={resetHref} className="sr-only">
        Сбросить фильтры
      </Link>
    </section>
  );
}

function CatalogConnectionEmptyState() {
  return (
    <section className="rounded-2xl border border-dashed border-olive/24 bg-white/94 p-6 text-left shadow-[0_14px_34px_-30px_rgba(15,74,64,0.45)]">
      <p className="text-base font-semibold leading-6 text-olive">
        Идёт наполнение раздела «Досуг»
      </p>
      <p className="mt-2 text-sm leading-6 text-olive/60">
        Здесь появятся развлечения, активности, места для отдыха, прогулок и семейного досуга в
        городах Крыма.
      </p>
    </section>
  );
}

function EmptyCatalogContent({
  shouldShowConnectionEmptyState,
  onReset,
}: {
  shouldShowConnectionEmptyState: boolean;
  onReset: () => void;
}) {
  if (shouldShowConnectionEmptyState) {
    return <CatalogConnectionEmptyState />;
  }

  return (
    <div className="space-y-4">
      <EmptyState resetHref="/attractions" onReset={onReset} />
      <FirstListingPromo kind="attractions" />
    </div>
  );
}

export function AttractionCatalogClient({
  result: initialResult,
  mapItems,
  categories,
  locationSuggestions,
  activeBounds = null,
  catalogActiveTotal,
}: AttractionCatalogClientProps) {
  const initialBounds = hasStrictLocationRadiusScope(initialResult) ? null : activeBounds;
  const [result, setResult] = useState(initialResult);
  const [bounds, setBounds] = useState(initialBounds);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [newItemIds, setNewItemIds] = useState<string[]>([]);
  const resultRef = useRef(initialResult);
  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const boundsRefreshTimerRef = useRef<number | null>(null);
  const pendingBoundsRef = useRef<string | null>(null);
  const boundsRef = useRef(initialBounds);
  const ignoreBoundsUntilRef = useRef(0);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  useEffect(() => {
    return () => {
      if (boundsRefreshTimerRef.current !== null) {
        window.clearTimeout(boundsRefreshTimerRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (newItemIds.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => setNewItemIds([]), 900);
    return () => window.clearTimeout(timer);
  }, [newItemIds]);

  const shouldShowConnectionEmptyState = catalogActiveTotal === 0;
  const hasLocationRadiusScope = hasStrictLocationRadiusScope(result);
  const effectiveBounds = hasLocationRadiusScope ? null : bounds;
  const currentParams = useMemo(
    () => getParamsFromResult(result, effectiveBounds),
    [effectiveBounds, result],
  );
  const mapItemsEndpoint = useMemo(() => {
    return buildCatalogPath("/api/map/attractions", {
      ...currentParams,
      bounds: effectiveBounds,
    });
  }, [currentParams, effectiveBounds]);
  const initialMapItems = mapItems ?? result.items.map(toAttractionMapItem);
  const shouldShowRefreshSkeleton = isRefreshing;
  const foundLabel = formatRuCount(result.total, "место", "места", "мест");

  useEffect(() => {
    if (!hasLocationRadiusScope) {
      return;
    }

    const urlHasBounds = new URLSearchParams(window.location.search).has("bounds");
    if (bounds === null && !urlHasBounds) {
      return;
    }

    setBounds(null);
    boundsRef.current = null;
    window.history.replaceState(
      {},
      "",
      buildCatalogPath("/attractions", getParamsFromResult(resultRef.current, null)),
    );
  }, [bounds, hasLocationRadiusScope]);

  const runRequest = useCallback(
    async (
      href: string,
      options?: {
        historyMode?: "push" | "replace" | "none";
        bounds?: string | null;
        preserveFiltersForBounds?: boolean;
        preserveCurrentResults?: boolean;
      },
    ) => {
      const nextBounds = options?.bounds ?? null;
      const preserveCurrentResults = options?.preserveCurrentResults === true;
      const previousResult = resultRef.current;
      const previousBounds = boundsRef.current;

      if (boundsRefreshTimerRef.current !== null) {
        window.clearTimeout(boundsRefreshTimerRef.current);
        boundsRefreshTimerRef.current = null;
      }
      if (!preserveCurrentResults) {
        pendingBoundsRef.current = null;
      }
      abortControllerRef.current?.abort();
      requestSeqRef.current += 1;
      const requestId = requestSeqRef.current;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsRefreshing(true);
      setError("");

      try {
        const response = await fetchAttractionCatalog(href, 1, controller.signal, nextBounds);
        if (requestId !== requestSeqRef.current || controller.signal.aborted) {
          return;
        }

        const nextResult = options?.preserveFiltersForBounds
          ? mergeBoundsResultFilters(response, previousResult, nextBounds)
          : response;

        setResult(nextResult);
        setBounds(nextBounds);
        setNewItemIds([]);

        const historyMode = options?.historyMode ?? "push";
        if (historyMode !== "none") {
          const nextHref = buildCatalogPath(
            "/attractions",
            getParamsFromResult(nextResult, nextBounds),
          );
          if (historyMode === "replace") {
            window.history.replaceState({}, "", nextHref);
          } else {
            window.history.pushState({}, "", nextHref);
          }
        }
      } catch {
        if (controller.signal.aborted || requestId !== requestSeqRef.current) {
          return;
        }

        setResult(previousResult);
        setBounds(previousBounds);
        setError("Не удалось обновить каталог досуга");
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }

        if (requestId === requestSeqRef.current) {
          setIsRefreshing(false);
        }
      }
    },
    [],
  );

  const handleNavigate = useCallback(
    (href: string) => {
      void runRequest(href, { historyMode: "push", bounds: null });
    },
    [runRequest],
  );

  const handleReset = useCallback(() => {
    void runRequest("/attractions", { historyMode: "push", bounds: null });
  }, [runRequest]);

  const handleBoundsChange = useCallback(
    (nextBounds: string | null) => {
      if (hasLocationRadiusScope) {
        return;
      }

      if (Date.now() <= ignoreBoundsUntilRef.current) {
        return;
      }

      const normalizedBounds = nextBounds?.trim() || null;
      if (
        normalizedBounds === (boundsRef.current ?? null) ||
        normalizedBounds === pendingBoundsRef.current
      ) {
        return;
      }

      pendingBoundsRef.current = normalizedBounds;

      if (boundsRefreshTimerRef.current !== null) {
        window.clearTimeout(boundsRefreshTimerRef.current);
        boundsRefreshTimerRef.current = null;
      }

      abortControllerRef.current?.abort();
      pendingBoundsRef.current = null;
      ignoreBoundsUntilRef.current = Date.now() + 2200;
      requestSeqRef.current += 1;

      setIsRefreshing(true);
      setError("");

      if (!normalizedBounds) {
        pendingBoundsRef.current = null;
        boundsRef.current = null;
        setBounds(null);
        setIsRefreshing(false);
        return;
      }

      boundsRefreshTimerRef.current = window.setTimeout(() => {
        boundsRefreshTimerRef.current = null;
        const requestPromise = runRequest(getPageHrefFromWindow(), {
          historyMode: "replace",
          bounds: normalizedBounds,
          preserveFiltersForBounds: true,
          preserveCurrentResults: true,
        });
        const scheduledRequestId = requestSeqRef.current;
        void requestPromise.finally(() => {
          if (
            scheduledRequestId === requestSeqRef.current &&
            pendingBoundsRef.current === normalizedBounds
          ) {
            pendingBoundsRef.current = null;
          }
        });
      }, MAP_BOUNDS_REFRESH_DELAY_MS);
    },
    [hasLocationRadiusScope, runRequest],
  );

  const handlePageChange = useCallback(
    async (nextPage: number) => {
      const safePage = Math.min(Math.max(1, Math.floor(nextPage)), resultRef.current.totalPages);
      if (safePage === resultRef.current.page || isRefreshing) {
        return;
      }

      if (boundsRefreshTimerRef.current !== null) {
        window.clearTimeout(boundsRefreshTimerRef.current);
        boundsRefreshTimerRef.current = null;
      }
      abortControllerRef.current?.abort();
      requestSeqRef.current += 1;
      const requestId = requestSeqRef.current;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsRefreshing(true);
      setError("");

      try {
        const response = await fetchAttractionCatalog(
          getPageHrefFromWindow(),
          safePage,
          controller.signal,
          boundsRef.current,
        );
        if (requestId !== requestSeqRef.current || controller.signal.aborted) {
          return;
        }

        const merged = boundsRef.current
          ? mergeBoundsResultFilters(response, resultRef.current, boundsRef.current)
          : response;
        const nextHref = buildCatalogPath("/attractions", {
          ...getParamsFromResult(merged, boundsRef.current),
          page: merged.page > 1 ? String(merged.page) : "",
        });

        setResult(merged);
        setNewItemIds(merged.items.map((item) => item.id));
        window.history.pushState({}, "", nextHref);
        window.requestAnimationFrame(() => {
          document.getElementById("catalog-results")?.scrollIntoView({
            block: "start",
            behavior: "smooth",
          });
        });
      } catch {
        if (!controller.signal.aborted && requestId === requestSeqRef.current) {
          setError("Не удалось открыть страницу каталога досуга");
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }

        if (requestId === requestSeqRef.current) {
          setIsRefreshing(false);
        }
      }
    },
    [isRefreshing],
  );

  useEffect(() => {
    const handlePopState = () => {
      void runRequest(getPageHrefFromWindow(), {
        historyMode: "none",
        bounds: new URLSearchParams(window.location.search).get("bounds")?.trim() || null,
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [runRequest]);

  return (
    <>
      <CatalogScrollRestorer catalogKey="attractions" />
      <CatalogShell>
        <MarketplaceFilterBar
          key={[
            result.filters.query ?? "",
            result.filters.locationName ?? "",
            result.filters.category ?? "",
            result.filters.radiusKm,
            result.filters.sort,
          ].join("|")}
          kind="attractions"
          filters={result.filters}
          total={result.total}
          categories={categories}
          locationSuggestions={locationSuggestions}
          onNavigate={handleNavigate}
        />

        <MarketplaceCatalogMap
          kind="attractions"
          items={initialMapItems}
          resultsCount={result.total}
          filters={result.filters}
          syncBoundsToUrl={false}
          activeBoundsParam={effectiveBounds}
          isLoading={isRefreshing}
          mapItemsEndpoint={mapItemsEndpoint}
          boundsQueryChangeDelayMs={0}
          mapTitle="Карта мест"
          onBoundsQueryChange={handleBoundsChange}
        >
          <section className="min-w-0 lg:w-full" id="catalog-results" aria-busy={isRefreshing}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-olive/70">
                {isRefreshing ? <CatalogLoadingInlineLabel /> : `Найдено: ${foundLabel}`}
              </p>
            </div>

            {error ? (
              <div className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {error}
              </div>
            ) : null}

            {shouldShowRefreshSkeleton ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <SkeletonCard key={`attraction-skeleton-${index}`} />
                ))}
              </div>
            ) : result.items.length === 0 ? (
              <EmptyCatalogContent
                shouldShowConnectionEmptyState={shouldShowConnectionEmptyState}
                onReset={handleReset}
              />
            ) : (
              <div className="space-y-4">
                {result.items.map((item, index) => {
                  const delayBase = index < 10 ? index * 50 : 0;
                  const animationStyle: CSSProperties = {
                    animationDelay: `${delayBase}ms`,
                    contentVisibility: index >= 4 ? "auto" : "visible",
                    containIntrinsicSize: index >= 4 ? "320px 960px" : undefined,
                  };

                  return (
                    <Fragment key={item.id}>
                      <div
                        className={cn(
                          "catalog-card-enter",
                          newItemIds.includes(item.id) && "is-new",
                        )}
                        style={animationStyle}
                      >
                        <AttractionCard item={item} eagerImage={index < 2} />
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            )}

            {!isRefreshing && result.totalPages > 1 ? (
              <CatalogPagination
                page={result.page}
                totalPages={result.totalPages}
                onPageChange={(nextPage) => void handlePageChange(nextPage)}
              />
            ) : null}
          </section>
        </MarketplaceCatalogMap>
      </CatalogShell>
    </>
  );
}

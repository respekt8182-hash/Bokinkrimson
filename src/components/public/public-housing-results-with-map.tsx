// UI component for public housing results with map in the public module.
"use client";

import { Map as MapIcon } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";
import { CatalogMapPreviewCard } from "@/components/maps/catalog-map-preview-card";
import {
  YandexMapMultiViewer,
  type YandexMapPoint,
  type YandexMapViewport,
} from "@/components/maps/yandex-map-multi-viewer";
import { AppIcon } from "@/components/ui/app-icon";
import {
  MapPropertyPopupCard,
  type MapPopupPropertyItem,
} from "@/components/public/map-property-popup-card";
import { PublicPropertySearchCard } from "@/components/public/public-property-search-card";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import type { PublicCatalogItem } from "@/lib/public-properties";
import { housingHubPath } from "@/lib/seo/routes";

type PublicHousingResultsWithMapProps = {
  items: PublicCatalogItem[];
  mapQuery: string;
  selectedLocationName?: string | null;
  view?: "list" | "grid";
  searchGuests?: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadingInitial?: boolean;
  emptyContent?: ReactNode;
  newItemIds?: string[];
  onLoadMore?: () => void;
  onWishlistToggle?: (isFavorite: boolean) => void;
};

type MapPointResponse = MapPopupPropertyItem & {
  url?: string | null;
  latitude: number | null;
  longitude: number | null;
  priceFrom: number | null;
};

type MapState = {
  status: "idle" | "loading" | "ready" | "error";
  points: MapPointResponse[];
  totalAvailable: number | null;
  truncated: boolean;
  errorMessage: string;
};

type LocationViewportPreset = {
  keys: string[];
  viewport: YandexMapViewport;
};

const LOCATION_VIEWPORT_PRESETS: LocationViewportPreset[] = [
  {
    keys: ["ялта", "yalta"],
    viewport: { center: [44.4952, 34.1663], zoom: 12 },
  },
  {
    keys: ["алушта", "alushta"],
    viewport: { center: [44.6764, 34.4097], zoom: 12 },
  },
  {
    keys: ["алупка", "alupka"],
    viewport: { center: [44.418, 34.0453], zoom: 13 },
  },
  {
    keys: ["евпатория", "evpatoria"],
    viewport: { center: [45.1906, 33.3676], zoom: 12 },
  },
  {
    keys: ["керчь", "kerch"],
    viewport: { center: [45.3562, 36.4673], zoom: 12 },
  },
  {
    keys: ["севастополь", "sevastopol"],
    viewport: { center: [44.6167, 33.5254], zoom: 11 },
  },
  {
    keys: ["судак", "sudak"],
    viewport: { center: [44.8491, 34.9747], zoom: 12 },
  },
  {
    keys: ["феодосия", "feodosiya", "feodosia"],
    viewport: { center: [45.0319, 35.3824], zoom: 12 },
  },
  {
    keys: ["щелкино", "schelkino", "shchyolkino"],
    viewport: { center: [45.4287, 35.8223], zoom: 12 },
  },
  {
    keys: ["молочное"],
    viewport: { center: [45.225, 33.1549], zoom: 13 },
  },
];

function normalizeLocationKey(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/^(г\.?|город|с\.?|село|пос\.?|поселок|пгт)\s+/i, "")
    .replace(/\s+/g, " ");
}

function resolveLocationViewport(value: string | null | undefined): YandexMapViewport | null {
  const key = normalizeLocationKey(value);
  if (!key) {
    return null;
  }

  const preset = LOCATION_VIEWPORT_PRESETS.find((item) => item.keys.includes(key));
  return preset?.viewport ?? null;
}

const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatMapPrice(value: number, currency: string | null): string {
  const amount = ruNumberFormat.format(value);
  if (currency === "RUB") {
    return `${amount} ₽`;
  }

  return currency ? `${amount} ${currency}` : amount;
}

function sanitizePoint(point: Partial<MapPointResponse>): MapPointResponse {
  const latitude =
    typeof point.latitude === "number" && Number.isFinite(point.latitude) ? point.latitude : null;
  const longitude =
    typeof point.longitude === "number" && Number.isFinite(point.longitude)
      ? point.longitude
      : null;
  const priceFrom =
    typeof point.priceFrom === "number" && Number.isFinite(point.priceFrom)
      ? point.priceFrom
      : null;
  const pricePerNight =
    typeof point.pricePerNight === "number" && Number.isFinite(point.pricePerNight)
      ? point.pricePerNight
      : priceFrom;

  return {
    id: typeof point.id === "string" ? point.id : "",
    title:
      typeof point.title === "string" && point.title.trim().length > 0 ? point.title : "Объект",
    path:
      typeof point.path === "string" && point.path.trim().length > 0
        ? point.path
        : typeof point.url === "string"
          ? point.url
          : housingHubPath,
    latitude,
    longitude,
    pricePerNight,
    priceFrom,
    currency: typeof point.currency === "string" ? point.currency : "RUB",
    addressShort: typeof point.addressShort === "string" ? point.addressShort : "Крым",
    photos: Array.isArray(point.photos)
      ? point.photos
          .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
          .slice(0, 5)
      : [],
    rating: typeof point.rating === "number" && Number.isFinite(point.rating) ? point.rating : null,
    reviewsCount:
      typeof point.reviewsCount === "number" && Number.isFinite(point.reviewsCount)
        ? point.reviewsCount
        : 0,
    isFavorite: point.isFavorite === true,
  };
}

function appendStayParamsToPath(
  path: string,
  params: {
    checkIn: string;
    checkOut: string;
    guests: string;
    guestsAdults?: string;
    guestsChildren?: string;
  },
): string {
  const [pathWithoutHash, hash = ""] = path.split("#", 2);
  const [pathname, queryString = ""] = pathWithoutHash.split("?", 2);
  const query = new URLSearchParams(queryString);

  if (params.checkIn) {
    query.set("checkIn", params.checkIn);
  } else {
    query.delete("checkIn");
  }

  if (params.checkOut) {
    query.set("checkOut", params.checkOut);
  } else {
    query.delete("checkOut");
  }

  if (params.guests) {
    query.set("guests", params.guests);
  } else {
    query.delete("guests");
  }

  if (params.guestsAdults) {
    query.set("guestsAdults", params.guestsAdults);
  } else {
    query.delete("guestsAdults");
  }

  if (params.guestsChildren) {
    query.set("guestsChildren", params.guestsChildren);
  } else {
    query.delete("guestsChildren");
  }

  const nextQuery = query.toString();
  const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname;
  return hash ? `${nextPath}#${hash}` : nextPath;
}

function createInitialMapState(): MapState {
  return {
    status: "idle",
    points: [],
    totalAvailable: null,
    truncated: false,
    errorMessage: "",
  };
}

function SkeletonCard({ view }: { view: "list" | "grid" }) {
  const isGrid = view === "grid";

  if (isGrid) {
    return (
      <article
        className="overflow-hidden rounded-2xl border border-olive/[0.07] bg-white"
        aria-hidden="true"
      >
        <div className="catalog-skeleton aspect-[4/3] w-full rounded-t-2xl" />
        <div className="space-y-2.5 p-3">
          <div className="catalog-skeleton h-3 w-16 rounded-md" />
          <div className="catalog-skeleton h-5 w-4/5 rounded-md" />
          <div className="catalog-skeleton h-3.5 w-3/5 rounded-md" />
          <div className="flex gap-2">
            <div className="catalog-skeleton h-6 w-6 rounded-lg" />
            <div className="catalog-skeleton h-6 w-20 rounded-lg" />
          </div>
          <div className="flex gap-1.5">
            <div className="catalog-skeleton h-5 w-14 rounded-md" />
            <div className="catalog-skeleton h-5 w-14 rounded-md" />
          </div>
        </div>
        <div className="flex items-end justify-between border-t border-olive/[0.06] p-3">
          <div className="catalog-skeleton h-6 w-28 rounded-md" />
          <div className="catalog-skeleton h-9 w-20 rounded-xl" />
        </div>
      </article>
    );
  }

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
            <div className="flex items-center gap-2">
              <div className="catalog-skeleton h-4 w-16 rounded-md" />
              <div className="catalog-skeleton h-9 w-9 rounded-lg" />
            </div>
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

export function PublicHousingResultsWithMap({
  items,
  mapQuery,
  selectedLocationName,
  view = "list",
  searchGuests = null,
  hasMore,
  loadingMore,
  loadingInitial = false,
  emptyContent = null,
  newItemIds = [],
  onLoadMore,
  onWishlistToggle,
}: PublicHousingResultsWithMapProps) {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const interactionSourceRef = useRef<"map" | "list" | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedLocation = useMemo(() => {
    const byQuery = new URLSearchParams(mapQuery).get("location")?.trim() ?? "";
    return (selectedLocationName?.trim() || byQuery || "").trim();
  }, [mapQuery, selectedLocationName]);
  const stayParams = useMemo(() => {
    const params = new URLSearchParams(mapQuery);
    return {
      checkIn: params.get("checkIn")?.trim() ?? "",
      checkOut: params.get("checkOut")?.trim() ?? "",
      guests: params.get("guests")?.trim() ?? "",
      guestsAdults: params.get("guestsAdults")?.trim() ?? "",
      guestsChildren: params.get("guestsChildren")?.trim() ?? "",
    };
  }, [mapQuery]);
  const searchGuestsCount = useMemo(() => {
    if (typeof searchGuests === "number" && Number.isFinite(searchGuests) && searchGuests > 0) {
      return Math.floor(searchGuests);
    }

    const parsed = Number.parseInt(stayParams.guests, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchGuests, stayParams.guests]);

  const locationViewport = useMemo(
    () => resolveLocationViewport(selectedLocation),
    [selectedLocation],
  );
  const viewportKey = useMemo(() => {
    const normalized = normalizeLocationKey(selectedLocation);
    return normalized || "crimea-default";
  }, [selectedLocation]);
  const newIdsSet = useMemo(() => new Set(newItemIds), [newItemIds]);
  const eagerImageCount = view === "grid" ? 4 : 2;
  const deferredRenderThreshold = view === "grid" ? 6 : 4;

  const [isMapActivated, setIsMapActivated] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [pulseCardId, setPulseCardId] = useState<string | null>(null);
  const [mapState, setMapState] = useState<MapState>(createInitialMapState);

  const closeMapFully = useCallback(() => {
    setIsMapExpanded(false);
    setIsMapActivated(false);
    setActivePointId(null);
    setHoveredPointId(null);
  }, []);

  const fallbackPoints = useMemo<MapPointResponse[]>(
    () =>
      items.map((item) =>
        sanitizePoint({
          id: item.id,
          title: item.name,
          path: item.path,
          latitude: item.latitude,
          longitude: item.longitude,
          pricePerNight: item.stayPrice?.nightly ?? item.minNightPrice,
          priceFrom: item.minNightPrice,
          currency: item.stayPrice?.currency ?? item.currency,
          addressShort: item.locationName,
          photos:
            item.imageUrls.length > 0
              ? item.imageUrls
              : item.coverImageUrl
                ? [item.coverImageUrl]
                : [],
          rating: item.reviewsCount > 0 ? Number(item.avgRating.toFixed(1)) : null,
          reviewsCount: item.reviewsCount,
          isFavorite: false,
        }),
      ),
    [items],
  );
  const visibleItemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const mapPoints = useMemo(() => {
    const remotePointsById =
      mapState.status === "ready"
        ? new Map(
            mapState.points
              .filter((point) => visibleItemIds.has(point.id))
              .map((point) => [point.id, point] as const),
          )
        : null;

    return fallbackPoints.map((fallbackPoint) => {
      const mergedPoint = remotePointsById
        ? sanitizePoint({
            ...fallbackPoint,
            ...remotePointsById.get(fallbackPoint.id),
            id: fallbackPoint.id,
          })
        : fallbackPoint;

      return {
        ...mergedPoint,
        path: appendStayParamsToPath(mergedPoint.path, stayParams),
      };
    });
  }, [fallbackPoints, mapState.points, mapState.status, stayParams, visibleItemIds]);

  const pointsWithCoordinates = useMemo(
    () =>
      mapPoints.filter(
        (point): point is MapPointResponse & { latitude: number; longitude: number } =>
          point.latitude !== null && point.longitude !== null,
      ),
    [mapPoints],
  );

  const mapPointById = useMemo(
    () => new Map(pointsWithCoordinates.map((point) => [point.id, point])),
    [pointsWithCoordinates],
  );

  const mapViewerPoints = useMemo<YandexMapPoint[]>(
    () =>
      pointsWithCoordinates.map((point) => ({
        id: point.id,
        title: point.title,
        latitude: point.latitude,
        longitude: point.longitude,
        priceLabel:
          point.pricePerNight !== null ? formatMapPrice(point.pricePerNight, point.currency) : null,
        previewImageUrl: point.photos[0] ?? null,
        rating: point.rating,
        reviewsCount: point.reviewsCount,
      })),
    [pointsWithCoordinates],
  );

  const activePopupItem = activePointId ? (mapPointById.get(activePointId) ?? null) : null;
  const hasMapPoints = mapViewerPoints.length > 0;

  useEffect(() => {
    setIsMapActivated(false);
    setIsMapExpanded(false);
    setActivePointId(null);
    setHoveredPointId(null);
    setPulseCardId(null);
    setMapState(createInitialMapState());
  }, [mapQuery, selectedLocation]);

  useEffect(() => {
    if (!isMapActivated) {
      return;
    }

    const controller = new AbortController();

    const fetchPoints = async () => {
      setMapState({
        status: "loading",
        points: [],
        totalAvailable: null,
        truncated: false,
        errorMessage: "",
      });

      try {
        const response = await fetch(`/api/map/accommodations?${mapQuery}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("map_fetch_failed");
        }

        const body = (await response.json()) as {
          map_points?: Partial<MapPointResponse>[];
          meta?: {
            totalAvailable?: number;
            truncated?: boolean;
          };
        };

        const points = Array.isArray(body.map_points)
          ? body.map_points
              .map((point) => sanitizePoint(point))
              .filter((point) => point.id.trim().length > 0)
          : [];

        setMapState({
          status: "ready",
          points,
          totalAvailable:
            typeof body.meta?.totalAvailable === "number" ? body.meta.totalAvailable : null,
          truncated: body.meta?.truncated === true,
          errorMessage: "",
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setMapState({
          status: "error",
          points: [],
          totalAvailable: null,
          truncated: false,
          errorMessage: "Не удалось обновить детали точек карты. Показаны объекты текущей выдачи.",
        });
      }
    };

    void fetchPoints();

    return () => {
      controller.abort();
    };
  }, [isMapActivated, mapQuery]);

  useEffect(() => {
    if (!isMapExpanded) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMapFully();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeMapFully, isMapExpanded]);

  useBodyScrollLock(isMapExpanded);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== null) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  function focusCardById(pointId: string) {
    const card = cardRefs.current.get(pointId);
    if (!card) {
      return;
    }

    card.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulseCardId(pointId);
    if (pulseTimerRef.current !== null) {
      clearTimeout(pulseTimerRef.current);
    }
    pulseTimerRef.current = setTimeout(() => {
      setPulseCardId((prev) => (prev === pointId ? null : prev));
    }, 1500);
  }

  function handleMapPointClick(pointId: string) {
    interactionSourceRef.current = "map";
    setActivePointId(pointId);
    focusCardById(pointId);
  }

  function openMapFully() {
    setIsMapActivated(true);
    setIsMapExpanded(true);
  }

  const mapStatsLabel = !isMapActivated
    ? `Предпросмотр: ${ruNumberFormat.format(mapViewerPoints.length)} показанных`
    : `На карте: ${ruNumberFormat.format(mapViewerPoints.length)}`;

  return (
    <>
      <section className="space-y-4">
        <section className="rounded-[30px] border border-olive/10 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.14),_transparent_58%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(243,247,245,0.94))] p-4 shadow-[0_26px_52px_-36px_rgba(15,74,64,0.54)] md:hidden">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold leading-5 text-olive whitespace-nowrap">
              {
                "\u0421\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u044b \u043d\u0430 \u043a\u0430\u0440\u0442\u0435"
              }
            </p>
          </div>

          <CatalogMapPreviewCard
            title="Карта объектов"
            subtitle="Карта загружается только после явного открытия, чтобы не тормозить выдачу."
            actionLabel="Открыть карту"
            ariaLabel="Открыть карту полностью"
            onOpen={openMapFully}
            variant="crimea-preview"
            className="mt-4 h-[188px] w-full min-[420px]:h-[220px]"
          />
        </section>

        <section className="hidden rounded-2xl bg-white/94 p-3 ring-1 ring-olive/10 md:block lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-olive">Смотреть варианты на карте</p>
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
          <CatalogMapPreviewCard
            title="Карта объектов"
            subtitle="Откроется по запросу без лишней загрузки Yandex iframe."
            actionLabel="Открыть карту"
            ariaLabel="Открыть карту полностью"
            onOpen={openMapFully}
            variant="crimea-preview"
            className="mt-3 h-[160px] w-full rounded-xl"
          />
        </section>

        <div className="catalog-layout grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(320px,360px)] xl:grid-cols-[minmax(0,1.28fr)_minmax(340px,390px)] 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <section
            id="catalog-results"
            aria-busy={loadingInitial || loadingMore}
            className="space-y-4"
          >
            <div
              className={cn(
                "grid gap-4 transition-all duration-300",
                view === "grid" ? "grid-cols-1 min-[480px]:grid-cols-2" : "grid-cols-1",
              )}
            >
              {loadingInitial && items.length === 0 ? (
                Array.from({ length: view === "grid" ? 4 : 3 }, (_, index) => (
                  <SkeletonCard key={`initial-skeleton-${index}`} view={view} />
                ))
              ) : items.length === 0 ? (
                emptyContent
              ) : (
                items.map((item, index) => {
                    const isHighlighted =
                      item.id === activePointId ||
                      item.id === hoveredPointId ||
                      item.id === pulseCardId;
                    const delayBase = index < 10 ? index * 50 : 0;
                    const animationStyle: CSSProperties = {
                      animationDelay: `${delayBase}ms`,
                      contentVisibility: index >= deferredRenderThreshold ? "auto" : "visible",
                      containIntrinsicSize:
                        index >= deferredRenderThreshold
                          ? view === "grid"
                            ? "380px 320px"
                            : "320px 960px"
                          : undefined,
                    };

                    return (
                      <div
                        key={item.id}
                        ref={(node) => {
                          if (node) {
                            cardRefs.current.set(item.id, node);
                            return;
                          }

                          cardRefs.current.delete(item.id);
                        }}
                        className="catalog-card-enter"
                        style={animationStyle}
                      >
                        <PublicPropertySearchCard
                          item={item}
                          initialIsFavorite={false}
                          view={view}
                          prioritizeImage={index < eagerImageCount}
                          searchGuests={searchGuestsCount}
                          isHighlighted={isHighlighted}
                          isNew={newIdsSet.has(item.id)}
                          onWishlistToggle={onWishlistToggle}
                        />
                      </div>
                    );
                  })
              )}
            </div>

            {loadingMore ? (
              <div
                className={cn(
                  "grid gap-4",
                  view === "grid" ? "grid-cols-1 min-[480px]:grid-cols-2" : "grid-cols-1",
                )}
              >
                {Array.from({ length: view === "grid" ? 4 : 3 }, (_, index) => (
                  <SkeletonCard key={`load-more-skeleton-${index}`} view={view} />
                ))}
              </div>
            ) : null}

            {hasMore ? (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className={cn(
                    "load-more-btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto",
                    loadingMore ? "loading" : "",
                  )}
                >
                  {loadingMore ? <span className="spinner" aria-hidden="true" /> : null}
                  {loadingMore ? "Загружаем..." : "Показать ещё"}
                </button>
              </div>
            ) : null}
          </section>

          <aside className="map-column hidden self-start lg:block lg:sticky lg:top-[96px] lg:h-[347.61px]">
            <section className="flex h-full flex-col rounded-2xl bg-white/94 p-3.5 ring-1 ring-olive/10 md:p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-olive">Смотреть варианты на карте</p>
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
                    points={mapViewerPoints}
                    activePointId={activePointId}
                    hoveredPointId={hoveredPointId}
                    onPointClick={handleMapPointClick}
                    onPointHoverChange={setHoveredPointId}
                    initialViewport={locationViewport}
                    viewportKey={viewportKey}
                    className="h-full w-full"
                  />
                </div>
              ) : (
                <CatalogMapPreviewCard
                  title="Карта объектов"
                  subtitle="Откройте интерактивную карту, когда захотите сравнить расположение."
                  actionLabel="Открыть карту"
                  ariaLabel="Открыть карту полностью"
                  onOpen={openMapFully}
                  variant="crimea-preview"
                  className="mt-3 min-h-0 flex-1 rounded-xl"
                />
              )}
              {isMapActivated && mapState.status === "loading" ? (
                <p className="mt-2 text-xs text-olive/60">Обновляем точки текущей выдачи...</p>
              ) : null}
            </section>
          </aside>
        </div>
      </section>

      {false ? (
        <button
          type="button"
          onClick={openMapFully}
          aria-expanded={isMapExpanded}
          aria-controls="catalog-map-modal"
          className="float-map-btn hidden z-[70] inline-flex items-center gap-2 rounded-[20px] bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_34px_-24px_rgba(15,118,110,0.7)] lg:hidden"
        >
          <AppIcon icon={MapIcon} className="h-4 w-4 shrink-0" />
          <span>Карта · {mapViewerPoints.length}</span>
        </button>
      ) : null}

      {isMapExpanded ? (
        <div
          id="catalog-map-modal"
          className="fixed inset-0 z-[90] bg-midnight/55 p-3 backdrop-blur-[1px] sm:p-5"
        >
          <section className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white/97 p-3 ring-1 ring-olive/10 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-olive">Карта объектов</p>
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
                points={mapViewerPoints}
                activePointId={activePointId}
                hoveredPointId={hoveredPointId}
                onPointClick={handleMapPointClick}
                onPointHoverChange={setHoveredPointId}
                initialViewport={locationViewport}
                viewportKey={viewportKey}
                className="h-[calc(100dvh-190px)] min-h-[360px] w-full"
              />

              {mapState.status === "loading" && !hasMapPoints ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/55 backdrop-blur-[1px]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-olive/16 bg-white/92 px-3 py-1.5 text-xs font-semibold text-olive shadow-sm">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-olive/30 border-t-olive" />
                    Загружаем точки
                  </div>
                </div>
              ) : null}

              {activePopupItem ? (
                <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex justify-center lg:justify-start">
                  <MapPropertyPopupCard
                    key={activePopupItem.id}
                    item={activePopupItem}
                    onClose={() => setActivePointId(null)}
                    className="pointer-events-auto w-full max-w-md"
                  />
                </div>
              ) : null}
            </div>

            {mapState.errorMessage ? (
              <p className="mt-2 text-xs text-amber-700">{mapState.errorMessage}</p>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

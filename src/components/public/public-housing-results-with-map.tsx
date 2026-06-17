// UI component for public housing results with map in the public module.
"use client";

import { ChevronDown, ChevronUp, Maximize2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  Fragment,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent as ReactUIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";
import type { YandexMapPoint, YandexMapViewport } from "@/components/maps/yandex-map-multi-viewer";
import { AppIcon } from "@/components/ui/app-icon";
import { CatalogNearbyContinuationNote } from "@/components/public/catalog-nearby-continuation-note";
import {
  MapPropertyPopupCard,
  type MapPopupPropertyItem,
} from "@/components/public/map-property-popup-card";
import { CatalogPagination } from "@/components/public/catalog-pagination";
import { PublicPropertySearchCard } from "@/components/public/public-property-search-card";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useCatalogMapPlacement } from "@/hooks/use-catalog-map-placement";
import { NEARBY_CATALOG_RADIUS_KM } from "@/lib/catalog-radius";
import {
  buildCatalogMapViewportScope,
  markCatalogMapItemViewed,
  readCatalogMapViewedItems,
  readCatalogMapViewport,
  writeCatalogMapViewport,
} from "@/lib/catalog-map-memory";
import { fetchWithRetry } from "@/lib/client-retry-fetch";
import { fetchLocationCenter } from "@/lib/location-center-client";
import { normalizeRoomPriceType, type RoomPriceCalculationType } from "@/lib/pricing";
import type { PublicCatalogItem } from "@/lib/public-properties";
import {
  setPublicMobileBottomNavForceHidden,
  setPublicMobileBottomNavProgress,
} from "@/lib/public-mobile-nav-visibility";
import { housingHubPath } from "@/lib/seo/routes";

type PublicHousingResultsWithMapProps = {
  items: PublicCatalogItem[];
  mapQuery: string;
  selectedLocationName?: string | null;
  view?: "list" | "grid";
  searchGuests?: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  page?: number;
  totalPages?: number;
  loadingInitial?: boolean;
  mapBoundsRefreshing?: boolean;
  totalCount?: number;
  emptyContent?: ReactNode;
  newItemIds?: string[];
  onLoadMore?: () => void;
  onPageChange?: (page: number) => void;
  onWishlistToggle?: (isFavorite: boolean) => void;
  onMapBoundsFilterChange?: (bounds: string | null) => void;
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

type MobileSheetSnap = "expanded" | "preview" | "collapsed";

type MobileSheetDragState = {
  pointerId: number;
  startY: number;
  startTop: number;
  didMove: boolean;
};

type MobileSheetSnaps = Record<MobileSheetSnap, number>;

const YandexMapMultiViewer = dynamic(
  () =>
    import("@/components/maps/yandex-map-multi-viewer").then(
      (module) => module.YandexMapMultiViewer,
    ),
  {
    ssr: false,
    loading: () => <div aria-hidden="true" className="h-full w-full bg-[#e7eef3]" />,
  },
);

const MOBILE_SHEET_HANDLE_HEIGHT = 76;
const MOBILE_SHEET_BOTTOM_CLEARANCE = -12;
const MOBILE_STAGE_MIN_HEIGHT = 360;
const MOBILE_STAGE_MAX_HEIGHT = 820;
const MOBILE_SHEET_CHROME_SCROLL_RANGE = 140;
const MAP_POINTS_REFRESH_DELAY_MS = 300;
const MAP_BOUNDS_PRECISION = 4;
const SEARCH_LOCATION_MAP_ZOOM = 10;

const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const ruPluralRules = new Intl.PluralRules("ru-RU");

function formatRuCount(value: number, one: string, few: string, many: string): string {
  const label =
    ruPluralRules.select(Math.abs(value)) === "one"
      ? one
      : ruPluralRules.select(Math.abs(value)) === "few"
        ? few
        : many;

  return `${ruNumberFormat.format(value)} ${label}`;
}

function normalizeMapPriceType(value: unknown): RoomPriceCalculationType {
  return value === "MIXED" ? "MIXED" : normalizeRoomPriceType(value);
}

function formatMapPrice(
  value: number,
  currency: string | null,
  priceType: RoomPriceCalculationType | null,
): string {
  const amount = ruNumberFormat.format(value);
  const suffix = priceType === "PER_PERSON" ? "/чел" : "";
  if (currency === "RUB") {
    return `${amount} ₽${suffix}`;
  }

  return currency ? `${amount} ${currency}${suffix}` : `${amount}${suffix}`;
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
    priceType: normalizeMapPriceType(point.priceType),
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

function createInitialMapState(): MapState {
  return {
    status: "idle",
    points: [],
    totalAvailable: null,
    truncated: false,
    errorMessage: "",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatMapBoundsFilter(bounds: [[number, number], [number, number]] | null): string | null {
  if (!bounds) {
    return null;
  }

  const south = bounds[0][0];
  const west = bounds[0][1];
  const north = bounds[1][0];
  const east = bounds[1][1];
  if (![south, west, north, east].every(Number.isFinite)) {
    return null;
  }

  return [south, west, north, east].map((value) => value.toFixed(MAP_BOUNDS_PRECISION)).join(",");
}

function isPointInsideViewportBounds(
  point: { latitude: number | null; longitude: number | null },
  bounds: [[number, number], [number, number]] | null,
): boolean {
  if (!bounds) {
    return true;
  }

  if (point.latitude === null || point.longitude === null) {
    return false;
  }

  const south = bounds[0][0];
  const west = bounds[0][1];
  const north = bounds[1][0];
  const east = bounds[1][1];

  return (
    point.latitude >= south &&
    point.latitude <= north &&
    point.longitude >= west &&
    point.longitude <= east
  );
}

function buildMapPointsRequestQuery(mapQuery: string, boundsQuery: string): string {
  const params = new URLSearchParams(mapQuery);
  params.set("bounds", boundsQuery);
  return params.toString();
}

function getNearestMobileSheetSnap(top: number, snaps: MobileSheetSnaps): MobileSheetSnap {
  return (Object.entries(snaps) as Array<[MobileSheetSnap, number]>).reduce(
    (nearest, entry) => (Math.abs(entry[1] - top) < Math.abs(nearest[1] - top) ? entry : nearest),
    ["preview", snaps.preview],
  )[0];
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

function CatalogLoadingInlineLabel() {
  return (
    <>
      <span>Ищем лучшие варианты жилья</span>
      <span className="catalog-loading-inline-dots text-terra" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </>
  );
}

function MapLoadingDotsPill({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "catalog-map-loading-pill pointer-events-none absolute left-1/2 top-4 z-[80] -translate-x-1/2",
        className,
      )}
      role="status"
      aria-label="Обновляем карту"
    >
      <span className="catalog-map-loading-dot" aria-hidden="true" />
      <span className="catalog-map-loading-dot" aria-hidden="true" />
      <span className="catalog-map-loading-dot" aria-hidden="true" />
    </div>
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
  page = 1,
  totalPages = 1,
  loadingInitial = false,
  mapBoundsRefreshing = false,
  totalCount,
  emptyContent = null,
  newItemIds = [],
  onLoadMore,
  onPageChange,
  onWishlistToggle,
  onMapBoundsFilterChange,
}: PublicHousingResultsWithMapProps) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const desktopMapShellRef = useRef<HTMLElement | null>(null);
  const mobileStageRef = useRef<HTMLDivElement | null>(null);
  const mobileResultsScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileSheetDragRef = useRef<MobileSheetDragState | null>(null);
  const mobileSheetTopRef = useRef<number | null>(null);
  const mobileDragHandledRef = useRef(false);
  const mobileResultsScrollTopRef = useRef(0);
  const mobileChromeProgressRef = useRef(0);
  const hasMapInteractionRef = useRef(false);
  const mapBoundsQueryRef = useRef<string | null>(null);
  const appliedMapBoundsQueryRef = useRef<string | null>(null);
  const mapPointsRequestSeqRef = useRef(0);
  const previousPageRef = useRef(page);
  const suppressBoundsRefreshUntilRef = useRef(0);
  const mapPlacement = useCatalogMapPlacement();

  const selectedLocation = useMemo(() => {
    const byQuery = new URLSearchParams(mapQuery).get("location")?.trim() ?? "";
    return (selectedLocationName?.trim() || byQuery || "").trim();
  }, [mapQuery, selectedLocationName]);
  const initialViewportKey = useMemo(() => {
    const normalizedLocation = selectedLocation.trim().toLocaleLowerCase("ru-RU");
    return normalizedLocation ? `housing-location:${normalizedLocation}` : "";
  }, [selectedLocation]);
  const mapViewportStorageScope = useMemo(
    () => buildCatalogMapViewportScope(pathname, searchParamsString),
    [pathname, searchParamsString],
  );
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

  const newIdsSet = useMemo(() => new Set(newItemIds), [newItemIds]);
  const eagerImageCount = view === "grid" ? 4 : 2;
  const deferredRenderThreshold = view === "grid" ? 6 : 4;

  const [isMapActivated, setIsMapActivated] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mobileSheetSnap, setMobileSheetSnap] = useState<MobileSheetSnap>("preview");
  const [mobileSheetTop, setMobileSheetTop] = useState<number | null>(null);
  const [mobileStageHeight, setMobileStageHeight] = useState(0);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [mapState, setMapState] = useState<MapState>(createInitialMapState);
  const [mapViewportBounds, setMapViewportBounds] = useState<
    [[number, number], [number, number]] | null
  >(null);
  const [mapBoundsQuery, setMapBoundsQuery] = useState<string | null>(null);
  const [initialViewport, setInitialViewport] = useState<YandexMapViewport | null>(null);
  const [viewedPointIds, setViewedPointIds] = useState<Set<string>>(() =>
    readCatalogMapViewedItems("housing"),
  );
  const [storedMapViewport, setStoredMapViewport] = useState<YandexMapViewport | null>(() =>
    readCatalogMapViewport("housing", mapViewportStorageScope),
  );

  const closeMapFully = useCallback(() => {
    setIsMapExpanded(false);
    setIsMapActivated(true);
    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPointId(null);
  }, []);

  const fallbackPoints = useMemo<MapPointResponse[]>(
    () =>
      items.map((item) => {
        const stayPrice = item.stayPrice;

        return sanitizePoint({
          id: item.id,
          title: item.name,
          path: item.path,
          latitude: item.latitude,
          longitude: item.longitude,
          pricePerNight: stayPrice ? stayPrice.totalNightly : item.minNightPrice,
          priceType: stayPrice ? "PER_ROOM" : item.minNightPriceType,
          priceFrom: item.minNightPrice,
          currency: stayPrice ? stayPrice.currency : item.currency,
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
        });
      }),
    [items],
  );

  const mapPoints = useMemo(() => {
    const shouldUseRemotePoints = mapState.status !== "idle";
    const sourcePoints =
      shouldUseRemotePoints && mapState.points.length > 0 ? mapState.points : fallbackPoints;
    const pointById = new Map(
      sourcePoints
        .map((point) => sanitizePoint(point))
        .filter((point) => isPointInsideViewportBounds(point, mapViewportBounds))
        .map((point) => [point.id, point]),
    );

    if (shouldUseRemotePoints) {
      for (const point of fallbackPoints) {
        if (
          !pointById.has(point.id) &&
          isPointInsideViewportBounds(point, mapViewportBounds) &&
          (viewedPointIds.has(point.id) || hoveredCardId === point.id || activePointId === point.id)
        ) {
          pointById.set(point.id, sanitizePoint(point));
        }
      }

      return Array.from(pointById.values());
    }

    return Array.from(pointById.values());
  }, [
    activePointId,
    fallbackPoints,
    hoveredCardId,
    mapViewportBounds,
    mapState.points,
    mapState.status,
    viewedPointIds,
  ]);

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
  const fallbackPointById = useMemo(
    () => new Map(fallbackPoints.map((point) => [point.id, point])),
    [fallbackPoints],
  );

  const mapViewerPoints = useMemo<YandexMapPoint[]>(
    () =>
      pointsWithCoordinates.map((point) => ({
        id: point.id,
        title: point.title,
        latitude: point.latitude,
        longitude: point.longitude,
        priceLabel:
          point.pricePerNight !== null
            ? formatMapPrice(point.pricePerNight, point.currency, point.priceType)
            : null,
        previewImageUrl: point.photos[0] ?? null,
        rating: point.rating,
        reviewsCount: point.reviewsCount,
        isViewed: viewedPointIds.has(point.id),
      })),
    [pointsWithCoordinates, viewedPointIds],
  );

  const activePopupItem = activePointId ? (mapPointById.get(activePointId) ?? null) : null;
  const highlightedMapPointId = hoveredPointId ?? hoveredCardId;
  const resolvedInitialViewport = storedMapViewport ?? initialViewport;
  const resolvedInitialViewportKey = storedMapViewport
    ? `housing-memory:${mapViewportStorageScope}`
    : initialViewportKey;
  const isResultsRefreshing = loadingInitial || mapBoundsRefreshing;
  const isCatalogLoading = isResultsRefreshing;
  const catalogSkeletonCount = mapBoundsRefreshing ? (view === "grid" ? 8 : 6) : 4;
  const hasCatalogPagination = totalPages > 1 && Boolean(onPageChange);
  const mapLoadingPillVisible =
    isResultsRefreshing || (hasMapInteractionRef.current && mapState.status === "loading");
  const foundCount = totalCount ?? items.length;
  const foundCountLabel = formatRuCount(
    foundCount,
    "вариант жилья",
    "варианта жилья",
    "вариантов жилья",
  );
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
  const resolvedMobileSheetTop = mobileSheetTop ?? mobileSheetSnaps.preview;
  const mobileSheetVisibleHeight = Math.max(
    MOBILE_SHEET_HANDLE_HEIGHT,
    (mobileStageHeight || 640) - resolvedMobileSheetTop,
  );
  const mobilePopupBottom = clamp(mobileSheetVisibleHeight + 14, 92, 180);

  const setMobileChromeProgress = useCallback((progress: number, force = false) => {
    const nextProgress = clamp(Math.round(progress * 1000) / 1000, 0, 1);

    if (!force && Math.abs(mobileChromeProgressRef.current - nextProgress) < 0.004) {
      return;
    }

    mobileChromeProgressRef.current = nextProgress;
    setPublicMobileBottomNavProgress(nextProgress);
  }, []);

  useEffect(() => {
    setStoredMapViewport(readCatalogMapViewport("housing", mapViewportStorageScope));
  }, [mapViewportStorageScope]);

  useEffect(() => {
    const refreshViewedItems = () => {
      setViewedPointIds(readCatalogMapViewedItems("housing"));
    };

    window.addEventListener("pageshow", refreshViewedItems);
    window.addEventListener("focus", refreshViewedItems);

    return () => {
      window.removeEventListener("pageshow", refreshViewedItems);
      window.removeEventListener("focus", refreshViewedItems);
    };
  }, []);

  useEffect(() => {
    setIsMapActivated((current) => {
      if (mapPlacement === null) {
        return current;
      }

      if (mapPlacement === "mobile") {
        return true;
      }

      return true;
    });
    setIsMapExpanded(false);
    setMobileSheetSnap("preview");
    setMobileSheetTop(null);
    mobileSheetTopRef.current = null;
    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPointId(null);
    setMapState(createInitialMapState());
    mapBoundsQueryRef.current = null;
    appliedMapBoundsQueryRef.current = null;
    setMapViewportBounds(null);
    setMapBoundsQuery(null);
    hasMapInteractionRef.current = false;
    suppressBoundsRefreshUntilRef.current = 0;
  }, [mapPlacement, mapQuery, selectedLocation]);

  useEffect(() => {
    if (mapPlacement !== null && mapPlacement !== "mobile") {
      setIsMapActivated(true);
    }
  }, [mapPlacement]);

  useEffect(() => {
    const normalizedLocation = selectedLocation.trim();
    if (!normalizedLocation) {
      setInitialViewport(null);
      return;
    }

    const controller = new AbortController();

    fetchLocationCenter(normalizedLocation, controller.signal)
      .then((center) => {
        if (controller.signal.aborted) {
          return;
        }

        if (!center) {
          setInitialViewport(null);
          return;
        }

        setInitialViewport({
          center: [center.latitude, center.longitude],
          zoom: SEARCH_LOCATION_MAP_ZOOM,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setInitialViewport(null);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedLocation]);

  useEffect(() => {
    if (!isMapActivated || !mapBoundsQuery || !hasMapInteractionRef.current) {
      return;
    }

    const controller = new AbortController();
    const requestId = ++mapPointsRequestSeqRef.current;
    const requestQuery = buildMapPointsRequestQuery(mapQuery, mapBoundsQuery);
    let refreshTimer: number | null = null;

    const fetchPoints = async () => {
      if (requestId !== mapPointsRequestSeqRef.current || controller.signal.aborted) {
        return;
      }

      setMapState((current) => ({
        status: "loading",
        points: current.points,
        totalAvailable: current.totalAvailable,
        truncated: current.truncated,
        errorMessage: "",
      }));

      try {
        const response = await fetchWithRetry(`/api/map/accommodations?${requestQuery}`, {
          signal: controller.signal,
          retries: 2,
          retryDelayMs: 450,
          timeoutMs: 9_000,
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

        if (requestId !== mapPointsRequestSeqRef.current || controller.signal.aborted) {
          return;
        }

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
        if (controller.signal.aborted || requestId !== mapPointsRequestSeqRef.current) {
          return;
        }

        setMapState((current) => ({
          status: "error",
          points: current.points,
          totalAvailable: current.totalAvailable,
          truncated: current.truncated,
          errorMessage: "Не удалось обновить детали точек карты. Показаны объекты текущей выдачи.",
        }));
      }
    };

    refreshTimer = window.setTimeout(() => {
      void fetchPoints();
    }, MAP_POINTS_REFRESH_DELAY_MS);

    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      controller.abort();
    };
  }, [isMapActivated, mapBoundsQuery, mapQuery]);

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
    const shouldControlMobileChrome =
      mapPlacement === "mobile" && mobileSheetSnap === "expanded" && !isMapExpanded;

    if (shouldControlMobileChrome) {
      mobileResultsScrollTopRef.current = mobileResultsScrollRef.current?.scrollTop ?? 0;
    }

    setMobileChromeProgress(0, true);
  }, [isMapExpanded, mapPlacement, mobileSheetSnap, setMobileChromeProgress]);

  useEffect(() => {
    return () => {
      setPublicMobileBottomNavProgress(0);
    };
  }, []);

  useEffect(() => {
    if (mapPlacement !== "mobile" || isMapExpanded || mobileSheetSnap !== "expanded") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const results = mobileResultsScrollRef.current;
      if (!results) {
        return;
      }

      results.scrollTop = 0;
      mobileResultsScrollTopRef.current = results.scrollTop;
      setMobileChromeProgress(0, true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isMapExpanded, mapPlacement, mobileSheetSnap, setMobileChromeProgress]);

  useEffect(() => {
    const previousPage = previousPageRef.current;
    previousPageRef.current = page;

    if (
      previousPage === page ||
      mapPlacement !== "mobile" ||
      !isMapActivated ||
      isMapExpanded ||
      mobileSheetSnap !== "expanded"
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const results = mobileResultsScrollRef.current;
      if (!results) {
        return;
      }

      results.scrollTop = 0;
      mobileResultsScrollTopRef.current = 0;
      setMobileChromeProgress(0, true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isMapActivated, isMapExpanded, mapPlacement, mobileSheetSnap, page, setMobileChromeProgress]);

  useEffect(() => {
    const shouldHideNav =
      mapPlacement === "mobile" && (isMapExpanded || mobileSheetSnap === "collapsed");

    setPublicMobileBottomNavForceHidden("housing-catalog-map", shouldHideNav);

    return () => {
      setPublicMobileBottomNavForceHidden("housing-catalog-map", false);
    };
  }, [isMapExpanded, mapPlacement, mobileSheetSnap]);

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
    };
  }, [mapPlacement]);

  useEffect(() => {
    if (mapPlacement !== "mobile") {
      return;
    }

    if (mobileSheetDragRef.current) {
      return;
    }

    mobileSheetTopRef.current = mobileSheetSnaps[mobileSheetSnap];
    setMobileSheetTop(mobileSheetSnaps[mobileSheetSnap]);
  }, [mapPlacement, mobileSheetSnap, mobileSheetSnaps]);

  const snapMobileSheet = useCallback(
    (snap: MobileSheetSnap) => {
      mobileSheetTopRef.current = mobileSheetSnaps[snap];
      setMobileSheetSnap(snap);
      setMobileSheetTop(mobileSheetSnaps[snap]);
    },
    [mobileSheetSnaps],
  );

  const markPointViewed = useCallback((pointId: string) => {
    setViewedPointIds((prev) => {
      const next = markCatalogMapItemViewed("housing", pointId);
      if (prev.has(pointId) && prev.size === next.size) {
        return prev;
      }

      return next;
    });
  }, []);

  function handleMapPointClick(pointId: string) {
    hasMapInteractionRef.current = true;
    suppressBoundsRefreshUntilRef.current = Date.now() + 900;
    setActivePointId(pointId);
    setHoveredCardId(null);
    setHoveredPointId(null);
    markPointViewed(pointId);

    if (mapPlacement === "mobile") {
      snapMobileSheet("collapsed");
    }
  }

  const handleMapPointHoverChange = useCallback((pointId: string | null) => {
    setHoveredPointId(pointId);
  }, []);

  const handleMapBoundsChange = useCallback(
    (bounds: [[number, number], [number, number]] | null, viewport?: YandexMapViewport) => {
      const normalizedBounds = formatMapBoundsFilter(bounds);
      if (hasMapInteractionRef.current && bounds) {
        writeCatalogMapViewport("housing", mapViewportStorageScope, viewport ?? { bounds });
      }
      const shouldSuppressBoundsRefresh = Date.now() <= suppressBoundsRefreshUntilRef.current;
      if (normalizedBounds !== mapBoundsQueryRef.current) {
        mapBoundsQueryRef.current = normalizedBounds;
        setMapViewportBounds(bounds);
      }

      if (shouldSuppressBoundsRefresh) {
        return;
      }
      suppressBoundsRefreshUntilRef.current = 0;

      if (!hasMapInteractionRef.current) {
        return;
      }

      if (normalizedBounds === appliedMapBoundsQueryRef.current) {
        return;
      }

      appliedMapBoundsQueryRef.current = normalizedBounds;
      setMapBoundsQuery(normalizedBounds);
      onMapBoundsFilterChange?.(normalizedBounds);
    },
    [mapViewportStorageScope, onMapBoundsFilterChange],
  );

  useLayoutEffect(() => {
    if (!mapBoundsRefreshing || mapPlacement !== "mobile") {
      return;
    }

    const results = mobileResultsScrollRef.current;
    if (!results) {
      return;
    }

    const preservedScrollTop = mobileResultsScrollTopRef.current;
    window.requestAnimationFrame(() => {
      results.scrollTop = preservedScrollTop;
    });
  }, [items, mapBoundsRefreshing, mapPlacement]);

  const handleMapWheelCapture = useCallback(() => {
    hasMapInteractionRef.current = true;
  }, []);

  function openMapFully() {
    setIsMapActivated(true);
    setIsMapExpanded(true);
  }

  function openMobileMapInSearch() {
    setIsMapActivated(true);
    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPointId(null);
    setMobileChromeProgress(0, true);
    snapMobileSheet("collapsed");
  }

  function handleMobileMapPointerDown() {
    hasMapInteractionRef.current = true;

    if (mapPlacement !== "mobile") {
      setActivePointId(null);
      setHoveredCardId(null);
      setHoveredPointId(null);
      return;
    }

    if (mobileSheetSnap !== "collapsed") {
      snapMobileSheet("collapsed");
    }

    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPointId(null);
  }

  function handleMobileSheetPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    mobileSheetTopRef.current = resolvedMobileSheetTop;
    mobileSheetDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop: resolvedMobileSheetTop,
      didMove: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleMobileSheetPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
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

  function handleMobileSheetPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = mobileSheetDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    mobileSheetDragRef.current = null;

    if (!dragState.didMove) {
      return;
    }

    const currentTop =
      mobileSheetTopRef.current ?? mobileSheetTop ?? mobileSheetSnaps[mobileSheetSnap];
    const nextSnap = getNearestMobileSheetSnap(currentTop, mobileSheetSnaps);
    snapMobileSheet(nextSnap);
  }

  function handleMobileSheetPointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = mobileSheetDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    mobileSheetDragRef.current = null;
    snapMobileSheet(mobileSheetSnap);
  }

  function handleMobileSheetClick() {
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

  const mapStatsLabel = `На карте: ${ruNumberFormat.format(mapViewerPoints.length)}`;
  function handleMobileResultsScroll(event: ReactUIEvent<HTMLDivElement>) {
    const currentScrollTop = event.currentTarget.scrollTop;
    const previousScrollTop = mobileResultsScrollTopRef.current;
    mobileResultsScrollTopRef.current = currentScrollTop;

    if (mapPlacement !== "mobile" || mobileSheetSnap !== "expanded" || isMapExpanded) {
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

  const shouldShowMobileMapButton =
    mapPlacement === "mobile" &&
    !isMapExpanded &&
    mobileSheetSnap === "expanded" &&
    resolvedMobileSheetTop <= mobileSheetSnaps.expanded + 1;
  const isMobileSheetExpanded = mobileSheetSnap === "expanded";
  const mobileStatusContent = isResultsRefreshing ? (
    <CatalogLoadingInlineLabel />
  ) : (
    <>Найдено {foundCountLabel}</>
  );
  const mobileSheetHandle = (
    <button
      type="button"
      onClick={handleMobileSheetClick}
      onPointerDown={handleMobileSheetPointerDown}
      onPointerMove={handleMobileSheetPointerMove}
      onPointerUp={handleMobileSheetPointerUp}
      onPointerCancel={handleMobileSheetPointerCancel}
      className="flex h-[76px] w-full touch-none cursor-grab flex-col items-center gap-2 rounded-t-[26px] px-2 pb-3 pt-2 text-center text-olive active:cursor-grabbing"
      aria-expanded={mobileSheetSnap !== "collapsed"}
      aria-controls="catalog-results"
    >
      <span
        className="h-1 w-16 rounded-full bg-white/70 shadow-[0_1px_5px_rgba(255,255,255,0.72)] ring-1 ring-white/80"
        aria-hidden="true"
      />
      <span className="relative isolate inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,255,255,0.48)_52%,rgba(255,255,255,0.72))] px-4 py-2 text-sm font-semibold shadow-[0_18px_36px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-12px_24px_rgba(255,255,255,0.18)] ring-1 ring-white/72 backdrop-blur-xl">
        {mobileStatusContent}
        <AppIcon
          icon={mobileSheetSnap === "expanded" ? ChevronDown : ChevronUp}
          className="h-4 w-4 text-olive/48"
        />
      </span>
    </button>
  );

  const resultsSection = (
    <section
      id="catalog-results"
      aria-busy={isResultsRefreshing || loadingMore}
      className="space-y-4"
    >
      <div
        className={cn(
          "grid gap-4",
          view === "grid" ? "grid-cols-1 min-[480px]:grid-cols-2" : "grid-cols-1",
        )}
      >
        {isCatalogLoading
          ? Array.from({ length: catalogSkeletonCount }, (_, index) => (
              <SkeletonCard key={`initial-skeleton-${index}`} view={view} />
            ))
          : items.length === 0
            ? emptyContent
            : items.map((item, index) => {
                const isHighlighted = item.id === activePointId || item.id === hoveredPointId;
                const showNearbyNote =
                  item.searchMatchKind === "nearby" &&
                  (index === 0 || items[index - 1]?.searchMatchKind !== "nearby");
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
                  <Fragment key={item.id}>
                    {showNearbyNote ? (
                      <CatalogNearbyContinuationNote
                        locationName={selectedLocation}
                        radiusKm={NEARBY_CATALOG_RADIUS_KM}
                      />
                    ) : null}
                    <div
                      ref={(node) => {
                        if (node) {
                          cardRefs.current.set(item.id, node);
                          return;
                        }

                        cardRefs.current.delete(item.id);
                      }}
                      className="catalog-card-enter"
                      style={animationStyle}
                      onMouseEnter={() => {
                        if (!mapPointById.has(item.id) && !fallbackPointById.has(item.id)) {
                          return;
                        }

                        setActivePointId(null);
                        setHoveredPointId(null);
                        setHoveredCardId(item.id);
                      }}
                      onMouseLeave={() => {
                        setHoveredCardId((current) => (current === item.id ? null : current));
                      }}
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
                  </Fragment>
                );
              })}
      </div>

      {!isResultsRefreshing && loadingMore ? (
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

      {!isResultsRefreshing && hasCatalogPagination && onPageChange ? (
        <CatalogPagination
          page={page}
          totalPages={totalPages}
          disabled={loadingMore}
          onPageChange={onPageChange}
        />
      ) : !isResultsRefreshing && hasMore ? (
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
  );

  return (
    <>
      <section className="space-y-4">
        {mapPlacement === "mobile" ? (
          isMapActivated ? (
            <section ref={mobileStageRef} className="-mx-4 -mt-6 md:hidden">
              <div
                className="catalog-map-mobile-stage relative min-h-[360px] overflow-hidden bg-[#e7eef3]"
                style={{
                  height: mobileStageHeight
                    ? `${mobileStageHeight}px`
                    : `min(${MOBILE_STAGE_MAX_HEIGHT}px, 100dvh)`,
                }}
              >
                <div
                  className="catalog-map-touch-layer absolute inset-0"
                  onPointerDownCapture={handleMobileMapPointerDown}
                  onWheelCapture={handleMapWheelCapture}
                >
                  <YandexMapMultiViewer
                    points={mapViewerPoints}
                    activePointId={activePointId}
                    hoveredPointId={highlightedMapPointId}
                    onPointClick={handleMapPointClick}
                    onPointHoverChange={handleMapPointHoverChange}
                    onBoundsChange={handleMapBoundsChange}
                    initialViewport={resolvedInitialViewport}
                    viewportKey={resolvedInitialViewportKey}
                    controls={[]}
                    showBalloons={false}
                    frameless
                    fitPointsOnChange="never"
                    className="h-full w-full"
                  />
                </div>

                {mapLoadingPillVisible ? <MapLoadingDotsPill className="top-3" /> : null}

                {activePopupItem && mobileSheetSnap !== "expanded" ? (
                  <div
                    className="pointer-events-none absolute inset-x-3 z-30 flex justify-center transition-[bottom] duration-200 ease-out"
                    style={{ bottom: `${mobilePopupBottom}px` }}
                  >
                    <MapPropertyPopupCard
                      key={activePopupItem.id}
                      item={activePopupItem}
                      onClose={() => setActivePointId(null)}
                      variant="compact"
                      className="pointer-events-auto w-full max-w-[500px]"
                    />
                  </div>
                ) : null}

                <div
                  className={cn(
                    "absolute inset-x-0 top-0 z-40 h-full bg-transparent will-change-transform",
                    mobileSheetDragRef.current
                      ? "transition-none"
                      : "transition-transform duration-300 ease-out",
                  )}
                  style={{ transform: `translate3d(0, ${resolvedMobileSheetTop}px, 0)` }}
                >
                  <div className={cn("md:hidden", isMobileSheetExpanded && "hidden")}>
                    <button
                      type="button"
                      onClick={handleMobileSheetClick}
                      onPointerDown={handleMobileSheetPointerDown}
                      onPointerMove={handleMobileSheetPointerMove}
                      onPointerUp={handleMobileSheetPointerUp}
                      onPointerCancel={handleMobileSheetPointerCancel}
                      className="flex h-[76px] w-full touch-none cursor-grab flex-col items-center gap-2 rounded-t-[26px] px-2 pb-3 pt-2 text-center text-olive active:cursor-grabbing"
                      aria-expanded={mobileSheetSnap !== "collapsed"}
                      aria-controls="catalog-results"
                    >
                      <span
                        className="h-1 w-16 rounded-full bg-white/70 shadow-[0_1px_5px_rgba(255,255,255,0.72)] ring-1 ring-white/80"
                        aria-hidden="true"
                      />
                      <span className="relative isolate inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,255,255,0.48)_52%,rgba(255,255,255,0.72))] px-4 py-2 text-sm font-semibold shadow-[0_18px_36px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-12px_24px_rgba(255,255,255,0.18)] ring-1 ring-white/72 backdrop-blur-xl">
                        {mobileStatusContent}
                        <AppIcon
                          icon={mobileSheetSnap === "expanded" ? ChevronDown : ChevronUp}
                          className="h-4 w-4 text-olive/48"
                        />
                      </span>
                    </button>
                  </div>
                  <div
                    ref={mobileResultsScrollRef}
                    onScroll={handleMobileResultsScroll}
                    className={cn(
                      "overflow-y-auto overscroll-y-contain bg-[#f4f6fb] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)] shadow-[0_-18px_38px_rgba(15,23,42,0.15)] transition-opacity duration-150",
                      isMobileSheetExpanded
                        ? "h-full pt-0"
                        : "h-[calc(100%-76px)] rounded-t-[28px] pt-4",
                      mobileSheetSnap === "collapsed"
                        ? "pointer-events-none opacity-0"
                        : "opacity-100",
                    )}
                  >
                    {isMobileSheetExpanded ? (
                      <>
                        <div className="-mx-4">{mobileSheetHandle}</div>
                        <div className="pt-4">{resultsSection}</div>
                      </>
                    ) : (
                      resultsSection
                    )}
                  </div>
                </div>
              </div>
              {shouldShowMobileMapButton ? (
                <button
                  type="button"
                  onClick={openMobileMapInSearch}
                  className="float-map-btn md:hidden"
                  aria-label="Показать карту"
                >
                  Карта
                </button>
              ) : null}
            </section>
          ) : (
            <section className="space-y-4 md:hidden">
              {resultsSection}
              <button
                type="button"
                onClick={openMobileMapInSearch}
                className="float-map-btn md:hidden"
                aria-label="Показать карту"
              >
                Карта
              </button>
            </section>
          )
        ) : (
          <>
            {mapPlacement === "tablet" ? (
              <section className="hidden overflow-hidden bg-[#e7eef3] md:block lg:hidden">
                <div className="hidden">
                  <div>
                    <p className="text-sm font-semibold text-olive">Смотреть варианты на карте</p>
                    <p className="text-xs text-olive/65">{mapStatsLabel}</p>
                  </div>
                </div>
                <div className="relative h-[320px] overflow-hidden">
                  <div
                    className="catalog-map-touch-layer h-full"
                    onPointerDownCapture={handleMobileMapPointerDown}
                    onWheelCapture={handleMapWheelCapture}
                  >
                    <YandexMapMultiViewer
                      points={mapViewerPoints}
                      activePointId={activePointId}
                      hoveredPointId={highlightedMapPointId}
                      onPointClick={handleMapPointClick}
                      onPointHoverChange={handleMapPointHoverChange}
                      onBoundsChange={handleMapBoundsChange}
                      initialViewport={resolvedInitialViewport}
                      viewportKey={resolvedInitialViewportKey}
                      controls={[]}
                      customZoomControls
                      showBalloons={false}
                      frameless
                      fitPointsOnChange="never"
                      className="h-full w-full"
                    />
                  </div>
                  {activePopupItem ? (
                    <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex justify-center">
                      <MapPropertyPopupCard
                        key={activePopupItem.id}
                        item={activePopupItem}
                        onClose={() => setActivePointId(null)}
                        className="pointer-events-auto w-full max-w-md"
                      />
                    </div>
                  ) : null}
                  {mapLoadingPillVisible ? <MapLoadingDotsPill /> : null}
                </div>
              </section>
            ) : null}

            <div className="catalog-layout housing-catalog-layout grid gap-0 lg:grid-cols-[minmax(0,60%)_minmax(0,40%)]">
              <div className="lg:pl-6 lg:pr-5 xl:pl-10 xl:pr-6 2xl:pl-12">{resultsSection}</div>

              <aside
                ref={desktopMapShellRef}
                data-map-yandex-chrome="compact"
                className="catalog-map-sticky housing-catalog-map relative hidden self-start overflow-visible lg:block lg:sticky lg:top-[var(--catalog-map-sticky-top)]"
              >
                <section className="catalog-map-surface relative h-full overflow-hidden bg-[#e7eef3]">
                  {mapPlacement === "desktop" ? (
                    <>
                      <div
                        className="catalog-map-touch-layer absolute inset-0"
                        onPointerDownCapture={handleMobileMapPointerDown}
                        onWheelCapture={handleMapWheelCapture}
                      >
                        <YandexMapMultiViewer
                          points={mapViewerPoints}
                          activePointId={activePointId}
                          hoveredPointId={highlightedMapPointId}
                          onPointClick={handleMapPointClick}
                          onPointHoverChange={handleMapPointHoverChange}
                          onBoundsChange={handleMapBoundsChange}
                          initialViewport={resolvedInitialViewport}
                          viewportKey={resolvedInitialViewportKey}
                          controls={[]}
                          customZoomControls
                          showBalloons={false}
                          frameless
                          fitPointsOnChange="never"
                          className="h-full w-full"
                        />
                      </div>

                      {activePopupItem ? (
                        <div className="pointer-events-none absolute left-1/2 top-20 z-20 w-[312px] max-w-[calc(100%-24px)] -translate-x-1/2">
                          <MapPropertyPopupCard
                            key={activePopupItem.id}
                            item={activePopupItem}
                            onClose={() => setActivePointId(null)}
                            className="pointer-events-auto w-full"
                          />
                        </div>
                      ) : null}

                      {mapLoadingPillVisible ? <MapLoadingDotsPill /> : null}
                    </>
                  ) : null}
                </section>
                {mapPlacement === "desktop" ? (
                  <div className="catalog-map-expand-control housing-catalog-map-expand-control pointer-events-none absolute left-5 top-5 z-[1000] flex items-start justify-start">
                    <button
                      type="button"
                      onClick={openMapFully}
                      className="pointer-events-auto inline-flex h-11 items-center gap-3 rounded-xl bg-white px-4 text-sm font-semibold text-[#202124] shadow-[0_12px_28px_rgba(15,23,42,0.16)] ring-1 ring-black/5 transition hover:bg-white/96"
                      aria-label="Раскрыть карту полностью"
                    >
                      <AppIcon icon={Maximize2} className="h-5 w-5" />
                      Раскрыть карту
                    </button>
                  </div>
                ) : null}
              </aside>
            </div>
          </>
        )}
      </section>

      {isMapExpanded ? (
        <div
          id="catalog-map-modal"
          className="fixed inset-0 z-[90] bg-[#e7eef3]"
          role="dialog"
          aria-modal="true"
          aria-label="Карта объектов"
        >
          <section className="relative h-full w-full overflow-hidden">
            <div
              className="catalog-map-touch-layer absolute inset-0"
              onPointerDownCapture={handleMobileMapPointerDown}
              onWheelCapture={handleMapWheelCapture}
            >
              <YandexMapMultiViewer
                points={mapViewerPoints}
                activePointId={activePointId}
                hoveredPointId={highlightedMapPointId}
                onPointClick={handleMapPointClick}
                onPointHoverChange={handleMapPointHoverChange}
                onBoundsChange={handleMapBoundsChange}
                initialViewport={resolvedInitialViewport}
                viewportKey={resolvedInitialViewportKey}
                controls={[]}
                customZoomControls
                showBalloons={false}
                frameless
                fitPointsOnChange="never"
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

            {mapLoadingPillVisible ? <MapLoadingDotsPill className="top-5" /> : null}

            {activePopupItem ? (
              <div className="pointer-events-none absolute left-1/2 top-20 z-20 w-[312px] max-w-[calc(100%-24px)] -translate-x-1/2 sm:top-24">
                <MapPropertyPopupCard
                  key={activePopupItem.id}
                  item={activePopupItem}
                  onClose={() => setActivePointId(null)}
                  className="pointer-events-auto w-full"
                />
              </div>
            ) : null}

            {mapState.errorMessage ? (
              <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 rounded-2xl bg-white/94 px-3 py-2 text-xs font-medium text-amber-700 shadow-sm ring-1 ring-black/5 sm:left-auto sm:right-5 sm:max-w-sm">
                {mapState.errorMessage}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

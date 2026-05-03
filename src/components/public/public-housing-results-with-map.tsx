// UI component for public housing results with map in the public module.
"use client";

import { ChevronDown, ChevronUp, ExternalLink, X } from "lucide-react";
import {
  type CSSProperties,
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
import { useCatalogMapPlacement } from "@/hooks/use-catalog-map-placement";
import type { PublicCatalogItem } from "@/lib/public-properties";
import {
  setPublicMobileBottomNavForceHidden,
  setPublicMobileBottomNavProgress,
} from "@/lib/public-mobile-nav-visibility";
import {
  getKnownCrimeaLocationCenter,
  normalizeCrimeaLocationKey,
} from "@/lib/crimea-location-coordinates";
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
  totalCount?: number;
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

type LocationCenterResponse = {
  item?: {
    latitude?: number | null;
    longitude?: number | null;
    zoom?: number | null;
  } | null;
};

type MobileSheetSnap = "expanded" | "preview" | "collapsed";

type MobileSheetDragState = {
  pointerId: number;
  startY: number;
  startTop: number;
  didMove: boolean;
};

type MobileSheetSnaps = Record<MobileSheetSnap, number>;

const MOBILE_SHEET_HANDLE_HEIGHT = 76;
const MOBILE_SHEET_BOTTOM_CLEARANCE = -12;
const MOBILE_STAGE_MIN_HEIGHT = 360;
const MOBILE_STAGE_MAX_HEIGHT = 820;
const MOBILE_SHEET_CHROME_SCROLL_RANGE = 140;

function resolveLocationViewport(value: string | null | undefined): YandexMapViewport | null {
  const center = getKnownCrimeaLocationCenter(value);
  if (!center) {
    return null;
  }

  return { center: [center.latitude, center.longitude], zoom: center.zoom };
}

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

export function PublicHousingResultsWithMap({
  items,
  mapQuery,
  selectedLocationName,
  view = "list",
  searchGuests = null,
  hasMore,
  loadingMore,
  loadingInitial = false,
  totalCount,
  emptyContent = null,
  newItemIds = [],
  onLoadMore,
  onWishlistToggle,
}: PublicHousingResultsWithMapProps) {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const mobileStageRef = useRef<HTMLDivElement | null>(null);
  const mobileResultsScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileSheetDragRef = useRef<MobileSheetDragState | null>(null);
  const mobileSheetTopRef = useRef<number | null>(null);
  const mobileDragHandledRef = useRef(false);
  const mobileResultsScrollTopRef = useRef(0);
  const mobileChromeProgressRef = useRef(0);
  const mapPlacement = useCatalogMapPlacement();

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

  const [remoteLocationViewport, setRemoteLocationViewport] = useState<YandexMapViewport | null>(
    null,
  );
  const knownLocationViewport = useMemo(
    () => resolveLocationViewport(selectedLocation),
    [selectedLocation],
  );
  const locationViewport = knownLocationViewport ?? remoteLocationViewport;
  const viewportKey = useMemo(() => {
    const normalized = normalizeCrimeaLocationKey(selectedLocation);
    if (!locationViewport || !normalized) {
      return undefined;
    }

    const center = locationViewport.center;
    return [
      "housing",
      normalized,
      center?.[0] ?? "",
      center?.[1] ?? "",
      locationViewport.zoom ?? "",
    ].join(":");
  }, [locationViewport, selectedLocation]);
  const newIdsSet = useMemo(() => new Set(newItemIds), [newItemIds]);
  const eagerImageCount = view === "grid" ? 4 : 2;
  const deferredRenderThreshold = view === "grid" ? 6 : 4;

  const [isMapActivated, setIsMapActivated] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mobileSheetSnap, setMobileSheetSnap] = useState<MobileSheetSnap>("preview");
  const [mobileSheetTop, setMobileSheetTop] = useState<number | null>(null);
  const [mobileStageHeight, setMobileStageHeight] = useState(0);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [mapState, setMapState] = useState<MapState>(createInitialMapState);
  const [viewedPointIds, setViewedPointIds] = useState<Set<string>>(() => new Set());

  const closeMapFully = useCallback(() => {
    setIsMapExpanded(false);
    setIsMapActivated(true);
    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPointId(null);
  }, []);

  useEffect(() => {
    const normalized = normalizeCrimeaLocationKey(selectedLocation);

    if (!normalized || knownLocationViewport) {
      setRemoteLocationViewport(null);
      return;
    }

    const controller = new AbortController();
    setRemoteLocationViewport(null);

    const fetchLocationCenter = async () => {
      try {
        const response = await fetch(
          `/api/location-center?location=${encodeURIComponent(selectedLocation)}`,
          {
            signal: controller.signal,
            cache: "force-cache",
          },
        );

        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as LocationCenterResponse;
        const latitude = body.item?.latitude;
        const longitude = body.item?.longitude;

        if (
          typeof latitude !== "number" ||
          typeof longitude !== "number" ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          controller.signal.aborted
        ) {
          return;
        }

        setRemoteLocationViewport({
          center: [latitude, longitude],
          zoom:
            typeof body.item?.zoom === "number" && Number.isFinite(body.item.zoom)
              ? body.item.zoom
              : 12,
        });
      } catch {
        if (!controller.signal.aborted) {
          setRemoteLocationViewport(null);
        }
      }
    };

    void fetchLocationCenter();

    return () => {
      controller.abort();
    };
  }, [knownLocationViewport, selectedLocation]);

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

  const mapPoints = useMemo(() => {
    const sourcePoints =
      mapState.status === "ready" && mapState.points.length > 0 ? mapState.points : fallbackPoints;

    return sourcePoints.map((point) => sanitizePoint(point));
  }, [fallbackPoints, mapState.points, mapState.status]);

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
        isViewed: viewedPointIds.has(point.id),
      })),
    [pointsWithCoordinates, viewedPointIds],
  );

  const activePopupItem = activePointId ? (mapPointById.get(activePointId) ?? null) : null;
  const activeMapPointId = activePointId ?? hoveredCardId;
  const hasMapPoints = mapViewerPoints.length > 0;
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
    setIsMapActivated(true);
    setIsMapExpanded(false);
    setMobileSheetSnap("preview");
    setMobileSheetTop(null);
    mobileSheetTopRef.current = null;
    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPointId(null);
    setViewedPointIds(new Set());
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

      results.scrollTop = MOBILE_SHEET_HANDLE_HEIGHT;
      mobileResultsScrollTopRef.current = results.scrollTop;
      setMobileChromeProgress(0, true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isMapExpanded, mapPlacement, mobileSheetSnap, setMobileChromeProgress]);

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
    window.addEventListener("scroll", updateHeight, { passive: true });

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
      window.removeEventListener("scroll", updateHeight);
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

  function handleMapPointClick(pointId: string) {
    setActivePointId(pointId);
    setHoveredCardId(null);
    setHoveredPointId(null);
    setViewedPointIds((prev) => {
      if (prev.has(pointId)) {
        return prev;
      }

      const next = new Set(prev);
      next.add(pointId);
      return next;
    });

    if (mapPlacement === "mobile") {
      snapMobileSheet("collapsed");
    }
  }

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
      <span className="h-1 w-16 rounded-full bg-white/70 shadow-[0_1px_5px_rgba(255,255,255,0.72)] ring-1 ring-white/80" aria-hidden="true" />
      <span className="relative isolate inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,255,255,0.48)_52%,rgba(255,255,255,0.72))] px-4 py-2 text-sm font-semibold shadow-[0_18px_36px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-12px_24px_rgba(255,255,255,0.18)] ring-1 ring-white/72 backdrop-blur-xl">
        Найдено {foundCountLabel}
        <AppIcon
          icon={mobileSheetSnap === "expanded" ? ChevronDown : ChevronUp}
          className="h-4 w-4 text-olive/48"
        />
      </span>
    </button>
  );

  const resultsSection = (
    <section id="catalog-results" aria-busy={loadingInitial || loadingMore} className="space-y-4">
      <div
        className={cn(
          "grid gap-4 transition-all duration-300",
          view === "grid" ? "grid-cols-1 min-[480px]:grid-cols-2" : "grid-cols-1",
        )}
      >
        {loadingInitial && items.length === 0
          ? Array.from({ length: view === "grid" ? 4 : 3 }, (_, index) => (
              <SkeletonCard key={`initial-skeleton-${index}`} view={view} />
            ))
          : items.length === 0
            ? emptyContent
            : items.map((item, index) => {
                const isHighlighted = item.id === activePointId || item.id === hoveredPointId;
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
                    onMouseEnter={() => {
                      if (!mapPointById.has(item.id)) {
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
                );
              })}
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
  );

  return (
    <>
      <section className="space-y-4">
        {mapPlacement === "mobile" ? (
          <section ref={mobileStageRef} className="-mx-4 -mt-6 md:hidden">
            <div
              className="relative min-h-[360px] overflow-hidden bg-[#e7eef3]"
              style={{
                height: mobileStageHeight
                  ? `${mobileStageHeight}px`
                  : `min(${MOBILE_STAGE_MAX_HEIGHT}px, 100dvh)`,
              }}
            >
              <div className="absolute inset-0" onPointerDownCapture={handleMobileMapPointerDown}>
                <YandexMapMultiViewer
                  points={mapViewerPoints}
                  activePointId={activeMapPointId}
                  hoveredPointId={hoveredPointId}
                  onPointClick={handleMapPointClick}
                  onPointHoverChange={setHoveredPointId}
                  initialViewport={locationViewport}
                  viewportKey={viewportKey}
                  controls={[]}
                  showBalloons={false}
                  frameless
                  className="h-full w-full"
                />
              </div>

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
                      Найдено {foundCountLabel}
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
                    "overflow-y-auto overscroll-y-auto bg-[#f4f6fb] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)] shadow-[0_-18px_38px_rgba(15,23,42,0.15)] transition-opacity duration-150",
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
                  <div className="h-full" onPointerDownCapture={handleMobileMapPointerDown}>
                    <YandexMapMultiViewer
                      points={mapViewerPoints}
                      activePointId={activeMapPointId}
                      hoveredPointId={hoveredPointId}
                      onPointClick={handleMapPointClick}
                      onPointHoverChange={setHoveredPointId}
                      initialViewport={locationViewport}
                      viewportKey={viewportKey}
                      showBalloons={false}
                      frameless
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
                </div>
              </section>
            ) : null}

            <div className="catalog-layout grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,46vw)] xl:grid-cols-[minmax(0,1fr)_minmax(500px,48vw)] 2xl:grid-cols-[minmax(0,0.92fr)_minmax(560px,760px)]">
              {resultsSection}

              <aside className="catalog-map-sticky hidden self-start overflow-hidden lg:block lg:sticky lg:top-[96px] lg:h-[calc(100dvh-120px)] lg:min-h-[520px]">
                <section className="relative h-full overflow-hidden bg-[#e7eef3]">
                  {mapPlacement === "desktop" ? (
                    <>
                      <div
                        className="absolute inset-0"
                        onPointerDownCapture={handleMobileMapPointerDown}
                      >
                        <YandexMapMultiViewer
                          points={mapViewerPoints}
                          activePointId={activeMapPointId}
                          hoveredPointId={hoveredPointId}
                          onPointClick={handleMapPointClick}
                          onPointHoverChange={setHoveredPointId}
                          initialViewport={locationViewport}
                          viewportKey={viewportKey}
                          controls={["zoomControl"]}
                          showBalloons={false}
                          frameless
                          className="h-full w-full"
                        />
                      </div>

                      <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-start justify-end">
                        <button
                          type="button"
                          onClick={openMapFully}
                          className="pointer-events-auto inline-flex h-12 items-center gap-3 rounded-2xl bg-white px-4 text-sm font-semibold text-[#202124] shadow-[0_12px_28px_rgba(15,23,42,0.18)] ring-1 ring-black/5 transition hover:bg-white/96"
                          aria-label="Раскрыть карту полностью"
                        >
                          <AppIcon icon={ExternalLink} className="h-5 w-5" />
                          Раскрыть карту
                        </button>
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

                      {isMapActivated && mapState.status === "loading" ? (
                        <div className="pointer-events-none absolute bottom-3 left-3 z-20 inline-flex items-center gap-2 rounded-full bg-white/94 px-3 py-1.5 text-xs font-semibold text-olive shadow-sm ring-1 ring-black/5">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-olive/30 border-t-olive" />
                          Обновляем точки
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </section>
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
            <div className="absolute inset-0" onPointerDownCapture={handleMobileMapPointerDown}>
              <YandexMapMultiViewer
                points={mapViewerPoints}
                activePointId={activeMapPointId}
                hoveredPointId={hoveredPointId}
                onPointClick={handleMapPointClick}
                onPointHoverChange={setHoveredPointId}
                initialViewport={locationViewport}
                viewportKey={viewportKey}
                controls={["zoomControl"]}
                showBalloons={false}
                frameless
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

            {mapState.status === "loading" && !hasMapPoints ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/30 backdrop-blur-[1px]">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/94 px-3 py-1.5 text-xs font-semibold text-olive shadow-sm ring-1 ring-black/5">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-olive/30 border-t-olive" />
                  Загружаем точки
                </div>
              </div>
            ) : null}

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

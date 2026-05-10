"use client";

import { ChevronDown, ChevronUp, ExternalLink, Map as MapIcon, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent as ReactUIEvent,
} from "react";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import {
  YandexMapMultiViewer,
  type YandexMapPoint,
  type YandexMapRadiusCircle,
  type YandexMapViewport,
} from "@/components/maps/yandex-map-multi-viewer";
import { AppIcon } from "@/components/ui/app-icon";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useCatalogMapPlacement } from "@/hooks/use-catalog-map-placement";
import { cn } from "@/lib/cn";
import { formatPublicContactName, formatPublicPersonName } from "@/lib/public-display-name";
import {
  setPublicMobileBottomNavForceHidden,
  setPublicMobileBottomNavProgress,
} from "@/lib/public-mobile-nav-visibility";
import type {
  PublicAttractionCatalogItem,
  PublicAttractionCatalogResult,
  PublicAttractionMapItem,
  PublicTransferCatalogItem,
  PublicTransferCatalogResult,
} from "@/lib/public-marketplace";

type MarketplaceCatalogMapKind = "attractions" | "transfers";

type MarketplaceCatalogMapItem =
  | PublicAttractionCatalogItem
  | PublicAttractionMapItem
  | PublicTransferCatalogItem;

type MarketplaceCatalogMapFilters =
  | PublicAttractionCatalogResult["filters"]
  | PublicTransferCatalogResult["filters"];

type MarketplaceCatalogMapProps = {
  kind: MarketplaceCatalogMapKind;
  items: MarketplaceCatalogMapItem[];
  resultsCount?: number;
  filters: MarketplaceCatalogMapFilters;
  mapTitle: string;
  syncBoundsToUrl?: boolean;
  mapItemsEndpoint?: string | null;
  children: ReactNode;
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
const CATALOG_MAP_ITEM_SELECTOR = "[data-catalog-map-item-id]";
const MAP_BOUNDS_UPDATE_DELAY_MS = 1200;
const MAP_BOUNDS_PRECISION = 4;

const rubFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});
const ruPluralRules = new Intl.PluralRules("ru-RU");

function formatRuCount(value: number, one: string, few: string, many: string): string {
  const plural = ruPluralRules.select(Math.abs(value));
  const label = plural === "one" ? one : plural === "few" ? few : many;

  return `${rubFormatter.format(value)} ${label}`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function resolveCatalogLocationZoom(radiusKm: number): number {
  if (radiusKm <= 15) {
    return 13;
  }

  if (radiusKm <= 35) {
    return 12;
  }

  return 11;
}

function getNearestMobileSheetSnap(top: number, snaps: MobileSheetSnaps): MobileSheetSnap {
  return (Object.entries(snaps) as Array<[MobileSheetSnap, number]>).reduce(
    (nearest, entry) => (Math.abs(entry[1] - top) < Math.abs(nearest[1] - top) ? entry : nearest),
    ["preview", snaps.preview],
  )[0];
}

function getCatalogMapItemElement(
  target: EventTarget | null,
  boundary: HTMLElement,
): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const itemElement = target.closest<HTMLElement>(CATALOG_MAP_ITEM_SELECTOR);
  if (!itemElement || !boundary.contains(itemElement)) {
    return null;
  }

  return itemElement;
}

function formatMoney(value: number): string {
  return `${rubFormatter.format(Math.round(value))} ₽`;
}

function formatTransferPrice(value: number | null, unit: string | null): string {
  if (value === null) {
    return "Цена по запросу";
  }

  return `от ${formatMoney(value)}${unit ? ` ${unit}` : ""}`;
}

function formatReviewsLabel(value: number): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;

  if (abs > 10 && abs < 20) {
    return `${value} отзывов`;
  }
  if (mod > 1 && mod < 5) {
    return `${value} отзыва`;
  }
  if (mod === 1) {
    return `${value} отзыв`;
  }

  return `${value} отзывов`;
}

function compactText(value: string | null | undefined, limit: number): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1).trim()}…`;
}

function hasCoordinates(
  item: MarketplaceCatalogMapItem,
): item is MarketplaceCatalogMapItem & { latitude: number; longitude: number } {
  return (
    item.latitude !== null &&
    item.longitude !== null &&
    Number.isFinite(item.latitude) &&
    Number.isFinite(item.longitude)
  );
}

function getTransferVehicleLabel(item: PublicTransferCatalogItem): string {
  const primaryFleetItem = item.fleet[0] ?? null;
  const value =
    item.vehicleModel?.trim() ||
    item.vehicleClass?.trim() ||
    primaryFleetItem?.vehicleModel?.trim() ||
    primaryFleetItem?.vehicleClass?.trim() ||
    primaryFleetItem?.transportKind?.trim() ||
    item.transferType?.trim();

  return value || "Трансфер";
}

function buildMapPoint(
  kind: MarketplaceCatalogMapKind,
  item: MarketplaceCatalogMapItem & { latitude: number; longitude: number },
): YandexMapPoint {
  if (kind === "transfers") {
    const transfer = item as PublicTransferCatalogItem;

    return {
      id: transfer.id,
      title: transfer.title,
      latitude: item.latitude,
      longitude: item.longitude,
      priceLabel: transfer.priceFrom !== null ? formatMoney(transfer.priceFrom) : null,
      previewImageUrl: transfer.coverImageUrl,
      rating: transfer.avgRating > 0 ? transfer.avgRating : null,
      reviewsCount: transfer.reviewsCount,
    };
  }

  return {
    id: item.id,
    title: item.title,
    latitude: item.latitude,
    longitude: item.longitude,
    priceLabel: null,
    previewImageUrl: item.coverImageUrl,
    rating: null,
    reviewsCount: 0,
    balloonVariant: "title-only",
  };
}

function MapPopupCard({
  kind,
  item,
  className,
  onClose,
  variant = "default",
}: {
  kind: MarketplaceCatalogMapKind;
  item: MarketplaceCatalogMapItem;
  className?: string;
  onClose: () => void;
  variant?: "default" | "compact";
}) {
  if (kind === "transfers") {
    return (
      <TransferMapPopupCard
        item={item as PublicTransferCatalogItem}
        className={className}
        onClose={onClose}
        variant={variant}
      />
    );
  }

  return (
    <AttractionMapPopupCard
      item={item as PublicAttractionCatalogItem}
      className={className}
      onClose={onClose}
      variant={variant}
    />
  );
}

function PopupShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-olive/20 bg-white shadow-[0_18px_40px_rgba(17,29,16,0.28)]",
        className,
      )}
    >
      {children}
    </article>
  );
}

function AttractionMapPopupCard({
  item,
  className,
  onClose,
  variant = "default",
}: {
  item: PublicAttractionCatalogItem | PublicAttractionMapItem;
  className?: string;
  onClose: () => void;
  variant?: "default" | "compact";
}) {
  const locationLabel =
    [item.locationName, item.address].filter(Boolean).join(", ") || item.districtName || "Крым";

  const categoryLabel = item.category || item.tags[0] || null;
  const description = "description" in item ? item.description : null;
  const summaryLabel = compactText(item.shortDescription ?? description, 78);

  if (variant === "compact") {
    return (
      <article
        data-map-popup-card="true"
        className={cn(
          "relative overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_18px_38px_rgba(15,23,42,0.22)]",
          className,
        )}
      >
        <Link
          href={item.path}
          aria-label={`Открыть карточку ${item.title}`}
          className="absolute inset-0 z-0 rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2"
        />

        <div className="pointer-events-none relative z-10 flex min-h-[128px] gap-3 p-3">
          <div className="pointer-events-none relative h-[104px] w-[120px] shrink-0 overflow-hidden rounded-2xl bg-cream/65">
            {item.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.coverImageUrl}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-olive/55">
                Без фото
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 py-0.5 pr-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-xs font-medium text-olive/58">
                {categoryLabel || locationLabel}
              </span>
            </div>

            <h3 className="mt-2 line-clamp-2 text-[15px] font-bold leading-snug text-olive">
              {item.title}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-olive/55">{locationLabel}</p>
            {summaryLabel ? (
              <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug text-olive/56">
                {summaryLabel}
              </p>
            ) : null}
          </div>

          <div className="pointer-events-auto absolute left-4 top-4 z-20">
            <FavoriteToggleButton
              itemId={item.id}
              entityType="attraction"
              initialIsFavorite={false}
              variant="icon"
              className="h-8 w-8 shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-olive/70 shadow-sm backdrop-blur transition hover:text-olive"
            aria-label="Закрыть карточку"
          >
            <AppIcon icon={X} className="h-4 w-4" />
          </button>
        </div>
      </article>
    );
  }

  return (
    <PopupShell className={className}>
      <div className="relative h-36 bg-cream/65">
        {item.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverImageUrl}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-olive/60">
            Без фото
          </div>
        )}

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-2">
          <FavoriteToggleButton
            itemId={item.id}
            entityType="attraction"
            initialIsFavorite={false}
            variant="icon"
          />

          <button
            type="button"
            onClick={onClose}
            className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-full text-olive/90"
            aria-label="Закрыть карточку"
          >
            <AppIcon icon={X} className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-olive">
          {item.title}
        </h3>
        <p className="line-clamp-1 text-xs text-olive/68">{locationLabel}</p>

        <Link
          href={item.path}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-terra px-4 text-sm font-semibold text-white transition hover:bg-terra/88"
        >
          Подробнее
        </Link>
      </div>
    </PopupShell>
  );
}

function TransferMapPopupCard({
  item,
  className,
  onClose,
  variant = "default",
}: {
  item: PublicTransferCatalogItem;
  className?: string;
  onClose: () => void;
  variant?: "default" | "compact";
}) {
  const contactLabel = formatPublicContactName(
    item.contacts.contactName,
    formatPublicPersonName(item.owner, "Водитель"),
  );
  const locationLabel = item.locationName || item.districtName || item.serviceArea || "Крым";
  const vehicleLabel = getTransferVehicleLabel(item);
  const metaLabel =
    item.avgRating > 0 && item.reviewsCount > 0
      ? `Рейтинг ${item.avgRating.toFixed(1)} • ${formatReviewsLabel(item.reviewsCount)}`
      : compactText(item.routeExamples ?? item.serviceArea, 70) || vehicleLabel;
  const compactMetaLabel = compactText(item.routeExamples ?? item.serviceArea, 70);

  if (variant === "compact") {
    return (
      <article
        data-map-popup-card="true"
        className={cn(
          "relative overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_18px_38px_rgba(15,23,42,0.22)]",
          className,
        )}
      >
        <Link
          href={item.path}
          aria-label={`Открыть карточку ${item.title}`}
          className="absolute inset-0 z-0 rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2"
        />

        <div className="pointer-events-none relative z-10 flex min-h-[128px] gap-3 p-3">
          <div className="pointer-events-none relative h-[104px] w-[120px] shrink-0 overflow-hidden rounded-2xl bg-cream/65">
            {item.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.coverImageUrl}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-olive/55">
                Без фото
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 py-0.5 pr-1">
            <div className="flex min-w-0 items-center gap-2">
              {item.avgRating > 0 && item.reviewsCount > 0 ? (
                <>
                  <span className="inline-flex h-6 items-center rounded-lg bg-[#58a36b] px-2 text-xs font-bold leading-none text-white">
                    {item.avgRating.toFixed(1).replace(".", ",")}
                  </span>
                  <span className="truncate text-xs font-medium text-olive/58">
                    {formatReviewsLabel(item.reviewsCount)}
                  </span>
                </>
              ) : (
                <span className="truncate text-xs font-medium text-olive/58">{vehicleLabel}</span>
              )}
            </div>

            <h3 className="mt-2 line-clamp-2 text-[15px] font-bold leading-snug text-olive">
              {item.title}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-olive/55">
              {[contactLabel, locationLabel].filter(Boolean).join(" • ")}
            </p>
            <p className="mt-1.5 text-[15px] font-extrabold leading-tight text-olive">
              {formatTransferPrice(item.priceFrom, item.priceUnitLabel)}
              {compactMetaLabel ? (
                <span className="ml-1 text-[11px] font-medium text-olive/48">
                  {compactMetaLabel}
                </span>
              ) : null}
            </p>
          </div>

          <div className="pointer-events-auto absolute left-4 top-4 z-20">
            <FavoriteToggleButton
              itemId={item.id}
              entityType="transfer"
              initialIsFavorite={false}
              variant="icon"
              className="h-8 w-8 shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-olive/70 shadow-sm backdrop-blur transition hover:text-olive"
            aria-label="Закрыть карточку"
          >
            <AppIcon icon={X} className="h-4 w-4" />
          </button>
        </div>
      </article>
    );
  }

  return (
    <PopupShell className={className}>
      <div className="relative h-36 bg-cream/65">
        {item.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverImageUrl}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-olive/60">
            Без фото
          </div>
        )}

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-2">
          <FavoriteToggleButton
            itemId={item.id}
            entityType="transfer"
            initialIsFavorite={false}
            variant="icon"
          />

          <button
            type="button"
            onClick={onClose}
            className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-full text-olive/90"
            aria-label="Закрыть карточку"
          >
            <AppIcon icon={X} className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-olive">
          {item.title}
        </h3>
        <p className="line-clamp-1 text-xs text-olive/68">
          {[contactLabel, locationLabel].filter(Boolean).join(" • ")}
        </p>

        <div className="rounded-xl bg-cream/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-olive/60">Стоимость</p>
          <p className="mt-1 text-lg font-semibold leading-tight text-olive">
            {formatTransferPrice(item.priceFrom, item.priceUnitLabel)}
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-olive/68">{metaLabel}</p>
        </div>

        <Link
          href={item.path}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-terra px-4 text-sm font-semibold text-white transition hover:bg-terra/88"
        >
          Подробнее
        </Link>
      </div>
    </PopupShell>
  );
}

export function MarketplaceCatalogMap({
  kind,
  items,
  resultsCount,
  filters,
  mapTitle,
  syncBoundsToUrl = true,
  mapItemsEndpoint = null,
  children,
}: MarketplaceCatalogMapProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentBoundsParam = searchParams.get("bounds")?.trim() || null;
  const mobileStageRef = useRef<HTMLDivElement | null>(null);
  const mobileResultsScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileSheetDragRef = useRef<MobileSheetDragState | null>(null);
  const mobileSheetTopRef = useRef<number | null>(null);
  const mobileDragHandledRef = useRef(false);
  const mobileResultsScrollTopRef = useRef(0);
  const mobileChromeProgressRef = useRef(0);
  const boundsBootstrapHandledRef = useRef(false);
  const boundsUpdateTimerRef = useRef<number | null>(null);
  const lastRequestedBoundsRef = useRef<string | null>(currentBoundsParam);
  const mapPlacement = useCatalogMapPlacement();
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mobileSheetSnap, setMobileSheetSnap] = useState<MobileSheetSnap>("preview");
  const [mobileSheetTop, setMobileSheetTop] = useState<number | null>(null);
  const [mobileStageHeight, setMobileStageHeight] = useState(0);
  const [isMobileSheetDragging, setIsMobileSheetDragging] = useState(false);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [loadedMapItemsState, setLoadedMapItemsState] = useState<{
    endpoint: string;
    items: MarketplaceCatalogMapItem[];
  } | null>(null);
  const [viewedPointIds, setViewedPointIds] = useState<Set<string>>(() => new Set());
  useBodyScrollLock(mapExpanded);

  useEffect(() => {
    const endpoint = mapItemsEndpoint ?? "";
    if (!endpoint) {
      return;
    }

    let isDisposed = false;

    async function loadMapItems() {
      try {
        const response = await fetch(endpoint, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { items?: MarketplaceCatalogMapItem[] };
        if (!isDisposed && Array.isArray(payload.items)) {
          setLoadedMapItemsState({ endpoint, items: payload.items });
        }
      } catch {
        // The current page items remain usable if the expanded map payload fails.
      }
    }

    void loadMapItems();

    return () => {
      isDisposed = true;
    };
  }, [mapItemsEndpoint]);

  const loadedMapItems =
    loadedMapItemsState?.endpoint === mapItemsEndpoint ? loadedMapItemsState.items : null;
  const resolvedItems = loadedMapItems ?? items;

  useEffect(() => {
    const shouldHideNav =
      mapPlacement === "mobile" && (mapExpanded || mobileSheetSnap === "collapsed");

    setPublicMobileBottomNavForceHidden(`${kind}-catalog-map`, shouldHideNav);

    return () => {
      setPublicMobileBottomNavForceHidden(`${kind}-catalog-map`, false);
    };
  }, [kind, mapExpanded, mapPlacement, mobileSheetSnap]);

  const mapPoints = useMemo<YandexMapPoint[]>(() => {
    const centerLat = filters.centerLat;
    const centerLng = filters.centerLng;
    const radiusKm = Number.isFinite(filters.radiusKm) ? filters.radiusKm : null;
    const hasRadiusCenter =
      centerLat !== null &&
      centerLng !== null &&
      Number.isFinite(centerLat) &&
      Number.isFinite(centerLng);

    return resolvedItems
      .filter(
        (item): item is MarketplaceCatalogMapItem & { latitude: number; longitude: number } => {
          if (!hasCoordinates(item)) {
            return false;
          }

          if (hasRadiusCenter && radiusKm !== null) {
            return haversineKm(centerLat!, centerLng!, item.latitude, item.longitude) <= radiusKm;
          }

          return true;
        },
      )
      .map((item) => buildMapPoint(kind, item))
      .map((point) => ({
        ...point,
        isViewed: viewedPointIds.has(point.id),
      }));
  }, [filters.centerLat, filters.centerLng, filters.radiusKm, kind, resolvedItems, viewedPointIds]);

  const visibleMapPointIds = useMemo(
    () => new Set(mapPoints.map((point) => point.id)),
    [mapPoints],
  );
  const mapItemById = useMemo(
    () => new Map(resolvedItems.map((item) => [item.id, item])),
    [resolvedItems],
  );
  const activePopupItem =
    activePointId && visibleMapPointIds.has(activePointId)
      ? (mapItemById.get(activePointId) ?? null)
      : null;
  const highlightedMapPointId = hoveredPointId ?? hoveredCardId;
  const mapStatsLabel = `На карте: ${mapPoints.length}`;
  const foundCountLabel = formatRuCount(
    resultsCount ?? resolvedItems.length,
    "вариант",
    "варианта",
    "вариантов",
  );
  const mapPointCountLabel = formatRuCount(mapPoints.length, "точка", "точки", "точек");

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
  const resolvedMobileSheetTop =
    isMobileSheetDragging && mobileSheetTop !== null
      ? mobileSheetTop
      : mobileSheetSnaps[mobileSheetSnap];
  const mobileSheetVisibleHeight = Math.max(
    MOBILE_SHEET_HANDLE_HEIGHT,
    (mobileStageHeight || 640) - resolvedMobileSheetTop,
  );
  const mobilePopupBottom = clamp(mobileSheetVisibleHeight + 14, 92, 180);

  const radiusCircle = useMemo<YandexMapRadiusCircle | null>(() => {
    if (
      filters.centerLat !== null &&
      filters.centerLng !== null &&
      Number.isFinite(filters.centerLat) &&
      Number.isFinite(filters.centerLng)
    ) {
      return {
        center: [filters.centerLat, filters.centerLng],
        radiusKm: filters.radiusKm,
      };
    }

    return null;
  }, [filters.centerLat, filters.centerLng, filters.radiusKm]);
  const mapViewport = useMemo<YandexMapViewport | null>(() => {
    if (
      filters.centerLat !== null &&
      filters.centerLng !== null &&
      Number.isFinite(filters.centerLat) &&
      Number.isFinite(filters.centerLng)
    ) {
      return {
        center: [filters.centerLat, filters.centerLng],
        zoom: resolveCatalogLocationZoom(filters.radiusKm),
      };
    }

    return null;
  }, [filters.centerLat, filters.centerLng, filters.radiusKm]);
  const mapViewportKey = useMemo(() => {
    if (!mapViewport) {
      return undefined;
    }

    return [
      kind,
      filters.locationName ?? "",
      filters.centerLat,
      filters.centerLng,
      filters.radiusKm,
    ].join(":");
  }, [
    filters.centerLat,
    filters.centerLng,
    filters.locationName,
    filters.radiusKm,
    kind,
    mapViewport,
  ]);
  const openMapFully = useCallback(() => {
    setMapExpanded(true);
  }, []);

  const closeMapFully = useCallback(() => {
    setMapExpanded(false);
    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPointId(null);
  }, []);

  const handleMapBoundsChange = useCallback(
    (bounds: [[number, number], [number, number]] | null) => {
      if (!syncBoundsToUrl) {
        return;
      }

      const normalizedBounds = formatMapBoundsFilter(bounds);
      const lastRequestedBounds = lastRequestedBoundsRef.current;

      if (!boundsBootstrapHandledRef.current && !lastRequestedBounds) {
        boundsBootstrapHandledRef.current = true;
        return;
      }
      boundsBootstrapHandledRef.current = true;

      if (normalizedBounds === lastRequestedBounds) {
        return;
      }

      if (boundsUpdateTimerRef.current !== null) {
        window.clearTimeout(boundsUpdateTimerRef.current);
      }
      lastRequestedBoundsRef.current = normalizedBounds;

      boundsUpdateTimerRef.current = window.setTimeout(() => {
        boundsUpdateTimerRef.current = null;
        const nextParams = new URLSearchParams(window.location.search);
        const liveBounds = nextParams.get("bounds")?.trim() || null;

        if (liveBounds === normalizedBounds) {
          return;
        }

        if (normalizedBounds) {
          nextParams.set("bounds", normalizedBounds);
        } else {
          nextParams.delete("bounds");
        }
        nextParams.delete("page");

        const nextQuery = nextParams.toString();
        const nextPathname = window.location.pathname || pathname;
        router.replace(nextQuery ? `${nextPathname}?${nextQuery}` : nextPathname, {
          scroll: false,
        });
      }, MAP_BOUNDS_UPDATE_DELAY_MS);
    },
    [pathname, router, syncBoundsToUrl],
  );

  const setMobileChromeProgress = useCallback((progress: number, force = false) => {
    const nextProgress = clamp(Math.round(progress * 1000) / 1000, 0, 1);

    if (!force && Math.abs(mobileChromeProgressRef.current - nextProgress) < 0.004) {
      return;
    }

    mobileChromeProgressRef.current = nextProgress;
    setPublicMobileBottomNavProgress(nextProgress);
  }, []);

  const snapMobileSheet = useCallback(
    (snap: MobileSheetSnap) => {
      mobileSheetTopRef.current = mobileSheetSnaps[snap];
      setMobileSheetSnap(snap);
      setMobileSheetTop(mobileSheetSnaps[snap]);
    },
    [mobileSheetSnaps],
  );

  const handleMobileSheetPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      mobileSheetTopRef.current = resolvedMobileSheetTop;
      mobileSheetDragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startTop: resolvedMobileSheetTop,
        didMove: false,
      };
      setIsMobileSheetDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [resolvedMobileSheetTop],
  );

  const handleMobileSheetPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
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
    },
    [mobileSheetSnaps],
  );

  const handleMobileSheetPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const dragState = mobileSheetDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      mobileSheetDragRef.current = null;
      setIsMobileSheetDragging(false);

      if (!dragState.didMove) {
        return;
      }

      const currentTop =
        mobileSheetTopRef.current ?? mobileSheetTop ?? mobileSheetSnaps[mobileSheetSnap];
      const nextSnap = getNearestMobileSheetSnap(currentTop, mobileSheetSnaps);
      snapMobileSheet(nextSnap);
    },
    [mobileSheetSnap, mobileSheetSnaps, mobileSheetTop, snapMobileSheet],
  );

  const handleMobileSheetPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const dragState = mobileSheetDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      mobileSheetDragRef.current = null;
      setIsMobileSheetDragging(false);
      snapMobileSheet(mobileSheetSnap);
    },
    [mobileSheetSnap, snapMobileSheet],
  );

  const handleMobileSheetClick = useCallback(() => {
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
  }, [mobileSheetSnap, snapMobileSheet]);

  const handlePointClick = useCallback(
    (pointId: string) => {
      setViewedPointIds((prev) => {
        if (prev.has(pointId)) {
          return prev;
        }

        const next = new Set(prev);
        next.add(pointId);
        return next;
      });
      setActivePointId(pointId);
      setHoveredCardId(null);
      setHoveredPointId(null);

      if (mapPlacement === "mobile") {
        snapMobileSheet("collapsed");
      }
    },
    [mapPlacement, snapMobileSheet],
  );

  const openMobileMapInSearch = useCallback(() => {
    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPointId(null);
    setMobileChromeProgress(0, true);
    snapMobileSheet("collapsed");
  }, [setMobileChromeProgress, snapMobileSheet]);

  const handleMobileMapPointerDown = useCallback(() => {
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
  }, [mapPlacement, mobileSheetSnap, snapMobileSheet]);

  const handleCatalogCardMouseOver = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const itemElement = getCatalogMapItemElement(event.target, event.currentTarget);
      const pointId = itemElement?.dataset.catalogMapItemId ?? null;

      if (!pointId || !visibleMapPointIds.has(pointId)) {
        return;
      }

      setActivePointId(null);
      setHoveredPointId(null);
      setHoveredCardId((current) => (current === pointId ? current : pointId));
    },
    [visibleMapPointIds],
  );

  const handleCatalogCardMouseOut = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const itemElement = getCatalogMapItemElement(event.target, event.currentTarget);
    if (!itemElement) {
      return;
    }

    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && itemElement.contains(relatedTarget)) {
      return;
    }

    const pointId = itemElement.dataset.catalogMapItemId;
    setHoveredCardId((current) => (current === pointId ? null : current));
  }, []);

  useEffect(() => {
    if (!mapExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMapFully();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeMapFully, mapExpanded]);

  useEffect(() => {
    const shouldControlMobileChrome =
      mapPlacement === "mobile" && mobileSheetSnap === "expanded" && !mapExpanded;

    if (shouldControlMobileChrome) {
      mobileResultsScrollTopRef.current = mobileResultsScrollRef.current?.scrollTop ?? 0;
    }

    setMobileChromeProgress(0, true);
  }, [mapExpanded, mapPlacement, mobileSheetSnap, setMobileChromeProgress]);

  useEffect(() => {
    return () => {
      setPublicMobileBottomNavProgress(0);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (boundsUpdateTimerRef.current !== null) {
        window.clearTimeout(boundsUpdateTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    lastRequestedBoundsRef.current = currentBoundsParam;
    if (!currentBoundsParam) {
      boundsBootstrapHandledRef.current = false;
    }
  }, [currentBoundsParam, mapViewportKey]);

  useEffect(() => {
    if (mapPlacement !== "mobile" || mapExpanded || mobileSheetSnap !== "expanded") {
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
  }, [mapExpanded, mapPlacement, mobileSheetSnap, setMobileChromeProgress]);

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

  function handleMobileResultsScroll(event: ReactUIEvent<HTMLDivElement>) {
    const currentScrollTop = event.currentTarget.scrollTop;
    const previousScrollTop = mobileResultsScrollTopRef.current;
    mobileResultsScrollTopRef.current = currentScrollTop;

    if (mapPlacement !== "mobile" || mobileSheetSnap !== "expanded" || mapExpanded) {
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
    !mapExpanded &&
    mobileSheetSnap === "expanded" &&
    resolvedMobileSheetTop <= mobileSheetSnaps.expanded + 1;
  const isMobileMapCollapsed = mobileSheetSnap === "collapsed";
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
  );

  return (
    <>
      {mapPlacement === "mobile" ? (
        <section ref={mobileStageRef} className="-mx-4 -mt-2 md:hidden">
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
                points={mapPoints}
                activePointId={activePointId}
                hoveredPointId={highlightedMapPointId}
                onPointClick={handlePointClick}
                onPointHoverChange={setHoveredPointId}
                onBoundsChange={handleMapBoundsChange}
                initialViewport={mapViewport}
                viewportKey={mapViewportKey}
                radiusCircle={radiusCircle}
                controls={[]}
                showBalloons={false}
                frameless
                fitPointsOnChange="initial"
                className="h-full w-full"
              />
            </div>

            {activePopupItem && mobileSheetSnap !== "expanded" ? (
              <div
                className="pointer-events-none absolute inset-x-3 z-30 flex justify-center transition-[bottom] duration-200 ease-out"
                style={{ bottom: `${mobilePopupBottom}px` }}
              >
                <MapPopupCard
                  kind={kind}
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
                isMobileSheetDragging
                  ? "transition-none"
                  : "transition-transform duration-300 ease-out",
              )}
              style={{ transform: `translate3d(0, ${resolvedMobileSheetTop}px, 0)` }}
            >
              {!isMobileSheetExpanded ? <div className="md:hidden">{mobileSheetHandle}</div> : null}
              <div
                ref={mobileResultsScrollRef}
                onScroll={handleMobileResultsScroll}
                onMouseOver={handleCatalogCardMouseOver}
                onMouseOut={handleCatalogCardMouseOut}
                className={cn(
                  "overflow-y-auto overscroll-y-auto bg-[#f4f6fb] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)] shadow-[0_-18px_38px_rgba(15,23,42,0.15)] transition-opacity duration-150",
                  isMobileSheetExpanded
                    ? "h-full pt-0"
                    : "h-[calc(100%-76px)] rounded-t-[28px] pt-4",
                  mobileSheetSnap === "collapsed" ? "pointer-events-none opacity-0" : "opacity-100",
                )}
              >
                {isMobileSheetExpanded ? (
                  <>
                    <div className="-mx-4">{mobileSheetHandle}</div>
                    <div className="pt-4">{children}</div>
                  </>
                ) : (
                  children
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
      ) : null}

      {false && mapPlacement === "mobile" ? (
        <section className="-mx-4 -mt-2 overflow-hidden bg-[#e7eef3] md:hidden">
          <div
            className={cn(
              "relative transition-[height] duration-300 ease-out",
              isMobileMapCollapsed ? "h-[220px]" : "h-[42dvh] min-h-[310px] max-h-[520px]",
            )}
          >
            <YandexMapMultiViewer
              points={mapPoints}
              activePointId={activePointId}
              hoveredPointId={highlightedMapPointId}
              onPointClick={handlePointClick}
              onPointHoverChange={setHoveredPointId}
              onBoundsChange={handleMapBoundsChange}
              initialViewport={mapViewport}
              viewportKey={mapViewportKey}
              radiusCircle={radiusCircle}
              controls={[]}
              fitPointsOnChange="initial"
              className="h-full w-full rounded-none border-0"
            />

            <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
              <div className="min-w-0 rounded-[24px] bg-white/94 px-4 py-3 text-olive shadow-[0_16px_32px_rgba(15,23,42,0.14)] ring-1 ring-white/70 backdrop-blur">
                <p className="text-sm font-semibold leading-tight">{mapTitle}</p>
                <p className="mt-0.5 truncate text-xs text-olive/62">
                  {filters.locationName || "Крым"} · {mapPointCountLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={openMapFully}
                className="pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/94 text-olive shadow-[0_16px_32px_rgba(15,23,42,0.14)] ring-1 ring-white/70 backdrop-blur transition hover:bg-white"
                aria-label="Раскрыть карту полностью"
              >
                <AppIcon icon={MapIcon} className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {mapPlacement === "tablet" ? (
        <section className="mb-4 hidden overflow-hidden bg-[#e7eef3] md:block lg:hidden">
          <div className="hidden">
            <div>
              <p className="text-sm font-semibold text-olive">{mapTitle}</p>
              <p className="text-xs text-olive/65">{mapStatsLabel}</p>
            </div>
          </div>
          <div className="relative h-[320px] overflow-hidden">
            <YandexMapMultiViewer
              points={mapPoints}
              activePointId={activePointId}
              hoveredPointId={highlightedMapPointId}
              onPointClick={handlePointClick}
              onPointHoverChange={setHoveredPointId}
              onBoundsChange={handleMapBoundsChange}
              initialViewport={mapViewport}
              viewportKey={mapViewportKey}
              radiusCircle={radiusCircle}
              showBalloons={false}
              frameless
              fitPointsOnChange="initial"
              className="h-full w-full"
            />
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
          </div>
        </section>
      ) : null}

      <div
        onMouseOver={handleCatalogCardMouseOver}
        onMouseOut={handleCatalogCardMouseOut}
        className={cn(
          mapPlacement === "mobile"
            ? "hidden"
            : "catalog-layout grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,46vw)] xl:grid-cols-[minmax(0,1fr)_minmax(500px,48vw)] 2xl:grid-cols-[minmax(0,0.92fr)_minmax(560px,760px)]",
        )}
      >
        {mapPlacement === "mobile" ? (
          <div className="md:hidden">
            <button
              type="button"
              onClick={handleMobileSheetClick}
              onPointerDown={handleMobileSheetPointerDown}
              onPointerUp={handleMobileSheetPointerUp}
              className="flex w-full flex-col items-center gap-2 rounded-t-[26px] px-2 pb-3 pt-1 text-center text-olive"
              aria-expanded={!isMobileMapCollapsed}
              aria-controls="catalog-results"
            >
              <span className="h-1 w-16 rounded-full bg-olive/10" aria-hidden="true" />
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                Найдено {foundCountLabel}
                <AppIcon
                  icon={isMobileMapCollapsed ? ChevronDown : ChevronUp}
                  className="h-4 w-4 text-olive/48"
                />
              </span>
            </button>
          </div>
        ) : null}
        {children}

        <aside className="catalog-map-sticky map-column hidden self-start overflow-hidden lg:block lg:sticky lg:top-[96px] lg:h-[calc(100dvh-120px)] lg:min-h-[520px]">
          <section className="relative h-full overflow-hidden bg-[#e7eef3]">
            <div className="hidden">
              <div>
                <p className="text-sm font-semibold text-olive">{mapTitle}</p>
                <p className="text-xs text-olive/65">{mapStatsLabel}</p>
              </div>
            </div>

            {mapPlacement === "desktop" ? (
              <div className="absolute inset-0">
                <YandexMapMultiViewer
                  points={mapPoints}
                  activePointId={activePointId}
                  hoveredPointId={highlightedMapPointId}
                  onPointClick={handlePointClick}
                  onPointHoverChange={setHoveredPointId}
                  onBoundsChange={handleMapBoundsChange}
                  initialViewport={mapViewport}
                  viewportKey={mapViewportKey}
                  radiusCircle={radiusCircle}
                  controls={["zoomControl"]}
                  showBalloons={false}
                  frameless
                  fitPointsOnChange="initial"
                  className="h-full w-full"
                />

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
                    <MapPopupCard
                      kind={kind}
                      item={activePopupItem}
                      onClose={() => setActivePointId(null)}
                      className="pointer-events-auto w-full"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </aside>
      </div>

      {mapExpanded ? (
        <div
          id={`${kind}-catalog-map-modal`}
          className="fixed inset-0 z-[90] bg-[#e7eef3]"
          role="dialog"
          aria-modal="true"
          aria-label={mapTitle}
        >
          <section className="relative h-full w-full overflow-hidden">
            <div className="absolute inset-0">
              <YandexMapMultiViewer
                points={mapPoints}
                activePointId={activePointId}
                hoveredPointId={highlightedMapPointId}
                onPointClick={handlePointClick}
                onPointHoverChange={setHoveredPointId}
                onBoundsChange={handleMapBoundsChange}
                initialViewport={mapViewport}
                viewportKey={mapViewportKey}
                radiusCircle={radiusCircle}
                controls={["zoomControl"]}
                showBalloons={false}
                frameless
                fitPointsOnChange="initial"
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

            {activePopupItem ? (
              <div className="pointer-events-none absolute left-1/2 top-20 z-20 w-[312px] max-w-[calc(100%-24px)] -translate-x-1/2 sm:top-24">
                <MapPopupCard
                  kind={kind}
                  item={activePopupItem}
                  onClose={() => setActivePointId(null)}
                  className="pointer-events-auto w-full"
                />
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

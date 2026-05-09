"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type YandexMapPoint = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  priceLabel?: string | null;
  previewImageUrl?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  balloonVariant?: "details" | "title-only";
  isViewed?: boolean;
};

export type YandexMapViewport = {
  center?: [number, number];
  zoom?: number;
  bounds?: [[number, number], [number, number]];
};

export type YandexMapRadiusCircle = {
  center: [number, number];
  radiusKm: number;
};

type YandexMapMultiViewerProps = {
  points: YandexMapPoint[];
  activePointId?: string | null;
  hoveredPointId?: string | null;
  onPointClick?: (pointId: string) => void;
  onPointHoverChange?: (pointId: string | null) => void;
  className?: string;
  initialViewport?: YandexMapViewport | null;
  viewportKey?: string;
  radiusCircle?: YandexMapRadiusCircle | null;
  controls?: string[];
  showBalloons?: boolean;
  frameless?: boolean;
};

type YandexMapInstance = {
  destroy: () => void;
  setCenter: (center: [number, number], zoom?: number, options?: unknown) => void;
  setBounds: (bounds: [[number, number], [number, number]], options?: unknown) => void;
  container: {
    fitToViewport: () => void;
  };
  events: {
    add: (event: string, callback: (event: { get: (name: string) => unknown }) => void) => void;
  };
  geoObjects: {
    add: (value: unknown) => void;
    remove: (value: unknown) => void;
    removeAll: () => void;
  };
};

type YandexPlacemarkInstance = {
  events: {
    add: (
      event: "click" | "mouseenter" | "mouseleave",
      callback: (event: { get: (name: string) => unknown }) => void,
    ) => void;
  };
  balloon?: {
    open: () => void;
    close: () => void;
    isOpen: () => boolean;
  };
  options: {
    set: (name: string, value: unknown) => void;
  };
};

type YandexClustererInstance = {
  add: (objects: unknown[]) => void;
  removeAll: () => void;
};

type YandexApi = {
  ready: (callback: () => void) => void;
  Map: new (element: HTMLElement, state: unknown, options?: unknown) => YandexMapInstance;
  Placemark: new (
    coordinates: [number, number],
    properties: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => YandexPlacemarkInstance;
  Clusterer: new (options?: Record<string, unknown>) => YandexClustererInstance;
  Circle: new (
    geometry: [[number, number], number],
    properties: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => unknown;
  templateLayoutFactory: {
    createClass: (template: string) => unknown;
  };
};

type PriceLayouts = {
  default: unknown;
  viewed: unknown;
  hover: unknown;
  active: unknown;
};

type BalloonContentLayouts = {
  details: unknown;
  titleOnly: unknown;
};

const DEFAULT_CENTER: [number, number] = [44.9482, 34.1003];
const DEFAULT_ZOOM = 8;
const SINGLE_POINT_ZOOM = 13;
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const FALLBACK_PREVIEW_IMAGE_URL = "/crimea-map-preview.svg";
const PRICE_MARKER_WIDTH = 144;
const PRICE_MARKER_HEIGHT = 36;
const PRICE_MARKER_HIT_PADDING_X = 8;
const PRICE_MARKER_HIT_PADDING_Y = 6;
const BALLOON_CLOSE_DELAY_MS = 180;
const PRICE_BALLOON_GAP_PX = 6;
const DOT_BALLOON_OFFSET: [number, number] = [0, -12];

let scriptPromise: Promise<void> | null = null;

function getYandexApi(): YandexApi | undefined {
  return (window as Window & { ymaps?: YandexApi }).ymaps;
}

function loadYandexScript(apiKey: string): Promise<void> {
  if (getYandexApi()) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-yandex-maps="true"]');

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load script")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.defer = true;
    script.dataset.yandexMaps = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load script"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function createPriceLayout(ymaps: YandexApi, style: string): unknown {
  return ymaps.templateLayoutFactory.createClass(
    `<div style="${style}">$[properties.iconContent]</div>`,
  );
}

function createBalloonContentLayout(ymaps: YandexApi): unknown {
  const fontFamily = "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;";

  return ymaps.templateLayoutFactory.createClass(`<div style="pointer-events:none;">
    <div style="width:272px;display:flex;align-items:stretch;gap:10px;padding:10px;background:#ffffff;border:1px solid rgba(15,23,42,0.08);border-radius:14px;box-shadow:0 14px 28px rgba(15,23,42,0.20);">
      <div style="width:66px;height:66px;flex:0 0 auto;overflow:hidden;border-radius:10px;background:#eef2f7;">
        <img src="$[properties.balloonImageUrl]" alt="" style="display:block;width:100%;height:100%;object-fit:cover;" />
      </div>
      <div style="min-width:0;flex:1;">
        <div style="${fontFamily}font-size:14px;line-height:1.2;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">$[properties.balloonTitle]</div>
        <div style="display:flex;align-items:center;gap:7px;margin-top:5px;">
          <span style="${fontFamily}display:inline-flex;min-width:30px;height:21px;padding:0 7px;align-items:center;justify-content:center;gap:3px;border-radius:7px;background:#19a35b;font-size:12px;line-height:1;font-weight:700;color:#ffffff;">
            <span style="font-size:10px;line-height:1;">&#9733;</span>
            <span>$[properties.balloonRatingLabel]</span>
          </span>
          <span style="${fontFamily}font-size:12px;line-height:1.2;font-weight:500;color:#4b5563;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">$[properties.balloonReviewsLabel]</span>
        </div>
        <div style="${fontFamily}margin-top:7px;font-size:13px;line-height:1.2;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">$[properties.balloonPriceLabel]</div>
      </div>
    </div>
  </div>`);
}

function createTitleOnlyBalloonContentLayout(ymaps: YandexApi): unknown {
  const fontFamily = "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;";

  return ymaps.templateLayoutFactory.createClass(`<div style="pointer-events:none;">
    <div style="max-width:240px;padding:9px 12px;background:#ffffff;border:1px solid rgba(15,23,42,0.08);border-radius:12px;box-shadow:0 12px 24px rgba(15,23,42,0.18);">
      <div style="${fontFamily}font-size:14px;line-height:1.25;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">$[properties.balloonTitle]</div>
    </div>
  </div>`);
}

function buildBalloonContentFallbackHtml(input: {
  title: string;
  imageUrl: string;
  ratingLabel: string;
  reviewsLabel: string;
  priceLabel: string;
}): string {
  const fontFamily = "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;";

  return `<div style="width:272px;display:flex;align-items:stretch;gap:10px;padding:10px;background:#ffffff;border:1px solid rgba(15,23,42,0.08);border-radius:14px;box-shadow:0 14px 28px rgba(15,23,42,0.20);">
    <div style="width:66px;height:66px;flex:0 0 auto;overflow:hidden;border-radius:10px;background:#eef2f7;">
      <img src="${input.imageUrl}" alt="" style="display:block;width:100%;height:100%;object-fit:cover;" />
    </div>
    <div style="min-width:0;flex:1;">
      <div style="${fontFamily}font-size:14px;line-height:1.2;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${input.title}</div>
      <div style="display:flex;align-items:center;gap:7px;margin-top:5px;">
        <span style="${fontFamily}display:inline-flex;min-width:30px;height:21px;padding:0 7px;align-items:center;justify-content:center;gap:3px;border-radius:7px;background:#19a35b;font-size:12px;line-height:1;font-weight:700;color:#ffffff;">
          <span style="font-size:10px;line-height:1;">&#9733;</span>
          <span>${input.ratingLabel}</span>
        </span>
        <span style="${fontFamily}font-size:12px;line-height:1.2;font-weight:500;color:#4b5563;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${input.reviewsLabel}</span>
      </div>
      <div style="${fontFamily}margin-top:7px;font-size:13px;line-height:1.2;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${input.priceLabel}</div>
    </div>
  </div>`;
}

function buildTitleOnlyBalloonContentFallbackHtml(input: { title: string }): string {
  const fontFamily = "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;";

  return `<div style="max-width:240px;padding:9px 12px;background:#ffffff;border:1px solid rgba(15,23,42,0.08);border-radius:12px;box-shadow:0 12px 24px rgba(15,23,42,0.18);">
    <div style="${fontFamily}font-size:14px;line-height:1.25;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${input.title}</div>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolvePreviewImageUrl(value: string | null | undefined): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : FALLBACK_PREVIEW_IMAGE_URL;
}

function formatReviewsCount(value: number): string {
  const count = Math.max(0, Math.floor(value));
  const mod100 = count % 100;
  const mod10 = count % 10;

  let tail = "отзывов";
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) {
      tail = "отзыв";
    } else if (mod10 >= 2 && mod10 <= 4) {
      tail = "отзыва";
    }
  }

  return `${count} ${tail}`;
}

function buildPricePlacemarkOptions(input: {
  point: YandexMapPoint;
  activePointId: string | null;
  hoveredPointId: string | null;
  layouts: PriceLayouts;
}): Record<string, unknown> {
  const isActive = input.point.id === input.activePointId;
  const isHovered = input.point.id === input.hoveredPointId && !isActive;
  const isViewed = input.point.isViewed === true && !isActive && !isHovered;

  return {
    iconLayout: "default#imageWithContent",
    iconImageHref: TRANSPARENT_PIXEL,
    iconImageSize: [1, 1],
    iconImageOffset: [0, 0],
    iconContentLayout: isActive
      ? input.layouts.active
      : isHovered
        ? input.layouts.hover
        : isViewed
          ? input.layouts.viewed
          : input.layouts.default,
    iconContentOffset: [-PRICE_MARKER_WIDTH / 2, -PRICE_MARKER_HEIGHT / 2],
    iconContentSize: [PRICE_MARKER_WIDTH, PRICE_MARKER_HEIGHT],
    iconShape: {
      type: "Rectangle",
      coordinates: [
        [
          -(PRICE_MARKER_WIDTH / 2 + PRICE_MARKER_HIT_PADDING_X),
          -(PRICE_MARKER_HEIGHT / 2 + PRICE_MARKER_HIT_PADDING_Y),
        ],
        [
          PRICE_MARKER_WIDTH / 2 + PRICE_MARKER_HIT_PADDING_X,
          PRICE_MARKER_HEIGHT / 2 + PRICE_MARKER_HIT_PADDING_Y,
        ],
      ],
    },
    cursor: "pointer",
    zIndex: isActive ? 1400 : isHovered ? 1300 : 1000,
  };
}

function buildBalloonPlacemarkOptions(input: {
  isPricePlacemark: boolean;
  balloonContentLayout: unknown;
}): Record<string, unknown> {
  return {
    hasBalloon: true,
    openEmptyBalloon: true,
    balloonShadow: false,
    balloonContentLayout: input.balloonContentLayout,
    balloonCloseButton: false,
    hideIconOnBalloonOpen: false,
    balloonAutoPan: false,
    balloonPanelMaxMapArea: 0,
    balloonOffset: input.isPricePlacemark
      ? [0, -(Math.round(PRICE_MARKER_HEIGHT / 2) + PRICE_BALLOON_GAP_PX)]
      : DOT_BALLOON_OFFSET,
  };
}

function buildDotPlacemarkOptions(input: {
  pointId: string;
  activePointId: string | null;
  hoveredPointId: string | null;
  isViewed?: boolean;
}): Record<string, unknown> {
  const isActive = input.pointId === input.activePointId;
  const isHovered = input.pointId === input.hoveredPointId && !isActive;
  const isViewed = input.isViewed === true && !isActive && !isHovered;

  return {
    preset: isActive
      ? "islands#darkBlueCircleDotIcon"
      : isHovered
        ? "islands#blueCircleDotIcon"
        : isViewed
          ? "islands#grayCircleDotIcon"
          : "islands#brownCircleDotIcon",
    zIndex: isActive ? 1400 : isHovered ? 1300 : 1000,
  };
}

function isPlacemarkBalloonOpen(placemark: YandexPlacemarkInstance): boolean {
  return placemark.balloon?.isOpen?.() === true;
}

function closePlacemarkBalloon(placemark: YandexPlacemarkInstance): void {
  if (isPlacemarkBalloonOpen(placemark)) {
    placemark.balloon?.close();
  }
}

function applyViewport(map: YandexMapInstance, viewport?: YandexMapViewport | null) {
  if (viewport?.bounds) {
    map.setBounds(viewport.bounds, {
      checkZoomRange: true,
      zoomMargin: 44,
      duration: 220,
    });
    return;
  }

  if (viewport?.center) {
    map.setCenter(viewport.center, viewport.zoom ?? DEFAULT_ZOOM, { duration: 220 });
    return;
  }

  map.setCenter(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 220 });
}

function fitPoints(map: YandexMapInstance, points: YandexMapPoint[]) {
  if (points.length === 0) {
    map.setCenter(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 220 });
    return;
  }

  if (points.length === 1) {
    map.setCenter([points[0].latitude, points[0].longitude], SINGLE_POINT_ZOOM, {
      duration: 220,
    });
    return;
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);

  map.setBounds(
    [
      [Math.min(...latitudes), Math.min(...longitudes)],
      [Math.max(...latitudes), Math.max(...longitudes)],
    ],
    {
      checkZoomRange: true,
      zoomMargin: 44,
      duration: 220,
    },
  );
}

export function YandexMapMultiViewer({
  points,
  activePointId = null,
  hoveredPointId = null,
  onPointClick,
  onPointHoverChange,
  className = "h-[560px] w-full",
  initialViewport,
  viewportKey,
  radiusCircle = null,
  controls,
  showBalloons = true,
  frameless = false,
}: YandexMapMultiViewerProps) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YandexMapInstance | null>(null);
  const clustererRef = useRef<YandexClustererInstance | null>(null);
  const placemarkByIdRef = useRef<Map<string, YandexPlacemarkInstance>>(new Map());
  const mapCreatedRef = useRef(false);
  const pointsSignatureRef = useRef("");
  const appliedViewportKeyRef = useRef<string | null>(null);
  const lastCenteredActiveRef = useRef<string | null>(null);
  const clickHandlerRef = useRef(onPointClick);
  const hoverHandlerRef = useRef(onPointHoverChange);
  const showBalloonsRef = useRef(showBalloons);
  const priceLayoutsRef = useRef<PriceLayouts | null>(null);
  const balloonContentLayoutsRef = useRef<BalloonContentLayouts | null>(null);
  const closeBalloonTimerByPointIdRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const openedBalloonPointIdRef = useRef<string | null>(null);
  const hoverEnabledRef = useRef(true);
  const circleRef = useRef<unknown>(null);
  const [error, setError] = useState("");
  const [mapReadyVersion, setMapReadyVersion] = useState(0);
  const controlsSignature = useMemo(
    () => (controls ?? ["zoomControl", "fullscreenControl"]).join("|"),
    [controls],
  );

  const normalizedPoints = useMemo(() => {
    const seen = new Set<string>();

    return points.filter((point) => {
      if (
        !Number.isFinite(point.latitude) ||
        !Number.isFinite(point.longitude) ||
        point.latitude < -90 ||
        point.latitude > 90 ||
        point.longitude < -180 ||
        point.longitude > 180
      ) {
        return false;
      }

      if (seen.has(point.id)) {
        return false;
      }

      seen.add(point.id);
      return true;
    });
  }, [points]);

  const pointById = useMemo(
    () => new Map(normalizedPoints.map((point) => [point.id, point])),
    [normalizedPoints],
  );

  useEffect(() => {
    clickHandlerRef.current = onPointClick;
  }, [onPointClick]);

  useEffect(() => {
    hoverHandlerRef.current = onPointHoverChange;
  }, [onPointHoverChange]);

  const clearBalloonCloseTimer = useCallback((pointId: string) => {
    const timer = closeBalloonTimerByPointIdRef.current.get(pointId);
    if (timer === undefined) {
      return;
    }

    clearTimeout(timer);
    closeBalloonTimerByPointIdRef.current.delete(pointId);
  }, []);

  const closeBalloonForPoint = useCallback(
    (pointId: string) => {
      clearBalloonCloseTimer(pointId);
      const placemark = placemarkByIdRef.current.get(pointId);
      if (placemark) {
        closePlacemarkBalloon(placemark);
      }

      if (openedBalloonPointIdRef.current === pointId) {
        openedBalloonPointIdRef.current = null;
      }
    },
    [clearBalloonCloseTimer],
  );

  const closeAllBalloons = useCallback(() => {
    closeBalloonTimerByPointIdRef.current.forEach((timer) => {
      clearTimeout(timer);
    });
    closeBalloonTimerByPointIdRef.current.clear();

    placemarkByIdRef.current.forEach((placemark) => {
      closePlacemarkBalloon(placemark);
    });

    openedBalloonPointIdRef.current = null;
  }, []);

  useEffect(() => {
    showBalloonsRef.current = showBalloons;
    if (!showBalloons) {
      closeAllBalloons();
    }
  }, [closeAllBalloons, showBalloons]);

  const openBalloonForPoint = useCallback(
    (pointId: string) => {
      clearBalloonCloseTimer(pointId);

      const openedPointId = openedBalloonPointIdRef.current;
      if (openedPointId && openedPointId !== pointId) {
        closeBalloonForPoint(openedPointId);
      }

      const placemark = placemarkByIdRef.current.get(pointId);
      if (!placemark) {
        return;
      }

      if (!isPlacemarkBalloonOpen(placemark)) {
        placemark.balloon?.open();
      }
      openedBalloonPointIdRef.current = pointId;
    },
    [clearBalloonCloseTimer, closeBalloonForPoint],
  );

  const scheduleBalloonClose = useCallback(
    (pointId: string) => {
      clearBalloonCloseTimer(pointId);

      const timer = setTimeout(() => {
        closeBalloonForPoint(pointId);
      }, BALLOON_CLOSE_DELAY_MS);

      closeBalloonTimerByPointIdRef.current.set(pointId, timer);
    },
    [clearBalloonCloseTimer, closeBalloonForPoint],
  );

  const updateMarkerStyles = useCallback(() => {
    const layouts = priceLayoutsRef.current;
    if (!layouts) {
      return;
    }

    placemarkByIdRef.current.forEach((placemark, pointId) => {
      const point = pointById.get(pointId);
      if (!point) {
        return;
      }

      const hasPriceLabel =
        typeof point.priceLabel === "string" && point.priceLabel.trim().length > 0;

      if (hasPriceLabel) {
        const isActive = point.id === activePointId;
        const isHovered = point.id === hoveredPointId && !isActive;
        const isViewed = point.isViewed === true && !isActive && !isHovered;

        placemark.options.set(
          "iconContentLayout",
          isActive
            ? layouts.active
            : isHovered
              ? layouts.hover
              : isViewed
                ? layouts.viewed
                : layouts.default,
        );
        placemark.options.set("zIndex", isActive ? 1400 : isHovered ? 1300 : 1000);
        return;
      }

      const nextDotOptions = buildDotPlacemarkOptions({
        pointId,
        activePointId,
        hoveredPointId,
        isViewed: point.isViewed,
      });
      placemark.options.set("preset", nextDotOptions.preset);
      placemark.options.set("zIndex", nextDotOptions.zIndex);
    });
  }, [activePointId, hoveredPointId, pointById]);

  useEffect(() => {
    if (!apiKey || !containerRef.current) {
      return;
    }

    let mounted = true;
    const placemarkStore = placemarkByIdRef.current;

    const setupMap = async () => {
      try {
        await loadYandexScript(apiKey);
        const ymaps = getYandexApi();

        if (!mounted || !containerRef.current || !ymaps) {
          return;
        }

        ymaps.ready(() => {
          const readyYmaps = getYandexApi();
          if (!mounted || !containerRef.current || !readyYmaps) {
            return;
          }

          const map = new readyYmaps.Map(
            containerRef.current,
            {
              center: DEFAULT_CENTER,
              zoom: DEFAULT_ZOOM,
              controls: controlsSignature ? controlsSignature.split("|") : [],
            },
            { suppressMapOpenBlock: true },
          );

          const clusterer = new readyYmaps.Clusterer({
            clusterDisableClickZoom: false,
            clusterOpenBalloonOnClick: false,
            groupByCoordinates: false,
          });

          map.geoObjects.add(clusterer);

          const layoutBaseStyle =
            "display:inline-flex;align-items:center;justify-content:center;min-width:56px;height:32px;padding:0 11px;border-radius:999px;background:#ffffff;box-shadow:0 8px 18px rgba(15,23,42,0.16);font:700 12px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#111827;white-space:nowrap;transition:transform .16s ease,box-shadow .16s ease,background .16s ease,color .16s ease;";

          priceLayoutsRef.current = {
            default: createPriceLayout(
              readyYmaps,
              `${layoutBaseStyle}border:1px solid rgba(17,24,39,0.16);`,
            ),
            viewed: createPriceLayout(
              readyYmaps,
              `${layoutBaseStyle}background:#e7e9ee;border:1px solid rgba(17,24,39,0.06);color:#707781;box-shadow:0 7px 15px rgba(15,23,42,0.10);`,
            ),
            hover: createPriceLayout(
              readyYmaps,
              `${layoutBaseStyle}border:1.8px solid rgba(17,24,39,0.22);transform:scale(1.06);box-shadow:0 12px 24px rgba(15,23,42,0.22);`,
            ),
            active: createPriceLayout(
              readyYmaps,
              `${layoutBaseStyle}background:#202124;border:2px solid #202124;color:#ffffff;transform:scale(1.1);box-shadow:0 14px 28px rgba(15,23,42,0.34),0 0 0 8px rgba(32,33,36,0.14);`,
            ),
          };
          balloonContentLayoutsRef.current = {
            details: createBalloonContentLayout(readyYmaps),
            titleOnly: createTitleOnlyBalloonContentLayout(readyYmaps),
          };
          hoverEnabledRef.current = window.matchMedia("(hover: hover)").matches;

          map.events.add("click", (event) => {
            if (hoverEnabledRef.current) {
              return;
            }

            if (event.get("target") !== map) {
              return;
            }

            closeAllBalloons();
            hoverHandlerRef.current?.(null);
          });

          mapRef.current = map;
          clustererRef.current = clusterer;
          mapCreatedRef.current = true;
          setMapReadyVersion((value) => value + 1);
          setError("");
        });
      } catch {
        setError("Не удалось загрузить карту. Проверьте ключ и подключение к сети.");
      }
    };

    void setupMap();

    return () => {
      mounted = false;
      mapRef.current?.destroy();
      mapRef.current = null;
      clustererRef.current = null;
      closeAllBalloons();
      placemarkStore.clear();
      mapCreatedRef.current = false;
      pointsSignatureRef.current = "";
      appliedViewportKeyRef.current = null;
      lastCenteredActiveRef.current = null;
      priceLayoutsRef.current = null;
      balloonContentLayoutsRef.current = null;
    };
  }, [apiKey, closeAllBalloons, controlsSignature]);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = getYandexApi();
    const clusterer = clustererRef.current;
    const layouts = priceLayoutsRef.current;
    const balloonContentLayouts = balloonContentLayoutsRef.current;

    if (
      !map ||
      !ymaps ||
      !clusterer ||
      !layouts ||
      !balloonContentLayouts ||
      !mapCreatedRef.current
    ) {
      return;
    }

    closeAllBalloons();
    clusterer.removeAll();
    placemarkByIdRef.current.clear();

    const placemarks: YandexPlacemarkInstance[] = normalizedPoints.map((point) => {
      const hasPriceLabel =
        typeof point.priceLabel === "string" && point.priceLabel.trim().length > 0;
      const rating =
        typeof point.rating === "number" && Number.isFinite(point.rating) && point.rating > 0
          ? Math.min(5, point.rating)
          : null;
      const reviewsCount =
        typeof point.reviewsCount === "number" && Number.isFinite(point.reviewsCount)
          ? point.reviewsCount
          : 0;
      const safeTitle = escapeHtml(point.title.trim().length > 0 ? point.title : "Объект");
      const safePriceLabel = escapeHtml(
        hasPriceLabel ? `от ${point.priceLabel}` : "цена уточняется",
      );
      const safeImageUrl = escapeHtml(resolvePreviewImageUrl(point.previewImageUrl));
      const safeRatingLabel = escapeHtml(rating !== null ? rating.toFixed(1) : "—");
      const safeReviewsLabel = escapeHtml(formatReviewsCount(reviewsCount));
      const isTitleOnlyBalloon = point.balloonVariant === "title-only";
      const balloonContentLayout = isTitleOnlyBalloon
        ? balloonContentLayouts.titleOnly
        : balloonContentLayouts.details;
      const balloonOptions = showBalloonsRef.current
        ? buildBalloonPlacemarkOptions({
            isPricePlacemark: hasPriceLabel,
            balloonContentLayout,
          })
        : {
            hasBalloon: false,
            openEmptyBalloon: false,
          };
      const balloonFallbackHtml = isTitleOnlyBalloon
        ? buildTitleOnlyBalloonContentFallbackHtml({ title: safeTitle })
        : buildBalloonContentFallbackHtml({
            title: safeTitle,
            imageUrl: safeImageUrl,
            ratingLabel: safeRatingLabel,
            reviewsLabel: safeReviewsLabel,
            priceLabel: safePriceLabel,
          });

      const placemark = new ymaps.Placemark(
        [point.latitude, point.longitude],
        {
          balloonContent: balloonFallbackHtml,
          balloonContentBody: balloonFallbackHtml,
          iconContent: hasPriceLabel ? point.priceLabel : "",
          balloonTitle: safeTitle,
          balloonPriceLabel: safePriceLabel,
          balloonImageUrl: safeImageUrl,
          balloonRatingLabel: safeRatingLabel,
          balloonReviewsLabel: safeReviewsLabel,
        },
        hasPriceLabel
          ? {
              ...buildPricePlacemarkOptions({
                point,
                activePointId: null,
                hoveredPointId: null,
                layouts,
              }),
              ...balloonOptions,
            }
          : {
              ...buildDotPlacemarkOptions({
                pointId: point.id,
                activePointId: null,
                hoveredPointId: null,
                isViewed: point.isViewed,
              }),
              ...balloonOptions,
              cursor: "pointer",
            },
      );

      placemark.events.add("click", () => {
        clickHandlerRef.current?.(point.id);

        if (!showBalloonsRef.current) {
          closeAllBalloons();
          return;
        }

        if (hoverEnabledRef.current) {
          openBalloonForPoint(point.id);
          return;
        }

        if (isPlacemarkBalloonOpen(placemark)) {
          closeBalloonForPoint(point.id);
          return;
        }

        openBalloonForPoint(point.id);
      });
      placemark.events.add("mouseenter", () => {
        if (!hoverEnabledRef.current) {
          return;
        }

        if (showBalloonsRef.current) {
          openBalloonForPoint(point.id);
        }
        hoverHandlerRef.current?.(point.id);
      });
      placemark.events.add("mouseleave", () => {
        if (!hoverEnabledRef.current) {
          return;
        }

        if (showBalloonsRef.current) {
          scheduleBalloonClose(point.id);
        }
        hoverHandlerRef.current?.(null);
      });

      placemarkByIdRef.current.set(point.id, placemark);
      return placemark;
    });

    if (placemarks.length > 0) {
      clusterer.add(placemarks);
    }

    const signature = normalizedPoints
      .map((point) => `${point.id}:${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`)
      .join("|");
    const pointsChanged = signature !== pointsSignatureRef.current;
    pointsSignatureRef.current = signature;
    lastCenteredActiveRef.current = null;

    const canApplyViewport =
      Boolean(initialViewport) &&
      Boolean(viewportKey) &&
      appliedViewportKeyRef.current !== viewportKey;
    const hasPinnedViewport = Boolean(initialViewport) && Boolean(viewportKey);

    if (normalizedPoints.length === 0) {
      applyViewport(map, initialViewport);
      if (viewportKey) {
        appliedViewportKeyRef.current = viewportKey;
      }
      return;
    }

    if (canApplyViewport) {
      applyViewport(map, initialViewport);
      appliedViewportKeyRef.current = viewportKey ?? null;
      return;
    }

    if (pointsChanged && !hasPinnedViewport) {
      fitPoints(map, normalizedPoints);
    }
  }, [
    closeAllBalloons,
    closeBalloonForPoint,
    initialViewport,
    mapReadyVersion,
    normalizedPoints,
    openBalloonForPoint,
    scheduleBalloonClose,
    viewportKey,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = getYandexApi();
    if (!map || !ymaps || !mapCreatedRef.current) {
      return;
    }

    // Remove previous circle if any.
    if (circleRef.current) {
      map.geoObjects.remove(circleRef.current);
      circleRef.current = null;
    }

    if (
      radiusCircle &&
      Number.isFinite(radiusCircle.center[0]) &&
      Number.isFinite(radiusCircle.center[1]) &&
      radiusCircle.radiusKm > 0
    ) {
      const circle = new ymaps.Circle(
        [radiusCircle.center, radiusCircle.radiusKm * 1000],
        {},
        {
          fillColor: "#4a7c5920",
          strokeColor: "#4a7c59",
          strokeOpacity: 0.45,
          strokeWidth: 2,
          fillOpacity: 0.1,
          zIndex: 10,
        },
      );
      map.geoObjects.add(circle);
      circleRef.current = circle;
    }
  }, [radiusCircle, mapReadyVersion]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      mapRef.current?.container.fitToViewport();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [mapReadyVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapCreatedRef.current) {
      return;
    }

    updateMarkerStyles();

    if (!activePointId) {
      lastCenteredActiveRef.current = null;
      return;
    }

    if (lastCenteredActiveRef.current === activePointId) {
      return;
    }

    const activePoint = pointById.get(activePointId);
    if (!activePoint) {
      return;
    }

    map.setCenter([activePoint.latitude, activePoint.longitude], undefined, { duration: 220 });
    lastCenteredActiveRef.current = activePointId;
  }, [activePointId, hoveredPointId, pointById, updateMarkerStyles]);

  if (!apiKey) {
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Добавьте `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` в `.env.local` или `.env` для отображения карты.
      </p>
    );
  }

  return (
    <div className="yandex-map-multi-viewer h-full w-full space-y-2">
      <div
        ref={containerRef}
        className={`${frameless ? "overflow-hidden bg-cream/45" : "overflow-hidden rounded-xl border border-olive/16 bg-cream/45"} ${className}`}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <style jsx global>{`
        .yandex-map-multi-viewer .ymaps-2-1-79-balloon__layout,
        .yandex-map-multi-viewer .ymaps-2-1-79-balloon__content {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .yandex-map-multi-viewer .ymaps-2-1-79-balloon__content {
          margin: 0 !important;
          padding: 0 !important;
        }

        .yandex-map-multi-viewer .ymaps-2-1-79-balloon__tail,
        .yandex-map-multi-viewer .ymaps-2-1-79-balloon__tail:after,
        .yandex-map-multi-viewer .ymaps-2-1-79-balloon__tail:before {
          display: none !important;
        }

        .yandex-map-multi-viewer .ymaps-2-1-79-balloon__close {
          display: none !important;
        }
      `}</style>
    </div>
  );
}

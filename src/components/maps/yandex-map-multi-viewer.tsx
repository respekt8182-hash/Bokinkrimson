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
  onBoundsChange?: (bounds: [[number, number], [number, number]] | null) => void;
  className?: string;
  initialViewport?: YandexMapViewport | null;
  viewportKey?: string;
  fitPointsOnChange?: "always" | "initial" | "never";
  radiusCircle?: YandexMapRadiusCircle | null;
  controls?: string[];
  showBalloons?: boolean;
  frameless?: boolean;
};

type YandexMapInstance = {
  destroy: () => void;
  getZoom: () => number;
  getBounds: () => [[number, number], [number, number]] | null;
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

type YandexApi = {
  ready: (callback: () => void) => void;
  Map: new (element: HTMLElement, state: unknown, options?: unknown) => YandexMapInstance;
  Placemark: new (
    coordinates: [number, number],
    properties: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => YandexPlacemarkInstance;
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

type DotLayouts = {
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
const PRICE_MARKER_MIN_ZOOM = 13;
const PRICE_MARKER_MIN_WIDTH = 62;
const PRICE_MARKER_MAX_WIDTH = 138;
const PRICE_MARKER_HEIGHT = 28;
const PRICE_MARKER_TAIL_HEIGHT = 7;
const PRICE_MARKER_HORIZONTAL_PADDING = 22;
const DOT_MARKER_SIZE = 14;
const BALLOON_CLOSE_DELAY_MS = 180;
const PRICE_BALLOON_GAP_PX = 6;
const DOT_BALLOON_OFFSET: [number, number] = [0, -12];
const HOVER_CLEAR_DELAY_MS = 80;
const MARKER_Z_INDEX_DEFAULT = 1000;
const MARKER_Z_INDEX_HOVER = 1_000_000;
const MARKER_Z_INDEX_ACTIVE = 2_000_000;
const MARKER_Z_INDEX_DRAG_OFFSET = 20;
const MARKER_OVERLAP_GRID_CELL_PX = PRICE_MARKER_MAX_WIDTH + 32;
const MARKER_OVERLAP_PADDING_PX = 4;
const MARKER_FAIR_ROTATION_MIN_POINTS = 3;
const MARKER_FAIR_ROTATION_DAY_MS = 24 * 60 * 60 * 1000;

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

function createPriceLayout(ymaps: YandexApi, style: string, tailStyle: string): unknown {
  return ymaps.templateLayoutFactory.createClass(
    `<div style="${style}">$[properties.iconContent]<span style="${tailStyle}"></span></div>`,
  );
}

function createDotLayout(ymaps: YandexApi, outerStyle: string, innerStyle: string): unknown {
  return ymaps.templateLayoutFactory.createClass(
    `<span style="${outerStyle}"><span style="${innerStyle}"></span></span>`,
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

function estimatePriceMarkerWidth(label: string): number {
  const normalized = label.trim();
  const estimatedContentWidth = Math.ceil(normalized.length * 7.8);
  return Math.min(
    PRICE_MARKER_MAX_WIDTH,
    Math.max(PRICE_MARKER_MIN_WIDTH, estimatedContentWidth + PRICE_MARKER_HORIZONTAL_PADDING),
  );
}

function getMapZoom(map: YandexMapInstance): number {
  const zoom = map.getZoom();
  return Number.isFinite(zoom) ? zoom : DEFAULT_ZOOM;
}

function normalizeMapBounds(value: unknown): [[number, number], [number, number]] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const southWest = value[0];
  const northEast = value[1];
  if (
    !Array.isArray(southWest) ||
    !Array.isArray(northEast) ||
    southWest.length < 2 ||
    northEast.length < 2
  ) {
    return null;
  }

  const south = Number(southWest[0]);
  const west = Number(southWest[1]);
  const north = Number(northEast[0]);
  const east = Number(northEast[1]);
  if (![south, west, north, east].every(Number.isFinite) || south > north || west > east) {
    return null;
  }

  return [
    [south, west],
    [north, east],
  ];
}

function hasPointPriceLabel(point: YandexMapPoint): boolean {
  return typeof point.priceLabel === "string" && point.priceLabel.trim().length > 0;
}

function shouldShowPricePlacemark(input: {
  point: YandexMapPoint;
  activePointId: string | null;
  zoom: number;
}): boolean {
  if (!hasPointPriceLabel(input.point)) {
    return false;
  }

  return (
    input.zoom >= PRICE_MARKER_MIN_ZOOM ||
    input.point.id === input.activePointId ||
    input.point.isViewed === true
  );
}

type MarkerOverlapBounds = {
  index: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function getMarkerZIndex(input: {
  isActive: boolean;
  isHovered: boolean;
  baseZIndex: number;
}): number {
  if (input.isActive) {
    return MARKER_Z_INDEX_ACTIVE + input.baseZIndex;
  }

  if (input.isHovered) {
    return MARKER_Z_INDEX_HOVER + input.baseZIndex;
  }

  return input.baseZIndex;
}

function getMarkerFairRotationSeed(): number {
  return Math.floor(Date.now() / MARKER_FAIR_ROTATION_DAY_MS);
}

function getStableHash(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function projectPointToWorldPixels(point: YandexMapPoint, zoom: number): [number, number] {
  const normalizedZoom = Math.max(0, Math.min(22, zoom));
  const scale = 256 * Math.pow(2, normalizedZoom);
  const safeLatitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const sinLatitude = Math.sin((safeLatitude * Math.PI) / 180);
  const x = ((point.longitude + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale;

  return [x, y];
}

function shouldUsePriceSizeForOverlap(point: YandexMapPoint, zoom: number): boolean {
  return hasPointPriceLabel(point) && (zoom >= PRICE_MARKER_MIN_ZOOM || point.isViewed === true);
}

function getMarkerOverlapBounds(
  point: YandexMapPoint,
  index: number,
  zoom: number,
): MarkerOverlapBounds {
  const [x, y] = projectPointToWorldPixels(point, zoom);

  if (shouldUsePriceSizeForOverlap(point, zoom)) {
    const width = estimatePriceMarkerWidth(point.priceLabel ?? "");
    const height = PRICE_MARKER_HEIGHT + PRICE_MARKER_TAIL_HEIGHT;

    return {
      index,
      left: x - width / 2 - MARKER_OVERLAP_PADDING_PX,
      right: x + width / 2 + MARKER_OVERLAP_PADDING_PX,
      top: y - height - MARKER_OVERLAP_PADDING_PX,
      bottom: y + MARKER_OVERLAP_PADDING_PX,
    };
  }

  const halfSize = DOT_MARKER_SIZE / 2 + MARKER_OVERLAP_PADDING_PX;

  return {
    index,
    left: x - halfSize,
    right: x + halfSize,
    top: y - halfSize,
    bottom: y + halfSize,
  };
}

function doMarkerBoundsOverlap(first: MarkerOverlapBounds, second: MarkerOverlapBounds): boolean {
  return (
    first.left <= second.right &&
    first.right >= second.left &&
    first.top <= second.bottom &&
    first.bottom >= second.top
  );
}

function findOverlappingMarkerGroups(points: YandexMapPoint[], zoom: number): number[][] {
  const bounds = points.map((point, index) => getMarkerOverlapBounds(point, index, zoom));
  const parents = bounds.map((_, index) => index);

  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) {
      root = parents[root];
    }

    while (parents[index] !== index) {
      const parent = parents[index];
      parents[index] = root;
      index = parent;
    }

    return root;
  };

  const union = (first: number, second: number) => {
    const firstRoot = find(first);
    const secondRoot = find(second);

    if (firstRoot !== secondRoot) {
      parents[secondRoot] = firstRoot;
    }
  };

  const cellToBoundsIndexes = new Map<string, number[]>();

  bounds.forEach((currentBounds, currentIndex) => {
    const checkedCandidates = new Set<number>();
    const minCellX = Math.floor(currentBounds.left / MARKER_OVERLAP_GRID_CELL_PX);
    const maxCellX = Math.floor(currentBounds.right / MARKER_OVERLAP_GRID_CELL_PX);
    const minCellY = Math.floor(currentBounds.top / MARKER_OVERLAP_GRID_CELL_PX);
    const maxCellY = Math.floor(currentBounds.bottom / MARKER_OVERLAP_GRID_CELL_PX);

    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
        const cellKey = `${cellX}:${cellY}`;
        const candidates = cellToBoundsIndexes.get(cellKey) ?? [];

        candidates.forEach((candidateIndex) => {
          if (checkedCandidates.has(candidateIndex)) {
            return;
          }

          checkedCandidates.add(candidateIndex);
          if (doMarkerBoundsOverlap(currentBounds, bounds[candidateIndex])) {
            union(currentIndex, candidateIndex);
          }
        });

        candidates.push(currentIndex);
        cellToBoundsIndexes.set(cellKey, candidates);
      }
    }
  });

  const groupsByRoot = new Map<number, number[]>();

  bounds.forEach((boundsItem) => {
    const root = find(boundsItem.index);
    const group = groupsByRoot.get(root);

    if (group) {
      group.push(boundsItem.index);
    } else {
      groupsByRoot.set(root, [boundsItem.index]);
    }
  });

  return Array.from(groupsByRoot.values()).filter((group) => group.length > 1);
}

function buildMarkerBaseZIndexByPointId(
  points: YandexMapPoint[],
  zoom: number,
  fairRotationSeed: number,
): Map<string, number> {
  const baseZIndexes = points.map((_, index) => MARKER_Z_INDEX_DEFAULT + points.length - index);

  findOverlappingMarkerGroups(points, zoom).forEach((group) => {
    if (group.length < MARKER_FAIR_ROTATION_MIN_POINTS) {
      return;
    }

    const sortedGroup = [...group].sort((first, second) => first - second);
    const groupKey = sortedGroup.map((pointIndex) => points[pointIndex].id).join("|");
    const rotation = (getStableHash(groupKey) + fairRotationSeed) % sortedGroup.length;
    const rotatedGroup = sortedGroup.slice(rotation).concat(sortedGroup.slice(0, rotation));
    const groupBaseRank = points.length - sortedGroup[0];

    rotatedGroup.forEach((pointIndex, orderIndex) => {
      baseZIndexes[pointIndex] = MARKER_Z_INDEX_DEFAULT + groupBaseRank - orderIndex;
    });
  });

  return new Map(points.map((point, index) => [point.id, baseZIndexes[index]]));
}

function buildMarkerLayerOptions(zIndex: number): Record<string, unknown> {
  return {
    interactiveZIndex: false,
    zIndex,
    zIndexHover: zIndex,
    zIndexActive: zIndex,
    zIndexDrag: zIndex + MARKER_Z_INDEX_DRAG_OFFSET,
  };
}

function buildPricePlacemarkOptions(input: {
  point: YandexMapPoint;
  activePointId: string | null;
  hoveredPointId: string | null;
  baseZIndex: number;
  layouts: PriceLayouts;
}): Record<string, unknown> {
  const isActive = input.point.id === input.activePointId;
  const isHovered = input.point.id === input.hoveredPointId && !isActive;
  const isViewed = input.point.isViewed === true && !isActive && !isHovered;
  const width = estimatePriceMarkerWidth(input.point.priceLabel ?? "");
  const markerHeight = PRICE_MARKER_HEIGHT + PRICE_MARKER_TAIL_HEIGHT;
  const zIndex = getMarkerZIndex({ isActive, isHovered, baseZIndex: input.baseZIndex });

  return {
    ...buildMarkerLayerOptions(zIndex),
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
    iconContentOffset: [-width / 2, -markerHeight],
    iconContentSize: [width, markerHeight],
    iconShape: {
      type: "Rectangle",
      coordinates: [
        [-width / 2, -markerHeight],
        [width / 2, 0],
      ],
    },
    cursor: "pointer",
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
    balloonOffset: getBalloonOffset(input.isPricePlacemark),
  };
}

function getBalloonOffset(isPricePlacemark: boolean): [number, number] {
  return isPricePlacemark
    ? [0, -(PRICE_MARKER_HEIGHT + PRICE_MARKER_TAIL_HEIGHT + PRICE_BALLOON_GAP_PX)]
    : DOT_BALLOON_OFFSET;
}

function buildDotPlacemarkOptions(input: {
  pointId: string;
  activePointId: string | null;
  hoveredPointId: string | null;
  baseZIndex: number;
  layouts: DotLayouts;
  isViewed?: boolean;
}): Record<string, unknown> {
  const isActive = input.pointId === input.activePointId;
  const isHovered = input.pointId === input.hoveredPointId && !isActive;
  const isViewed = input.isViewed === true && !isActive && !isHovered;
  const halfSize = DOT_MARKER_SIZE / 2;
  const zIndex = getMarkerZIndex({ isActive, isHovered, baseZIndex: input.baseZIndex });

  return {
    ...buildMarkerLayerOptions(zIndex),
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
    iconContentOffset: [-halfSize, -halfSize],
    iconContentSize: [DOT_MARKER_SIZE, DOT_MARKER_SIZE],
    iconShape: {
      type: "Rectangle",
      coordinates: [
        [-halfSize, -halfSize],
        [halfSize, halfSize],
      ],
    },
    cursor: "pointer",
  };
}

function buildMarkerVisualOptions(input: {
  point: YandexMapPoint;
  activePointId: string | null;
  hoveredPointId: string | null;
  zoom: number;
  baseZIndex: number;
  priceLayouts: PriceLayouts;
  dotLayouts: DotLayouts;
}): Record<string, unknown> {
  if (
    shouldShowPricePlacemark({
      point: input.point,
      activePointId: input.activePointId,
      zoom: input.zoom,
    })
  ) {
    return buildPricePlacemarkOptions({
      point: input.point,
      activePointId: input.activePointId,
      hoveredPointId: input.hoveredPointId,
      baseZIndex: input.baseZIndex,
      layouts: input.priceLayouts,
    });
  }

  return buildDotPlacemarkOptions({
    pointId: input.point.id,
    activePointId: input.activePointId,
    hoveredPointId: input.hoveredPointId,
    baseZIndex: input.baseZIndex,
    layouts: input.dotLayouts,
    isViewed: input.point.isViewed,
  });
}

function applyPlacemarkOptions(
  placemark: YandexPlacemarkInstance,
  options: Record<string, unknown>,
): void {
  Object.entries(options).forEach(([name, value]) => {
    placemark.options.set(name, value);
  });
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
  onBoundsChange,
  className = "h-[560px] w-full",
  initialViewport,
  viewportKey,
  fitPointsOnChange = "always",
  radiusCircle = null,
  controls,
  showBalloons = true,
  frameless = false,
}: YandexMapMultiViewerProps) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YandexMapInstance | null>(null);
  const placemarkByIdRef = useRef<Map<string, YandexPlacemarkInstance>>(new Map());
  const mapCreatedRef = useRef(false);
  const pointsSignatureRef = useRef("");
  const appliedViewportKeyRef = useRef<string | null>(null);
  const lastCenteredActiveRef = useRef<string | null>(null);
  const activePointIdRef = useRef(activePointId);
  const hoveredPointIdRef = useRef(hoveredPointId);
  const mapZoomRef = useRef(DEFAULT_ZOOM);
  const clickHandlerRef = useRef(onPointClick);
  const hoverHandlerRef = useRef(onPointHoverChange);
  const boundsChangeHandlerRef = useRef(onBoundsChange);
  const showBalloonsRef = useRef(showBalloons);
  const markerBaseZIndexByPointIdRef = useRef<Map<string, number>>(new Map());
  const priceLayoutsRef = useRef<PriceLayouts | null>(null);
  const dotLayoutsRef = useRef<DotLayouts | null>(null);
  const balloonContentLayoutsRef = useRef<BalloonContentLayouts | null>(null);
  const closeBalloonTimerByPointIdRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const openedBalloonPointIdRef = useRef<string | null>(null);
  const hoveredPointerPointIdRef = useRef<string | null>(null);
  const hoverClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverEnabledRef = useRef(true);
  const circleRef = useRef<unknown>(null);
  const [error, setError] = useState("");
  const [mapReadyVersion, setMapReadyVersion] = useState(0);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [fairRotationSeed] = useState(() => getMarkerFairRotationSeed());
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
  const markerBaseZIndexByPointId = useMemo(
    () => buildMarkerBaseZIndexByPointId(normalizedPoints, mapZoom, fairRotationSeed),
    [fairRotationSeed, mapZoom, normalizedPoints],
  );

  useEffect(() => {
    markerBaseZIndexByPointIdRef.current = markerBaseZIndexByPointId;
  }, [markerBaseZIndexByPointId]);

  useEffect(() => {
    clickHandlerRef.current = onPointClick;
  }, [onPointClick]);

  useEffect(() => {
    hoverHandlerRef.current = onPointHoverChange;
  }, [onPointHoverChange]);

  useEffect(() => {
    boundsChangeHandlerRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    activePointIdRef.current = activePointId;
  }, [activePointId]);

  useEffect(() => {
    hoveredPointIdRef.current = hoveredPointId;
  }, [hoveredPointId]);

  useEffect(() => {
    mapZoomRef.current = mapZoom;
  }, [mapZoom]);

  const reportCurrentBounds = useCallback((map: YandexMapInstance) => {
    boundsChangeHandlerRef.current?.(normalizeMapBounds(map.getBounds()));
  }, []);

  const clearBalloonCloseTimer = useCallback((pointId: string) => {
    const timer = closeBalloonTimerByPointIdRef.current.get(pointId);
    if (timer === undefined) {
      return;
    }

    clearTimeout(timer);
    closeBalloonTimerByPointIdRef.current.delete(pointId);
  }, []);

  const clearHoverClearTimer = useCallback(() => {
    if (hoverClearTimerRef.current === null) {
      return;
    }

    clearTimeout(hoverClearTimerRef.current);
    hoverClearTimerRef.current = null;
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

  const handlePlacemarkMouseEnter = useCallback(
    (pointId: string) => {
      clearHoverClearTimer();
      hoveredPointerPointIdRef.current = pointId;
      hoverHandlerRef.current?.(pointId);
    },
    [clearHoverClearTimer],
  );

  const handlePlacemarkMouseLeave = useCallback(
    (pointId: string) => {
      clearHoverClearTimer();

      hoverClearTimerRef.current = setTimeout(() => {
        hoverClearTimerRef.current = null;

        if (hoveredPointerPointIdRef.current !== pointId) {
          return;
        }

        hoveredPointerPointIdRef.current = null;
        hoverHandlerRef.current?.(null);
      }, HOVER_CLEAR_DELAY_MS);
    },
    [clearHoverClearTimer],
  );

  const updateMarkerStyles = useCallback(() => {
    const priceLayouts = priceLayoutsRef.current;
    const dotLayouts = dotLayoutsRef.current;
    if (!priceLayouts || !dotLayouts) {
      return;
    }

    placemarkByIdRef.current.forEach((placemark, pointId) => {
      const point = pointById.get(pointId);
      if (!point) {
        return;
      }

      const isPricePlacemark = shouldShowPricePlacemark({
        point,
        activePointId,
        zoom: mapZoom,
      });
      const visualOptions = buildMarkerVisualOptions({
        point,
        activePointId,
        hoveredPointId,
        zoom: mapZoom,
        baseZIndex: markerBaseZIndexByPointId.get(point.id) ?? MARKER_Z_INDEX_DEFAULT,
        priceLayouts,
        dotLayouts,
      });

      if (showBalloonsRef.current) {
        visualOptions.balloonOffset = getBalloonOffset(isPricePlacemark);
      }

      applyPlacemarkOptions(placemark, visualOptions);
    });
  }, [activePointId, hoveredPointId, mapZoom, markerBaseZIndexByPointId, pointById]);

  const removePlacemarksFromMap = useCallback(() => {
    const map = mapRef.current;
    if (map) {
      placemarkByIdRef.current.forEach((placemark) => {
        map.geoObjects.remove(placemark);
      });
    }

    placemarkByIdRef.current.clear();
  }, []);

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

          const layoutBaseStyle =
            "position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:62px;height:28px;padding:0 11px;border-radius:16px;background:#ffffff;box-shadow:0 2px 4px rgba(0,0,0,0.18),0 7px 18px rgba(0,0,0,0.12);font:800 13px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#111827;white-space:nowrap;box-sizing:border-box;transition:background .12s ease,color .12s ease,border-color .12s ease,box-shadow .12s ease;";
          const tailBaseStyle =
            "position:absolute;left:50%;bottom:-5px;width:10px;height:10px;margin-left:-5px;transform:rotate(45deg);background:#ffffff;border-right:1px solid rgba(17,24,39,0.08);border-bottom:1px solid rgba(17,24,39,0.08);border-radius:2px;box-shadow:2px 2px 3px rgba(0,0,0,0.07);box-sizing:border-box;transition:background .12s ease,border-color .12s ease;";

          priceLayoutsRef.current = {
            default: createPriceLayout(
              readyYmaps,
              `${layoutBaseStyle}border:1px solid rgba(17,24,39,0.08);`,
              tailBaseStyle,
            ),
            viewed: createPriceLayout(
              readyYmaps,
              `${layoutBaseStyle}background:#e1e4ea;border:1px solid rgba(17,24,39,0.06);color:#5f6671;box-shadow:0 1px 2px rgba(0,0,0,0.12),0 4px 13px rgba(0,0,0,0.08);`,
              `${tailBaseStyle}background:#e1e4ea;border-right-color:rgba(17,24,39,0.06);border-bottom-color:rgba(17,24,39,0.06);`,
            ),
            hover: createPriceLayout(
              readyYmaps,
              `${layoutBaseStyle}background:#202124;border:1px solid #202124;color:#ffffff;box-shadow:0 2px 5px rgba(0,0,0,0.28),0 8px 20px rgba(0,0,0,0.22);`,
              `${tailBaseStyle}background:#202124;border-right-color:#202124;border-bottom-color:#202124;`,
            ),
            active: createPriceLayout(
              readyYmaps,
              `${layoutBaseStyle}background:#202124;border:1px solid #202124;color:#ffffff;box-shadow:0 2px 5px rgba(0,0,0,0.30),0 8px 22px rgba(0,0,0,0.24);`,
              `${tailBaseStyle}background:#202124;border-right-color:#202124;border-bottom-color:#202124;`,
            ),
          };

          const dotOuterBaseStyle =
            "display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:#ffffff;border:1.6px solid #ffffff;box-sizing:border-box;box-shadow:0 1px 2px rgba(0,0,0,0.17),0 4px 15px rgba(0,0,0,0.10);transition:background .12s ease,border-color .12s ease,box-shadow .12s ease;";
          const dotInnerBaseStyle =
            "display:block;width:10.8px;height:10.8px;border-radius:50%;border:1.6px solid #1c1c1c;box-sizing:border-box;transition:background .12s ease,border-color .12s ease;";

          dotLayoutsRef.current = {
            default: createDotLayout(readyYmaps, dotOuterBaseStyle, dotInnerBaseStyle),
            viewed: createDotLayout(
              readyYmaps,
              `${dotOuterBaseStyle}background:#e1e4ea;border-color:#e1e4ea;`,
              `${dotInnerBaseStyle}border-color:#6f7680;`,
            ),
            hover: createDotLayout(
              readyYmaps,
              `${dotOuterBaseStyle}background:#202124;border-color:#202124;box-shadow:0 2px 5px rgba(0,0,0,0.28),0 8px 20px rgba(0,0,0,0.20);`,
              `${dotInnerBaseStyle}border-color:#ffffff;`,
            ),
            active: createDotLayout(
              readyYmaps,
              `${dotOuterBaseStyle}background:#202124;border-color:#202124;box-shadow:0 2px 5px rgba(0,0,0,0.30),0 8px 22px rgba(0,0,0,0.22);`,
              `${dotInnerBaseStyle}background:#ffffff;border-color:#ffffff;`,
            ),
          };
          balloonContentLayoutsRef.current = {
            details: createBalloonContentLayout(readyYmaps),
            titleOnly: createTitleOnlyBalloonContentLayout(readyYmaps),
          };
          hoverEnabledRef.current = window.matchMedia("(hover: hover)").matches;
          const initialZoom = getMapZoom(map);
          mapZoomRef.current = initialZoom;
          setMapZoom(initialZoom);

          map.events.add("boundschange", (event) => {
            const eventZoom = event.get("newZoom");
            const nextZoom =
              typeof eventZoom === "number" && Number.isFinite(eventZoom)
                ? eventZoom
                : getMapZoom(map);
            const eventBounds = normalizeMapBounds(event.get("newBounds"));

            mapZoomRef.current = nextZoom;
            setMapZoom((currentZoom) =>
              Math.abs(currentZoom - nextZoom) < 0.05 ? currentZoom : nextZoom,
            );
            boundsChangeHandlerRef.current?.(eventBounds ?? normalizeMapBounds(map.getBounds()));
          });

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
          mapCreatedRef.current = true;
          setMapReadyVersion((value) => value + 1);
          window.requestAnimationFrame(() => reportCurrentBounds(map));
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
      clearHoverClearTimer();
      closeAllBalloons();
      placemarkStore.clear();
      hoveredPointerPointIdRef.current = null;
      mapCreatedRef.current = false;
      pointsSignatureRef.current = "";
      appliedViewportKeyRef.current = null;
      lastCenteredActiveRef.current = null;
      priceLayoutsRef.current = null;
      dotLayoutsRef.current = null;
      balloonContentLayoutsRef.current = null;
      mapZoomRef.current = DEFAULT_ZOOM;
    };
  }, [apiKey, clearHoverClearTimer, closeAllBalloons, controlsSignature, reportCurrentBounds]);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = getYandexApi();
    const priceLayouts = priceLayoutsRef.current;
    const dotLayouts = dotLayoutsRef.current;
    const balloonContentLayouts = balloonContentLayoutsRef.current;

    if (
      !map ||
      !ymaps ||
      !priceLayouts ||
      !dotLayouts ||
      !balloonContentLayouts ||
      !mapCreatedRef.current
    ) {
      return;
    }

    closeAllBalloons();
    removePlacemarksFromMap();

    const currentActivePointId = activePointIdRef.current;
    const currentHoveredPointId = hoveredPointIdRef.current;
    const currentZoom = mapZoomRef.current;

    normalizedPoints.forEach((point) => {
      const hasPriceLabel = hasPointPriceLabel(point);
      const isPricePlacemark = shouldShowPricePlacemark({
        point,
        activePointId: currentActivePointId,
        zoom: currentZoom,
      });
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
            isPricePlacemark,
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
        {
          ...buildMarkerVisualOptions({
            point,
            activePointId: currentActivePointId,
            hoveredPointId: currentHoveredPointId,
            zoom: currentZoom,
            baseZIndex:
              markerBaseZIndexByPointIdRef.current.get(point.id) ?? MARKER_Z_INDEX_DEFAULT,
            priceLayouts,
            dotLayouts,
          }),
          ...balloonOptions,
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
        handlePlacemarkMouseEnter(point.id);
      });
      placemark.events.add("mouseleave", () => {
        if (!hoverEnabledRef.current) {
          return;
        }

        if (showBalloonsRef.current) {
          scheduleBalloonClose(point.id);
        }
        handlePlacemarkMouseLeave(point.id);
      });

      placemarkByIdRef.current.set(point.id, placemark);
      map.geoObjects.add(placemark);
    });

    const signature = normalizedPoints
      .map((point) => `${point.id}:${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`)
      .join("|");
    const previousSignature = pointsSignatureRef.current;
    const pointsChanged = signature !== previousSignature;
    pointsSignatureRef.current = signature;
    lastCenteredActiveRef.current = null;

    const canApplyViewport =
      Boolean(initialViewport) &&
      Boolean(viewportKey) &&
      appliedViewportKeyRef.current !== viewportKey;
    const hasPinnedViewport = Boolean(initialViewport) && Boolean(viewportKey);

    if (normalizedPoints.length === 0) {
      if (!canApplyViewport && fitPointsOnChange === "never") {
        return;
      }

      applyViewport(map, initialViewport);
      window.setTimeout(() => reportCurrentBounds(map), 240);
      if (viewportKey) {
        appliedViewportKeyRef.current = viewportKey;
      }
      return;
    }

    if (canApplyViewport) {
      applyViewport(map, initialViewport);
      appliedViewportKeyRef.current = viewportKey ?? null;
      window.setTimeout(() => reportCurrentBounds(map), 240);
      return;
    }

    const shouldFitPoints =
      pointsChanged &&
      !hasPinnedViewport &&
      (fitPointsOnChange === "always" ||
        (fitPointsOnChange === "initial" && previousSignature.length === 0));

    if (shouldFitPoints) {
      fitPoints(map, normalizedPoints);
      window.setTimeout(() => reportCurrentBounds(map), 240);
    }
  }, [
    closeAllBalloons,
    closeBalloonForPoint,
    fitPointsOnChange,
    handlePlacemarkMouseEnter,
    handlePlacemarkMouseLeave,
    initialViewport,
    mapReadyVersion,
    normalizedPoints,
    openBalloonForPoint,
    removePlacemarksFromMap,
    reportCurrentBounds,
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

"use client";

import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

export type YandexMapMarkerCategory =
  | "beach"
  | "sea"
  | "mountain"
  | "water"
  | "reserve"
  | "history"
  | "religion"
  | "palace"
  | "culture"
  | "city"
  | "entertainment"
  | "winery"
  | "route"
  | "landmark";

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
  showPriceAtLowZoom?: boolean;
  markerCategory?: YandexMapMarkerCategory | null;
  markerCategoryLabel?: string | null;
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
  onBoundsChange?: (
    bounds: [[number, number], [number, number]] | null,
    viewport?: YandexMapViewport,
  ) => void;
  className?: string;
  initialViewport?: YandexMapViewport | null;
  viewportKey?: string;
  fitPointsOnChange?: "always" | "initial" | "never";
  radiusCircle?: YandexMapRadiusCircle | null;
  controls?: string[];
  customZoomControls?: boolean;
  customZoomControlsClassName?: string;
  showBalloons?: boolean;
  frameless?: boolean;
};

type YandexMapInstance = {
  destroy: () => void;
  getZoom: () => number;
  getCenter: () => [number, number] | null;
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

type CategoryLayouts = Record<
  YandexMapMarkerCategory,
  {
    default: unknown;
    viewed: unknown;
    hover: unknown;
    active: unknown;
  }
>;

type CategoryMarkerDefinition = {
  color: string;
  icon: string;
  label: string;
};

type MarkerVisualKind = "price" | "category" | "dot";

type BalloonContentLayouts = {
  details: unknown;
  titleOnly: unknown;
};

const DEFAULT_CENTER: [number, number] = [44.9482, 34.1003];
const DEFAULT_ZOOM = 8;
const CUSTOM_ZOOM_MIN = 3;
const CUSTOM_ZOOM_MAX = 19;
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
const CATEGORY_MARKER_MIN_ZOOM = 12;
const CATEGORY_MARKER_SIZE = 34;
const CATEGORY_MARKER_TAIL_SIZE = 10;
const CATEGORY_MARKER_TOTAL_HEIGHT = CATEGORY_MARKER_SIZE + 7;
const BALLOON_CLOSE_DELAY_MS = 180;
const PRICE_BALLOON_GAP_PX = 6;
const DOT_BALLOON_OFFSET: [number, number] = [0, -12];
const CATEGORY_BALLOON_OFFSET: [number, number] = [
  0,
  -(CATEGORY_MARKER_TOTAL_HEIGHT + PRICE_BALLOON_GAP_PX),
];
const HOVER_CLEAR_DELAY_MS = 80;
const MARKER_Z_INDEX_DEFAULT = 1000;
const MARKER_Z_INDEX_HOVER = 1_000_000;
const MARKER_Z_INDEX_ACTIVE = 2_000_000;
const MARKER_Z_INDEX_DRAG_OFFSET = 20;
const MARKER_OVERLAP_GRID_CELL_PX = PRICE_MARKER_MAX_WIDTH + 32;
const MARKER_OVERLAP_PADDING_PX = 4;
const MARKER_FAIR_ROTATION_MIN_POINTS = 3;
const MARKER_FAIR_ROTATION_DAY_MS = 24 * 60 * 60 * 1000;
const MARKER_DENSITY_MIN_TOTAL_POINTS = 90;
const MARKER_DENSITY_FULL_DETAIL_MIN_ZOOM = 13;
const YANDEX_SCRIPT_TIMEOUT_MS = 12_000;
const MAP_BOUNDS_IDLE_DEBOUNCE_MS = 260;

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

    const params = new URLSearchParams({
      apikey: apiKey,
      lang: "ru_RU",
    });
    const script = document.createElement("script");
    let timeout: number | null = null;
    script.src = `https://api-maps.yandex.ru/2.1/?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.dataset.yandexMaps = "true";
    script.onload = () => {
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
      resolve();
    };
    script.onerror = () => {
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
      scriptPromise = null;
      script.remove();
      reject(new Error("Failed to load script"));
    };
    timeout = window.setTimeout(() => {
      scriptPromise = null;
      script.remove();
      reject(new Error("Map script timed out"));
    }, YANDEX_SCRIPT_TIMEOUT_MS);
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

const categoryMarkerDefinitions: Record<YandexMapMarkerCategory, CategoryMarkerDefinition> = {
  beach: {
    color: "#38bdf8",
    icon: '<path d="M17.553 16.75a7.5 7.5 0 0 0 -10.606 0"/><path d="M18 3.804a6 6 0 0 0 -8.196 2.196l10.392 6a6 6 0 0 0 -2.196 -8.196"/><path d="M16.732 10c1.658 -2.87 2.225 -5.644 1.268 -6.196c-.957 -.552 -3.075 1.326 -4.732 4.196"/><path d="M15 9l-3 5.196"/><path d="M3 19.25a2.4 2.4 0 0 1 1 -.25a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 1 .25"/>',
    label: "\u041f\u043b\u044f\u0436\u0438 \u0438 \u043a\u0443\u043f\u0430\u043d\u0438\u0435",
  },
  sea: {
    color: "#2563eb",
    icon: '<path d="M3 7c3 -2 6 -2 9 0s6 2 9 0"/><path d="M3 17c3 -2 6 -2 9 0s6 2 9 0"/><path d="M3 12c3 -2 6 -2 9 0s6 2 9 0"/>',
    label:
      "\u041c\u043e\u0440\u0435, \u0431\u0443\u0445\u0442\u044b \u0438 \u043c\u044b\u0441\u044b",
  },
  mountain: {
    color: "#92400e",
    icon: '<path d="M3 20h18l-6.921 -14.612a2.3 2.3 0 0 0 -4.158 0l-6.921 14.612"/><path d="M7.5 11l2 2.5l2.5 -2.5l2 3l2.5 -2"/>',
    label:
      "\u0413\u043e\u0440\u044b, \u0441\u043a\u0430\u043b\u044b \u0438 \u043f\u0435\u0449\u0435\u0440\u044b",
  },
  water: {
    color: "#0891b2",
    icon: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1 -11.31 0z"/><path d="M8.5 14a3.5 3.5 0 0 0 7 0"/>',
    label:
      "\u0412\u043e\u0434\u043e\u043f\u0430\u0434\u044b, \u043e\u0437\u0435\u0440\u0430 \u0438 \u0432\u043e\u0434\u043e\u0435\u043c\u044b",
  },
  reserve: {
    color: "#16a34a",
    icon: '<path d="M16 5l3 3l-2 1l4 4l-3 1l4 4h-9"/><path d="M15 21l0 -3"/><path d="M8 13l-2 -2"/><path d="M8 12l2 -2"/><path d="M8 21v-13"/><path d="M5.824 16a3 3 0 0 1 -2.743 -3.69a3 3 0 0 1 .304 -4.833a3 3 0 0 1 4.615 -3.707a3 3 0 0 1 4.614 3.707a3 3 0 0 1 .305 4.833a3 3 0 0 1 -2.919 3.695h-4l-.176 -.005"/>',
    label:
      "\u0417\u0430\u043f\u043e\u0432\u0435\u0434\u043d\u0438\u043a\u0438 \u0438 \u0443\u0440\u043e\u0447\u0438\u0449\u0430",
  },
  history: {
    color: "#475569",
    icon: '<path d="M7 21h1a1 1 0 0 0 1 -1v-1a3 3 0 0 1 6 0m3 2h1a1 1 0 0 0 1 -1v-15l-3 -2l-3 2v6h-4v-6l-3 -2l-3 2v15a1 1 0 0 0 1 1h2m8 -2v1a1 1 0 0 0 1 1h2"/><path d="M7 7v.01"/><path d="M7 10v.01"/><path d="M7 13v.01"/><path d="M17 7v.01"/><path d="M17 10v.01"/><path d="M17 13v.01"/>',
    label:
      "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0438 \u0430\u0440\u0445\u0435\u043e\u043b\u043e\u0433\u0438\u044f",
  },
  religion: {
    color: "#7c3aed",
    icon: '<path d="M3 21l18 0"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><path d="M10 5l4 0"/><path d="M12 3l0 5"/><path d="M6 21v-7m-2 2l8 -8l8 8m-2 -2v7"/>',
    label: "\u0425\u0440\u0430\u043c\u044b \u0438 \u0440\u0435\u043b\u0438\u0433\u0438\u044f",
  },
  palace: {
    color: "#d97706",
    icon: '<path d="M15 19v-2a3 3 0 0 0 -6 0v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14h4v3h3v-3h4v3h3v-3h4v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1"/><path d="M3 11l18 0"/>',
    label: "\u0414\u0432\u043e\u0440\u0446\u044b \u0438 \u0434\u0430\u0447\u0438",
  },
  culture: {
    color: "#dc2626",
    icon: '<path d="M3 21l18 0"/><path d="M3 10l18 0"/><path d="M5 6l7 -3l7 3"/><path d="M4 10l0 11"/><path d="M20 10l0 11"/><path d="M8 14l0 3"/><path d="M12 14l0 3"/><path d="M16 14l0 3"/>',
    label: "\u041c\u0443\u0437\u0435\u0438 \u0438 \u043a\u0443\u043b\u044c\u0442\u0443\u0440\u0430",
  },
  city: {
    color: "#65a30d",
    icon: '<path d="M13 4a2 2 0 1 0 -4 0a2 2 0 0 0 4 0"/><path d="M10 7l-1 5l-3 3"/><path d="M11 12l4 2l1 5"/><path d="M9 12h4"/><path d="M3 21h18"/>',
    label: "\u041f\u0440\u043e\u0433\u0443\u043b\u043a\u0438 \u0438 \u043f\u0430\u0440\u043a\u0438",
  },
  entertainment: {
    color: "#ec4899",
    icon: '<path d="M15 5l0 2"/><path d="M15 11l0 2"/><path d="M15 17l0 2"/><path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2"/>',
    label: "\u0421\u0435\u043c\u0435\u0439\u043d\u044b\u0439 \u043e\u0442\u0434\u044b\u0445",
  },
  winery: {
    color: "#991b1b",
    icon: '<path d="M8 21h8"/><path d="M12 16v5"/><path d="M17 5l1 6c0 3.012 -2.686 5 -6 5s-6 -1.988 -6 -5l1 -6"/><path d="M7 5a5 2 0 1 0 10 0a5 2 0 1 0 -10 0"/>',
    label: "\u0412\u0438\u043d\u043e\u0434\u0435\u043b\u044c\u043d\u0438",
  },
  route: {
    color: "#111827",
    icon: '<path d="M3 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M19 7a2 2 0 1 0 0 -4a2 2 0 0 0 0 4"/><path d="M11 19h5.5a3.5 3.5 0 0 0 0 -7h-8a3.5 3.5 0 0 1 0 -7h4.5"/>',
    label:
      "\u0421\u043c\u043e\u0442\u0440\u043e\u0432\u044b\u0435 \u0438 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u044b",
  },
  landmark: {
    color: "#0f766e",
    icon: '<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0"/>',
    label:
      "\u0414\u043e\u0441\u0442\u043e\u043f\u0440\u0438\u043c\u0435\u0447\u0430\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c",
  },
};

function createCategoryMarkerLayout(
  ymaps: YandexApi,
  definition: CategoryMarkerDefinition,
  state: "default" | "viewed" | "hover" | "active",
): unknown {
  const safeLabel = escapeHtml(definition.label);
  const isStrong = state === "hover" || state === "active";
  const isViewed = state === "viewed";
  const background = isStrong ? "#202124" : isViewed ? "#e1e4ea" : "#ffffff";
  const borderColor = isStrong ? "#202124" : isViewed ? "#cfd6dc" : definition.color;
  const iconColor = isStrong ? "#ffffff" : isViewed ? "#64707d" : definition.color;
  const shadow = isStrong
    ? "0 2px 5px rgba(0,0,0,0.28),0 9px 22px rgba(0,0,0,0.22)"
    : isViewed
      ? "0 1px 2px rgba(0,0,0,0.12),0 5px 14px rgba(0,0,0,0.08)"
      : "0 2px 4px rgba(0,0,0,0.18),0 8px 20px rgba(0,0,0,0.14)";
  const markerStyle =
    `position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;` +
    `width:${CATEGORY_MARKER_SIZE}px;height:${CATEGORY_MARKER_SIZE}px;border-radius:50%;` +
    `background:${background};border:2px solid ${borderColor};color:${iconColor};box-sizing:border-box;` +
    `box-shadow:${shadow};transition:background .12s ease,color .12s ease,border-color .12s ease,box-shadow .12s ease;`;
  const tailStyle =
    `position:absolute;left:50%;bottom:-5px;width:${CATEGORY_MARKER_TAIL_SIZE}px;height:${CATEGORY_MARKER_TAIL_SIZE}px;` +
    `margin-left:-${CATEGORY_MARKER_TAIL_SIZE / 2}px;transform:rotate(45deg);background:${background};` +
    `border-right:2px solid ${borderColor};border-bottom:2px solid ${borderColor};border-radius:2px;` +
    `box-shadow:2px 2px 3px rgba(0,0,0,0.08);box-sizing:border-box;z-index:0;` +
    `transition:background .12s ease,border-color .12s ease;`;

  return ymaps.templateLayoutFactory.createClass(
    `<span style="${markerStyle}" role="img" aria-label="${safeLabel}" title="${safeLabel}">
      <span style="${tailStyle}"></span>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="position:relative;z-index:1;display:block;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${definition.icon}</svg>
    </span>`,
  );
}

function createCategoryLayouts(ymaps: YandexApi): CategoryLayouts {
  const result = {} as CategoryLayouts;

  (
    Object.entries(categoryMarkerDefinitions) as Array<
      [YandexMapMarkerCategory, CategoryMarkerDefinition]
    >
  ).forEach(([category, definition]) => {
    result[category] = {
      default: createCategoryMarkerLayout(ymaps, definition, "default"),
      viewed: createCategoryMarkerLayout(ymaps, definition, "viewed"),
      hover: createCategoryMarkerLayout(ymaps, definition, "hover"),
      active: createCategoryMarkerLayout(ymaps, definition, "active"),
    };
  });

  return result;
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
      <div style="${fontFamily}display:$[properties.balloonCategoryDisplay];margin-top:4px;font-size:12px;line-height:1.2;font-weight:600;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">$[properties.balloonCategoryLabel]</div>
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

function buildTitleOnlyBalloonContentFallbackHtml(input: {
  title: string;
  categoryLabel: string;
}): string {
  const fontFamily = "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;";
  const categoryHtml = input.categoryLabel
    ? `<div style="${fontFamily}margin-top:4px;font-size:12px;line-height:1.2;font-weight:600;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${input.categoryLabel}</div>`
    : "";

  return `<div style="max-width:240px;padding:9px 12px;background:#ffffff;border:1px solid rgba(15,23,42,0.08);border-radius:12px;box-shadow:0 12px 24px rgba(15,23,42,0.18);">
    <div style="${fontFamily}font-size:14px;line-height:1.25;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${input.title}</div>
    ${categoryHtml}
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

function resolveMarkerCategoryLabel(point: YandexMapPoint): string {
  const explicitLabel =
    typeof point.markerCategoryLabel === "string" ? point.markerCategoryLabel.trim() : "";
  if (explicitLabel.length > 0) {
    return explicitLabel;
  }

  if (!hasPointMarkerCategory(point)) {
    return "";
  }

  return categoryMarkerDefinitions[point.markerCategory]?.label ?? "";
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

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

function normalizeMapCenter(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const latitude = Number(value[0]);
  const longitude = Number(value[1]);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return [latitude, longitude];
}

function getMapViewport(
  map: YandexMapInstance,
  bounds?: [[number, number], [number, number]] | null,
  zoom?: number,
): YandexMapViewport {
  return {
    bounds: bounds ?? normalizeMapBounds(map.getBounds()) ?? undefined,
    center: normalizeMapCenter(map.getCenter()) ?? undefined,
    zoom: Number.isFinite(zoom) ? zoom : getMapZoom(map),
  };
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
    input.point.isViewed === true ||
    input.point.showPriceAtLowZoom === true
  );
}

function hasPointMarkerCategory(point: YandexMapPoint): point is YandexMapPoint & {
  markerCategory: YandexMapMarkerCategory;
} {
  return Boolean(point.markerCategory && categoryMarkerDefinitions[point.markerCategory]);
}

function shouldShowCategoryPlacemark(input: {
  point: YandexMapPoint;
  activePointId: string | null;
  zoom: number;
}): boolean {
  if (!hasPointMarkerCategory(input.point) || hasPointPriceLabel(input.point)) {
    return false;
  }

  return input.zoom >= CATEGORY_MARKER_MIN_ZOOM || input.point.id === input.activePointId;
}

function getMarkerVisualKind(input: {
  point: YandexMapPoint;
  activePointId: string | null;
  zoom: number;
}): MarkerVisualKind {
  if (
    shouldShowPricePlacemark({
      point: input.point,
      activePointId: input.activePointId,
      zoom: input.zoom,
    })
  ) {
    return "price";
  }

  if (
    shouldShowCategoryPlacemark({
      point: input.point,
      activePointId: input.activePointId,
      zoom: input.zoom,
    })
  ) {
    return "category";
  }

  return "dot";
}

function getMarkerDensityZoomBucket(zoom: number): number {
  return Math.max(0, Math.floor(Number.isFinite(zoom) ? zoom : DEFAULT_ZOOM));
}

function getDensityGridCellSizePx(zoom: number): number | null {
  if (zoom >= MARKER_DENSITY_FULL_DETAIL_MIN_ZOOM) {
    return null;
  }

  if (zoom >= 12) return 28;
  if (zoom >= 11) return 34;
  if (zoom >= 10) return 42;
  if (zoom >= 9) return 50;
  if (zoom >= 8) return 58;
  if (zoom >= 7) return 66;
  return 74;
}

function getDensityMaxRenderedPoints(zoom: number): number {
  if (zoom >= MARKER_DENSITY_FULL_DETAIL_MIN_ZOOM) return Number.POSITIVE_INFINITY;
  if (zoom >= 12) return 760;
  if (zoom >= 11) return 560;
  if (zoom >= 10) return 380;
  if (zoom >= 9) return 260;
  if (zoom >= 8) return 180;
  if (zoom >= 7) return 130;
  return 90;
}

function getFeaturedPriceGridCellSizePx(zoom: number): number | null {
  if (zoom >= PRICE_MARKER_MIN_ZOOM) {
    return null;
  }

  if (zoom >= 12) return 84;
  if (zoom >= 11) return 96;
  if (zoom >= 10) return 112;
  if (zoom >= 9) return 132;
  if (zoom >= 8) return 150;
  if (zoom >= 7) return 166;
  return 184;
}

function getFeaturedPriceMaxCount(zoom: number): number {
  if (zoom >= PRICE_MARKER_MIN_ZOOM) return Number.POSITIVE_INFINITY;
  if (zoom >= 12) return 72;
  if (zoom >= 11) return 56;
  if (zoom >= 10) return 42;
  if (zoom >= 9) return 30;
  if (zoom >= 8) return 22;
  if (zoom >= 7) return 16;
  return 10;
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

function getDensityCellKey(point: YandexMapPoint, zoom: number, cellSizePx: number): string {
  const [x, y] = projectPointToWorldPixels(point, zoom);
  return `${Math.floor(x / cellSizePx)}:${Math.floor(y / cellSizePx)}`;
}

function isProtectedDensityPoint(
  point: YandexMapPoint,
  activePointId: string | null,
  hoveredPointId: string | null,
): boolean {
  return point.id === activePointId || point.id === hoveredPointId || point.isViewed === true;
}

function pickDensityRepresentative(
  entries: Array<{ point: YandexMapPoint; index: number }>,
  cellKey: string,
  fairRotationSeed: number,
): { point: YandexMapPoint; index: number } {
  if (entries.length < MARKER_FAIR_ROTATION_MIN_POINTS) {
    return entries[0];
  }

  const sortedEntries = [...entries].sort((left, right) =>
    left.point.id.localeCompare(right.point.id),
  );
  const rotation = (getStableHash(cellKey) + fairRotationSeed) % sortedEntries.length;
  return sortedEntries[rotation];
}

function markFeaturedLowZoomPricePoints(
  points: YandexMapPoint[],
  zoom: number,
  activePointId: string | null,
): YandexMapPoint[] {
  const cellSize = getFeaturedPriceGridCellSizePx(zoom);
  if (!cellSize) {
    return points;
  }

  const maxFeatured = getFeaturedPriceMaxCount(zoom);
  const featuredPointIds = new Set<string>();
  const occupiedPriceCells = new Set<string>();

  points.forEach((point) => {
    if (!hasPointPriceLabel(point) || (point.id !== activePointId && point.isViewed !== true)) {
      return;
    }

    occupiedPriceCells.add(getDensityCellKey(point, zoom, cellSize));
  });

  for (const point of points) {
    if (!hasPointPriceLabel(point) || point.id === activePointId || point.isViewed === true) {
      continue;
    }

    const cellKey = getDensityCellKey(point, zoom, cellSize);
    if (occupiedPriceCells.has(cellKey)) {
      continue;
    }

    occupiedPriceCells.add(cellKey);
    featuredPointIds.add(point.id);

    if (featuredPointIds.size >= maxFeatured) {
      break;
    }
  }

  if (featuredPointIds.size === 0) {
    return points.map((point) =>
      point.showPriceAtLowZoom ? { ...point, showPriceAtLowZoom: undefined } : point,
    );
  }

  return points.map((point) => {
    const showPriceAtLowZoom = featuredPointIds.has(point.id);
    if (Boolean(point.showPriceAtLowZoom) === showPriceAtLowZoom) {
      return point;
    }

    return {
      ...point,
      showPriceAtLowZoom: showPriceAtLowZoom || undefined,
    };
  });
}

function buildDensityLimitedPoints(input: {
  points: YandexMapPoint[];
  zoom: number;
  activePointId: string | null;
  hoveredPointId: string | null;
  fairRotationSeed: number;
}): YandexMapPoint[] {
  const cellSize = getDensityGridCellSizePx(input.zoom);
  if (!cellSize || input.points.length <= MARKER_DENSITY_MIN_TOTAL_POINTS) {
    return markFeaturedLowZoomPricePoints(input.points, input.zoom, input.activePointId);
  }

  const protectedEntries: Array<{ point: YandexMapPoint; index: number }> = [];
  const occupiedCells = new Set<string>();
  const entriesByCell = new Map<string, Array<{ point: YandexMapPoint; index: number }>>();

  input.points.forEach((point, index) => {
    const cellKey = getDensityCellKey(point, input.zoom, cellSize);

    if (isProtectedDensityPoint(point, input.activePointId, input.hoveredPointId)) {
      protectedEntries.push({ point, index });
      occupiedCells.add(cellKey);
    }
  });

  input.points.forEach((point, index) => {
    const cellKey = getDensityCellKey(point, input.zoom, cellSize);

    if (
      occupiedCells.has(cellKey) ||
      isProtectedDensityPoint(point, input.activePointId, input.hoveredPointId)
    ) {
      return;
    }

    const entries = entriesByCell.get(cellKey);
    if (entries) {
      entries.push({ point, index });
    } else {
      entriesByCell.set(cellKey, [{ point, index }]);
    }
  });

  const representatives = Array.from(entriesByCell.entries()).map(([cellKey, entries]) => ({
    ...pickDensityRepresentative(entries, cellKey, input.fairRotationSeed),
    cellKey,
  }));
  const maxRendered = getDensityMaxRenderedPoints(input.zoom);
  const availableSlots = Math.max(0, maxRendered - protectedEntries.length);
  const limitedRepresentatives =
    representatives.length > availableSlots
      ? representatives
          .sort((left, right) => {
            const leftHash = getStableHash(`${left.cellKey}:${input.fairRotationSeed}`);
            const rightHash = getStableHash(`${right.cellKey}:${input.fairRotationSeed}`);
            return leftHash - rightHash;
          })
          .slice(0, availableSlots)
      : representatives;

  const selected = [...protectedEntries, ...limitedRepresentatives]
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.point);

  return markFeaturedLowZoomPricePoints(selected, input.zoom, input.activePointId);
}

function shouldUsePriceSizeForOverlap(point: YandexMapPoint, zoom: number): boolean {
  return (
    hasPointPriceLabel(point) &&
    (zoom >= PRICE_MARKER_MIN_ZOOM || point.isViewed === true || point.showPriceAtLowZoom === true)
  );
}

function shouldUseCategorySizeForOverlap(point: YandexMapPoint, zoom: number): boolean {
  return (
    hasPointMarkerCategory(point) && !hasPointPriceLabel(point) && zoom >= CATEGORY_MARKER_MIN_ZOOM
  );
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

  if (shouldUseCategorySizeForOverlap(point, zoom)) {
    const halfWidth = CATEGORY_MARKER_SIZE / 2 + MARKER_OVERLAP_PADDING_PX;

    return {
      index,
      left: x - halfWidth,
      right: x + halfWidth,
      top: y - CATEGORY_MARKER_TOTAL_HEIGHT - MARKER_OVERLAP_PADDING_PX,
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
  markerKind: MarkerVisualKind;
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
    balloonOffset: getBalloonOffset(input.markerKind),
  };
}

function getBalloonOffset(markerKind: MarkerVisualKind): [number, number] {
  if (markerKind === "price") {
    return [0, -(PRICE_MARKER_HEIGHT + PRICE_MARKER_TAIL_HEIGHT + PRICE_BALLOON_GAP_PX)];
  }

  if (markerKind === "category") {
    return CATEGORY_BALLOON_OFFSET;
  }

  return DOT_BALLOON_OFFSET;
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

function buildCategoryPlacemarkOptions(input: {
  point: YandexMapPoint;
  activePointId: string | null;
  hoveredPointId: string | null;
  baseZIndex: number;
  layouts: CategoryLayouts;
}): Record<string, unknown> {
  const isActive = input.point.id === input.activePointId;
  const isHovered = input.point.id === input.hoveredPointId && !isActive;
  const isViewed = input.point.isViewed === true && !isActive && !isHovered;
  const halfWidth = CATEGORY_MARKER_SIZE / 2;
  const category = hasPointMarkerCategory(input.point) ? input.point.markerCategory : "landmark";
  const layouts = input.layouts[category] ?? input.layouts.landmark;
  const zIndex = getMarkerZIndex({ isActive, isHovered, baseZIndex: input.baseZIndex });

  return {
    ...buildMarkerLayerOptions(zIndex),
    iconLayout: "default#imageWithContent",
    iconImageHref: TRANSPARENT_PIXEL,
    iconImageSize: [1, 1],
    iconImageOffset: [0, 0],
    iconContentLayout: isActive
      ? layouts.active
      : isHovered
        ? layouts.hover
        : isViewed
          ? layouts.viewed
          : layouts.default,
    iconContentOffset: [-halfWidth, -CATEGORY_MARKER_TOTAL_HEIGHT],
    iconContentSize: [CATEGORY_MARKER_SIZE, CATEGORY_MARKER_TOTAL_HEIGHT],
    iconShape: {
      type: "Rectangle",
      coordinates: [
        [-halfWidth, -CATEGORY_MARKER_TOTAL_HEIGHT],
        [halfWidth, 0],
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
  categoryLayouts: CategoryLayouts;
}): Record<string, unknown> {
  const markerKind = getMarkerVisualKind({
    point: input.point,
    activePointId: input.activePointId,
    zoom: input.zoom,
  });

  if (markerKind === "price") {
    return buildPricePlacemarkOptions({
      point: input.point,
      activePointId: input.activePointId,
      hoveredPointId: input.hoveredPointId,
      baseZIndex: input.baseZIndex,
      layouts: input.priceLayouts,
    });
  }

  if (markerKind === "category") {
    return buildCategoryPlacemarkOptions({
      point: input.point,
      activePointId: input.activePointId,
      hoveredPointId: input.hoveredPointId,
      baseZIndex: input.baseZIndex,
      layouts: input.categoryLayouts,
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
  if (viewport?.center) {
    map.setCenter(viewport.center, viewport.zoom ?? DEFAULT_ZOOM, { duration: 220 });
    return;
  }

  if (viewport?.bounds) {
    map.setBounds(viewport.bounds, {
      checkZoomRange: true,
      zoomMargin: 44,
      duration: 220,
    });
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
  customZoomControls = false,
  customZoomControlsClassName,
  showBalloons = true,
  frameless = false,
}: YandexMapMultiViewerProps) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YandexMapInstance | null>(null);
  const placemarkByIdRef = useRef<Map<string, YandexPlacemarkInstance>>(new Map());
  const displayPointsRef = useRef<YandexMapPoint[]>([]);
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
  const boundsReportTimerRef = useRef<number | null>(null);
  const pendingBoundsReportRef = useRef<{
    bounds: [[number, number], [number, number]] | null;
    viewport: YandexMapViewport;
  } | null>(null);
  const suppressResizeBoundsUntilRef = useRef(0);
  const showBalloonsRef = useRef(showBalloons);
  const markerBaseZIndexByPointIdRef = useRef<Map<string, number>>(new Map());
  const priceLayoutsRef = useRef<PriceLayouts | null>(null);
  const dotLayoutsRef = useRef<DotLayouts | null>(null);
  const categoryLayoutsRef = useRef<CategoryLayouts | null>(null);
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
  const [scriptRetryNonce, setScriptRetryNonce] = useState(0);
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

  const markerDensityZoom = useMemo(() => getMarkerDensityZoomBucket(mapZoom), [mapZoom]);
  const displayPoints = useMemo(
    () =>
      buildDensityLimitedPoints({
        points: normalizedPoints,
        zoom: markerDensityZoom,
        activePointId: null,
        hoveredPointId: null,
        fairRotationSeed,
      }),
    [fairRotationSeed, markerDensityZoom, normalizedPoints],
  );
  const displayPointsRenderSignature = useMemo(
    () =>
      displayPoints
        .map((point) =>
          [
            point.id,
            point.latitude.toFixed(5),
            point.longitude.toFixed(5),
            point.title,
            point.priceLabel ?? "",
            point.previewImageUrl ?? "",
            point.rating ?? "",
            point.reviewsCount ?? "",
            point.balloonVariant ?? "",
            point.markerCategory ?? "",
            point.markerCategoryLabel ?? "",
          ].join("\u001f"),
        )
        .join("\u001e"),
    [displayPoints],
  );

  const pointById = useMemo(
    () => new Map(displayPoints.map((point) => [point.id, point])),
    [displayPoints],
  );
  const markerBaseZIndexByPointId = useMemo(
    () => buildMarkerBaseZIndexByPointId(displayPoints, mapZoom, fairRotationSeed),
    [displayPoints, fairRotationSeed, mapZoom],
  );

  useEffect(() => {
    displayPointsRef.current = displayPoints;
  }, [displayPoints]);

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

  const clearBoundsReportTimer = useCallback(() => {
    if (boundsReportTimerRef.current === null) {
      return;
    }

    window.clearTimeout(boundsReportTimerRef.current);
    boundsReportTimerRef.current = null;
  }, []);

  const reportCurrentBounds = useCallback(
    (map: YandexMapInstance) => {
      clearBoundsReportTimer();
      pendingBoundsReportRef.current = null;
      const bounds = normalizeMapBounds(map.getBounds());
      boundsChangeHandlerRef.current?.(bounds, getMapViewport(map, bounds));
    },
    [clearBoundsReportTimer],
  );

  const scheduleBoundsReport = useCallback(
    (
      map: YandexMapInstance,
      bounds: [[number, number], [number, number]] | null,
      zoom?: number,
      delayMs = MAP_BOUNDS_IDLE_DEBOUNCE_MS,
    ) => {
      pendingBoundsReportRef.current = {
        bounds,
        viewport: getMapViewport(map, bounds, zoom),
      };

      clearBoundsReportTimer();
      boundsReportTimerRef.current = window.setTimeout(() => {
        boundsReportTimerRef.current = null;
        const pending = pendingBoundsReportRef.current;
        pendingBoundsReportRef.current = null;

        if (!pending) {
          return;
        }

        boundsChangeHandlerRef.current?.(pending.bounds, pending.viewport);
      }, delayMs);
    },
    [clearBoundsReportTimer],
  );

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
    const categoryLayouts = categoryLayoutsRef.current;
    if (!priceLayouts || !dotLayouts || !categoryLayouts) {
      return;
    }

    placemarkByIdRef.current.forEach((placemark, pointId) => {
      const point = pointById.get(pointId);
      if (!point) {
        return;
      }

      const markerKind = getMarkerVisualKind({
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
        categoryLayouts,
      });

      if (showBalloonsRef.current) {
        visualOptions.balloonOffset = getBalloonOffset(markerKind);
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

  const changeMapZoom = useCallback((direction: 1 | -1) => {
    const map = mapRef.current;
    if (!map || !mapCreatedRef.current) {
      return;
    }

    const nextZoom = clampNumber(getMapZoom(map) + direction, CUSTOM_ZOOM_MIN, CUSTOM_ZOOM_MAX);
    const center = normalizeMapCenter(map.getCenter()) ?? DEFAULT_CENTER;
    map.setCenter(center, nextZoom, { duration: 180 });
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
          categoryLayoutsRef.current = createCategoryLayouts(readyYmaps);
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
            if (Date.now() <= suppressResizeBoundsUntilRef.current) {
              return;
            }
            const bounds = eventBounds ?? normalizeMapBounds(map.getBounds());
            scheduleBoundsReport(map, bounds, nextZoom);
          });

          map.events.add("actionend", () => {
            if (Date.now() <= suppressResizeBoundsUntilRef.current) {
              return;
            }

            const bounds = normalizeMapBounds(map.getBounds());
            scheduleBoundsReport(map, bounds, getMapZoom(map));
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
      clearBoundsReportTimer();
      pendingBoundsReportRef.current = null;
      closeAllBalloons();
      placemarkStore.clear();
      hoveredPointerPointIdRef.current = null;
      mapCreatedRef.current = false;
      pointsSignatureRef.current = "";
      appliedViewportKeyRef.current = null;
      lastCenteredActiveRef.current = null;
      priceLayoutsRef.current = null;
      dotLayoutsRef.current = null;
      categoryLayoutsRef.current = null;
      balloonContentLayoutsRef.current = null;
      mapZoomRef.current = DEFAULT_ZOOM;
    };
  }, [
    apiKey,
    clearBoundsReportTimer,
    clearHoverClearTimer,
    closeAllBalloons,
    controlsSignature,
    reportCurrentBounds,
    scheduleBoundsReport,
    scriptRetryNonce,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = getYandexApi();
    const priceLayouts = priceLayoutsRef.current;
    const dotLayouts = dotLayoutsRef.current;
    const categoryLayouts = categoryLayoutsRef.current;
    const balloonContentLayouts = balloonContentLayoutsRef.current;

    if (
      !map ||
      !ymaps ||
      !priceLayouts ||
      !dotLayouts ||
      !categoryLayouts ||
      !balloonContentLayouts ||
      !mapCreatedRef.current
    ) {
      return;
    }

    closeAllBalloons();
    removePlacemarksFromMap();

    const currentDisplayPoints = displayPointsRef.current;
    const currentActivePointId = activePointIdRef.current;
    const currentHoveredPointId = hoveredPointIdRef.current;
    const currentZoom = mapZoomRef.current;

    currentDisplayPoints.forEach((point) => {
      const hasPriceLabel = hasPointPriceLabel(point);
      const markerKind = getMarkerVisualKind({
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
      const safeCategoryLabel = escapeHtml(resolveMarkerCategoryLabel(point));
      const isTitleOnlyBalloon = point.balloonVariant === "title-only";
      const balloonContentLayout = isTitleOnlyBalloon
        ? balloonContentLayouts.titleOnly
        : balloonContentLayouts.details;
      const balloonOptions = showBalloonsRef.current
        ? buildBalloonPlacemarkOptions({
            markerKind,
            balloonContentLayout,
          })
        : {
            hasBalloon: false,
            openEmptyBalloon: false,
          };
      const balloonFallbackHtml = isTitleOnlyBalloon
        ? buildTitleOnlyBalloonContentFallbackHtml({
            title: safeTitle,
            categoryLabel: safeCategoryLabel,
          })
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
          balloonCategoryLabel: safeCategoryLabel,
          balloonCategoryDisplay: safeCategoryLabel ? "block" : "none",
          balloonPriceLabel: safePriceLabel,
          balloonImageUrl: safeImageUrl,
          balloonRatingLabel: safeRatingLabel,
          balloonReviewsLabel: safeReviewsLabel,
          hintContent: safeCategoryLabel ? `${safeTitle} - ${safeCategoryLabel}` : safeTitle,
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
            categoryLayouts,
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
    if (pointsChanged) {
      lastCenteredActiveRef.current = null;
    }

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
    displayPointsRenderSignature,
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
      suppressResizeBoundsUntilRef.current = Date.now() + 350;
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
    <div className="yandex-map-multi-viewer relative h-full w-full space-y-2">
      <div
        ref={containerRef}
        className={`${frameless ? "overflow-hidden bg-cream/45" : "overflow-hidden rounded-xl border border-olive/16 bg-cream/45"} ${className}`}
      />
      {customZoomControls ? (
        <div
          className={cn(
            "pointer-events-auto absolute bottom-12 right-4 z-[70] flex w-12 flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] ring-1 ring-black/5",
            customZoomControlsClassName,
          )}
        >
          <button
            type="button"
            onClick={() => changeMapZoom(1)}
            className="flex h-12 w-12 items-center justify-center text-[#202124] transition hover:bg-slate-50 active:bg-slate-100"
            aria-label="Увеличить карту"
          >
            <AppIcon icon={Plus} className="h-5 w-5 text-[#202124]" />
          </button>
          <span className="mx-2 h-px bg-slate-200" aria-hidden="true" />
          <button
            type="button"
            onClick={() => changeMapZoom(-1)}
            className="flex h-12 w-12 items-center justify-center text-[#202124] transition hover:bg-slate-50 active:bg-slate-100"
            aria-label="Уменьшить карту"
          >
            <AppIcon icon={Minus} className="h-5 w-5 text-[#202124]" />
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>{error}</p>
          <button
            type="button"
            className="mt-1 font-semibold text-amber-900 underline-offset-2 hover:underline"
            onClick={() => {
              setError("");
              setScriptRetryNonce((value) => value + 1);
            }}
          >
            Повторить загрузку карты
          </button>
        </div>
      ) : null}
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

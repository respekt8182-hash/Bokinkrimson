"use client";

import { ChevronDown, ChevronUp, ExternalLink, Map as MapIcon, Maximize2, X } from "lucide-react";
import dynamic from "next/dynamic";
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
import type {
  YandexMapMarkerCategory,
  YandexMapPoint,
  YandexMapRadiusCircle,
  YandexMapViewport,
} from "@/components/maps/yandex-map-multi-viewer";
import { AppIcon } from "@/components/ui/app-icon";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useCatalogMapPlacement } from "@/hooks/use-catalog-map-placement";
import {
  buildCatalogMapViewportScope,
  markCatalogMapItemViewed,
  readCatalogMapViewedItems,
  readCatalogMapViewport,
  writeCatalogMapViewport,
} from "@/lib/catalog-map-memory";
import { fetchWithRetry } from "@/lib/client-retry-fetch";
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
  activeBoundsParam?: string | null;
  isLoading?: boolean;
  mapItemsEndpoint?: string | null;
  boundsQueryChangeDelayMs?: number;
  onBoundsQueryChange?: (bounds: string | null) => void;
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
const MOBILE_MAP_BUTTON_SCROLL_THRESHOLD = 180;
const CATALOG_MAP_ITEM_SELECTOR = "[data-catalog-map-item-id]";
const MAP_BOUNDS_UPDATE_DELAY_MS = 350;
const MAP_BOUNDS_PRECISION = 4;
const MAP_RADIUS_VIEWPORT_PADDING = 1.18;

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

function parseMapBoundsFilter(value: string | null): [[number, number], [number, number]] | null {
  if (!value) {
    return null;
  }

  const [south, west, north, east] = value.split(",").map((part) => Number.parseFloat(part));
  if (![south, west, north, east].every(Number.isFinite)) {
    return null;
  }

  if (south >= north || west >= east) {
    return null;
  }

  return [
    [south, west],
    [north, east],
  ];
}

function buildRadiusViewportBounds(
  latitude: number | null,
  longitude: number | null,
  radiusKm: number | null,
): [[number, number], [number, number]] | null {
  if (
    latitude === null ||
    longitude === null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    radiusKm === null ||
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0
  ) {
    return null;
  }

  const paddedRadiusKm = radiusKm * MAP_RADIUS_VIEWPORT_PADDING;
  const latitudeDelta = paddedRadiusKm / 111.32;
  const longitudeScale = Math.cos((latitude * Math.PI) / 180);
  const longitudeDelta = paddedRadiusKm / (111.32 * Math.max(0.2, Math.abs(longitudeScale)));

  return [
    [clamp(latitude - latitudeDelta, -90, 90), clamp(longitude - longitudeDelta, -180, 180)],
    [clamp(latitude + latitudeDelta, -90, 90), clamp(longitude + longitudeDelta, -180, 180)],
  ];
}

function buildViewportKey(input: {
  boundsParam: string | null;
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number;
}): string | null {
  if (input.boundsParam) {
    return `bounds:${input.boundsParam}`;
  }

  if (
    input.centerLat !== null &&
    input.centerLng !== null &&
    Number.isFinite(input.centerLat) &&
    Number.isFinite(input.centerLng) &&
    Number.isFinite(input.radiusKm) &&
    input.radiusKm > 0
  ) {
    return [
      "radius",
      input.centerLat.toFixed(5),
      input.centerLng.toFixed(5),
      Math.round(input.radiusKm * 10) / 10,
    ].join(":");
  }

  return null;
}

function isPointInsideViewportBounds(
  item: { latitude: number | null; longitude: number | null },
  bounds: [[number, number], [number, number]] | null,
): boolean {
  if (!bounds) {
    return true;
  }

  if (item.latitude === null || item.longitude === null) {
    return false;
  }

  const south = bounds[0][0];
  const west = bounds[0][1];
  const north = bounds[1][0];
  const east = bounds[1][1];

  return (
    item.latitude >= south &&
    item.latitude <= north &&
    item.longitude >= west &&
    item.longitude <= east
  );
}

function getNearestMobileSheetSnap(top: number, snaps: MobileSheetSnaps): MobileSheetSnap {
  return (Object.entries(snaps) as Array<[MobileSheetSnap, number]>).reduce(
    (nearest, entry) => (Math.abs(entry[1] - top) < Math.abs(nearest[1] - top) ? entry : nearest),
    ["preview", snaps.preview],
  )[0];
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

function MapNetworkNotice({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-3 bottom-3 z-[80] rounded-2xl bg-white/94 px-3 py-2 text-xs font-medium text-amber-700 shadow-sm ring-1 ring-black/5",
        className,
      )}
    >
      {message}
    </div>
  );
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

const cp1252ByteByChar: Record<string, number> = {
  "\u20ac": 0x80,
  "\u201a": 0x82,
  "\u0192": 0x83,
  "\u201e": 0x84,
  "\u2026": 0x85,
  "\u2020": 0x86,
  "\u2021": 0x87,
  "\u02c6": 0x88,
  "\u2030": 0x89,
  "\u0160": 0x8a,
  "\u2039": 0x8b,
  "\u0152": 0x8c,
  "\u017d": 0x8e,
  "\u2018": 0x91,
  "\u2019": 0x92,
  "\u201c": 0x93,
  "\u201d": 0x94,
  "\u2022": 0x95,
  "\u2013": 0x96,
  "\u2014": 0x97,
  "\u02dc": 0x98,
  "\u2122": 0x99,
  "\u0161": 0x9a,
  "\u203a": 0x9b,
  "\u0153": 0x9c,
  "\u017e": 0x9e,
  "\u0178": 0x9f,
};

const utf8TextDecoder =
  typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8", { fatal: false });

type AttractionMarkerCategoryRule = {
  category: YandexMapMarkerCategory;
  keywords: string[];
};

const attractionMarkerPrimaryCategoryRules: AttractionMarkerCategoryRule[] = [
  {
    category: "beach",
    keywords: ["пляжи и купание", "пляжи и набережные", "природа и пляжи"],
  },
  {
    category: "sea",
    keywords: ["море бухты мысы и маяки", "маяки и виды"],
  },
  {
    category: "mountain",
    keywords: ["горы скалы и пещеры", "горы и смотровые", "пещеры", "природа и маршруты"],
  },
  {
    category: "water",
    keywords: ["водопады озера и водоемы", "природа и водопады", "природа и озера", "водопады"],
  },
  {
    category: "reserve",
    keywords: ["заповедники урочища и природные парки", "природа и заповедники"],
  },
  {
    category: "history",
    keywords: [
      "история археология и военные объекты",
      "история и мемориалы",
      "история и археология",
      "крепости",
      "крепости и древности",
      "пещерные города",
      "пещерные города и монастыри",
    ],
  },
  {
    category: "religion",
    keywords: ["храмы монастыри и религия", "храмы и исторические места", "храмы и святыни"],
  },
  {
    category: "palace",
    keywords: ["дворцы дачи и архитектура", "дворцы и архитектура", "дворцы и парки"],
  },
  {
    category: "culture",
    keywords: ["музеи культура и памятники", "музеи и выставки", "музеи"],
  },
  {
    category: "city",
    keywords: [
      "городские прогулки парки и инфраструктура",
      "парки и сады",
      "парки и дворцы",
      "инженерные объекты",
    ],
  },
  {
    category: "entertainment",
    keywords: ["развлечения и семейный отдых", "семейный отдых", "досуг и места отдыха"],
  },
  {
    category: "winery",
    keywords: ["винодельни гастро и производства", "винодельни"],
  },
  {
    category: "route",
    keywords: ["смотровые и маршруты", "маршруты и тропы"],
  },
];

const attractionMarkerIdentityCategoryRules: AttractionMarkerCategoryRule[] = [
  {
    category: "entertainment",
    keywords: [
      "delfin",
      "akvarium",
      "aquarium",
      "zoopark",
      "safari",
      "taygan",
      "akvapark",
      "krokodil",
      "teatr",
      "theater",
      "circus",
      "attrakcion",
      "family",
      "\u0434\u0435\u043b\u044c\u0444\u0438\u043d",
      "\u0430\u043a\u0432\u0430\u0440\u0438",
      "\u0437\u043e\u043e",
      "\u0441\u0430\u0444\u0430\u0440\u0438",
      "\u0430\u043a\u0432\u0430\u043f\u0430\u0440\u043a",
      "\u0442\u0435\u0430\u0442\u0440",
      "\u0446\u0438\u0440\u043a",
      "\u0430\u0442\u0442\u0440\u0430\u043a\u0446",
      "\u0441\u0435\u043c\u0435\u0439",
    ],
  },
  {
    category: "route",
    keywords: [
      "smotrov",
      "vidov",
      "besedka",
      "obzorn",
      "\u0441\u043c\u043e\u0442\u0440\u043e\u0432",
      "\u0432\u0438\u0434\u043e\u0432",
      "\u0431\u0435\u0441\u0435\u0434",
      "\u043e\u0431\u0437\u043e\u0440\u043d",
    ],
  },
  {
    category: "mountain",
    keywords: [
      "peshcher",
      "mramornaya",
      "krasnaya",
      "eminne",
      "bair",
      "kolodets",
      "shaht",
      "\u043f\u0435\u0449\u0435\u0440",
      "\u043a\u043e\u043b\u043e\u0434\u0435\u0446",
      "\u0448\u0430\u0445\u0442",
    ],
  },
  {
    category: "beach",
    keywords: [
      "plyazh",
      "pljazh",
      "beach",
      "kupalen",
      "kupaln",
      "\u043f\u043b\u044f\u0436",
      "\u043a\u0443\u043f\u0430\u043b\u044c\u043d",
    ],
  },
  {
    category: "sea",
    keywords: [
      "buhta",
      "bukhta",
      "mys",
      "mayak",
      "more",
      "kosa",
      "lighthouse",
      "\u0431\u0443\u0445\u0442",
      "\u043c\u044b\u0441",
      "\u043c\u0430\u044f\u043a",
      "\u043c\u043e\u0440\u0435",
      "\u043a\u043e\u0441\u0430",
    ],
  },
  {
    category: "water",
    keywords: [
      "vodopad",
      "ozero",
      "vodohran",
      "vodohranilishche",
      "vanna",
      "laguna",
      "liman",
      "istochnik",
      "rodnik",
      "gryaz",
      "\u0432\u043e\u0434\u043e\u043f\u0430\u0434",
      "\u043e\u0437\u0435\u0440",
      "\u0432\u043e\u0434\u043e\u0445\u0440\u0430\u043d",
      "\u043b\u0430\u0433\u0443\u043d",
      "\u043b\u0438\u043c\u0430\u043d",
      "\u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a",
      "\u0440\u043e\u0434\u043d\u0438\u043a",
      "\u0432\u0430\u043d\u043d",
      "\u0433\u0440\u044f\u0437",
    ],
  },
  {
    category: "route",
    keywords: [
      "tropa",
      "marshrut",
      "trail",
      "ekotropa",
      "botkinskaya",
      "shtangeevskaya",
      "\u0442\u0440\u043e\u043f",
      "\u043c\u0430\u0440\u0448\u0440\u0443\u0442",
      "\u044d\u043a\u043e\u0442\u0440\u043e\u043f",
    ],
  },
  {
    category: "winery",
    keywords: [
      "vinodel",
      "vino",
      "winery",
      "vinn",
      "\u0432\u0438\u043d\u043e\u0434\u0435\u043b",
      "\u0432\u0438\u043d\u043d",
    ],
  },
  {
    category: "religion",
    keywords: [
      "hram",
      "sobor",
      "tserkov",
      "cerkov",
      "monastyr",
      "mechet",
      "kenassa",
      "surb",
      "svyato",
      "ioanna",
      "predtechi",
      "usypalnitsa",
      "\u0445\u0440\u0430\u043c",
      "\u0441\u043e\u0431\u043e\u0440",
      "\u0446\u0435\u0440\u043a\u043e\u0432",
      "\u043c\u043e\u043d\u0430\u0441\u0442\u044b\u0440",
      "\u043c\u0435\u0447\u0435\u0442",
      "\u043a\u0435\u043d\u0430\u0441",
    ],
  },
  {
    category: "history",
    keywords: [
      "pamyatnik",
      "memorial",
      "monument",
      "obelisk",
      "sapun",
      "malahov",
      "\u043f\u0430\u043c\u044f\u0442\u043d\u0438\u043a",
      "\u043c\u0435\u043c\u043e\u0440\u0438\u0430\u043b",
      "\u043e\u0431\u0435\u043b\u0438\u0441\u043a",
      "\u0441\u0430\u043f\u0443\u043d",
      "\u043c\u0430\u043b\u0430\u0445\u043e\u0432",
    ],
  },
  {
    category: "history",
    keywords: [
      "krepost",
      "kale",
      "bashnya",
      "batareya",
      "kurgan",
      "gorodishche",
      "fort",
      "hersones",
      "mangup",
      "chufut",
      "genuez",
      "neapol",
      "skifskiy",
      "\u043a\u0440\u0435\u043f\u043e\u0441\u0442",
      "\u0431\u0430\u0448\u043d",
      "\u0431\u0430\u0442\u0430\u0440\u0435",
      "\u043a\u0443\u0440\u0433\u0430\u043d",
      "\u0433\u043e\u0440\u043e\u0434\u0438\u0449",
    ],
  },
  {
    category: "palace",
    keywords: [
      "dvorets",
      "dvorec",
      "dvorts",
      "palace",
      "zamok",
      "usadba",
      "villa",
      "haraks",
      "dyulber",
      "kichkine",
      "mellas",
      "livadiyskiy",
      "vorontsovskiy",
      "hanskij",
      "\u0434\u0432\u043e\u0440\u0435\u0446",
      "\u0434\u0432\u043e\u0440\u0446",
      "\u0437\u0430\u043c\u043e\u043a",
      "\u0443\u0441\u0430\u0434\u044c\u0431",
      "\u0432\u0438\u043b\u043b",
    ],
  },
  {
    category: "culture",
    keywords: [
      "muzey",
      "muzej",
      "museum",
      "galere",
      "panoram",
      "dioram",
      "vystavo",
      "\u043c\u0443\u0437\u0435",
      "\u0433\u0430\u043b\u0435\u0440",
      "\u043f\u0430\u043d\u043e\u0440\u0430\u043c",
      "\u0434\u0438\u043e\u0440\u0430\u043c",
      "\u0432\u044b\u0441\u0442\u0430\u0432",
    ],
  },
  {
    category: "city",
    keywords: [
      "park",
      "sad",
      "botanich",
      "skver",
      "naberezhn",
      "bulvar",
      "ploshchad",
      "\u043f\u0430\u0440\u043a",
      "\u0441\u0430\u0434",
      "\u0431\u043e\u0442\u0430\u043d\u0438\u0447",
      "\u0441\u043a\u0432\u0435\u0440",
      "\u043d\u0430\u0431\u0435\u0440\u0435\u0436",
      "\u0431\u0443\u043b\u044c\u0432\u0430\u0440",
      "\u043f\u043b\u043e\u0449\u0430\u0434",
    ],
  },
  {
    category: "reserve",
    keywords: [
      "zapoved",
      "urochishche",
      "roshcha",
      "les",
      "zakaznik",
      "\u0437\u0430\u043f\u043e\u0432\u0435\u0434",
      "\u0443\u0440\u043e\u0447\u0438\u0449",
      "\u0440\u043e\u0449",
      "\u043b\u0435\u0441",
      "\u0437\u0430\u043a\u0430\u0437\u043d\u0438\u043a",
    ],
  },
  {
    category: "mountain",
    keywords: [
      "gora",
      "mountain",
      "skala",
      "kaya",
      "mys",
      "kanon",
      "yayla",
      "dolina",
      "les",
      "roshcha",
      "demerdzhi",
      "chatyr",
      "ay-petri",
      "ai-petri",
      "tarhankut",
      "fiolent",
      "balka",
      "prirod",
      "vulkan",
      "karer",
      "ostrov",
      "\u0433\u043e\u0440\u0430",
      "\u0433\u043e\u0440\u044b",
      "\u0441\u043a\u0430\u043b",
      "\u043c\u044b\u0441",
      "\u043a\u0430\u043d\u044c\u043e\u043d",
      "\u044f\u0439\u043b",
      "\u0434\u043e\u043b\u0438\u043d",
      "\u043f\u0440\u0438\u0440\u043e\u0434",
      "\u0432\u0443\u043b\u043a\u0430\u043d",
      "\u043a\u0430\u0440\u044c\u0435\u0440",
      "\u043e\u0441\u0442\u0440\u043e\u0432",
    ],
  },
];

const attractionMarkerCategoryFallbackRules: AttractionMarkerCategoryRule[] = [
  {
    category: "beach",
    keywords: ["\u043f\u043b\u044f\u0436"],
  },
  {
    category: "culture",
    keywords: ["\u043c\u0443\u0437\u0435", "\u0432\u044b\u0441\u0442\u0430\u0432"],
  },
  {
    category: "entertainment",
    keywords: ["\u0441\u0435\u043c\u0435\u0439"],
  },
  {
    category: "route",
    keywords: [
      "\u0433\u043e\u0440\u044b \u0438 \u0441\u043c\u043e\u0442\u0440\u043e\u0432",
      "\u0441\u043c\u043e\u0442\u0440\u043e\u0432",
      "\u0432\u0438\u0434\u044b",
    ],
  },
  {
    category: "sea",
    keywords: [
      "\u043c\u043e\u0440\u0435",
      "\u0431\u0443\u0445\u0442",
      "\u043c\u044b\u0441",
      "\u043c\u0430\u044f\u043a",
    ],
  },
  {
    category: "winery",
    keywords: ["\u0432\u0438\u043d\u043e\u0434\u0435\u043b", "\u0432\u0438\u043d\u043d"],
  },
  {
    category: "religion",
    keywords: ["\u0445\u0440\u0430\u043c", "\u0441\u0432\u044f\u0442\u044b\u043d"],
  },
  {
    category: "history",
    keywords: [
      "\u043a\u0440\u0435\u043f\u043e\u0441\u0442",
      "\u0434\u0440\u0435\u0432\u043d\u043e\u0441\u0442",
    ],
  },
  {
    category: "city",
    keywords: [
      "\u043f\u0430\u0440\u043a\u0438 \u0438 \u0441\u0430\u0434",
      "\u043f\u0430\u0440\u043a\u0438 \u0438 \u0441\u0435\u043c\u0435\u0439",
      "\u043f\u0430\u0440\u043a\u0438 \u0438 \u0434\u0432\u043e\u0440\u0446",
    ],
  },
  {
    category: "palace",
    keywords: [
      "\u0434\u0432\u043e\u0440\u0446\u044b \u0438 \u0430\u0440\u0445\u0438\u0442\u0435\u043a\u0442",
      "\u0434\u0432\u043e\u0440\u0446\u044b \u0438 \u043f\u0430\u0440\u043a",
      "\u0434\u0432\u043e\u0440\u0446",
    ],
  },
  {
    category: "mountain",
    keywords: ["\u043f\u0435\u0449\u0435\u0440"],
  },
  {
    category: "water",
    keywords: ["\u0432\u043e\u0434\u043e\u043f\u0430\u0434", "\u043e\u0437\u0435\u0440"],
  },
  {
    category: "route",
    keywords: [
      "\u043c\u0430\u0440\u0448\u0440\u0443\u0442\u044b \u0438 \u0442\u0440\u043e\u043f\u044b",
    ],
  },
  {
    category: "history",
    keywords: [
      "\u043c\u0435\u043c\u043e\u0440\u0438\u0430\u043b",
      "\u0430\u0440\u0445\u0435\u043e\u043b\u043e\u0433",
    ],
  },
  {
    category: "reserve",
    keywords: ["\u0437\u0430\u043f\u043e\u0432\u0435\u0434"],
  },
  {
    category: "mountain",
    keywords: [
      "\u043f\u0440\u0438\u0440\u043e\u0434",
      "\u0433\u043e\u0440",
      "\u0441\u043a\u0430\u043b",
    ],
  },
];

function repairMojibake(value: string): string {
  if (!/[\u00c2\u00c3\u00d0\u00d1]/.test(value) || !utf8TextDecoder) {
    return value;
  }

  const bytes: number[] = [];
  for (const char of value) {
    const code = char.charCodeAt(0);
    const mappedByte = cp1252ByteByChar[char];

    if (mappedByte !== undefined) {
      bytes.push(mappedByte);
      continue;
    }

    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }

    return value;
  }

  const decoded = utf8TextDecoder.decode(new Uint8Array(bytes));
  return decoded && !decoded.includes("\ufffd") ? decoded : value;
}

function normalizeMarkerSearchText(value: string | null | undefined): string {
  const repaired = repairMojibake(value ?? "");
  return repaired
    .toLowerCase()
    .replaceAll("\u0451", "\u0435")
    .replace(/[^a-z0-9\u0430-\u044f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAttractionMarkerSearchText(values: Array<string | null | undefined>): string {
  return values
    .flatMap((value) => {
      const normalized = normalizeMarkerSearchText(value);
      const rawNormalized = (value ?? "").toLowerCase();
      return normalized === rawNormalized ? [normalized] : [rawNormalized, normalized];
    })
    .filter(Boolean)
    .join(" ");
}

function getAttractionMarkerIdentitySearchText(
  item: PublicAttractionCatalogItem | PublicAttractionMapItem,
): string {
  return buildAttractionMarkerSearchText([item.id, item.path, item.title, ...item.tags]);
}

function getAttractionMarkerCategorySearchText(
  item: PublicAttractionCatalogItem | PublicAttractionMapItem,
): string {
  return buildAttractionMarkerSearchText([item.category]);
}

function findAttractionMarkerCategory(
  text: string,
  rules: AttractionMarkerCategoryRule[],
): YandexMapMarkerCategory | null {
  const match = rules.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));
  return match?.category ?? null;
}

function resolveAttractionMarkerCategory(
  item: PublicAttractionCatalogItem | PublicAttractionMapItem,
): YandexMapMarkerCategory {
  const primaryCategory = findAttractionMarkerCategory(
    getAttractionMarkerCategorySearchText(item),
    attractionMarkerPrimaryCategoryRules,
  );
  if (primaryCategory) {
    return primaryCategory;
  }

  const identityCategory = findAttractionMarkerCategory(
    getAttractionMarkerIdentitySearchText(item),
    attractionMarkerIdentityCategoryRules,
  );
  if (identityCategory) {
    return identityCategory;
  }

  const fallbackCategory = findAttractionMarkerCategory(
    getAttractionMarkerCategorySearchText(item),
    attractionMarkerCategoryFallbackRules,
  );

  return fallbackCategory ?? "landmark";
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

  const attraction = item as PublicAttractionCatalogItem | PublicAttractionMapItem;

  return {
    id: attraction.id,
    title: attraction.title,
    latitude: item.latitude,
    longitude: item.longitude,
    priceLabel: null,
    previewImageUrl: attraction.coverImageUrl,
    rating: null,
    reviewsCount: 0,
    balloonVariant: "title-only",
    markerCategory: resolveAttractionMarkerCategory(attraction),
    markerCategoryLabel: attraction.category ?? attraction.tags[0] ?? null,
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
          data-catalog-detail-link="attractions"
          data-catalog-item-id={item.id}
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
          data-catalog-detail-link="attractions"
          data-catalog-item-id={item.id}
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
          data-catalog-detail-link="transfers"
          data-catalog-item-id={item.id}
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
          data-catalog-detail-link="transfers"
          data-catalog-item-id={item.id}
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
  activeBoundsParam,
  isLoading = false,
  mapItemsEndpoint = null,
  boundsQueryChangeDelayMs = MAP_BOUNDS_UPDATE_DELAY_MS,
  onBoundsQueryChange,
  children,
}: MarketplaceCatalogMapProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const currentBoundsParam =
    activeBoundsParam !== undefined
      ? activeBoundsParam?.trim() || null
      : searchParams.get("bounds")?.trim() || null;
  const mobileStageRef = useRef<HTMLDivElement | null>(null);
  const desktopMapShellRef = useRef<HTMLElement | null>(null);
  const mobileResultsScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileSheetDragRef = useRef<MobileSheetDragState | null>(null);
  const mobileSheetTopRef = useRef<number | null>(null);
  const mobileDragHandledRef = useRef(false);
  const mobileResultsScrollTopRef = useRef(0);
  const mobileChromeProgressRef = useRef(0);
  const boundsUpdateTimerRef = useRef<number | null>(null);
  const lastRequestedBoundsRef = useRef<string | null>(currentBoundsParam);
  const hasMapInteractionRef = useRef(false);
  const mapBoundsQueryRef = useRef<string | null>(currentBoundsParam);
  const suppressBoundsSyncUntilRef = useRef(0);
  const mapPlacement = useCatalogMapPlacement();
  const isAttractionsCatalog = kind === "attractions";
  const mapViewportStorageScope = useMemo(
    () => buildCatalogMapViewportScope(pathname, searchParamsString),
    [pathname, searchParamsString],
  );
  const [storedMapViewport, setStoredMapViewport] = useState<YandexMapViewport | null>(() =>
    readCatalogMapViewport(kind, mapViewportStorageScope),
  );
  const [mapInteractionBoundsParam, setMapInteractionBoundsParam] = useState<string | null>(null);
  const [hasMapViewportInteraction, setHasMapViewportInteraction] = useState(false);
  const currentBounds = useMemo(
    () => parseMapBoundsFilter(currentBoundsParam),
    [currentBoundsParam],
  );
  const isCurrentBoundsFromMapInteraction =
    currentBoundsParam !== null &&
    (hasMapViewportInteraction || currentBoundsParam === mapInteractionBoundsParam);
  const hasStrictAttractionRadiusScope =
    kind === "attractions" &&
    filters.centerLat !== null &&
    filters.centerLng !== null &&
    Number.isFinite(filters.centerLat) &&
    Number.isFinite(filters.centerLng) &&
    Number.isFinite(filters.radiusKm) &&
    filters.radiusKm > 0;
  const initialMapViewport = useMemo<YandexMapViewport | null>(() => {
    if (currentBounds && !isCurrentBoundsFromMapInteraction) {
      return { bounds: currentBounds };
    }

    if (storedMapViewport) {
      return storedMapViewport;
    }

    const radiusBounds = buildRadiusViewportBounds(
      filters.centerLat,
      filters.centerLng,
      filters.radiusKm,
    );

    return radiusBounds ? { bounds: radiusBounds } : null;
  }, [
    currentBounds,
    filters.centerLat,
    filters.centerLng,
    filters.radiusKm,
    isCurrentBoundsFromMapInteraction,
    storedMapViewport,
  ]);
  const initialMapViewportKey = useMemo(() => {
    if (currentBounds && !isCurrentBoundsFromMapInteraction && currentBoundsParam) {
      return `bounds:${currentBoundsParam}`;
    }

    if (storedMapViewport) {
      return `memory:${kind}:${mapViewportStorageScope}`;
    }

    return buildViewportKey({
      boundsParam: isCurrentBoundsFromMapInteraction ? null : currentBoundsParam,
      centerLat: filters.centerLat,
      centerLng: filters.centerLng,
      radiusKm: filters.radiusKm,
    });
  }, [
    currentBounds,
    currentBoundsParam,
    filters.centerLat,
    filters.centerLng,
    filters.radiusKm,
    isCurrentBoundsFromMapInteraction,
    kind,
    mapViewportStorageScope,
    storedMapViewport,
  ]);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mobileSheetSnap, setMobileSheetSnap] = useState<MobileSheetSnap>("preview");
  const [mobileSheetTop, setMobileSheetTop] = useState<number | null>(null);
  const [mobileStageHeight, setMobileStageHeight] = useState(0);
  const [mobileMapButtonVisible, setMobileMapButtonVisible] = useState(false);
  const [isMobileSheetDragging, setIsMobileSheetDragging] = useState(false);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const pointFilterBounds = isCurrentBoundsFromMapInteraction ? null : currentBounds;
  const [loadedMapItemsState, setLoadedMapItemsState] = useState<{
    endpoint: string;
    items: MarketplaceCatalogMapItem[];
  } | null>(null);
  const [isMapItemsLoading, setIsMapItemsLoading] = useState(false);
  const [mapItemsErrorMessage, setMapItemsErrorMessage] = useState("");
  const [viewedPointIds, setViewedPointIds] = useState<Set<string>>(() =>
    readCatalogMapViewedItems(kind),
  );
  useBodyScrollLock(mapExpanded);

  useEffect(() => {
    setStoredMapViewport(readCatalogMapViewport(kind, mapViewportStorageScope));
  }, [kind, mapViewportStorageScope]);

  useEffect(() => {
    const refreshViewedItems = () => {
      setViewedPointIds(readCatalogMapViewedItems(kind));
    };

    refreshViewedItems();
    window.addEventListener("pageshow", refreshViewedItems);
    window.addEventListener("focus", refreshViewedItems);

    return () => {
      window.removeEventListener("pageshow", refreshViewedItems);
      window.removeEventListener("focus", refreshViewedItems);
    };
  }, [kind]);

  const shouldLoadRemoteMapItems =
    Boolean(mapItemsEndpoint) &&
    (mapExpanded ||
      mapPlacement === "desktop" ||
      mapPlacement === "tablet" ||
      mobileSheetSnap !== "preview");

  useEffect(() => {
    const endpoint = shouldLoadRemoteMapItems ? (mapItemsEndpoint ?? "") : "";
    if (!endpoint) {
      setIsMapItemsLoading(false);
      return;
    }

    if (loadedMapItemsState?.endpoint === endpoint) {
      setIsMapItemsLoading(false);
      return;
    }

    let isDisposed = false;
    const controller = new AbortController();

    async function loadMapItems() {
      setMapItemsErrorMessage("");
      setIsMapItemsLoading(true);

      try {
        const response = await fetchWithRetry(endpoint, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
          retries: 2,
          retryDelayMs: 450,
          timeoutMs: 9_000,
        });

        if (!response.ok) {
          throw new Error("map_items_fetch_failed");
        }

        const payload = (await response.json()) as {
          items?: MarketplaceCatalogMapItem[];
          map_points?: MarketplaceCatalogMapItem[];
        };
        const nextItems = Array.isArray(payload.items)
          ? payload.items
          : Array.isArray(payload.map_points)
            ? payload.map_points
            : null;

        if (!isDisposed && nextItems) {
          setLoadedMapItemsState({ endpoint, items: nextItems });
        }
      } catch {
        if (!isDisposed && !controller.signal.aborted) {
          setMapItemsErrorMessage("Не удалось загрузить все точки карты. Показана текущая выдача.");
        }
      } finally {
        if (!isDisposed) {
          setIsMapItemsLoading(false);
        }
      }
    }

    void loadMapItems();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [loadedMapItemsState?.endpoint, mapItemsEndpoint, shouldLoadRemoteMapItems]);

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

          if (
            hasStrictAttractionRadiusScope &&
            haversineKm(centerLat!, centerLng!, item.latitude, item.longitude) > radiusKm!
          ) {
            return false;
          }

          if (!isPointInsideViewportBounds(item, pointFilterBounds)) {
            return false;
          }

          if (
            !hasStrictAttractionRadiusScope &&
            !pointFilterBounds &&
            !currentBounds &&
            hasRadiusCenter &&
            radiusKm !== null
          ) {
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
  }, [
    filters.centerLat,
    filters.centerLng,
    filters.radiusKm,
    hasStrictAttractionRadiusScope,
    kind,
    currentBounds,
    pointFilterBounds,
    resolvedItems,
    viewedPointIds,
  ]);

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
  const mapNetworkNotice = mapItemsErrorMessage ? (
    <MapNetworkNotice message={mapItemsErrorMessage} />
  ) : null;
  const showMapLoading = isLoading || isMapItemsLoading;

  const mobileSheetSnaps = useMemo<MobileSheetSnaps>(() => {
    const height = mobileStageHeight || 640;
    const collapsed = Math.max(
      0,
      height - MOBILE_SHEET_HANDLE_HEIGHT - MOBILE_SHEET_BOTTOM_CLEARANCE,
    );
    const preview = clamp(Math.round(height * 0.5), 150, Math.max(150, collapsed - 118));

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
    (bounds: [[number, number], [number, number]] | null, viewport?: YandexMapViewport) => {
      const normalizedBounds = formatMapBoundsFilter(bounds);
      if (hasMapInteractionRef.current && bounds) {
        writeCatalogMapViewport(kind, mapViewportStorageScope, viewport ?? { bounds });
      }

      if (hasStrictAttractionRadiusScope) {
        mapBoundsQueryRef.current = null;
        lastRequestedBoundsRef.current = null;
        if (boundsUpdateTimerRef.current !== null) {
          window.clearTimeout(boundsUpdateTimerRef.current);
          boundsUpdateTimerRef.current = null;
        }
        return;
      }

      const shouldSuppressBoundsSync = Date.now() <= suppressBoundsSyncUntilRef.current;
      if (normalizedBounds !== mapBoundsQueryRef.current) {
        mapBoundsQueryRef.current = normalizedBounds;
      }

      if (shouldSuppressBoundsSync) {
        return;
      }
      suppressBoundsSyncUntilRef.current = 0;

      if (!hasMapInteractionRef.current) {
        return;
      }

      const lastRequestedBounds = lastRequestedBoundsRef.current;

      if (normalizedBounds === lastRequestedBounds) {
        return;
      }

      if (boundsUpdateTimerRef.current !== null) {
        window.clearTimeout(boundsUpdateTimerRef.current);
        boundsUpdateTimerRef.current = null;
      }
      lastRequestedBoundsRef.current = normalizedBounds;

      const publishBoundsChange = () => {
        setMapInteractionBoundsParam((current) =>
          current === normalizedBounds ? current : normalizedBounds,
        );
        onBoundsQueryChange?.(normalizedBounds);
      };

      if (!syncBoundsToUrl && boundsQueryChangeDelayMs <= 0) {
        publishBoundsChange();
        return;
      }

      boundsUpdateTimerRef.current = window.setTimeout(() => {
        boundsUpdateTimerRef.current = null;
        const nextParams = new URLSearchParams(window.location.search);
        const liveBounds = nextParams.get("bounds")?.trim() || null;

        publishBoundsChange();

        if (!syncBoundsToUrl) {
          return;
        }

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
      }, boundsQueryChangeDelayMs);
    },
    [
      hasStrictAttractionRadiusScope,
      boundsQueryChangeDelayMs,
      kind,
      mapViewportStorageScope,
      onBoundsQueryChange,
      pathname,
      router,
      syncBoundsToUrl,
    ],
  );

  const markMapInteraction = useCallback(() => {
    hasMapInteractionRef.current = true;
    setHasMapViewportInteraction((current) => (current ? current : true));
  }, []);

  const handleMapWheelCapture = useCallback(() => {
    markMapInteraction();
  }, [markMapInteraction]);

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
    (event: ReactPointerEvent<HTMLElement>) => {
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
    (event: ReactPointerEvent<HTMLElement>) => {
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
    (event: ReactPointerEvent<HTMLElement>) => {
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
    (event: ReactPointerEvent<HTMLElement>) => {
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
      markMapInteraction();
      suppressBoundsSyncUntilRef.current = Date.now() + 900;
      setViewedPointIds((prev) => {
        const next = markCatalogMapItemViewed(kind, pointId);
        if (prev.has(pointId) && prev.size === next.size) {
          return prev;
        }

        return next;
      });
      setActivePointId(pointId);
      setHoveredCardId(null);
      setHoveredPointId(null);

      if (mapPlacement === "mobile") {
        snapMobileSheet("collapsed");
      }
    },
    [kind, mapPlacement, markMapInteraction, snapMobileSheet],
  );

  const openMobileMapInSearch = useCallback(() => {
    setActivePointId(null);
    setHoveredCardId(null);
    setHoveredPointId(null);
    setMobileChromeProgress(0, true);
    snapMobileSheet("collapsed");
  }, [setMobileChromeProgress, snapMobileSheet]);

  const handleMobileMapPointerDown = useCallback(() => {
    markMapInteraction();

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
  }, [mapPlacement, markMapInteraction, mobileSheetSnap, snapMobileSheet]);

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
    if (mapPlacement !== "mobile" || mapExpanded) {
      setMobileMapButtonVisible(false);
      return;
    }

    let frame = 0;
    const updateVisibility = () => {
      frame = 0;
      const results =
        mobileResultsScrollRef.current ?? document.getElementById("catalog-results");

      if (!results) {
        setMobileMapButtonVisible(false);
        return;
      }

      const resultsTop = results.getBoundingClientRect().top + window.scrollY;
      setMobileMapButtonVisible(
        window.scrollY - resultsTop >= MOBILE_MAP_BUTTON_SCROLL_THRESHOLD,
      );
    };
    const scheduleVisibilityUpdate = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(updateVisibility);
      }
    };

    updateVisibility();
    window.addEventListener("scroll", scheduleVisibilityUpdate, { passive: true });
    window.addEventListener("resize", scheduleVisibilityUpdate);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", scheduleVisibilityUpdate);
      window.removeEventListener("resize", scheduleVisibilityUpdate);
    };
  }, [mapExpanded, mapPlacement, mobileSheetSnap]);

  useEffect(() => {
    return () => {
      if (boundsUpdateTimerRef.current !== null) {
        window.clearTimeout(boundsUpdateTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    lastRequestedBoundsRef.current = currentBoundsParam;
    mapBoundsQueryRef.current = currentBoundsParam;
    if (!currentBoundsParam) {
      hasMapInteractionRef.current = false;
    }
  }, [currentBoundsParam]);

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

  useLayoutEffect(() => {
    if (mapPlacement !== "desktop") {
      return;
    }

    let frame = 0;

    const updateDesktopMapChrome = () => {
      frame = 0;
      const mapShell = desktopMapShellRef.current;
      if (!mapShell) {
        return;
      }

      const viewportHeight = window.innerHeight || 0;
      const rect = mapShell.getBoundingClientRect();
      const top = Math.round(Math.max(0, rect.top));
      const nextTop = clamp(top, 96, Math.max(96, viewportHeight - 320));
      mapShell.style.setProperty("--catalog-map-control-left", `${Math.round(rect.left + 16)}px`);
      mapShell.style.setProperty("--catalog-map-control-top", `${nextTop + 16}px`);
      mapShell.style.removeProperty("--catalog-map-visible-top");
      mapShell.dataset.mapYandexChrome = nextTop <= 120 ? "full" : "compact";
    };

    const scheduleUpdate = () => {
      if (frame !== 0) {
        return;
      }

      frame = window.requestAnimationFrame(updateDesktopMapChrome);
    };

    updateDesktopMapChrome();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);

    const settleTimer = window.setTimeout(updateDesktopMapChrome, 240);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      window.clearTimeout(settleTimer);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
    };
  }, [mapPlacement]);

  function handleMobileResultsScroll(event: ReactUIEvent<HTMLDivElement>) {
    const currentScrollTop = event.currentTarget.scrollTop;
    const previousScrollTop = mobileResultsScrollTopRef.current;
    mobileResultsScrollTopRef.current = currentScrollTop;
    setMobileMapButtonVisible(currentScrollTop >= MOBILE_MAP_BUTTON_SCROLL_THRESHOLD);

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
    mobileMapButtonVisible;
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
            className={cn(
              "catalog-map-mobile-stage relative min-h-[360px] overflow-hidden bg-[#e7eef3]",
              isMobileSheetExpanded && "catalog-map-mobile-stage-document-scroll",
            )}
            style={{
              height: isMobileSheetExpanded
                ? "auto"
                : mobileStageHeight
                  ? `${mobileStageHeight}px`
                  : `min(${MOBILE_STAGE_MAX_HEIGHT}px, 100dvh)`,
            }}
          >
            <div
              className={cn(
                "absolute",
                isMobileSheetExpanded ? "inset-x-0 top-0 h-[100dvh]" : "inset-0",
              )}
              onPointerDownCapture={handleMobileMapPointerDown}
              onWheelCapture={handleMapWheelCapture}
            >
              <YandexMapMultiViewer
                points={mapPoints}
                activePointId={activePointId}
                hoveredPointId={highlightedMapPointId}
                onPointClick={handlePointClick}
                onPointHoverChange={setHoveredPointId}
                onBoundsChange={handleMapBoundsChange}
                initialViewport={initialMapViewport}
                viewportKey={initialMapViewportKey ?? undefined}
                radiusCircle={radiusCircle}
                controls={[]}
                showBalloons={false}
                frameless
                fitPointsOnChange="never"
                className="h-full w-full"
              />
            </div>

            {showMapLoading ? <MapLoadingDotsPill className="top-3" /> : null}
            {mapNetworkNotice}

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
                "z-40 bg-transparent will-change-transform",
                isMobileSheetExpanded
                  ? "relative h-auto"
                  : "absolute inset-x-0 top-0 h-full",
                isMobileSheetDragging
                  ? "transition-none"
                  : "transition-transform duration-300 ease-out",
              )}
              style={{
                transform: `translate3d(0, ${isMobileSheetExpanded ? 0 : resolvedMobileSheetTop}px, 0)`,
              }}
            >
              {!isMobileSheetExpanded ? <div className="md:hidden">{mobileSheetHandle}</div> : null}
              <div
                ref={mobileResultsScrollRef}
                onScroll={handleMobileResultsScroll}
                onPointerDown={isMobileSheetExpanded ? undefined : handleMobileSheetPointerDown}
                onPointerMove={isMobileSheetExpanded ? undefined : handleMobileSheetPointerMove}
                onPointerUp={isMobileSheetExpanded ? undefined : handleMobileSheetPointerUp}
                onPointerCancel={
                  isMobileSheetExpanded ? undefined : handleMobileSheetPointerCancel
                }
                onMouseOver={handleCatalogCardMouseOver}
                onMouseOut={handleCatalogCardMouseOut}
                className={cn(
                  "bg-[#f4f6fb] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)] shadow-[0_-18px_38px_rgba(15,23,42,0.15)] transition-opacity duration-150",
                  isMobileSheetExpanded
                    ? "h-auto overflow-visible pt-0"
                    : "h-[calc(100%-76px)] touch-none overflow-y-auto overscroll-y-auto rounded-t-[28px] pt-4",
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
              initialViewport={initialMapViewport}
              viewportKey={initialMapViewportKey ?? undefined}
              radiusCircle={radiusCircle}
              controls={[]}
              fitPointsOnChange="never"
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
        <section
          className={cn(
            "mb-4 hidden overflow-hidden bg-[#e7eef3] md:block lg:hidden",
            isAttractionsCatalog && "catalog-map-surface",
          )}
        >
          <div className="hidden">
            <div>
              <p className="text-sm font-semibold text-olive">{mapTitle}</p>
              <p className="text-xs text-olive/65">{mapStatsLabel}</p>
            </div>
          </div>
          <div
            className="relative h-[320px] overflow-hidden"
            onPointerDownCapture={markMapInteraction}
            onWheelCapture={handleMapWheelCapture}
          >
            <YandexMapMultiViewer
              points={mapPoints}
              activePointId={activePointId}
              hoveredPointId={highlightedMapPointId}
              onPointClick={handlePointClick}
              onPointHoverChange={setHoveredPointId}
              onBoundsChange={handleMapBoundsChange}
              initialViewport={initialMapViewport}
              viewportKey={initialMapViewportKey ?? undefined}
              radiusCircle={radiusCircle}
              controls={isAttractionsCatalog ? [] : undefined}
              customZoomControls={isAttractionsCatalog}
              showBalloons={false}
              frameless
              fitPointsOnChange="never"
              className="h-full w-full"
            />
            {showMapLoading ? <MapLoadingDotsPill /> : null}
            {mapNetworkNotice}
            <div
              className={cn(
                "pointer-events-none absolute top-3 z-30 flex items-start",
                isAttractionsCatalog ? "left-4 top-4 justify-start" : "right-3 justify-end",
              )}
            >
              <button
                type="button"
                onClick={openMapFully}
                className={cn(
                  "pointer-events-auto inline-flex items-center gap-3 bg-white px-4 text-sm font-semibold text-[#202124] shadow-[0_12px_28px_rgba(15,23,42,0.18)] ring-1 ring-black/5 transition hover:bg-white/96",
                  isAttractionsCatalog ? "h-11 rounded-xl" : "h-12 rounded-2xl",
                )}
                aria-label="Раскрыть карту полностью"
              >
                <AppIcon
                  icon={isAttractionsCatalog ? Maximize2 : ExternalLink}
                  className="h-5 w-5"
                />
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
            : "catalog-layout public-catalog-layout grid gap-0 lg:grid-cols-[minmax(0,60%)_minmax(0,40%)]",
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
        <div className="lg:pl-6 lg:pr-5 xl:pl-10 xl:pr-6 2xl:pl-12">{children}</div>

        <aside
          ref={desktopMapShellRef}
          data-map-yandex-chrome="compact"
          className="catalog-map-sticky public-catalog-map relative hidden self-start overflow-visible lg:block lg:sticky lg:top-[var(--catalog-map-sticky-top)]"
        >
          <section
            className={cn(
              "relative h-full overflow-hidden bg-[#e7eef3]",
              isAttractionsCatalog && "catalog-map-surface",
            )}
          >
            <div className="hidden">
              <div>
                <p className="text-sm font-semibold text-olive">{mapTitle}</p>
                <p className="text-xs text-olive/65">{mapStatsLabel}</p>
              </div>
            </div>

            {mapPlacement === "desktop" ? (
              <div
                className="absolute inset-0"
                onPointerDownCapture={markMapInteraction}
                onWheelCapture={handleMapWheelCapture}
              >
                <YandexMapMultiViewer
                  points={mapPoints}
                  activePointId={activePointId}
                  hoveredPointId={highlightedMapPointId}
                  onPointClick={handlePointClick}
                  onPointHoverChange={setHoveredPointId}
                  onBoundsChange={handleMapBoundsChange}
                  initialViewport={initialMapViewport}
                  viewportKey={initialMapViewportKey ?? undefined}
                  radiusCircle={radiusCircle}
                  controls={[]}
                  customZoomControls
                  showBalloons={false}
                  frameless
                  fitPointsOnChange="never"
                  className="h-full w-full"
                />

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
                {showMapLoading ? <MapLoadingDotsPill /> : null}
                {mapNetworkNotice}
              </div>
            ) : null}
          </section>
          {mapPlacement === "desktop" ? (
            <div
              className={cn(
                "pointer-events-none absolute left-5 top-5 z-[1000] flex items-start justify-start",
                "catalog-map-expand-control",
              )}
            >
              <button
                type="button"
                onClick={openMapFully}
                className={cn(
                  "pointer-events-auto inline-flex items-center gap-3 bg-white px-4 text-sm font-semibold text-[#202124] shadow-[0_12px_28px_rgba(15,23,42,0.18)] ring-1 ring-black/5 transition hover:bg-white/96",
                  "h-11 rounded-xl",
                )}
                aria-label="Раскрыть карту полностью"
              >
                <AppIcon icon={Maximize2} className="h-5 w-5" />
                Раскрыть карту
              </button>
            </div>
          ) : null}
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
          <section
            className={cn(
              "relative h-full w-full overflow-hidden",
              isAttractionsCatalog && "catalog-map-surface",
            )}
          >
            <div
              className="absolute inset-0"
              onPointerDownCapture={markMapInteraction}
              onWheelCapture={handleMapWheelCapture}
            >
              <YandexMapMultiViewer
                points={mapPoints}
                activePointId={activePointId}
                hoveredPointId={highlightedMapPointId}
                onPointClick={handlePointClick}
                onPointHoverChange={setHoveredPointId}
                onBoundsChange={handleMapBoundsChange}
                initialViewport={initialMapViewport}
                viewportKey={initialMapViewportKey ?? undefined}
                radiusCircle={radiusCircle}
                controls={isAttractionsCatalog ? [] : ["zoomControl"]}
                customZoomControls={isAttractionsCatalog}
                showBalloons={false}
                frameless
                fitPointsOnChange="never"
                className="h-full min-h-[100dvh] w-full"
              />
            </div>

            {showMapLoading ? <MapLoadingDotsPill className="top-5" /> : null}
            {mapNetworkNotice}

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

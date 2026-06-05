export type CatalogMapMemoryKey = "housing" | "excursions" | "tours" | "attractions" | "transfers";

export type CatalogMapBounds = [[number, number], [number, number]];

export type CatalogMapViewportMemory = {
  bounds?: CatalogMapBounds;
  center?: [number, number];
  zoom?: number;
};

const viewedStoragePrefix = "krymvokrug.catalogMap.viewed";
const viewportStoragePrefix = "krymvokrug.catalogMap.viewport";
const maxViewedItems = 500;
const maxViewportAgeMs = 1000 * 60 * 90;

function getViewedStorageKey(catalogKey: CatalogMapMemoryKey): string {
  return `${viewedStoragePrefix}.${catalogKey}`;
}

function getViewportStorageKey(catalogKey: CatalogMapMemoryKey, scope: string): string {
  return `${viewportStoragePrefix}.${catalogKey}.${scope || "default"}`;
}

function normalizeItemId(itemId: string): string {
  return itemId.trim();
}

function isValidCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeCenter(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const latitude = value[0];
  const longitude = value[1];
  if (!isValidCoordinate(latitude) || !isValidCoordinate(longitude)) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return [latitude, longitude];
}

function normalizeZoom(value: unknown): number | null {
  if (!isValidCoordinate(value)) {
    return null;
  }

  return Math.min(22, Math.max(0, value));
}

function normalizeBounds(value: unknown): CatalogMapBounds | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const southWest = value[0];
  const northEast = value[1];
  if (
    !Array.isArray(southWest) ||
    !Array.isArray(northEast) ||
    southWest.length !== 2 ||
    northEast.length !== 2
  ) {
    return null;
  }

  const south = southWest[0];
  const west = southWest[1];
  const north = northEast[0];
  const east = northEast[1];
  if (
    !isValidCoordinate(south) ||
    !isValidCoordinate(west) ||
    !isValidCoordinate(north) ||
    !isValidCoordinate(east)
  ) {
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

function normalizeViewport(value: unknown): CatalogMapViewportMemory | null {
  const bounds = normalizeBounds(value);
  if (bounds) {
    return { bounds };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const input = value as { bounds?: unknown; center?: unknown; zoom?: unknown };
  const normalizedBounds = normalizeBounds(input.bounds);
  const center = normalizeCenter(input.center);
  const zoom = normalizeZoom(input.zoom);

  if (!normalizedBounds && !center) {
    return null;
  }

  return {
    ...(normalizedBounds ? { bounds: normalizedBounds } : {}),
    ...(center ? { center } : {}),
    ...(zoom !== null ? { zoom } : {}),
  };
}

function readViewedArray(catalogKey: CatalogMapMemoryKey): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getViewedStorageKey(catalogKey));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is string => typeof value === "string")
      .map(normalizeItemId)
      .filter(Boolean)
      .slice(0, maxViewedItems);
  } catch {
    return [];
  }
}

export function readCatalogMapViewedItems(catalogKey: CatalogMapMemoryKey): Set<string> {
  return new Set(readViewedArray(catalogKey));
}

export function markCatalogMapItemViewed(
  catalogKey: CatalogMapMemoryKey,
  itemId: string,
): Set<string> {
  const normalizedId = normalizeItemId(itemId);
  const previous = readViewedArray(catalogKey);
  const next = normalizedId
    ? [normalizedId, ...previous.filter((id) => id !== normalizedId)].slice(0, maxViewedItems)
    : previous;

  if (typeof window !== "undefined" && normalizedId) {
    try {
      window.localStorage.setItem(getViewedStorageKey(catalogKey), JSON.stringify(next));
    } catch {
      // Best-effort UI memory; navigation must keep working without storage.
    }
  }

  return new Set(next);
}

export function markCatalogMapItemViewedForKeys(
  catalogKeys: CatalogMapMemoryKey[],
  itemId: string,
): void {
  catalogKeys.forEach((catalogKey) => {
    markCatalogMapItemViewed(catalogKey, itemId);
  });
}

export function readCatalogMapViewport(
  catalogKey: CatalogMapMemoryKey,
  scope: string,
): CatalogMapViewportMemory | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const key = getViewportStorageKey(catalogKey, scope);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { updatedAt?: unknown };
    const viewport = normalizeViewport(parsed);
    const updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0;

    if (!viewport || Date.now() - updatedAt > maxViewportAgeMs) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return viewport;
  } catch {
    return null;
  }
}

export function writeCatalogMapViewport(
  catalogKey: CatalogMapMemoryKey,
  scope: string,
  viewport: CatalogMapViewportMemory | CatalogMapBounds | null,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedViewport = normalizeViewport(viewport);
  if (!normalizedViewport) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getViewportStorageKey(catalogKey, scope),
      JSON.stringify({
        ...normalizedViewport,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // Best-effort UI memory; the map still works without persisted viewport.
  }
}

export function buildCatalogMapViewportScope(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete("bounds");
  params.delete("page");

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname || "/";
}

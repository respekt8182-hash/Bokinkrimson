// Shared parsers/helpers for search and map API contracts.
export type MapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type NumberRange = {
  min: number;
  max: number;
};

function clamp(value: number, range: NumberRange): number {
  return Math.min(range.max, Math.max(range.min, value));
}

export function parseIntParam(
  raw: string | null,
  fallback: number,
  range: NumberRange,
): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return clamp(parsed, range);
}

export function parseOptionalIntParam(
  raw: string | null,
  range: NumberRange,
): number | undefined {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return clamp(parsed, range);
}

export function parseOptionalFloatParam(
  raw: string | null,
  range: NumberRange,
): number | undefined {
  const parsed = Number.parseFloat(raw ?? "");
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return clamp(parsed, range);
}

// Supports "south,west,north,east" format used by map bounds filters.
export function parseBoundsParam(raw: string | null): MapBounds | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }

  const parts = value.split(",").map((item) => Number.parseFloat(item.trim()));
  if (parts.length !== 4 || parts.some((item) => !Number.isFinite(item))) {
    return null;
  }

  const [south, west, north, east] = parts;
  if (south > north || west > east) {
    return null;
  }

  return {
    south: clamp(south, { min: -90, max: 90 }),
    west: clamp(west, { min: -180, max: 180 }),
    north: clamp(north, { min: -90, max: 90 }),
    east: clamp(east, { min: -180, max: 180 }),
  };
}

export function isPointInsideBounds(
  latitude: number | null,
  longitude: number | null,
  bounds: MapBounds | null,
): boolean {
  if (latitude === null || longitude === null) {
    return false;
  }

  if (!bounds) {
    return true;
  }

  return (
    latitude >= bounds.south &&
    latitude <= bounds.north &&
    longitude >= bounds.west &&
    longitude <= bounds.east
  );
}

export function pickFirstListValue(raw: string | null): string | undefined {
  const value = raw?.trim();
  if (!value) {
    return undefined;
  }

  const first = value.split(",")[0]?.trim();
  return first || undefined;
}

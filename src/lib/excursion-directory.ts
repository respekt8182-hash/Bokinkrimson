// Excursion directory service: read/search/resolve location, district, and category references with fuzzy matching helpers.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { rankByTrigram } from "@/lib/fuzzy";

export type ExcursionDistrictDirectoryItem = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
};

export type ExcursionCategoryDirectoryItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type ExcursionLocationDirectoryItem = {
  id: string;
  slug: string;
  name: string;
  normalizedName: string;
  kind: string;
  districtId: string | null;
  districtName: string | null;
  latitude: number | null;
  longitude: number | null;
  aliases: string[];
  isMajor: boolean;
};

type ResolveExcursionLocationInput = {
  locationId?: string | null;
  location?: string | null;
};

export function normalizeExcursionLocationName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase().replace(/ё/g, "е");
}

function toNumberOrNull(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

function mapLocationRow(
  row: {
    id: string;
    slug: string;
    name: string;
    normalizedName: string;
    kind: string;
    districtId: string | null;
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
    aliases: string[];
    isMajor: boolean;
    district: { name: string } | null;
  },
): ExcursionLocationDirectoryItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    normalizedName: row.normalizedName,
    kind: row.kind,
    districtId: row.districtId,
    districtName: row.district?.name ?? null,
    latitude: toNumberOrNull(row.latitude),
    longitude: toNumberOrNull(row.longitude),
    aliases: row.aliases,
    isMajor: row.isMajor,
  };
}

export async function getExcursionDistrictDirectory(): Promise<ExcursionDistrictDirectoryItem[]> {
  const rows = await db.excursionDistrict.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
    },
  });

  return rows;
}

export async function getExcursionCategoryDirectory(): Promise<ExcursionCategoryDirectoryItem[]> {
  const rows = await db.excursionCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      isActive: true,
      sortOrder: true,
    },
  });

  return rows;
}

type SearchExcursionLocationOptions = {
  limit?: number;
  majorOnly?: boolean;
  districtId?: string | null;
};

export async function searchExcursionLocationDirectory(
  query: string,
  options?: SearchExcursionLocationOptions,
): Promise<ExcursionLocationDirectoryItem[]> {
  const limit = Math.max(1, Math.min(30, options?.limit ?? 8));
  const normalizedQuery = query.trim();

  const rows = await db.excursionLocation.findMany({
    where: {
      ...(options?.majorOnly ? { isMajor: true } : {}),
      ...(options?.districtId ? { districtId: options.districtId } : {}),
    },
    orderBy: [{ isMajor: "desc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      normalizedName: true,
      kind: true,
      districtId: true,
      latitude: true,
      longitude: true,
      aliases: true,
      isMajor: true,
      district: {
        select: { name: true },
      },
    },
    take: normalizedQuery.length < 2 ? limit : 500,
  });

  const mapped = rows.map(mapLocationRow);
  if (normalizedQuery.length < 2) {
    return mapped.slice(0, limit);
  }

  return rankByTrigram(
    normalizedQuery,
    mapped,
    (item) => [item.name, item.slug, ...item.aliases, item.districtName],
    {
      limit,
      minScore: 0.08,
    },
  );
}

export async function getExcursionLocationByIdOrSlug(
  idOrSlug: string | null | undefined,
): Promise<ExcursionLocationDirectoryItem | null> {
  if (!idOrSlug) {
    return null;
  }

  const row = await db.excursionLocation.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      normalizedName: true,
      kind: true,
      districtId: true,
      latitude: true,
      longitude: true,
      aliases: true,
      isMajor: true,
      district: {
        select: { name: true },
      },
    },
  });

  return row ? mapLocationRow(row) : null;
}

export async function resolveExcursionLocation(
  input: ResolveExcursionLocationInput,
): Promise<ExcursionLocationDirectoryItem | null> {
  const byId = await getExcursionLocationByIdOrSlug(input.locationId ?? null);
  if (byId) {
    return byId;
  }

  const value = input.location?.trim();
  if (!value) {
    return null;
  }

  const normalized = normalizeExcursionLocationName(value);
  const exactByNormalizedName = await db.excursionLocation.findFirst({
    where: { normalizedName: normalized },
    select: {
      id: true,
      slug: true,
      name: true,
      normalizedName: true,
      kind: true,
      districtId: true,
      latitude: true,
      longitude: true,
      aliases: true,
      isMajor: true,
      district: {
        select: { name: true },
      },
    },
  });

  if (exactByNormalizedName) {
    return mapLocationRow(exactByNormalizedName);
  }

  const [best] = await searchExcursionLocationDirectory(value, { limit: 1 });
  return best ?? null;
}

export function haversineDistanceKm(
  pointA: { latitude: number; longitude: number },
  pointB: { latitude: number; longitude: number },
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(pointB.latitude - pointA.latitude);
  const dLng = toRadians(pointB.longitude - pointA.longitude);
  const lat1 = toRadians(pointA.latitude);
  const lat2 = toRadians(pointB.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export async function findNearestMajorExcursionLocation(input: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
}): Promise<(ExcursionLocationDirectoryItem & { distanceKm: number }) | null> {
  const radiusKm = input.radiusKm ?? 35;
  const rows = await db.excursionLocation.findMany({
    where: {
      isMajor: true,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      normalizedName: true,
      kind: true,
      districtId: true,
      latitude: true,
      longitude: true,
      aliases: true,
      isMajor: true,
      district: {
        select: { name: true },
      },
    },
  });

  const nearest = rows
    .map((row) => {
      const item = mapLocationRow(row);
      if (item.latitude === null || item.longitude === null) {
        return null;
      }
      return {
        item,
        distanceKm: haversineDistanceKm(
          { latitude: input.latitude, longitude: input.longitude },
          { latitude: item.latitude, longitude: item.longitude },
        ),
      };
    })
    .filter((entry): entry is { item: ExcursionLocationDirectoryItem; distanceKm: number } => Boolean(entry))
    .sort((left, right) => left.distanceKm - right.distanceKm)[0];

  if (!nearest || nearest.distanceKm > radiusKm) {
    return null;
  }

  return {
    ...nearest.item,
    distanceKm: nearest.distanceKm,
  };
}

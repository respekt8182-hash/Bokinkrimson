import { existsSync } from "fs";
import path from "path";
import { ExcursionSessionStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { haversineDistanceKm } from "@/lib/excursion-directory";
import {
  buildProgramRouteSummary,
  formatAvailabilitySummary,
  getResolvedAvailabilityMode,
} from "@/lib/excursion-offers";
import { buildPublicExcursionPath } from "@/lib/public-excursions";
import { buildPublicPropertyPath, resolvePublicCatalogDisplayState } from "@/lib/public-properties";
import {
  buildPublishedExcursionVisibilityWhere,
  buildPublishedPropertyVisibilityWhere,
} from "@/lib/public-visibility";

const ROAD_DISTANCE_FACTOR = 1.3;

export const DEFAULT_NEARBY_RADIUS_KM = 10;

export type NearbyExcursionItem = {
  id: string;
  path: string;
  title: string;
  routeSummary: string;
  availabilitySummary: string;
  coverImageUrl: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
  priceUnitLabel: string | null;
  distanceKm: number;
};

export type NearbyPropertyItem = {
  id: string;
  path: string;
  name: string;
  locationName: string | null;
  coverImageUrl: string | null;
  minNightPrice: number | null;
  currency: string | null;
  distanceKm: number;
};

function toRoadDistanceKm(haversineKm: number): number {
  return Number((haversineKm * ROAD_DISTANCE_FACTOR).toFixed(1));
}

function normalizePublicAssetUrls(urls: string[]): string[] {
  return urls.filter((url) => {
    const trimmed = url.trim();
    if (!trimmed.startsWith("/uploads/")) {
      return trimmed.length > 0;
    }

    const relativePath = decodeURIComponent(trimmed.slice(1));
    const absolutePath = path.join(process.cwd(), "public", ...relativePath.split("/"));
    return existsSync(absolutePath);
  });
}

function shuffleItems<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

const nearbyExcursionSelect = Prisma.validator<Prisma.ExcursionSelect>()({
  id: true,
  title: true,
  locationId: true,
  locationName: true,
  latitude: true,
  longitude: true,
  startPoint: true,
  finishPoint: true,
  durationMinutes: true,
  durationDays: true,
  durationNights: true,
  priceFrom: true,
  priceTo: true,
  currency: true,
  priceUnitLabel: true,
  offerType: true,
  availabilityMode: true,
  scheduleMode: true,
  scheduleText: true,
  availabilityNote: true,
  photoUrls: true,
  mainLocation: {
    select: {
      name: true,
    },
  },
  anchorLocation: {
    select: {
      slug: true,
      name: true,
    },
  },
  routeLocations: {
    orderBy: [{ sortOrder: "asc" }],
    select: {
      location: {
        select: {
          name: true,
        },
      },
    },
  },
  sessions: {
    where: {
      status: ExcursionSessionStatus.AVAILABLE,
      startAt: {
        gte: new Date(),
      },
    },
    orderBy: [{ startAt: "asc" }],
    take: 1,
    select: {
      startAt: true,
    },
  },
});

const nearbyPropertySelect = Prisma.validator<Prisma.PropertySelect>()({
  id: true,
  status: true,
  pendingEditStatus: true,
  publishedSnapshot: true,
  name: true,
  type: true,
  locationId: true,
  locationName: true,
  address: true,
  seaDistance: true,
  latitude: true,
  longitude: true,
  description: true,
  checkInFrom: true,
  childrenAllowed: true,
  petsPolicy: true,
  starRating: true,
  media: {
    where: { roomId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: 6,
    select: {
      type: true,
      url: true,
    },
  },
  rooms: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      beds: true,
      extraBeds: true,
      areaSqm: true,
      prices: {
        select: {
          dateFrom: true,
          dateTo: true,
          price: true,
          minGuests: true,
          currency: true,
        },
      },
    },
  },
});

type NearbyExcursionRecord = Prisma.ExcursionGetPayload<{
  select: typeof nearbyExcursionSelect;
}>;

type NearbyPropertyRecord = Prisma.PropertyGetPayload<{
  select: typeof nearbyPropertySelect;
}>;

function getMinNightPrice(
  rooms: Array<{
    prices: Array<{
      price: number;
      currency: string;
    }>;
  }>,
): { minNightPrice: number | null; currency: string | null } {
  let minNightPrice: number | null = null;
  let currency: string | null = null;

  for (const room of rooms) {
    for (const price of room.prices) {
      if (minNightPrice === null || price.price < minNightPrice) {
        minNightPrice = price.price;
        currency = price.currency;
      }
    }
  }

  return { minNightPrice, currency };
}

function buildNearbyExcursionItem(
  row: NearbyExcursionRecord,
  distanceKm: number,
): NearbyExcursionItem {
  const coverImageUrl =
    normalizePublicAssetUrls(
      Array.isArray(row.photoUrls)
        ? row.photoUrls.filter((value): value is string => typeof value === "string")
        : [],
    )[0] ?? null;
  const nextSessionStartAt = row.sessions[0]?.startAt ?? null;

  return {
    id: row.id,
    path: buildPublicExcursionPath({
      id: row.id,
      locationId: row.locationId,
      title: row.title,
      anchorLocation: row.anchorLocation,
    }),
    title: row.title ?? "Экскурсия",
    routeSummary: buildProgramRouteSummary({
      routePoints: row.routeLocations.map((route) => route.location.name),
      startPoint: row.startPoint,
      finishPoint: row.finishPoint,
      mainLocationName: row.mainLocation?.name ?? null,
      anchorLocationName: row.anchorLocation?.name ?? row.locationName,
      locationName: row.locationName,
      maxPoints: 4,
    }),
    availabilitySummary: formatAvailabilitySummary({
      availabilityMode: getResolvedAvailabilityMode(row.availabilityMode, row.scheduleMode),
      scheduleMode: row.scheduleMode,
      scheduleText: row.scheduleText,
      availabilityNote: row.availabilityNote,
      nextSessionStartAt,
    }),
    coverImageUrl,
    priceFrom: row.priceFrom === null ? null : Number(row.priceFrom),
    priceTo: row.priceTo === null ? null : Number(row.priceTo),
    currency: row.currency,
    priceUnitLabel: row.priceUnitLabel,
    distanceKm,
  };
}

function buildNearbyPropertyItem(
  row: NearbyPropertyRecord,
  distanceKm: number,
): NearbyPropertyItem {
  const displayState = resolvePublicCatalogDisplayState(row);
  const pricing = getMinNightPrice(
    displayState.rooms.map((room) => ({
      prices: room.prices.map((price) => ({
        price: Number(price.price),
        currency: price.currency,
      })),
    })),
  );

  return {
    id: row.id,
    path: buildPublicPropertyPath({
      id: row.id,
      locationId: displayState.locationId,
      name: displayState.name,
    }),
    name: displayState.name ?? "Объект размещения",
    locationName: displayState.locationName,
    coverImageUrl: displayState.imageUrls[0] ?? null,
    minNightPrice: pricing.minNightPrice,
    currency: pricing.currency,
    distanceKm,
  };
}

export async function getNearbyExcursions(input: {
  latitude: number | null;
  longitude: number | null;
  excludeId?: string | null;
  radiusKm?: number;
  limit?: number;
}): Promise<NearbyExcursionItem[]> {
  if (input.latitude === null || input.longitude === null) {
    return [];
  }

  const origin = {
    latitude: input.latitude,
    longitude: input.longitude,
  };
  const radiusKm = input.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM;
  const rows = await db.excursion.findMany({
    where: {
      ...buildPublishedExcursionVisibilityWhere(),
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      latitude: { not: null },
      longitude: { not: null },
    },
    select: nearbyExcursionSelect,
    take: 5000,
  });

  return rows
    .map((row) => {
      const latitude = row.latitude === null ? null : Number(row.latitude);
      const longitude = row.longitude === null ? null : Number(row.longitude);

      if (latitude === null || longitude === null) {
        return null;
      }

      const roadDistanceKm = toRoadDistanceKm(haversineDistanceKm(origin, { latitude, longitude }));

      if (roadDistanceKm > radiusKm) {
        return null;
      }

      return buildNearbyExcursionItem(row, roadDistanceKm);
    })
    .filter((item): item is NearbyExcursionItem => Boolean(item))
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, input.limit ?? 4);
}

export async function getNearbyProperties(input: {
  latitude: number | null;
  longitude: number | null;
  excludeId?: string | null;
  radiusKm?: number;
  limit?: number;
  randomize?: boolean;
}): Promise<NearbyPropertyItem[]> {
  if (input.latitude === null || input.longitude === null) {
    return [];
  }

  const origin = {
    latitude: input.latitude,
    longitude: input.longitude,
  };
  const radiusKm = input.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM;
  const rows = await db.property.findMany({
    where: {
      ...buildPublishedPropertyVisibilityWhere(),
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: nearbyPropertySelect,
    take: 5000,
  });

  const candidates = rows
    .map((row) => {
      const displayState = resolvePublicCatalogDisplayState(row);
      if (displayState.latitude === null || displayState.longitude === null) {
        return null;
      }

      const roadDistanceKm = toRoadDistanceKm(
        haversineDistanceKm(origin, {
          latitude: displayState.latitude,
          longitude: displayState.longitude,
        }),
      );

      if (roadDistanceKm > radiusKm) {
        return null;
      }

      return buildNearbyPropertyItem(row, roadDistanceKm);
    })
    .filter((item): item is NearbyPropertyItem => Boolean(item));

  const picked = input.randomize === true ? shuffleItems(candidates) : [...candidates];

  return picked
    .slice(0, input.limit ?? 4)
    .sort((left, right) => left.distanceKm - right.distanceKm);
}

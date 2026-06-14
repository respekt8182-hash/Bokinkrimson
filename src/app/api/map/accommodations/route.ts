// Lightweight map points endpoint for housing. It intentionally avoids the full catalog pipeline.
import { MediaType, Prisma, PropertyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { crimeaLocationById } from "@/lib/constants";
import { db } from "@/lib/db";
import { getFavoritePropertyIds } from "@/lib/favorites";
import { normalizeLegacyFotoImageUrl } from "@/lib/media";
import {
  parsePublishedPropertySnapshot,
  shouldUsePublishedSnapshot,
} from "@/lib/property-public-snapshot";
import {
  buildPublicCatalogPropertyVisibilityWhere,
} from "@/lib/public-visibility";
import {
  parseListParam,
  parseMapBoundsSearchParams,
  parseOptionalFloatParam,
  parseOptionalIntParam,
  pickFirstListValue,
  type MapBounds,
} from "@/lib/search-contracts";

const defaultMapLimit = 500;
const maxMapLimit = 800;

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return defaultMapLimit;
  }

  return Math.max(100, Math.min(maxMapLimit, parsed));
}

function parseFlag(raw: string | null): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

function parseDate(raw: string | null): Date | null {
  const value = raw?.trim();
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getSnapshot(row: {
  status: PropertyStatus;
  pendingEditStatus: PropertyStatus | null;
  publishedSnapshot: Prisma.JsonValue | null;
}) {
  return shouldUsePublishedSnapshot(row)
    ? parsePublishedPropertySnapshot(row.publishedSnapshot)
    : null;
}

function buildPropertyMapPath(input: { id: string; locationId: string | null }): string {
  return `/crimea/${input.locationId ?? "crimea"}/${input.id}`;
}

function buildBoundsWhere(bounds: MapBounds | null): Prisma.PropertyWhereInput {
  if (!bounds) {
    return {
      latitude: { not: null },
      longitude: { not: null },
    };
  }

  return {
    latitude: { gte: bounds.south, lte: bounds.north },
    longitude: { gte: bounds.west, lte: bounds.east },
  };
}

function buildPriceWhere(input: {
  minPrice?: number;
  maxPrice?: number;
  checkIn: Date | null;
  checkOut: Date | null;
}): Prisma.RoomPriceWhereInput {
  const where: Prisma.RoomPriceWhereInput = {};

  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    where.price = {
      ...(input.minPrice !== undefined ? { gte: input.minPrice } : {}),
      ...(input.maxPrice !== undefined ? { lte: input.maxPrice } : {}),
    };
  }

  if (input.checkIn && input.checkOut && input.checkOut > input.checkIn) {
    where.dateFrom = { lte: input.checkOut };
    where.dateTo = { gte: input.checkIn };
  }

  return where;
}

function buildMapWhere(input: {
  bounds: MapBounds | null;
  searchQuery: string;
  locationId?: string;
  location?: string;
  type?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  amenityIds: string[];
  roomFeatureIds: string[];
  checkIn: Date | null;
  checkOut: Date | null;
  hasPhotos: boolean;
  hasReviews: boolean;
  familyFriendly: boolean;
  petsAllowed: boolean;
  nearSea: boolean;
  hasPool: boolean;
  hasKitchen: boolean;
  hasAirConditioner: boolean;
  hasParking: boolean;
  smokingForbidden: boolean;
  quietHours: boolean;
}): Prisma.PropertyWhereInput {
  const priceWhere = buildPriceWhere(input);
  const hasPriceFilter = Object.keys(priceWhere).length > 0;
  const locationName =
    input.locationId && crimeaLocationById[input.locationId]
      ? crimeaLocationById[input.locationId].name
      : input.location;

  return {
    AND: [
      buildPublicCatalogPropertyVisibilityWhere(),
      buildBoundsWhere(input.bounds),
      {
        rooms: {
          some: {
            isActive: true,
            ...(input.guests ? { OR: [{ beds: { gte: input.guests } }, { extraBeds: { gte: input.guests - 1 } }] } : {}),
            ...(hasPriceFilter
              ? {
                  prices: {
                    some: priceWhere,
                  },
                }
              : {}),
          },
        },
      },
      input.searchQuery.length >= 2
        ? {
            OR: [
              { name: { contains: input.searchQuery, mode: "insensitive" } },
              { locationName: { contains: input.searchQuery, mode: "insensitive" } },
              { address: { contains: input.searchQuery, mode: "insensitive" } },
              { type: { contains: input.searchQuery, mode: "insensitive" } },
            ],
          }
        : {},
      input.locationId || locationName
        ? {
            OR: [
              ...(input.locationId ? [{ locationId: input.locationId }] : []),
              ...(locationName
                ? [{ locationName: { contains: locationName, mode: "insensitive" as const } }]
                : []),
            ],
          }
        : {},
      input.type ? { type: input.type } : {},
      input.minRating !== undefined ? { avgRating: { gte: input.minRating } } : {},
      input.hasReviews ? { reviewsCount: { gt: 0 } } : {},
      input.hasPhotos ? { media: { some: { type: MediaType.IMAGE, roomId: null } } } : {},
      input.familyFriendly ? { childrenAllowed: true } : {},
      input.petsAllowed ? { petsPolicy: { in: ["ALLOWED", "ON_REQUEST"] } } : {},
      input.nearSea ? { seaDistance: { not: null } } : {},
      input.hasPool
        ? {
            OR: [
              { customAmenities: { some: { name: { contains: "бассейн", mode: "insensitive" } } } },
              { amenities: { some: { amenity: { name: { contains: "бассейн", mode: "insensitive" } } } } },
            ],
          }
        : {},
      input.hasKitchen
        ? {
            OR: [
              { customAmenities: { some: { name: { contains: "кух", mode: "insensitive" } } } },
              { amenities: { some: { amenity: { name: { contains: "кух", mode: "insensitive" } } } } },
            ],
          }
        : {},
      input.hasAirConditioner
        ? {
            OR: [
              { customAmenities: { some: { name: { contains: "кондиционер", mode: "insensitive" } } } },
              { amenities: { some: { amenity: { name: { contains: "кондиционер", mode: "insensitive" } } } } },
            ],
          }
        : {},
      input.hasParking
        ? {
            OR: [
              { parkingInfo: { not: null } },
              { customAmenities: { some: { name: { contains: "парков", mode: "insensitive" } } } },
              { amenities: { some: { amenity: { name: { contains: "парков", mode: "insensitive" } } } } },
            ],
          }
        : {},
      input.smokingForbidden ? { smokingPolicy: "FORBIDDEN" } : {},
      input.quietHours ? { quietHoursEnabled: true } : {},
      input.amenityIds.length > 0
        ? {
            amenities: {
              some: {
                amenityId: { in: input.amenityIds },
              },
            },
          }
        : {},
      input.roomFeatureIds.length > 0
        ? {
            OR: [
              {
                roomAmenitySettings: {
                  some: {
                    enabled: true,
                    featureId: { in: input.roomFeatureIds },
                  },
                },
              },
              {
                rooms: {
                  some: {
                    isActive: true,
                    features: {
                      some: {
                        featureId: { in: input.roomFeatureIds },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {},
    ],
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const bounds = parseMapBoundsSearchParams(searchParams);
  const limit = parseLimit(searchParams.get("limit"));
  const guests = parseOptionalIntParam(searchParams.get("guests") ?? searchParams.get("adults"), {
    min: 1,
    max: 20,
  });
  const minPrice = parseOptionalFloatParam(
    searchParams.get("minPrice") ?? searchParams.get("min_price"),
    { min: 0, max: 1_000_000_000 },
  );
  const maxPrice = parseOptionalFloatParam(
    searchParams.get("maxPrice") ?? searchParams.get("max_price"),
    { min: 0, max: 1_000_000_000 },
  );
  const minRating = parseOptionalFloatParam(searchParams.get("minRating"), { min: 1, max: 5 });
  const amenityIds = parseListParam(searchParams, "amenityIds", "amenityIds[]");
  const roomFeatureIds = parseListParam(searchParams, "roomFeatureIds", "roomFeatureIds[]");
  const checkIn = parseDate(searchParams.get("checkIn") ?? searchParams.get("checkin"));
  const checkOut = parseDate(searchParams.get("checkOut") ?? searchParams.get("checkout"));
  const type =
    pickFirstListValue(searchParams.get("type")) ??
    searchParams.get("propertyType") ??
    pickFirstListValue(searchParams.get("type[]")) ??
    undefined;

  const priceWhere = buildPriceWhere({ minPrice, maxPrice, checkIn, checkOut });
  const priceOrderBy: Prisma.RoomPriceOrderByWithRelationInput[] = [{ price: "asc" }];
  const rows = await db.property.findMany({
    where: buildMapWhere({
      bounds,
      searchQuery: (searchParams.get("query") ?? searchParams.get("q") ?? "").trim(),
      locationId: searchParams.get("location_id") ?? searchParams.get("locationId") ?? undefined,
      location: searchParams.get("location") ?? undefined,
      type,
      guests,
      minPrice,
      maxPrice,
      minRating,
      amenityIds,
      roomFeatureIds,
      checkIn,
      checkOut,
      hasPhotos: parseFlag(searchParams.get("hasPhotos")),
      hasReviews: parseFlag(searchParams.get("hasReviews")),
      familyFriendly:
        parseFlag(searchParams.get("familyFriendly")) || parseFlag(searchParams.get("kidsFriendly")),
      petsAllowed: parseFlag(searchParams.get("petsAllowed")),
      nearSea: parseFlag(searchParams.get("nearSea")),
      hasPool: parseFlag(searchParams.get("hasPool")),
      hasKitchen: parseFlag(searchParams.get("hasKitchen")),
      hasAirConditioner: parseFlag(searchParams.get("hasAirConditioner")),
      hasParking: parseFlag(searchParams.get("hasParking")),
      smokingForbidden: parseFlag(searchParams.get("smokingForbidden")),
      quietHours: parseFlag(searchParams.get("quietHours")),
    }),
    select: {
      id: true,
      status: true,
      pendingEditStatus: true,
      publishedSnapshot: true,
      name: true,
      type: true,
      locationId: true,
      locationName: true,
      latitude: true,
      longitude: true,
      avgRating: true,
      reviewsCount: true,
      updatedAt: true,
      media: {
        where: { type: MediaType.IMAGE, roomId: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { url: true, type: true },
        take: 1,
      },
      rooms: {
        where: {
          isActive: true,
          ...(guests ? { OR: [{ beds: { gte: guests } }, { extraBeds: { gte: guests - 1 } }] } : {}),
          ...(Object.keys(priceWhere).length > 0 ? { prices: { some: priceWhere } } : {}),
        },
        select: {
          prices: {
            where: priceWhere,
            orderBy: priceOrderBy,
            select: {
              price: true,
              priceType: true,
              currency: true,
            },
            take: 1,
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit + 1,
  });

  const pageRows = rows.slice(0, limit);
  const session = await getSession();
  const favoritePropertyIds = session
    ? await getFavoritePropertyIds(
        session.id,
        pageRows.map((item) => item.id),
      )
    : new Set<string>();

  const points = pageRows.flatMap((row) => {
    const snapshot = getSnapshot(row);
    const display = snapshot?.property ?? row;
    const latitude = display.latitude === null ? null : Number(display.latitude);
    const longitude = display.longitude === null ? null : Number(display.longitude);
    if (latitude === null || longitude === null) {
      return [];
    }

    const livePrice = row.rooms[0]?.prices[0] ?? null;
    const coverImageUrl =
      snapshot?.media.find((media) => media.type === MediaType.IMAGE)?.url ?? row.media[0]?.url ?? null;
    const locationId = display.locationId ?? null;
    const locationName = locationId
      ? (crimeaLocationById[locationId]?.name ?? display.locationName)
      : display.locationName;

    const path = buildPropertyMapPath({
      id: row.id,
      locationId,
    });

    return [
      {
        id: row.id,
        title: display.name ?? "Объект",
        url: path,
        path,
        latitude,
        longitude,
        pricePerNight: livePrice ? Number(livePrice.price) : null,
        priceType: livePrice?.priceType ?? null,
        priceFrom: livePrice ? Number(livePrice.price) : null,
        currency: livePrice?.currency ?? "RUB",
        addressShort: locationName ?? "Крым",
        photos: coverImageUrl ? [normalizeLegacyFotoImageUrl(coverImageUrl)] : [],
        rating: row.reviewsCount > 0 ? Number(Number(row.avgRating).toFixed(1)) : null,
        reviewsCount: row.reviewsCount,
        isFavorite: favoritePropertyIds.has(row.id),
      },
    ];
  });

  const truncated = rows.length > limit;

  return NextResponse.json(
    {
      total: points.length,
      map_points: points,
      meta: {
        returnedCount: points.length,
        totalAvailable: truncated ? limit + 1 : points.length,
        limit,
        boundsApplied: bounds !== null,
        truncated,
        queryTimeMs: Date.now() - startedAt,
      },
    },
    {
      headers: {
        "Cache-Control": session
          ? "private, no-store"
          : "public, s-maxage=45, stale-while-revalidate=180",
      },
    },
  );
}

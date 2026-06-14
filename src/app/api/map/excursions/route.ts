// Lightweight map points endpoint for excursions/tours. It avoids the full catalog rerank pipeline.
import {
  ExcursionDifficulty,
  ExcursionFormat,
  ExcursionOfferType,
  ExcursionSessionStatus,
  Prisma,
} from "@prisma/client";
import { NextResponse } from "next/server";
import {
  parsePublishedExcursionSnapshot,
  shouldUsePublishedExcursionSnapshot,
} from "@/lib/excursion-public-snapshot";
import { buildPublicCatalogExcursionVisibilityWhere } from "@/lib/public-visibility";
import { db } from "@/lib/db";
import {
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

function parseOfferType(value: string | null): ExcursionOfferType | undefined {
  if (value === "tour") {
    return ExcursionOfferType.TOUR;
  }
  if (value === "excursion") {
    return ExcursionOfferType.EXCURSION;
  }

  return undefined;
}

function parseFormat(value: string | null): ExcursionFormat | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "group") {
    return ExcursionFormat.GROUP;
  }
  if (normalized === "private") {
    return ExcursionFormat.PRIVATE;
  }

  return undefined;
}

function parseDifficulty(value: string | null): ExcursionDifficulty | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "easy") {
    return ExcursionDifficulty.EASY;
  }
  if (normalized === "medium") {
    return ExcursionDifficulty.MEDIUM;
  }
  if (normalized === "hard") {
    return ExcursionDifficulty.HARD;
  }

  return undefined;
}

function parseDate(raw: string | null): Date | null {
  const value = raw?.trim();
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function buildBoundsWhere(bounds: MapBounds | null): Prisma.ExcursionWhereInput {
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

function buildDateWhere(input: {
  dateFrom: Date | null;
  dateTo: Date | null;
  people?: number;
}): Prisma.ExcursionWhereInput {
  if (!input.dateFrom && !input.dateTo) {
    return {};
  }

  const startAt: Prisma.DateTimeFilter = {};
  if (input.dateFrom) {
    startAt.gte = input.dateFrom;
  }
  if (input.dateTo) {
    startAt.lte = input.dateTo;
  }

  return {
    OR: [
      {
        sessions: {
          none: {},
        },
      },
      {
        sessions: {
          some: {
            status: ExcursionSessionStatus.AVAILABLE,
            startAt,
            ...(input.people
              ? {
                  OR: [{ capacity: null }, { capacity: { gte: input.people } }],
                }
              : {}),
          },
        },
      },
    ],
  };
}

function buildMapWhere(input: {
  bounds: MapBounds | null;
  searchQuery: string;
  offerType?: ExcursionOfferType;
  locationId?: string;
  location?: string;
  districtId?: string;
  district?: string;
  categoryId?: string;
  category?: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  people?: number;
  format?: ExcursionFormat;
  pickup: boolean;
  kids: boolean;
  minPrice?: number;
  maxPrice?: number;
  durationBucket?: string | null;
  language?: string | null;
  difficulty?: ExcursionDifficulty;
}): Prisma.ExcursionWhereInput {
  const locationFilter = input.location?.trim();
  const districtFilter = input.district?.trim();
  const categoryFilter = input.category?.trim();

  return {
    AND: [
      buildPublicCatalogExcursionVisibilityWhere(),
      buildBoundsWhere(input.bounds),
      buildDateWhere({
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        people: input.people,
      }),
      input.offerType ? { offerType: input.offerType } : {},
      input.locationId || locationFilter
        ? {
            OR: [
              ...(input.locationId
                ? [
                    { locationId: input.locationId },
                    { mainLocation: { is: { slug: input.locationId } } },
                    { anchorLocation: { is: { slug: input.locationId } } },
                  ]
                : []),
              ...(locationFilter
                ? [
                    { locationName: { contains: locationFilter, mode: "insensitive" as const } },
                    { mainLocation: { is: { name: { contains: locationFilter, mode: "insensitive" as const } } } },
                    { anchorLocation: { is: { name: { contains: locationFilter, mode: "insensitive" as const } } } },
                  ]
                : []),
            ],
          }
        : {},
      input.districtId || districtFilter
        ? {
            OR: [
              ...(input.districtId ? [{ districtId: input.districtId }] : []),
              ...(districtFilter
                ? [
                    { district: { is: { slug: districtFilter } } },
                    { district: { is: { name: { contains: districtFilter, mode: "insensitive" as const } } } },
                  ]
                : []),
            ],
          }
        : {},
      input.categoryId || categoryFilter
        ? {
            OR: [
              ...(input.categoryId ? [{ categoryId: input.categoryId }] : []),
              ...(categoryFilter
                ? [
                    { category: { is: { slug: categoryFilter } } },
                    { category: { is: { name: { contains: categoryFilter, mode: "insensitive" as const } } } },
                  ]
                : []),
            ],
          }
        : {},
      input.searchQuery.length >= 2
        ? {
            OR: [
              { title: { contains: input.searchQuery, mode: "insensitive" } },
              { locationName: { contains: input.searchQuery, mode: "insensitive" } },
              { startPoint: { contains: input.searchQuery, mode: "insensitive" } },
              { finishPoint: { contains: input.searchQuery, mode: "insensitive" } },
              { shortDescription: { contains: input.searchQuery, mode: "insensitive" } },
              { category: { is: { name: { contains: input.searchQuery, mode: "insensitive" } } } },
            ],
          }
        : {},
      input.format ? { format: input.format } : {},
      input.pickup ? { pickupAvailable: true } : {},
      input.kids ? { isKidFriendly: true } : {},
      input.minPrice !== undefined || input.maxPrice !== undefined
        ? {
            priceFrom: {
              ...(input.minPrice !== undefined ? { gte: input.minPrice } : {}),
              ...(input.maxPrice !== undefined ? { lte: input.maxPrice } : {}),
            },
          }
        : {},
      input.durationBucket === "up_to_3h"
        ? { durationMinutes: { lte: 180 } }
        : input.durationBucket === "between_3h_6h"
          ? { durationMinutes: { gte: 180, lte: 360 } }
          : input.durationBucket === "more_6h"
            ? { OR: [{ durationMinutes: { gt: 360 } }, { durationDays: { gt: 0 } }] }
            : {},
      input.language
        ? {
            languageCodes: {
              has: input.language,
            },
          }
        : {},
      input.difficulty ? { difficulty: input.difficulty } : {},
    ],
  };
}

function getSnapshot(row: {
  status: Parameters<typeof shouldUsePublishedExcursionSnapshot>[0]["status"];
  pendingEditStatus: Parameters<typeof shouldUsePublishedExcursionSnapshot>[0]["pendingEditStatus"];
  publishedSnapshot: Parameters<typeof shouldUsePublishedExcursionSnapshot>[0]["publishedSnapshot"];
}) {
  return shouldUsePublishedExcursionSnapshot(row)
    ? parsePublishedExcursionSnapshot(row.publishedSnapshot)
    : null;
}

function buildExcursionMapPath(input: {
  id: string;
  locationId: string | null;
  anchorLocationSlug: string | null;
}): string {
  return `/crimea/excursions/${input.anchorLocationSlug ?? input.locationId ?? "crimea"}/${input.id}`;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const bounds = parseMapBoundsSearchParams(searchParams);
  const limit = parseLimit(searchParams.get("limit"));
  const dateFrom = parseDate(
    searchParams.get("date_from") ?? searchParams.get("dateFrom") ?? searchParams.get("date"),
  );
  const dateTo = parseDate(searchParams.get("date_to") ?? searchParams.get("dateTo")) ?? dateFrom;
  const people = parseOptionalIntParam(
    searchParams.get("participants") ?? searchParams.get("people") ?? searchParams.get("guests"),
    { min: 1, max: 40 },
  );
  const minPrice = parseOptionalFloatParam(searchParams.get("minPrice"), {
    min: 0,
    max: 1_000_000_000,
  });
  const maxPrice = parseOptionalFloatParam(searchParams.get("maxPrice"), {
    min: 0,
    max: 1_000_000_000,
  });
  const language = pickFirstListValue(searchParams.get("language") ?? searchParams.get("language[]"));

  const rows = await db.excursion.findMany({
    where: buildMapWhere({
      bounds,
      searchQuery: (searchParams.get("query") ?? searchParams.get("q") ?? "").trim(),
      offerType: parseOfferType(searchParams.get("offerType")),
      locationId: searchParams.get("location_id") ?? searchParams.get("locationId") ?? undefined,
      location: searchParams.get("location") ?? undefined,
      districtId: searchParams.get("district_id") ?? searchParams.get("districtId") ?? undefined,
      district: searchParams.get("district") ?? undefined,
      categoryId: searchParams.get("category_id") ?? searchParams.get("categoryId") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      dateFrom,
      dateTo,
      people,
      format: parseFormat(searchParams.get("format")),
      pickup: searchParams.get("pickup") === "1" || searchParams.get("pickup") === "true",
      kids: searchParams.get("kids") === "1" || searchParams.get("kids") === "true",
      minPrice,
      maxPrice,
      durationBucket: searchParams.get("durationBucket"),
      language,
      difficulty: parseDifficulty(
        searchParams.get("difficulty") ?? searchParams.get("difficulty[]"),
      ),
    }),
    select: {
      id: true,
      status: true,
      pendingEditStatus: true,
      publishedSnapshot: true,
      offerType: true,
      title: true,
      subtypeLabel: true,
      locationId: true,
      locationName: true,
      latitude: true,
      longitude: true,
      durationMinutes: true,
      durationDays: true,
      durationNights: true,
      priceFrom: true,
      priceTo: true,
      currency: true,
      priceUnitLabel: true,
      avgRating: true,
      reviewsCount: true,
      pickupAvailable: true,
      accommodationProvided: true,
      accommodationNights: true,
      photoUrls: true,
      updatedAt: true,
      anchorLocation: { select: { slug: true, name: true } },
      mainLocation: { select: { name: true } },
      district: { select: { slug: true, name: true } },
      category: { select: { slug: true, name: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit + 1,
  });

  const points = rows.slice(0, limit).flatMap((row) => {
    const snapshot = getSnapshot(row);
    const display = snapshot?.excursion ?? row;
    const latitude = display.latitude === null ? null : Number(display.latitude);
    const longitude = display.longitude === null ? null : Number(display.longitude);
    if (latitude === null || longitude === null) {
      return [];
    }

    const anchorLocation =
      "anchorLocation" in display ? display.anchorLocation : row.anchorLocation;
    const category = "category" in display ? display.category : row.category;
    const district = "district" in display ? display.district : row.district;
    const mainLocation = "mainLocation" in display ? display.mainLocation : row.mainLocation;
    const photoUrls = "photoUrls" in display ? display.photoUrls : row.photoUrls;
    const title = display.title ?? "Экскурсия";
    const locationId = display.locationId ?? null;
    const anchorLocationSlug = anchorLocation?.slug ?? null;

    return [
      {
        id: row.id,
        slug: row.id,
        path: buildExcursionMapPath({
          id: row.id,
          locationId,
          anchorLocationSlug,
        }),
        title,
        offerType: display.offerType,
        subtypeLabel: display.subtypeLabel ?? null,
        locationId,
        locationName: display.locationName ?? null,
        latitude,
        longitude,
        mainLocationName: mainLocation?.name ?? null,
        anchorCityName: anchorLocation?.name ?? display.locationName ?? null,
        districtName: district?.name ?? null,
        categoryName: category?.name ?? null,
        startPoint: null,
        finishPoint: null,
        routeSummary:
          [anchorLocation?.name, category?.name].filter((item): item is string => Boolean(item)).join(" · ") ||
          display.locationName ||
          "",
        durationMinutes: display.durationMinutes ?? null,
        durationDays: display.durationDays ?? null,
        durationNights: display.durationNights ?? null,
        languageCodes: [],
        difficulty: null,
        priceFrom: display.priceFrom === null ? null : Number(display.priceFrom),
        priceTo: display.priceTo === null ? null : Number(display.priceTo),
        currency: display.currency ?? "RUB",
        priceUnitLabel: display.priceUnitLabel ?? null,
        coverImageUrl: photoUrls[0] ?? null,
        avgRating: Number(row.avgRating),
        reviewsCount: row.reviewsCount,
        distanceKm: null,
        searchMatchKind: "primary",
        hasAvailableSession: true,
        pickupAvailable: display.pickupAvailable ?? false,
        availabilityMode: "REGULAR",
        availabilitySummary: "",
        hasAccommodation:
          display.accommodationProvided === true ||
          Boolean(display.accommodationNights && display.accommodationNights > 0),
        owner: {
          firstName: "",
          lastName: "",
          avatarUrl: null,
          phoneVerifiedAt: null,
        },
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
        "Cache-Control": "public, s-maxage=45, stale-while-revalidate=180",
      },
    },
  );
}

// Lightweight map points endpoint for transfers. It intentionally avoids the full transfer catalog pipeline.
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSearchPerformanceTimer,
  hasSearchFilters,
} from "@/lib/performance-logging";
import {
  buildPublicTransferPath,
  buildTransferPublicSlug,
  type PublicTransferCatalogItem,
} from "@/lib/public-marketplace";
import { buildPublishedTransferVisibilityWhere } from "@/lib/public-visibility";
import { parseBoundsParam, type MapBounds } from "@/lib/search-contracts";
import { applyPublishedTransferSnapshotToRow } from "@/lib/transfer-public-snapshot";

const defaultMapLimit = 500;
const maxMapLimit = 800;

const transferMapSelect = Prisma.validator<Prisma.TransferSelect>()({
  id: true,
  publicId: true,
  status: true,
  pendingEditStatus: true,
  publishedSnapshot: true,
  title: true,
  transferType: true,
  vehicleClass: true,
  vehicleModel: true,
  seats: true,
  luggage: true,
  locationId: true,
  locationName: true,
  districtId: true,
  serviceArea: true,
  routeExamples: true,
  latitude: true,
  longitude: true,
  priceFrom: true,
  priceUnitLabel: true,
  currency: true,
  shortDescription: true,
  description: true,
  photoUrls: true,
  serviceTags: true,
  contactName: true,
  avgRating: true,
  reviewsCount: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      firstName: true,
      avatarUrl: true,
      phoneVerifiedAt: true,
    },
  },
  location: {
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
    },
  },
  district: {
    select: {
      name: true,
    },
  },
});

type TransferMapRow = Prisma.TransferGetPayload<{ select: typeof transferMapSelect }>;

function readNumber(value: string | null): number | undefined {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return defaultMapLimit;
  }

  return Math.max(100, Math.min(maxMapLimit, parsed));
}

function readSort(value: string | null) {
  return value === "price_asc" ||
    value === "price_desc" ||
    value === "rating_desc" ||
    value === "popular_desc" ||
    value === "newest"
    ? value
    : "relevance";
}

function toNumberOrNull(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function firstPhoto(urls: string[] | null | undefined): string | null {
  return (urls ?? []).map((url) => url.trim()).find(Boolean) ?? null;
}

function buildCoordinateWhere(bounds: MapBounds | null): Prisma.TransferWhereInput {
  if (!bounds) {
    return {
      OR: [
        {
          latitude: { not: null },
          longitude: { not: null },
        },
        {
          location: {
            is: {
              latitude: { not: null },
              longitude: { not: null },
            },
          },
        },
      ],
    };
  }

  const latitudeWhere = { latitude: { gte: bounds.south, lte: bounds.north } };
  const longitudeWhere =
    bounds.west <= bounds.east
      ? { longitude: { gte: bounds.west, lte: bounds.east } }
      : {
          OR: [{ longitude: { gte: bounds.west } }, { longitude: { lte: bounds.east } }],
        };
  const livePointWhere = {
    AND: [latitudeWhere, longitudeWhere],
  };
  const locationPointWhere = {
    location: {
      is: livePointWhere,
    },
  };

  return {
    OR: [
      livePointWhere,
      locationPointWhere,
      // Published snapshots can hold the visible coordinates while an owner edit is pending.
      { pendingEditStatus: { not: null } },
    ],
  };
}

function buildTransferMapWhere(input: {
  bounds: MapBounds | null;
  query: string;
  location: string;
  transferType: string;
  minPrice?: number;
  maxPrice?: number;
}): Prisma.TransferWhereInput {
  const priceWhere =
    input.minPrice !== undefined || input.maxPrice !== undefined
      ? {
          priceFrom: {
            ...(input.minPrice !== undefined ? { gte: input.minPrice } : {}),
            ...(input.maxPrice !== undefined ? { lte: input.maxPrice } : {}),
          },
        }
      : {};

  return {
    AND: [
      buildPublishedTransferVisibilityWhere(),
      buildCoordinateWhere(input.bounds),
      input.query.length >= 2
        ? {
            OR: [
              { title: { contains: input.query, mode: "insensitive" } },
              { transferType: { contains: input.query, mode: "insensitive" } },
              { vehicleClass: { contains: input.query, mode: "insensitive" } },
              { vehicleModel: { contains: input.query, mode: "insensitive" } },
              { locationName: { contains: input.query, mode: "insensitive" } },
              { serviceArea: { contains: input.query, mode: "insensitive" } },
              { routeExamples: { contains: input.query, mode: "insensitive" } },
              { shortDescription: { contains: input.query, mode: "insensitive" } },
            ],
          }
        : {},
      input.location
        ? {
            OR: [
              { locationId: input.location },
              { locationName: { contains: input.location, mode: "insensitive" } },
              { serviceArea: { contains: input.location, mode: "insensitive" } },
              { routeExamples: { contains: input.location, mode: "insensitive" } },
              { location: { is: { name: { contains: input.location, mode: "insensitive" } } } },
              { district: { is: { name: { contains: input.location, mode: "insensitive" } } } },
            ],
          }
        : {},
      input.transferType
        ? { transferType: { contains: input.transferType, mode: "insensitive" } }
        : {},
      priceWhere,
    ],
  };
}

function buildOrderBy(sort: ReturnType<typeof readSort>): Prisma.TransferOrderByWithRelationInput[] {
  if (sort === "price_asc") {
    return [{ priceFrom: "asc" }, { updatedAt: "desc" }];
  }

  if (sort === "price_desc") {
    return [{ priceFrom: "desc" }, { updatedAt: "desc" }];
  }

  if (sort === "rating_desc") {
    return [{ avgRating: "desc" }, { reviewsCount: "desc" }, { updatedAt: "desc" }];
  }

  if (sort === "popular_desc") {
    return [{ reviewsCount: "desc" }, { avgRating: "desc" }, { updatedAt: "desc" }];
  }

  return [{ updatedAt: "desc" }];
}

function mapTransferPoint(row: TransferMapRow): PublicTransferCatalogItem | null {
  const display = applyPublishedTransferSnapshotToRow(row);
  const latitude = toNumberOrNull(display.latitude) ?? toNumberOrNull(display.location?.latitude);
  const longitude = toNumberOrNull(display.longitude) ?? toNumberOrNull(display.location?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  const title = display.title ?? "Трансфер без названия";

  return {
    id: row.id,
    publicId: row.publicId ?? null,
    slug: buildTransferPublicSlug(title),
    path: buildPublicTransferPath({ id: row.id, title }),
    title,
    transferType: display.transferType ?? null,
    serviceTags: Array.isArray(display.serviceTags) ? display.serviceTags : [],
    fleet: [],
    vehicleClass: display.vehicleClass ?? null,
    vehicleModel: display.vehicleModel ?? null,
    seats: display.seats ?? null,
    luggage: display.luggage ?? null,
    locationName: display.location?.name ?? display.locationName ?? null,
    districtName: display.district?.name ?? null,
    serviceArea: display.serviceArea ?? null,
    routeExamples: display.routeExamples ?? null,
    latitude,
    longitude,
    priceFrom: toNumberOrNull(display.priceFrom),
    priceUnitLabel: display.priceUnitLabel ?? null,
    currency: display.currency ?? "RUB",
    avgRating: Number(row.avgRating),
    reviewsCount: row.reviewsCount,
    shortDescription: display.shortDescription ?? null,
    description: null,
    photoUrls: [],
    coverImageUrl: firstPhoto(display.photoUrls),
    distanceKm: null,
    searchMatchKind: "primary",
    contacts: {
      contactName: display.contactName ?? null,
      phone: null,
      phoneMasked: null,
      phoneAvailable: false,
      phoneName: null,
      phone2: null,
      phone2Name: null,
      phone3: null,
      phone3Name: null,
      websiteUrl: null,
      email: null,
      emailAvailable: false,
      whatsappUrl: null,
      telegramUrl: null,
      vkUrl: null,
      maxUrl: null,
      okUrl: null,
      messengerAvailable: false,
    },
    owner: {
      id: row.owner.id,
      firstName: row.owner.firstName,
      lastName: "",
      avatarUrl: row.owner.avatarUrl,
      phoneVerifiedAt: row.owner.phoneVerifiedAt?.toISOString() ?? null,
    },
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = (params.get("q") || params.get("query") || "").trim();
  const location = (params.get("location") || "").trim();
  const transferType = (params.get("transferType") || "").trim();
  const bounds = parseBoundsParam(params.get("bounds") || "");
  const minPrice = readNumber(params.get("minPrice"));
  const maxPrice = readNumber(params.get("maxPrice"));
  const sort = readSort(params.get("sort"));
  const limit = readLimit(params.get("limit"));
  const finishPerf = createSearchPerformanceTimer("/api/map/transfers", {
    direction: "transfers",
    page: 1,
    pageSize: limit,
    queryLength: query.length,
  });

  try {
    const rows = await db.transfer.findMany({
      where: buildTransferMapWhere({
        bounds,
        query,
        location,
        transferType,
        minPrice,
        maxPrice,
      }),
      select: transferMapSelect,
      orderBy: buildOrderBy(sort),
      take: limit + 1,
    });
    const points = rows.slice(0, limit).flatMap((row) => {
      const point = mapTransferPoint(row);
      return point ? [point] : [];
    });
    const truncated = rows.length > limit;

    finishPerf({
      returned: points.length,
      count: points.length,
      candidates: rows.length,
      hasFilters: hasSearchFilters({
        queryLength: query.length,
        location,
        transferType,
        minPrice,
        maxPrice,
        boundsApplied: bounds !== null,
        sort: sort === "relevance" ? undefined : sort,
      }),
      status: 200,
    });

    return NextResponse.json(
      {
        items: points,
        map_points: points,
        total: points.length,
        meta: {
          returnedCount: points.length,
          totalAvailable: truncated ? limit + 1 : points.length,
          limit,
          boundsApplied: bounds !== null,
          truncated,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=45, stale-while-revalidate=180",
        },
      },
    );
  } catch (error) {
    finishPerf({
      status: 500,
      errorStatus: 500,
    });
    throw error;
  }
}

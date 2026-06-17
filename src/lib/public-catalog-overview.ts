import { ExcursionOfferType, type Prisma } from "@prisma/client";
import { crimeaLocationById, crimeaLocations } from "@/lib/constants";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";
import {
  normalizeLocationName,
  searchLocationDirectory,
} from "@/lib/location-directory";
import { createSearchPerformanceTimer } from "@/lib/performance-logging";
import {
  buildPublicCatalogExcursionVisibilityWhere,
  buildPublicCatalogPropertyVisibilityWhere,
} from "@/lib/public-visibility";

export type PublicCatalogOverview = {
  total: number;
  priceBounds: {
    min: number;
    max: number;
  };
};

type ResolvedOverviewLocation = {
  id: string;
  name: string;
};

const emptyOverview: PublicCatalogOverview = {
  total: 0,
  priceBounds: {
    min: 0,
    max: 0,
  },
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function resolveHousingOverviewLocation(
  value?: string | null,
): Promise<ResolvedOverviewLocation | null> {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  const builtIn =
    crimeaLocationById[normalized] ??
    crimeaLocations.find(
      (location) =>
        location.id.toLowerCase() === lower ||
        normalizeLocationName(location.name) === normalizeLocationName(normalized),
    ) ??
    null;

  if (builtIn) {
    return {
      id: builtIn.id,
      name: builtIn.name,
    };
  }

  const [directoryMatch] = await searchLocationDirectory(normalized, 1);
  return directoryMatch
    ? {
        id: directoryMatch.id,
        name: directoryMatch.name,
      }
    : null;
}

function buildPropertyLocationWhere(
  location: ResolvedOverviewLocation | null,
  rawLocation?: string | null,
): Prisma.PropertyWhereInput {
  const fallbackLocation = rawLocation?.trim() ?? "";
  if (!location && !fallbackLocation) {
    return {};
  }

  return {
    OR: [
      ...(location ? [{ locationId: location.id }] : []),
      ...(location
        ? [{ locationName: { contains: location.name, mode: "insensitive" as const } }]
        : []),
      ...(!location && fallbackLocation
        ? [{ locationName: { contains: fallbackLocation, mode: "insensitive" as const } }]
        : []),
    ],
  };
}

export async function getPublicHousingCatalogOverview(input?: {
  location?: string | null;
}): Promise<PublicCatalogOverview> {
  const finishPerf = createSearchPerformanceTimer("getPublicHousingCatalogOverview", {
    direction: "housing",
    hasFilters: Boolean(input?.location?.trim()),
  });
  const resolvedLocation = await resolveHousingOverviewLocation(input?.location);
  const where: Prisma.PropertyWhereInput = {
    AND: [
      buildPublicCatalogPropertyVisibilityWhere(),
      buildPropertyLocationWhere(resolvedLocation, input?.location),
    ],
  };

  const result = await loadDataWithDatabaseFallback(
    {
      contextId: "public-housing-catalog-overview",
      unavailableMessage:
        "Public housing catalog overview: database is unavailable. Returning empty overview.",
      fallbackEligibleMessage:
        "Public housing catalog overview: database is unavailable or credentials are invalid. Returning empty overview.",
    },
    async () => {
      const [total, priceAggregate] = await Promise.all([
        db.property.count({ where }),
        db.roomPrice.aggregate({
          where: {
            room: {
              is: {
                isActive: true,
                property: {
                  is: where,
                },
              },
            },
          },
          _max: {
            price: true,
          },
        }),
      ]);

      return {
        total,
        priceBounds: {
          min: 0,
          max: toNumber(priceAggregate._max.price),
        },
      };
    },
    emptyOverview,
  );

  finishPerf({
    returned: 0,
    count: result.total,
    status: 200,
  });

  return result;
}

export async function getPublicExcursionCatalogOverview(input?: {
  offerType?: "excursion" | "tour" | null;
}): Promise<PublicCatalogOverview> {
  const offerType =
    input?.offerType === "tour"
      ? ExcursionOfferType.TOUR
      : input?.offerType === "excursion"
        ? ExcursionOfferType.EXCURSION
        : null;
  const finishPerf = createSearchPerformanceTimer("getPublicExcursionCatalogOverview", {
    direction: offerType === ExcursionOfferType.TOUR ? "tours" : "excursions",
    hasFilters: offerType !== null,
  });
  const where: Prisma.ExcursionWhereInput = {
    ...buildPublicCatalogExcursionVisibilityWhere(),
    ...(offerType ? { offerType } : {}),
  };

  const result = await loadDataWithDatabaseFallback(
    {
      contextId: "public-excursion-catalog-overview",
      unavailableMessage:
        "Public excursion catalog overview: database is unavailable. Returning empty overview.",
      fallbackEligibleMessage:
        "Public excursion catalog overview: database is unavailable or credentials are invalid. Returning empty overview.",
    },
    async () => {
      const [total, priceAggregate] = await Promise.all([
        db.excursion.count({ where }),
        db.excursion.aggregate({
          where,
          _max: {
            priceFrom: true,
          },
        }),
      ]);

      return {
        total,
        priceBounds: {
          min: 0,
          max: toNumber(priceAggregate._max.priceFrom),
        },
      };
    },
    emptyOverview,
  );

  finishPerf({
    returned: 0,
    count: result.total,
    status: 200,
  });

  return result;
}

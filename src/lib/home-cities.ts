// Home showcase aggregator: computes "prices from" for popular Crimea cities from published housing and excursions.
import { unstable_cache } from "next/cache";
import { addDays, toIsoDate } from "@/lib/pricing";
import { db } from "@/lib/db";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import {
  buildPublishedExcursionVisibilityWhere,
  buildPublishedPropertyVisibilityWhere,
} from "@/lib/public-visibility";

export const HOME_CITY_FALLBACK_PRICE_RUB = 500;

type HomeCityDefinition = {
  key: string;
  title: string;
  locationId: string;
  locationName: string;
  imageBaseName: string;
};

export const homeCityDefinitions: HomeCityDefinition[] = [
  {
    key: "yevpatoria",
    title: "Евпатория",
    locationId: "evpatoria",
    locationName: "Евпатория",
    imageBaseName: "Yevpatoria",
  },
  {
    key: "alushta",
    title: "Алушта",
    locationId: "alushta",
    locationName: "Алушта",
    imageBaseName: "Alushta",
  },
  {
    key: "feodosia",
    title: "Феодосия",
    locationId: "feodosiya",
    locationName: "Феодосия",
    imageBaseName: "Feodosia",
  },
  {
    key: "sevastopol",
    title: "Севастополь",
    locationId: "sevastopol",
    locationName: "Севастополь",
    imageBaseName: "Sevastopol",
  },
  {
    key: "yalta",
    title: "Ялта",
    locationId: "yalta",
    locationName: "Ялта",
    imageBaseName: "Yalta",
  },
  {
    key: "alupka",
    title: "Алупка",
    locationId: "alupka",
    locationName: "Алупка",
    imageBaseName: "Alupka",
  },
  {
    key: "kerch",
    title: "Керчь",
    locationId: "kerch",
    locationName: "Керчь",
    imageBaseName: "Kerch",
  },
  {
    key: "sudak",
    title: "Судак",
    locationId: "sudak",
    locationName: "Судак",
    imageBaseName: "Sudak",
  },
];

type HousingPriceRecord = {
  locationId: string;
  dateFrom: Date;
  dateTo: Date;
  price: number;
};

type ExcursionPriceRecord = {
  locationId: string;
  price: number;
};

export type HomeCityShowcaseItem = {
  key: string;
  title: string;
  locationId: string;
  locationName: string;
  imageSrc: string;
  housingPriceFrom: number;
  excursionPriceFrom: number;
};

function getUtcDateOnly(value: Date): Date {
  return new Date(`${toIsoDate(value)}T00:00:00.000Z`);
}

type CandidateFuturePrice = {
  date: number;
  price: number;
};

function resolveHousingPricesByLocation(input: {
  locationIds: string[];
  records: HousingPriceRecord[];
  today: Date;
  fallbackPrice: number;
}): Map<string, number> {
  const today = getUtcDateOnly(input.today);
  const tomorrow = addDays(today, 1);
  const todayMs = today.getTime();
  const tomorrowMs = tomorrow.getTime();
  const locationSet = new Set(input.locationIds);
  const pricesByLocation = new Map<string, number>();

  for (const record of input.records) {
    if (!locationSet.has(record.locationId)) {
      continue;
    }

    const fromMs = getUtcDateOnly(record.dateFrom).getTime();
    const toMs = getUtcDateOnly(record.dateTo).getTime();
    if (fromMs > todayMs || toMs < todayMs) {
      continue;
    }

    const current = pricesByLocation.get(record.locationId);
    if (current === undefined || record.price < current) {
      pricesByLocation.set(record.locationId, record.price);
    }
  }

  const nearestFutureByLocation = new Map<string, CandidateFuturePrice>();
  for (const record of input.records) {
    if (!locationSet.has(record.locationId) || pricesByLocation.has(record.locationId)) {
      continue;
    }

    const fromMs = getUtcDateOnly(record.dateFrom).getTime();
    const toMs = getUtcDateOnly(record.dateTo).getTime();
    const futureStartMs = Math.max(fromMs, tomorrowMs);

    if (futureStartMs > toMs) {
      continue;
    }

    const candidate = nearestFutureByLocation.get(record.locationId);
    if (
      !candidate ||
      futureStartMs < candidate.date ||
      (futureStartMs === candidate.date && record.price < candidate.price)
    ) {
      nearestFutureByLocation.set(record.locationId, {
        date: futureStartMs,
        price: record.price,
      });
    }
  }

  for (const locationId of input.locationIds) {
    if (pricesByLocation.has(locationId)) {
      continue;
    }

    const future = nearestFutureByLocation.get(locationId);
    if (future) {
      pricesByLocation.set(locationId, future.price);
      continue;
    }

    pricesByLocation.set(locationId, input.fallbackPrice);
  }

  return pricesByLocation;
}

function resolveExcursionPricesByLocation(input: {
  locationIds: string[];
  records: ExcursionPriceRecord[];
  fallbackPrice: number;
}): Map<string, number> {
  const locationSet = new Set(input.locationIds);
  const pricesByLocation = new Map<string, number>();

  for (const record of input.records) {
    if (!locationSet.has(record.locationId)) {
      continue;
    }

    const current = pricesByLocation.get(record.locationId);
    if (current === undefined || record.price < current) {
      pricesByLocation.set(record.locationId, record.price);
    }
  }

  for (const locationId of input.locationIds) {
    if (!pricesByLocation.has(locationId)) {
      pricesByLocation.set(locationId, input.fallbackPrice);
    }
  }

  return pricesByLocation;
}

async function readHomeCitySourceRows(locationIds: string[], today: Date) {
  const canUseFallback = process.env.NODE_ENV !== "production";
  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "home-cities",
      "Database is unavailable. Using fallback showcase prices.",
    );
    return [[], []] as const;
  }

  try {
    return await Promise.all([
      db.roomPrice.findMany({
        where: {
          dateTo: { gte: today },
          room: {
            isActive: true,
            property: {
              ...buildPublishedPropertyVisibilityWhere(),
              locationId: { in: locationIds },
            },
          },
        },
        select: {
          dateFrom: true,
          dateTo: true,
          price: true,
          room: {
            select: {
              property: {
                select: {
                  locationId: true,
                },
              },
            },
          },
        },
      }),
      db.excursion.findMany({
        where: {
          ...buildPublishedExcursionVisibilityWhere(),
          locationId: { in: locationIds },
          priceFrom: { not: null },
        },
        select: {
          locationId: true,
          priceFrom: true,
        },
      }),
    ]);
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      "home-cities",
      "Database is unavailable or credentials are invalid. Using fallback showcase prices.",
    );
    return [[], []] as const;
  }
}

export async function getHomeCityShowcaseItems(): Promise<HomeCityShowcaseItem[]> {
  return getCachedHomeCityShowcaseItems();
}

const getCachedHomeCityShowcaseItems = unstable_cache(
  async (): Promise<HomeCityShowcaseItem[]> => {
  const fallbackPrice = HOME_CITY_FALLBACK_PRICE_RUB;
  const locationIds = homeCityDefinitions.map((item) => item.locationId);
  const today = getUtcDateOnly(new Date());

  const [housingRows, excursionRows] = await readHomeCitySourceRows(locationIds, today);

  const housingRecords: HousingPriceRecord[] = housingRows
    .map((row) => ({
      locationId: row.room.property.locationId ?? "",
      dateFrom: row.dateFrom,
      dateTo: row.dateTo,
      price: Number(row.price),
    }))
    .filter((row) => row.locationId.length > 0);

  const excursionRecords: ExcursionPriceRecord[] = excursionRows
    .map((row) => ({
      locationId: row.locationId ?? "",
      price: Number(row.priceFrom),
    }))
    .filter((row) => row.locationId.length > 0);

  const housingPriceByLocation = resolveHousingPricesByLocation({
    locationIds,
    records: housingRecords,
    today,
    fallbackPrice,
  });
  const excursionPriceByLocation = resolveExcursionPricesByLocation({
    locationIds,
    records: excursionRecords,
    fallbackPrice,
  });

  return homeCityDefinitions.map((city) => ({
    key: city.key,
    title: city.title,
    locationId: city.locationId,
    locationName: city.locationName,
    imageSrc: `/Foto/${city.imageBaseName}.webp`,
    housingPriceFrom: housingPriceByLocation.get(city.locationId) ?? fallbackPrice,
    excursionPriceFrom: excursionPriceByLocation.get(city.locationId) ?? fallbackPrice,
  }));
  },
  ["home-city-showcase-v1"],
  { revalidate: 900 },
);

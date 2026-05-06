import { db } from "@/lib/db";
import { normalizeLegacyFotoImageUrl } from "@/lib/media";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import { buildPublicPropertyPath } from "@/lib/public-properties";
import { buildPublishedPropertyVisibilityWhere } from "@/lib/public-visibility";

export type PopularPropertyItem = {
  id: string;
  name: string;
  slug: string;
  path: string;
  locationName: string | null;
  address: string | null;
  imageUrls: string[];
  minNightPrice: number | null;
  currency: string | null;
  priceType: "per_room" | "per_night";
  priceMonth: string | null;
};

const MONTH_NAMES_PREPOSITIONAL = [
  "в январе",
  "в феврале",
  "в марте",
  "в апреле",
  "в мае",
  "в июне",
  "в июле",
  "в августе",
  "в сентябре",
  "в октябре",
  "в ноябре",
  "в декабре",
];

function stripCountryFromAddress(address: string): string {
  return address
    .replace(/,?\s*Россия/gi, "")
    .replace(/,?\s*Республика\s+Крым/gi, "")
    .replace(/^\s*,\s*/, "")
    .trim();
}

function buildLocationLine(
  locationName: string | null,
  address: string | null,
): string {
  const loc = locationName?.trim() ?? "";
  const addr = address ? stripCountryFromAddress(address) : "";
  if (loc && addr) return `${loc}, ${addr}`;
  return loc || addr || "";
}

async function fetchPopularProperties(): Promise<PopularPropertyItem[]> {
  const properties = await db.property.findMany({
    where: {
      ...buildPublishedPropertyVisibilityWhere(),
      media: { some: { type: "IMAGE", roomId: null } },
    },
    select: {
      id: true,
      name: true,
      locationId: true,
      locationName: true,
      address: true,
      media: {
        where: { type: "IMAGE", roomId: null },
        orderBy: { sortOrder: "asc" },
        take: 8,
        select: { url: true },
      },
      rooms: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          prices: {
            orderBy: { price: "asc" },
            take: 10,
            select: {
              price: true,
              currency: true,
              dateFrom: true,
              dateTo: true,
            },
          },
        },
      },
    },
    orderBy: [
      { moderatedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
      { updatedAt: "desc" },
    ],
    take: 12,
  });

  return properties.map((p) => {
    const imageUrls = p.media.map((m) => normalizeLegacyFotoImageUrl(m.url));

    // Find the minimum price and determine which month it applies to
    let minPrice: number | null = null;
    let minCurrency: string | null = null;
    let priceMonth: string | null = null;

    for (const room of p.rooms) {
      for (const rp of room.prices) {
        const value = Number(rp.price);
        if (minPrice === null || value < minPrice) {
          minPrice = value;
          minCurrency = rp.currency;
          // Use the dateFrom month for the price label
          const d = new Date(rp.dateFrom);
          priceMonth = MONTH_NAMES_PREPOSITIONAL[d.getMonth()] ?? null;
        }
      }
    }

    // Determine if price is "per room" or "per night" based on room count
    const priceType: "per_room" | "per_night" =
      p.rooms.length <= 1 ? "per_room" : "per_night";

    return {
      id: p.id,
      name: p.name ?? "Объект размещения",
      slug: p.id,
      path: buildPublicPropertyPath({
        id: p.id,
        locationId: p.locationId,
        name: p.name,
      }),
      locationName: buildLocationLine(p.locationName, p.address),
      address: p.address,
      imageUrls,
      minNightPrice: minPrice,
      currency: minCurrency,
      priceType,
      priceMonth,
    };
  });
}

export async function getPopularProperties(): Promise<PopularPropertyItem[]> {
  const canUseFallback = process.env.NODE_ENV !== "production";

  if (canUseFallback && !(await isConfiguredDatabaseReachable())) {
    logDatabaseFallbackOnce(
      "popular-properties",
      "Database is unavailable. Popular properties section will stay hidden.",
    );
    return [];
  }

  try {
    return await fetchPopularProperties();
  } catch (error) {
    if (!canUseFallback || !isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logDatabaseFallbackOnce(
      "popular-properties",
      "Database is unavailable or credentials are invalid. Popular properties section will stay hidden.",
    );
    return [];
  }
}

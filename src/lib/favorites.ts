// Domain/service module for favorites.
import { Prisma } from "@prisma/client";
import { crimeaLocationById, propertyTypeById } from "@/lib/constants";
import { db } from "@/lib/db";
import { buildPublicPropertyPath } from "@/lib/public-properties";
import { buildPublishedPropertyVisibilityWhere } from "@/lib/public-visibility";

export type FavoriteCatalogItem = {
  id: string;
  path: string;
  name: string;
  typeLabel: string | null;
  locationName: string | null;
  coverImageUrl: string | null;
  activeRoomsCount: number;
  minNightPrice: number | null;
  currency: string | null;
  avgRating: number;
  reviewsCount: number;
  owner: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  favoritedAt: string;
};

function getMinPriceByRooms(
  rooms: Array<{
    prices: Array<{
      price: Prisma.Decimal;
      currency: string;
    }>;
  }>,
): { minNightPrice: number | null; currency: string | null } {
  let minNightPrice: number | null = null;
  let currency: string | null = null;

  for (const room of rooms) {
    for (const priceItem of room.prices) {
      const value = Number(priceItem.price);
      if (minNightPrice === null || value < minNightPrice) {
        minNightPrice = value;
        currency = priceItem.currency;
      }
    }
  }

  return { minNightPrice, currency };
}

export async function getFavoritePropertyIds(
  userId: string,
  propertyIds: string[],
): Promise<Set<string>> {
  if (propertyIds.length === 0) {
    return new Set();
  }

  const rows = await db.favoriteProperty.findMany({
    where: {
      userId,
      propertyId: { in: propertyIds },
    },
    select: {
      propertyId: true,
    },
  });

  return new Set(rows.map((row) => row.propertyId));
}

export async function getUserFavoriteProperties(userId: string): Promise<FavoriteCatalogItem[]> {
  const favorites = await db.favoriteProperty.findMany({
    where: {
      userId,
      property: {
        ...buildPublishedPropertyVisibilityWhere(),
      },
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      property: {
        select: {
          id: true,
          name: true,
          type: true,
          locationId: true,
          locationName: true,
          avgRating: true,
          reviewsCount: true,
          media: {
            where: { roomId: null },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 1,
            select: {
              url: true,
            },
          },
          rooms: {
            where: { isActive: true },
            select: {
              id: true,
              prices: {
                select: {
                  price: true,
                  currency: true,
                },
              },
            },
          },
          owner: {
            select: {
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  return favorites.map((favorite) => {
    const property = favorite.property;
    const { minNightPrice, currency } = getMinPriceByRooms(property.rooms);

    return {
      id: property.id,
      path: buildPublicPropertyPath({
        id: property.id,
        locationId: property.locationId,
        name: property.name,
      }),
      name: property.name ?? "Объект без названия",
      typeLabel: property.type ? (propertyTypeById[property.type]?.name ?? property.type) : null,
      locationName: property.locationId
        ? (crimeaLocationById[property.locationId]?.name ?? property.locationName)
        : property.locationName,
      coverImageUrl: property.media[0]?.url ?? null,
      activeRoomsCount: property.rooms.length,
      minNightPrice,
      currency,
      avgRating: Number(property.avgRating),
      reviewsCount: property.reviewsCount,
      owner: property.owner,
      favoritedAt: favorite.createdAt.toISOString(),
    };
  });
}

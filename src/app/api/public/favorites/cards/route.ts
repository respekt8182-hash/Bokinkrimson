import { NextResponse } from "next/server";
import { isFavoriteEntityType, type FavoriteEntityType } from "@/lib/favorite-entities";
import { getPublicExcursionByIdentifier, type PublicExcursionCard } from "@/lib/public-excursions";
import { getPublicPropertyByIdentifier, type PublicPropertyCard } from "@/lib/public-properties";

type FavoriteLookupItem = {
  id: string;
  entityType: FavoriteEntityType;
};

type FavoriteCardsResponseItem =
  | {
      key: string;
      entityType: "property";
      item: PublicPropertyCard;
    }
  | {
      key: string;
      entityType: "excursion" | "tour";
      item: PublicExcursionCard;
    };

function buildFavoriteKey(item: FavoriteLookupItem) {
  return `${item.entityType}:${item.id}`;
}

function normalizeFavoriteLookupItem(input: unknown): FavoriteLookupItem | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const value = input as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const entityType = value.entityType;

  if (!id || !isFavoriteEntityType(entityType)) {
    return null;
  }

  return { id, entityType };
}

function dedupeFavoriteLookupItems(items: FavoriteLookupItem[]) {
  const seen = new Set<string>();
  const result: FavoriteLookupItem[] = [];

  for (const item of items) {
    const key = buildFavoriteKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

export async function POST(request: Request) {
  let body: unknown = null;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ items: [] }, { status: 400 });
  }

  const rawItems =
    body && typeof body === "object" && Array.isArray((body as { items?: unknown[] }).items)
      ? (body as { items: unknown[] }).items
      : [];

  const items = dedupeFavoriteLookupItems(
    rawItems
      .map((item) => normalizeFavoriteLookupItem(item))
      .filter((item): item is FavoriteLookupItem => Boolean(item)),
  ).slice(0, 48);

  if (items.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const results = await Promise.all(
    items.map(async (item): Promise<FavoriteCardsResponseItem | null> => {
      if (item.entityType === "property") {
        const property = await getPublicPropertyByIdentifier(item.id);
        return property
          ? {
              key: buildFavoriteKey(item),
              entityType: item.entityType,
              item: property,
            }
          : null;
      }

      const excursion = await getPublicExcursionByIdentifier(item.id);
      return excursion
        ? {
            key: buildFavoriteKey(item),
            entityType: item.entityType,
            item: excursion,
          }
        : null;
    }),
  );

  return NextResponse.json({
    items: results.filter((item): item is FavoriteCardsResponseItem => Boolean(item)),
  });
}

// Map points endpoint for housing: returns lightweight coordinates + prices for current catalog filters.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFavoritePropertyIds } from "@/lib/favorites";
import { type PublicCatalogQuery, getPublicCatalog } from "@/lib/public-properties";
import {
  isPointInsideBounds,
  parseBoundsParam,
  parseIntParam,
  parseOptionalFloatParam,
  parseOptionalIntParam,
  pickFirstListValue,
} from "@/lib/search-contracts";

const maxCollectedItems = 5000;
const mapCollectionPageSize = 24;

function normalizeLocationFilterValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/^(г\.?|город|с\.?|село|пос\.?|поселок|пгт)\s+/i, "")
    .replace(/\s+/g, " ");
}

function parseSort(raw: string | null): PublicCatalogQuery["sort"] | undefined {
  const value = (raw ?? "").trim();
  if (
    value === "relevance" ||
    value === "price_asc" ||
    value === "price_desc" ||
    value === "rating_desc" ||
    value === "popular_desc"
  ) {
    return value;
  }

  return undefined;
}

function parseFlag(raw: string | null): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

function pickPointPhotos(item: { imageUrls: string[]; coverImageUrl: string | null }): string[] {
  const source =
    item.imageUrls.length > 0 ? item.imageUrls : item.coverImageUrl ? [item.coverImageUrl] : [];
  return Array.from(new Set(source.filter((url) => url.trim().length > 0))).slice(0, 5);
}

async function collectCatalogItems(query: PublicCatalogQuery) {
  const result = await getPublicCatalog({
    ...query,
    page: 1,
    pageSize: maxCollectedItems,
    allowLargePageSize: true,
    trackSearchImpressions: false,
  });

  return {
    items: result.items,
    totalAvailable: result.total,
    truncated: result.total > maxCollectedItems,
    filters: result.filters,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bounds = parseBoundsParam(searchParams.get("bounds"));
  const page = parseIntParam(searchParams.get("page"), 1, { min: 1, max: 500 });
  const guests = parseOptionalIntParam(
    searchParams.get("guests") ?? searchParams.get("adults"),
    { min: 1, max: 20 },
  );
  const minPrice = parseOptionalFloatParam(
    searchParams.get("minPrice") ?? searchParams.get("min_price"),
    { min: 0, max: 1_000_000_000 },
  );
  const maxPrice = parseOptionalFloatParam(
    searchParams.get("maxPrice") ?? searchParams.get("max_price"),
    { min: 0, max: 1_000_000_000 },
  );
  const minRating = parseOptionalFloatParam(searchParams.get("minRating"), { min: 1, max: 5 });

  const query: PublicCatalogQuery = {
    page,
    pageSize: 24,
    locationId:
      searchParams.get("location_id") ??
      searchParams.get("locationId") ??
      undefined,
    location: searchParams.get("location") ?? undefined,
    query:
      searchParams.get("query") ??
      searchParams.get("q") ??
      undefined,
    type:
      pickFirstListValue(searchParams.get("type")) ??
      searchParams.get("propertyType") ??
      pickFirstListValue(searchParams.get("type[]")) ??
      undefined,
    checkIn: searchParams.get("checkIn") ?? searchParams.get("checkin") ?? undefined,
    checkOut: searchParams.get("checkOut") ?? searchParams.get("checkout") ?? undefined,
    guests,
    minPrice,
    maxPrice,
    minRating,
    sort: parseSort(searchParams.get("sort")),
    hasPhotos: parseFlag(searchParams.get("hasPhotos")),
    hasReviews: parseFlag(searchParams.get("hasReviews")),
    familyFriendly:
      parseFlag(searchParams.get("familyFriendly")) || parseFlag(searchParams.get("kidsFriendly")),
    petsAllowed: parseFlag(searchParams.get("petsAllowed")),
  };

  const collected = await collectCatalogItems(query);
  const effectiveLocationId = query.locationId ?? collected.filters.locationId ?? null;
  const normalizedRequestedLocation = effectiveLocationId
    ? ""
    : normalizeLocationFilterValue(query.location ?? null);
  const session = await getSession();
  const favoritePropertyIds = session
    ? await getFavoritePropertyIds(
        session.id,
        collected.items.map((item) => item.id),
      )
    : new Set<string>();

  const points = collected.items
    .filter((item) => {
      if (!isPointInsideBounds(item.latitude, item.longitude, bounds)) {
        return false;
      }

      if (effectiveLocationId) {
        return item.locationId === effectiveLocationId;
      }

      if (normalizedRequestedLocation) {
        return normalizeLocationFilterValue(item.locationName) === normalizedRequestedLocation;
      }

      return true;
    })
    .map((item) => ({
      id: item.id,
      title: item.name,
      url: item.path,
      path: item.path,
      latitude: item.latitude,
      longitude: item.longitude,
      pricePerNight: item.stayPrice?.nightly ?? item.minNightPrice,
      priceFrom: item.minNightPrice,
      currency: item.stayPrice?.currency ?? item.currency ?? "RUB",
      addressShort: item.locationName ?? "Крым",
      photos: pickPointPhotos(item),
      rating: item.reviewsCount > 0 ? Number(item.avgRating.toFixed(1)) : null,
      reviewsCount: item.reviewsCount,
      isFavorite: favoritePropertyIds.has(item.id),
    }));

  return NextResponse.json({
    total: points.length,
    map_points: points,
    meta: {
      totalAvailable: collected.totalAvailable,
      truncated: collected.truncated,
      collectedPages: Math.ceil(collected.items.length / mapCollectionPageSize),
    },
  });
}

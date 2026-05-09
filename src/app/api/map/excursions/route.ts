// Map points endpoint for excursions: returns lightweight coordinates + prices for current catalog filters.
import { NextResponse } from "next/server";
import {
  type PublicExcursionCatalogQuery,
  getPublicExcursionCatalog,
} from "@/lib/public-excursions";
import {
  isPointInsideBounds,
  parseBoundsParam,
  parseIntParam,
  parseOptionalFloatParam,
  parseOptionalIntParam,
} from "@/lib/search-contracts";

const maxCollectedItems = 5000;
const mapCollectionPageSize = 24;

async function collectCatalogItems(query: PublicExcursionCatalogQuery) {
  const result = await getPublicExcursionCatalog({
    ...query,
    page: 1,
    pageSize: maxCollectedItems,
    allowLargePageSize: true,
  });

  return {
    items: result.items,
    totalAvailable: result.total,
    truncated: result.total > maxCollectedItems,
  };
}

function parseOfferType(value: string | null): PublicExcursionCatalogQuery["offerType"] {
  return value === "excursion" || value === "tour" ? value : undefined;
}

function parseDurationBucket(
  value: string | null,
): PublicExcursionCatalogQuery["durationBucket"] {
  return value === "up_to_3h" || value === "between_3h_6h" || value === "more_6h"
    ? value
    : undefined;
}

function parseDifficulty(value: string | null): PublicExcursionCatalogQuery["difficulty"] {
  return value === "easy" || value === "medium" || value === "hard" ? value : undefined;
}

function parseSort(value: string | null): PublicExcursionCatalogQuery["sort"] {
  return value === "relevance" ||
    value === "price_asc" ||
    value === "price_desc" ||
    value === "rating_desc" ||
    value === "popular_desc" ||
    value === "distance_asc" ||
    value === "duration_asc"
    ? value
    : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bounds = parseBoundsParam(searchParams.get("bounds"));
  const page = parseIntParam(searchParams.get("page"), 1, { min: 1, max: 500 });

  const query: PublicExcursionCatalogQuery = {
    page,
    pageSize: 24,
    offerType: parseOfferType(searchParams.get("offerType")),
    locationId:
      searchParams.get("location_id") ??
      searchParams.get("locationId") ??
      undefined,
    location: searchParams.get("location") ?? undefined,
    districtId:
      searchParams.get("district_id") ??
      searchParams.get("districtId") ??
      undefined,
    district: searchParams.get("district") ?? undefined,
    categoryId:
      searchParams.get("category_id") ??
      searchParams.get("categoryId") ??
      undefined,
    category: searchParams.get("category") ?? undefined,
    bounds,
    query:
      searchParams.get("query") ??
      searchParams.get("q") ??
      undefined,
    dateFrom:
      searchParams.get("date_from") ??
      searchParams.get("dateFrom") ??
      searchParams.get("date") ??
      undefined,
    dateTo:
      searchParams.get("date_to") ??
      searchParams.get("dateTo") ??
      undefined,
    people: parseOptionalIntParam(
      searchParams.get("participants") ?? searchParams.get("people") ?? searchParams.get("guests"),
      { min: 1, max: 40 },
    ),
    format: searchParams.get("format") ?? undefined,
    pickup:
      searchParams.get("pickup") === "1" ||
      searchParams.get("pickup") === "true",
    kids:
      searchParams.get("kids") === "1" ||
      searchParams.get("kids") === "true",
    radiusKm: (() => {
      const value = Number.parseFloat(searchParams.get("radiusKm") ?? "");
      return Number.isFinite(value) ? value : undefined;
    })(),
    minPrice: parseOptionalFloatParam(searchParams.get("minPrice"), {
      min: 0,
      max: 1_000_000_000,
    }),
    maxPrice: parseOptionalFloatParam(searchParams.get("maxPrice"), {
      min: 0,
      max: 1_000_000_000,
    }),
    durationBucket: parseDurationBucket(searchParams.get("durationBucket")),
    language: searchParams.get("language") ?? undefined,
    difficulty: parseDifficulty(searchParams.get("difficulty")),
    sort: parseSort(searchParams.get("sort")),
  };

  const collected = await collectCatalogItems(query);
  const points = collected.items
    .filter((item) => isPointInsideBounds(item.latitude, item.longitude, bounds))
    .map((item) => item);

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

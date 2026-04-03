// Search contract endpoint for excursions catalog (TZ-compatible alias over public excursions domain service).
import { NextResponse } from "next/server";
import { getPublicExcursionCatalog } from "@/lib/public-excursions";
import {
  isPointInsideBounds,
  parseBoundsParam,
  parseIntParam,
  parseOptionalIntParam,
  pickFirstListValue,
} from "@/lib/search-contracts";

function normalizeSort(raw: string | null): string {
  const value = (raw ?? "").trim().toLowerCase();
  return value || "relevance";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = parseIntParam(searchParams.get("page"), 1, { min: 1, max: 500 });
  const pageSize = parseIntParam(
    searchParams.get("page_size") ?? searchParams.get("pageSize"),
    30,
    { min: 1, max: 30 },
  );
  const participants = parseOptionalIntParam(
    searchParams.get("participants") ?? searchParams.get("people"),
    { min: 1, max: 40 },
  );
  const bounds = parseBoundsParam(searchParams.get("bounds"));
  const sortRaw = normalizeSort(searchParams.get("sort"));
  const sort =
    sortRaw === "price_asc" ||
    sortRaw === "price_desc" ||
    sortRaw === "rating_desc" ||
    sortRaw === "popular_desc" ||
    sortRaw === "distance_asc" ||
    sortRaw === "duration_asc"
      ? sortRaw
      : ("relevance" as const);

  const durationBucketRaw = searchParams.get("durationBucket");
  const durationBucket =
    durationBucketRaw === "up_to_3h" ||
    durationBucketRaw === "between_3h_6h" ||
    durationBucketRaw === "more_6h"
      ? durationBucketRaw
      : undefined;

  const minPriceRaw = Number.parseFloat(searchParams.get("minPrice") ?? "");
  const maxPriceRaw = Number.parseFloat(searchParams.get("maxPrice") ?? "");

  const result = await getPublicExcursionCatalog({
    page,
    pageSize,
    offerType:
      searchParams.get("offerType") === "tour" || searchParams.get("offerType") === "excursion"
        ? (searchParams.get("offerType") as "tour" | "excursion")
        : undefined,
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
    people: participants,
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
    sort,
    durationBucket,
    minPrice: Number.isFinite(minPriceRaw) && minPriceRaw > 0 ? minPriceRaw : undefined,
    maxPrice: Number.isFinite(maxPriceRaw) && maxPriceRaw > 0 ? maxPriceRaw : undefined,
  });

  const mapPoints = result.items
    .filter((item) => isPointInsideBounds(item.latitude, item.longitude, bounds))
    .map((item) => ({
      id: item.id,
      title: item.title,
      path: item.path,
      latitude: item.latitude,
      longitude: item.longitude,
      priceFrom: item.priceFrom,
      priceTo: item.priceTo,
      currency: item.currency,
      avgRating: item.avgRating,
      reviewsCount: item.reviewsCount,
      categoryName: item.categoryName,
    }));

  return NextResponse.json({
    items: result.items,
    total: result.total,
    page: result.page,
    page_size: result.pageSize,
    total_pages: result.totalPages,
    map_points: mapPoints,
    meta: {
      filters: result.filters,
      requested: {
        sort,
        language: pickFirstListValue(
          searchParams.get("language") ?? searchParams.get("language[]"),
        ),
      },
    },
  });
}

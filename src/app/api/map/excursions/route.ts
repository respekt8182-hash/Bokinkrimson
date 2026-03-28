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
  parseOptionalIntParam,
} from "@/lib/search-contracts";

const maxCollectedPages = 20;

async function collectCatalogItems(query: PublicExcursionCatalogQuery) {
  const firstPage = await getPublicExcursionCatalog({ ...query, page: 1, pageSize: 24 });
  const items = [...firstPage.items];
  const maxPage = Math.min(firstPage.totalPages, maxCollectedPages);

  for (let page = 2; page <= maxPage; page += 1) {
    const nextPage = await getPublicExcursionCatalog({ ...query, page, pageSize: 24 });
    items.push(...nextPage.items);
  }

  return {
    items,
    totalAvailable: firstPage.total,
    truncated: firstPage.totalPages > maxCollectedPages,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bounds = parseBoundsParam(searchParams.get("bounds"));
  const page = parseIntParam(searchParams.get("page"), 1, { min: 1, max: 500 });

  const query: PublicExcursionCatalogQuery = {
    page,
    pageSize: 24,
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
    people: parseOptionalIntParam(
      searchParams.get("participants") ?? searchParams.get("people"),
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
  };

  const collected = await collectCatalogItems(query);
  const points = collected.items
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
    total: points.length,
    map_points: points,
    meta: {
      totalAvailable: collected.totalAvailable,
      truncated: collected.truncated,
      collectedPages: Math.min(maxCollectedPages, Math.ceil(collected.items.length / 24)),
    },
  });
}

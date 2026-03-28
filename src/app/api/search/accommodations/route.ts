// Search contract endpoint for housing catalog (TZ-compatible alias over public catalog domain service).
import { NextResponse } from "next/server";
import { getPublicCatalog } from "@/lib/public-properties";
import { SearchFiltersSchema } from "@/lib/schemas/search";
import {
  isPointInsideBounds,
  parseBoundsParam,
  parseOptionalIntParam,
  pickFirstListValue,
} from "@/lib/search-contracts";

function parseSort(raw: string | null) {
  const value = (raw ?? "").trim().toLowerCase();
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = SearchFiltersSchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_search_params",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const page = input.page;
  const pageSize = input.pageSize ?? input.page_size ?? 30;
  const adults = parseOptionalIntParam(searchParams.get("adults"), { min: 1, max: 20 });
  const children = parseOptionalIntParam(searchParams.get("children"), { min: 0, max: 20 });
  const guests =
    input.guests ??
    (adults !== undefined || children !== undefined
      ? Math.max(1, (adults ?? 1) + (children ?? 0))
      : undefined);
  const bounds = parseBoundsParam(searchParams.get("bounds"));
  const minPrice =
    typeof input.minPrice === "number" && Number.isFinite(input.minPrice)
      ? input.minPrice
      : undefined;
  const maxPrice =
    typeof input.maxPrice === "number" && Number.isFinite(input.maxPrice)
      ? input.maxPrice
      : undefined;
  const minRating =
    typeof input.minRating === "number" && Number.isFinite(input.minRating)
      ? input.minRating
      : undefined;
  const sort = parseSort(input.sort);
  const query = input.query ?? input.q;
  const familyFriendly = input.familyFriendly === true || input.kidsFriendly === true;

  const result = await getPublicCatalog({
    // Contract adapter: normalize external API names to internal catalog query.
    page,
    pageSize,
    locationId:
      searchParams.get("location_id") ?? input.locationId ?? undefined,
    location: input.location ?? undefined,
    query: query ?? undefined,
    checkIn: searchParams.get("checkin") ?? searchParams.get("checkIn") ?? undefined,
    checkOut: searchParams.get("checkout") ?? searchParams.get("checkOut") ?? undefined,
    guests,
    minPrice,
    maxPrice,
    minRating,
    sort,
    hasPhotos: input.hasPhotos === true,
    hasReviews: input.hasReviews === true,
    familyFriendly,
    petsAllowed: input.petsAllowed === true,
    type:
      pickFirstListValue(searchParams.get("type")) ??
      input.propertyType ??
      pickFirstListValue(searchParams.get("type[]")) ??
      input.type ??
      undefined,
  });

  const mapPoints = result.items
    .filter((item) => isPointInsideBounds(item.latitude, item.longitude, bounds))
    .map((item) => ({
      id: item.id,
      title: item.name,
      path: item.path,
      latitude: item.latitude,
      longitude: item.longitude,
      priceFrom: item.minNightPrice,
      currency: item.currency,
      typeLabel: item.typeLabel,
      avgRating: item.avgRating,
      reviewsCount: item.reviewsCount,
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
        checkin: searchParams.get("checkin"),
        checkout: searchParams.get("checkout"),
        adults,
        children,
        sort,
      },
    },
  });
}

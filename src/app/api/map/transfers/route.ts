import { NextRequest, NextResponse } from "next/server";
import { getPublicTransferCatalog } from "@/lib/public-marketplace";
import { parseBoundsParam } from "@/lib/search-contracts";

function readNumber(value: string | null): number | undefined {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readSort(value: string | null) {
  return value === "distance_asc" ||
    value === "price_asc" ||
    value === "price_desc" ||
    value === "rating_desc" ||
    value === "popular_desc" ||
    value === "newest"
    ? value
    : "relevance";
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const result = await getPublicTransferCatalog({
    query: params.get("q") || params.get("query") || "",
    location: params.get("location") || "",
    transferType: params.get("transferType") || "",
    radiusKm: readNumber(params.get("radiusKm")),
    minPrice: readNumber(params.get("minPrice")),
    maxPrice: readNumber(params.get("maxPrice")),
    sort: readSort(params.get("sort")),
    bounds: parseBoundsParam(params.get("bounds") || ""),
    page: 1,
    pageSize: 5000,
    allowLargePageSize: true,
  });

  return NextResponse.json({
    items: result.items,
    map_points: result.items,
    total: result.total,
  });
}

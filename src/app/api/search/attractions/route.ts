import { NextResponse } from "next/server";
import {
  getPublicAttractionCatalog,
  type PublicAttractionCatalogQuery,
} from "@/lib/public-marketplace";
import { parseBoundsParam } from "@/lib/search-contracts";

function parsePage(value: string | null): number {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) ? Math.max(1, page) : 1;
}

function parsePageSize(value: string | null): number {
  const pageSize = Number.parseInt(value ?? "30", 10);
  return Number.isFinite(pageSize) ? Math.max(1, Math.min(30, pageSize)) : 30;
}

function parseRadiusKm(value: string | null): number | undefined {
  const radiusKm = Number.parseFloat(value ?? "");
  return Number.isFinite(radiusKm) ? radiusKm : undefined;
}

function parseSort(value: string | null): PublicAttractionCatalogQuery["sort"] | undefined {
  return value === "distance_asc" || value === "newest" || value === "name_asc" ? value : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageSize = parsePageSize(searchParams.get("pageSize") ?? searchParams.get("page_size"));
  const bounds = parseBoundsParam(searchParams.get("bounds"));
  const result = await getPublicAttractionCatalog({
    page: parsePage(searchParams.get("page")),
    pageSize,
    query: searchParams.get("q") ?? searchParams.get("query") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    bounds,
    radiusKm: parseRadiusKm(searchParams.get("radiusKm")) ?? 20,
    sort: parseSort(searchParams.get("sort")),
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=45, stale-while-revalidate=180",
    },
  });
}

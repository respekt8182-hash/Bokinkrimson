import { NextResponse } from "next/server";
import {
  getPublicAttractionMapItems,
  type PublicAttractionCatalogQuery,
} from "@/lib/public-marketplace";

function parseRadiusKm(value: string | null): number | undefined {
  const radiusKm = Number.parseFloat(value ?? "");
  return Number.isFinite(radiusKm) ? radiusKm : undefined;
}

function parseSort(value: string | null): PublicAttractionCatalogQuery["sort"] | undefined {
  return value === "distance_asc" || value === "newest" || value === "name_asc" ? value : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = await getPublicAttractionMapItems({
    query: searchParams.get("q") ?? searchParams.get("query") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    radiusKm: parseRadiusKm(searchParams.get("radiusKm")),
    sort: parseSort(searchParams.get("sort")),
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

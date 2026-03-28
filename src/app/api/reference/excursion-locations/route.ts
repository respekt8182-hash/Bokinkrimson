// Excursion reference endpoint: fuzzy-search location directory for public filters and organizer forms.
import { NextResponse } from "next/server";
import { searchExcursionLocationDirectory } from "@/lib/excursion-directory";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const districtId = searchParams.get("districtId");
  const majorOnly = searchParams.get("majorOnly") === "1";
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "8", 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(30, limitRaw)) : 8;

  const items = await searchExcursionLocationDirectory(query, {
    limit,
    majorOnly,
    districtId,
  });

  return NextResponse.json({ items });
}

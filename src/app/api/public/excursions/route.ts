// API route handler for /api/public/excursions.
import { NextResponse } from "next/server";
import { getPublicExcursionCatalog } from "@/lib/public-excursions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "12", 10);
  const location = searchParams.get("location") ?? undefined;
  const locationId = searchParams.get("locationId") ?? undefined;
  const offerType = searchParams.get("offerType") ?? undefined;
  const district = searchParams.get("district") ?? undefined;
  const districtId = searchParams.get("districtId") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const query = searchParams.get("query") ?? searchParams.get("q") ?? undefined;
  // Accept housing-style aliases so shared frontend widgets can call the same endpoint.
  const dateFrom = searchParams.get("dateFrom") ?? searchParams.get("checkIn") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? searchParams.get("checkOut") ?? undefined;
  const peopleRaw = Number.parseInt(searchParams.get("people") ?? searchParams.get("guests") ?? "", 10);
  const people = Number.isFinite(peopleRaw) ? peopleRaw : undefined;
  const format = searchParams.get("format") ?? undefined;
  const pickup = searchParams.get("pickup") === "1" || searchParams.get("pickup") === "true";
  const kids = searchParams.get("kids") === "1" || searchParams.get("kids") === "true";
  const radiusRaw = Number.parseFloat(searchParams.get("radiusKm") ?? "");
  const radiusKm = Number.isFinite(radiusRaw) ? radiusRaw : undefined;

  const result = await getPublicExcursionCatalog({
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 12,
    offerType: offerType === "tour" || offerType === "excursion" ? offerType : undefined,
    location,
    locationId,
    district,
    districtId,
    category,
    categoryId,
    query,
    dateFrom,
    dateTo,
    people,
    format,
    pickup,
    kids,
    radiusKm,
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

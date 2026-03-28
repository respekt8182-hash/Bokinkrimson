import { NextResponse } from "next/server";
import { getPublicCatalog } from "@/lib/public-properties";

// Guest-facing catalog API. Returns only published housing objects.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "12", 10);
  const location = searchParams.get("location") ?? undefined;
  const locationId = searchParams.get("locationId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const query = searchParams.get("query") ?? searchParams.get("q") ?? undefined;
  // Keep backward compatibility with legacy clients using lowercase query keys.
  const checkIn = searchParams.get("checkIn") ?? searchParams.get("checkin") ?? undefined;
  const checkOut = searchParams.get("checkOut") ?? searchParams.get("checkout") ?? undefined;
  const guestsRaw = Number.parseInt(
    searchParams.get("guests") ?? searchParams.get("adults") ?? "",
    10,
  );
  const guests = Number.isFinite(guestsRaw) ? Math.max(1, guestsRaw) : undefined;

  const result = await getPublicCatalog({
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 12,
    location,
    locationId,
    type,
    query,
    checkIn,
    checkOut,
    guests,
  });

  return NextResponse.json(result, {
    headers: {
      // Safe CDN cache for list pages; data is eventually consistent.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

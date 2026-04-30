import { NextResponse } from "next/server";
import { resolveCrimeaLocationCenter } from "@/lib/crimea-location-centers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location")?.trim() ?? "";

  if (location.length < 2 || location.length > 120) {
    return NextResponse.json(
      { item: null },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=1800",
        },
      },
    );
  }

  const center = await resolveCrimeaLocationCenter(location);

  return NextResponse.json(
    {
      item: center
        ? {
            name: center.name,
            latitude: center.latitude,
            longitude: center.longitude,
            zoom: center.zoom,
          }
        : null,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}

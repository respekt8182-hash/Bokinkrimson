import { NextResponse } from "next/server";
import { getPublicPropertyByIdentifier } from "@/lib/public-properties";

type RouteContext = {
  params: Promise<{ identifier: string }>;
};

// Guest-facing property card API. Supports both raw id and slug-with-id identifier.
export async function GET(request: Request, context: RouteContext) {
  const { identifier } = await context.params;
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");

  const item = await getPublicPropertyByIdentifier(identifier, locationId ?? undefined);

  if (!item) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  return NextResponse.json(
    { item },
    {
      headers: {
        // Slightly longer cache than list because card content changes less often.
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}

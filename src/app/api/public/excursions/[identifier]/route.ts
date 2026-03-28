// API route handler for /api/public/excursions/[identifier].
import { NextResponse } from "next/server";
import { getPublicExcursionByIdentifier } from "@/lib/public-excursions";

type RouteContext = {
  params: Promise<{ identifier: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { identifier } = await context.params;
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");

  const item = await getPublicExcursionByIdentifier(identifier, locationId ?? undefined);

  if (!item) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  return NextResponse.json(
    { item },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}

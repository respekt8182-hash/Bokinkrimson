import { NextResponse } from "next/server";
import { searchLocationDirectory } from "@/lib/location-directory";

// Public autocomplete endpoint used on landing and catalog filters.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const items = await searchLocationDirectory(query, query.length < 2 ? 10 : 8);

  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}

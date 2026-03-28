// API route handler for /api/reference/locations.
import { NextResponse } from "next/server";
import { searchLocationDirectory } from "@/lib/location-directory";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const items = await searchLocationDirectory(query, query.length < 2 ? 10 : 8);

  return NextResponse.json({ items });
}

// Excursion reference endpoint: returns district directory used by filters and editor selects.
import { NextResponse } from "next/server";
import { getExcursionDistrictDirectory } from "@/lib/excursion-directory";

export async function GET() {
  const items = await getExcursionDistrictDirectory();
  return NextResponse.json({ items });
}

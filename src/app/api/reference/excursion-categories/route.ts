// Excursion reference endpoint: returns active categories used by filters and editor selects.
import { NextResponse } from "next/server";
import { getExcursionCategoryDirectory } from "@/lib/excursion-directory";

export async function GET() {
  const items = await getExcursionCategoryDirectory();
  return NextResponse.json({ items });
}

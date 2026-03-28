import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Returns amenity catalog both flat and grouped for convenient UI usage.
export async function GET() {
  const items = await db.amenity.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const categories = Array.from(
    items.reduce((map, amenity) => {
      const key = amenity.category;
      const value = map.get(key) ?? [];
      value.push({ id: amenity.id, name: amenity.name });
      map.set(key, value);
      return map;
    }, new Map<string, Array<{ id: string; name: string }>>()),
  ).map(([category, amenities]) => ({ category, amenities }));

  return NextResponse.json({ items, categories });
}

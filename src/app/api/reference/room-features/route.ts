import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Returns active room feature catalog for checkbox UI.
export async function GET() {
  const items = await db.roomFeature.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const categories = Array.from(
    items.reduce((map, feature) => {
      const key = feature.category;
      const value = map.get(key) ?? [];
      value.push({ id: feature.id, name: feature.name });
      map.set(key, value);
      return map;
    }, new Map<string, Array<{ id: string; name: string }>>()),
  ).map(([category, features]) => ({ category, features }));

  return NextResponse.json({ items, categories });
}

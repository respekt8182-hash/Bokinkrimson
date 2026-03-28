import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeExcursion } from "@/lib/excursions";

// Owner excursions collection endpoint:
// GET  -> list own excursions
// POST -> create empty draft excursion
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const items = await db.excursion.findMany({
    where: {
      ownerId: session.id,
    },
    include: {
      mainLocation: { select: { name: true } },
      anchorLocation: { select: { name: true } },
      district: { select: { name: true } },
      category: { select: { name: true } },
      meetingLocation: { select: { name: true } },
      pickupLocations: { select: { locationId: true } },
      routeLocations: {
        select: { locationId: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return NextResponse.json({ items: items.map(serializeExcursion) });
}

export async function POST() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const created = await db.excursion.create({
    data: {
      ownerId: session.id,
      contactFirstName: session.firstName,
      contactLastName: session.lastName,
      contactEmail: "",
    },
    include: {
      mainLocation: { select: { name: true } },
      anchorLocation: { select: { name: true } },
      district: { select: { name: true } },
      category: { select: { name: true } },
      meetingLocation: { select: { name: true } },
      pickupLocations: { select: { locationId: true } },
      routeLocations: {
        select: { locationId: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json({ item: serializeExcursion(created) }, { status: 201 });
}

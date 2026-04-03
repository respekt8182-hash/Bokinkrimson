import { NextResponse } from "next/server";
import { ExcursionOfferType } from "@prisma/client";
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

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let offerType: ExcursionOfferType = ExcursionOfferType.EXCURSION;
  try {
    const payload = (await request.json()) as { offerType?: string };
    if (payload.offerType === ExcursionOfferType.TOUR) {
      offerType = ExcursionOfferType.TOUR;
    }
  } catch {
    // Empty body is allowed for backwards compatibility.
  }

  const created = await db.excursion.create({
    data: {
      ownerId: session.id,
      offerType,
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

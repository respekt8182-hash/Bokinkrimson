import { NextResponse } from "next/server";
import { ExcursionOfferType } from "@prisma/client";
import { getSession } from "@/lib/auth";
import {
  countOwnerActiveExcursionDrafts,
  OWNER_ACTIVE_EXCURSION_DRAFT_LIMIT,
  purgeExpiredDeletedExcursions,
} from "@/lib/admin-entity-lifecycle";
import { db } from "@/lib/db";
import { createExcursionDraft, serializeExcursion } from "@/lib/excursions";

// Owner excursions collection endpoint:
// GET  -> list own excursions
// POST -> create empty draft excursion
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  await purgeExpiredDeletedExcursions(db, new Date());

  const items = await db.excursion.findMany({
    where: {
      ownerId: session.id,
      deletedAt: null,
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

  await purgeExpiredDeletedExcursions(db, new Date());

  let offerType: ExcursionOfferType = ExcursionOfferType.EXCURSION;
  try {
    const payload = (await request.json()) as { offerType?: string };
    if (payload.offerType === ExcursionOfferType.TOUR) {
      offerType = ExcursionOfferType.TOUR;
    }
  } catch {
    // Empty body is allowed for backwards compatibility.
  }

  const activeDraftsCount = await countOwnerActiveExcursionDrafts(db, session.id);
  if (activeDraftsCount >= OWNER_ACTIVE_EXCURSION_DRAFT_LIMIT) {
    return NextResponse.json(
      {
        error:
          "Доступно не больше 3 активных черновиков программ. Опубликуйте или удалите одну из текущих карточек.",
      },
      { status: 409 },
    );
  }

  const createdDraft = await createExcursionDraft(db, {
    ownerId: session.id,
    offerType,
    contactFirstName: session.firstName,
    contactLastName: "",
    contactEmail: "",
  });

  const created = await db.excursion.findUniqueOrThrow({
    where: {
      id: createdDraft.id,
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

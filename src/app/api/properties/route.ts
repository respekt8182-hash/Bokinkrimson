import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  countOwnerActivePropertyDrafts,
  OWNER_ACTIVE_PROPERTY_DRAFT_LIMIT,
} from "@/lib/admin-entity-lifecycle";
import { db } from "@/lib/db";
import {
  createPropertyDraft,
  purgeExpiredPropertyDraftsForOwner,
  serializeProperty,
} from "@/lib/properties";

// List + create draft properties for current authenticated owner.
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  await purgeExpiredPropertyDraftsForOwner(db, session.id);

  const properties = await db.property.findMany({
    where: { ownerId: session.id, ownerDeletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      media: {
        where: { roomId: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      rooms: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          prices: {
            select: { id: true },
          },
        },
      },
      amenities: {
        include: {
          amenity: true,
        },
      },
      customAmenities: true,
    },
  });

  return NextResponse.json({ items: properties.map(serializeProperty) });
}

export async function POST() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  await purgeExpiredPropertyDraftsForOwner(db, session.id);

  const activeDraftsCount = await countOwnerActivePropertyDrafts(db, session.id);
  if (activeDraftsCount >= OWNER_ACTIVE_PROPERTY_DRAFT_LIMIT) {
    return NextResponse.json(
      {
        error:
          "Доступно не больше 3 активных черновиков объектов. Опубликуйте или удалите один из текущих черновиков.",
      },
      { status: 409 },
    );
  }

  const created = await createPropertyDraft(db, {
    ownerId: session.id,
  });

  const property = await db.property.findUniqueOrThrow({
    where: {
      id: created.id,
    },
    include: {
      media: {
        where: { roomId: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      rooms: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          prices: {
            select: { id: true },
          },
        },
      },
      amenities: {
        include: {
          amenity: true,
        },
      },
      customAmenities: true,
    },
  });

  return NextResponse.json({ item: serializeProperty(property) }, { status: 201 });
}

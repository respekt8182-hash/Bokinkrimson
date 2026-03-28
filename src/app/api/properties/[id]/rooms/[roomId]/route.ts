// API route handler for /api/properties/[id]/rooms/[roomId].
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  markPropertyNeedsRemoderationAfterOwnerEdit,
  preparePropertyForPublishedOwnerEdit,
} from "@/lib/properties";
import { normalizeRoomTitle } from "@/lib/room-title";
import { resolveBathroomTypeFromMeta, roomInclude, serializeRoom } from "@/lib/rooms";
import { updateRoomSchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ id: string; roomId: string }>;
};

async function getOwnedRoom(propertyId: string, roomId: string, userId: string) {
  return db.room.findFirst({
    where: {
      id: roomId,
      propertyId,
      property: {
        ownerId: userId,
        ownerDeletedAt: null,
      },
    },
    include: roomInclude,
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId } = await context.params;
  const room = await getOwnedRoom(id, roomId, session.id);

  if (!room || !room.isActive) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  return NextResponse.json({ item: serializeRoom(room) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId } = await context.params;
  const existing = await getOwnedRoom(id, roomId, session.id);

  if (!existing || !existing.isActive) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateRoomSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность полей номера" }, { status: 400 });
  }

  const data = parsed.data;
  const normalizedTitle = normalizeRoomTitle(data.title) || data.title.trim();
  const normalizedBathroomType = resolveBathroomTypeFromMeta(data.meta, data.bathroomType);
  // Amenity fields are accepted for compatibility with existing payload contracts.
  // Primary amenity editing path is /api/properties/[id]/room-amenities.
  const featureIds = Array.from(new Set(data.featureIds.map((item) => item.trim())));
  const customFeatures = Array.from(
    new Map(
      data.customFeatures
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((item) => [item.toLowerCase(), item]),
    ).values(),
  );

  if (featureIds.length > 0) {
    const features = await db.roomFeature.findMany({
      where: {
        id: { in: featureIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (features.length !== featureIds.length) {
      return NextResponse.json(
        { error: "Часть оснащения номера не найдена в справочнике" },
        { status: 400 },
      );
    }
  }

  await preparePropertyForPublishedOwnerEdit(db, id);

  const updated = await db.$transaction(async (tx) => {
    await tx.room.update({
      where: { id: existing.id },
      data: {
        title: normalizedTitle,
        beds: data.beds,
        extraBeds: data.extraBeds,
        roomsCount: 1,
        areaSqm: data.areaSqm,
        bathroomType: normalizedBathroomType,
        meta: data.meta,
      },
    });

    // Replace all room features atomically to avoid stale joins after edit.
    await tx.roomFeatureOnRoom.deleteMany({ where: { roomId: existing.id } });
    if (featureIds.length > 0) {
      await tx.roomFeatureOnRoom.createMany({
        data: featureIds.map((featureId) => ({
          roomId: existing.id,
          featureId,
        })),
      });
    }

    // Paid markers are mirrored via custom features, so we also replace this set atomically.
    await tx.roomCustomFeature.deleteMany({ where: { roomId: existing.id } });
    if (customFeatures.length > 0) {
      await tx.roomCustomFeature.createMany({
        data: customFeatures.map((name) => ({
          roomId: existing.id,
          name,
        })),
      });
    }

    return tx.room.findUnique({
      where: { id: existing.id },
      include: roomInclude,
    });
  });

  if (!updated) {
    return NextResponse.json({ error: "Не удалось обновить номер" }, { status: 500 });
  }

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, id);

  return NextResponse.json({ item: serializeRoom(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId } = await context.params;
  const room = await db.room.findFirst({
    where: {
      id: roomId,
      propertyId: id,
      isActive: true,
      property: {
        ownerId: session.id,
        ownerDeletedAt: null,
      },
    },
    select: { id: true, propertyId: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  await preparePropertyForPublishedOwnerEdit(db, id);

  await db.room.update({
    where: { id: room.id },
    data: { isActive: false },
  });

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, id);

  const activeRoomCount = await db.room.count({
    where: {
      propertyId: room.propertyId,
      isActive: true,
    },
  });

  return NextResponse.json({
    ok: true,
    activeRoomCount,
  });
}

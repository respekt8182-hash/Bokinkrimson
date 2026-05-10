// API route handler for /api/properties/[id]/rooms/bulk-features.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { roomInclude, serializeRoom } from "@/lib/rooms";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const bulkRoomFeaturesSchema = z.object({
  category: z.string().trim().min(1).max(120),
  roomIds: z.array(z.string().trim().min(1)).min(1).max(200),
  featureIds: z.array(z.string().trim().min(1)).max(200),
  paidFeatureIds: z.array(z.string().trim().min(1)).max(200).optional().default([]),
});

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;

  const property = await db.property.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      ownerDeletedAt: true,
    },
  });

  if (!property || property.ownerId !== session.id || property.ownerDeletedAt) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = bulkRoomFeaturesSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность данных удобств" }, { status: 400 });
  }

  const category = parsed.data.category.trim();
  const roomIds = Array.from(new Set(parsed.data.roomIds.map((roomId) => roomId.trim())));
  const featureIds = Array.from(new Set(parsed.data.featureIds.map((featureId) => featureId.trim())));
  const paidFeatureIds = Array.from(
    new Set(parsed.data.paidFeatureIds.map((featureId) => featureId.trim())),
  ).filter((featureId) => featureIds.includes(featureId));

  const [rooms, categoryFeatures] = await Promise.all([
    db.room.findMany({
      where: {
        id: { in: roomIds },
        propertyId: property.id,
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
    db.roomFeature.findMany({
      where: {
        category,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  if (rooms.length !== roomIds.length) {
    return NextResponse.json(
      { error: "Часть номеров не найдена или недоступна" },
      { status: 400 },
    );
  }

  if (categoryFeatures.length === 0) {
    return NextResponse.json(
      { error: "Категория удобств не найдена в справочнике" },
      { status: 400 },
    );
  }

  const categoryFeatureIds = categoryFeatures.map((feature) => feature.id);
  const categoryFeatureIdSet = new Set(categoryFeatureIds);

  if (!featureIds.every((featureId) => categoryFeatureIdSet.has(featureId))) {
    return NextResponse.json(
      { error: "Выбраны удобства, которые не относятся к этой категории" },
      { status: 400 },
    );
  }

  const paidLabelByFeatureId = new Map(
    categoryFeatures.map((feature) => [feature.id, `${feature.name} (платно)`]),
  );

  await db.$transaction(async (tx) => {
    for (const roomId of roomIds) {
      await tx.roomFeatureOnRoom.deleteMany({
        where: {
          roomId,
          featureId: { in: categoryFeatureIds },
        },
      });

      if (featureIds.length > 0) {
        await tx.roomFeatureOnRoom.createMany({
          data: featureIds.map((featureId) => ({
            roomId,
            featureId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.roomCustomFeature.deleteMany({
        where: {
          roomId,
          name: {
            in: categoryFeatures.map((feature) => `${feature.name} (платно)`),
          },
        },
      });

      const paidLabels = paidFeatureIds
        .map((featureId) => paidLabelByFeatureId.get(featureId))
        .filter((value): value is string => Boolean(value));

      if (paidLabels.length > 0) {
        await tx.roomCustomFeature.createMany({
          data: paidLabels.map((name) => ({
            roomId,
            name,
          })),
          skipDuplicates: true,
        });
      }
    }
  });

  const updatedRooms = await db.room.findMany({
    where: {
      propertyId: property.id,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: roomInclude,
  });

  return NextResponse.json({
    items: updatedRooms.map(serializeRoom),
    message:
      paidFeatureIds.length > 0
        ? "Удобства применены. Для выбранных пунктов добавлена пометка «платно»."
        : "Удобства применены к выбранным номерам.",
  });
}

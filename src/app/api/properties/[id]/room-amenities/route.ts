import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import { markPropertyNeedsRemoderationAfterOwnerEdit } from "@/lib/properties";
import { normalizeRoomTitle } from "@/lib/room-title";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateRoomAmenitySchema = z.object({
  featureId: z.string().trim().min(1),
  enabled: z.boolean(),
  isPaid: z.boolean().nullable().optional(),
  isKeyAmenity: z.boolean().optional(),
  applyToAllCategories: z.boolean().optional().default(true),
  categoryIds: z.array(z.string().trim().min(1)).optional().default([]),
});

const MAX_KEY_AMENITIES_PER_PROPERTY = 4;

const paidOptionFeatureIds = new Set<string>([
  "hair_dryer",
  "fan",
  "heater",
  "kettle",
  "mini_bar",
  "clothes_dryer",
  "iron",
  "ironing_board",
  "desk_lamp",
  "monitor",
  "pet_food",
  "safe",
  "lockers",
]);

async function ensurePropertyAccess(
  propertyId: string,
  editor: Awaited<ReturnType<typeof getEditorSession>>,
) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      ownerDeletedAt: true,
    },
  });

  if (!property || property.ownerDeletedAt) {
    return null;
  }

  if (!editor?.isAdmin && property.ownerId !== editor?.id) {
    return null;
  }

  return property;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export async function GET(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await ensurePropertyAccess(id, editor);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const [features, rooms, settings, featureOnRooms, paidLabels] = await Promise.all([
    db.roomFeature.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
      },
    }),
    db.room.findMany({
      where: {
        propertyId: property.id,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
      },
    }),
    db.objectRoomAmenitySetting.findMany({
      where: {
        propertyId: property.id,
      },
      select: {
        featureId: true,
        enabled: true,
        isPaid: true,
        isKeyAmenity: true,
        applyToAllCategories: true,
        categoryIds: true,
        updatedAt: true,
      },
    }),
    db.roomFeatureOnRoom.findMany({
      where: {
        room: {
          propertyId: property.id,
          isActive: true,
        },
      },
      select: {
        roomId: true,
        featureId: true,
      },
    }),
    db.roomCustomFeature.findMany({
      where: {
        room: {
          propertyId: property.id,
          isActive: true,
        },
        name: {
          endsWith: " (платно)",
        },
      },
      select: {
        roomId: true,
        name: true,
      },
    }),
  ]);

  const roomIds = rooms.map((room) => room.id);
  const roomIdSet = new Set(roomIds);
  // Legacy room-feature links are transformed into per-feature settings if explicit setting is absent.
  // This keeps old data editable without one-time migration scripts.
  const featureSelectionByFeatureId = featureOnRooms.reduce(
    (map, item) => {
      const list = map.get(item.featureId) ?? [];
      list.push(item.roomId);
      map.set(item.featureId, dedupe(list));
      return map;
    },
    new Map<string, string[]>(),
  );
  const featureByPaidLabel = new Map(features.map((feature) => [`${feature.name} (платно)`, feature.id]));
  const paidRoomIdsByFeatureId = paidLabels.reduce(
    (map, item) => {
      const featureId = featureByPaidLabel.get(item.name);
      if (!featureId) {
        return map;
      }
      const list = map.get(featureId) ?? [];
      list.push(item.roomId);
      map.set(featureId, dedupe(list));
      return map;
    },
    new Map<string, string[]>(),
  );
  const settingByFeatureId = new Map(settings.map((item) => [item.featureId, item]));

  const items = features.map((feature) => {
    const canUsePaidOption = paidOptionFeatureIds.has(feature.id);
    const explicitSetting = settingByFeatureId.get(feature.id);

    if (explicitSetting) {
      const normalizedCategoryIds = dedupe(explicitSetting.categoryIds).filter((roomId) =>
        roomIdSet.has(roomId),
      );
      const applyToAllCategories =
        roomIds.length === 0 ||
        explicitSetting.applyToAllCategories ||
        (explicitSetting.enabled && normalizedCategoryIds.length === 0);

      return {
        id: feature.id,
        name: feature.name,
        category: feature.category,
        setting: {
          enabled: explicitSetting.enabled,
          isPaid: canUsePaidOption && explicitSetting.enabled ? explicitSetting.isPaid ?? false : null,
          isKeyAmenity: explicitSetting.enabled ? explicitSetting.isKeyAmenity : false,
          applyToAllCategories,
          categoryIds: applyToAllCategories ? [] : normalizedCategoryIds,
          updatedAt: explicitSetting.updatedAt.toISOString(),
        },
      };
    }

    const selectedRoomIds = featureSelectionByFeatureId.get(feature.id) ?? [];
    const enabled = selectedRoomIds.length > 0;
    const applyToAllCategories =
      roomIds.length === 0 ? true : enabled ? selectedRoomIds.length === roomIds.length : true;
    const paidRoomIds = paidRoomIdsByFeatureId.get(feature.id) ?? [];
    const isPaid =
      canUsePaidOption && enabled && selectedRoomIds.length > 0
        ? selectedRoomIds.every((roomId) => paidRoomIds.includes(roomId))
        : null;

    return {
      id: feature.id,
      name: feature.name,
      category: feature.category,
      setting: {
        enabled,
        isPaid,
        isKeyAmenity: false,
        applyToAllCategories,
        categoryIds: applyToAllCategories ? [] : selectedRoomIds,
        updatedAt: null,
      },
    };
  });

  return NextResponse.json({
    items,
    categories: Array.from(
      items.reduce((map, item) => {
        const list = map.get(item.category) ?? [];
        list.push(item);
        map.set(item.category, list);
        return map;
      }, new Map<string, typeof items>()),
    ).map(([category, categoryItems]) => ({ category, items: categoryItems })),
    roomCategories: rooms.map((room) => ({
      id: room.id,
      title: normalizeRoomTitle(room.title),
      propertyName: property.name,
    })),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await ensurePropertyAccess(id, editor);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateRoomAmenitySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность параметров удобства" }, { status: 400 });
  }

  const feature = await db.roomFeature.findUnique({
    where: { id: parsed.data.featureId },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  });

  if (!feature || !feature.isActive) {
    return NextResponse.json({ error: "Удобство не найдено в справочнике" }, { status: 404 });
  }

  const existingSetting = await db.objectRoomAmenitySetting.findUnique({
    where: {
      propertyId_featureId: {
        propertyId: property.id,
        featureId: feature.id,
      },
    },
    select: {
      isKeyAmenity: true,
    },
  });

  const rooms = await db.room.findMany({
    where: {
      propertyId: property.id,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
    },
  });

  const allRoomIds = rooms.map((room) => room.id);
  const allRoomIdSet = new Set(allRoomIds);
  const categoryIds = dedupe(parsed.data.categoryIds);

  const normalizedEnabled = parsed.data.enabled;
  let normalizedApplyToAll = parsed.data.applyToAllCategories;
  let normalizedCategoryIds = categoryIds.filter((roomId) => allRoomIdSet.has(roomId));

  if (normalizedEnabled) {
    if (allRoomIds.length === 0 || normalizedApplyToAll) {
      normalizedApplyToAll = true;
      normalizedCategoryIds = [];
    } else if (normalizedCategoryIds.length === 0) {
      return NextResponse.json(
        { error: "Выберите минимум один номер для этого удобства" },
        { status: 400 },
      );
    }
  } else {
    normalizedApplyToAll = true;
    normalizedCategoryIds = [];
  }

  const targetRoomIds = normalizedEnabled
    ? normalizedApplyToAll
      ? allRoomIds
      : normalizedCategoryIds
    : [];
  const canUsePaidOption = paidOptionFeatureIds.has(feature.id);
  const normalizedIsPaid = normalizedEnabled && canUsePaidOption ? parsed.data.isPaid ?? false : null;
  const requestedIsKeyAmenity = parsed.data.isKeyAmenity ?? existingSetting?.isKeyAmenity ?? false;
  const normalizedIsKeyAmenity = normalizedEnabled ? requestedIsKeyAmenity : false;
  const paidLabel = `${feature.name} (платно)`;
  const keyAmenityLimitErrorMessage = "__key_amenity_limit_reached__";

  try {
    await db.$transaction(async (tx) => {
      if (normalizedIsKeyAmenity) {
        const selectedKeyAmenitiesCount = await tx.objectRoomAmenitySetting.count({
          where: {
            propertyId: property.id,
            enabled: true,
            isKeyAmenity: true,
            featureId: { not: feature.id },
          },
        });

        if (selectedKeyAmenitiesCount >= MAX_KEY_AMENITIES_PER_PROPERTY) {
          throw new Error(keyAmenityLimitErrorMessage);
        }
      }

      await tx.objectRoomAmenitySetting.upsert({
        where: {
          propertyId_featureId: {
            propertyId: property.id,
            featureId: feature.id,
          },
        },
        create: {
          propertyId: property.id,
          featureId: feature.id,
          enabled: normalizedEnabled,
          isPaid: normalizedIsPaid,
          isKeyAmenity: normalizedIsKeyAmenity,
          applyToAllCategories: normalizedApplyToAll,
          categoryIds: normalizedCategoryIds,
        },
        update: {
          enabled: normalizedEnabled,
          isPaid: normalizedIsPaid,
          isKeyAmenity: normalizedIsKeyAmenity,
          applyToAllCategories: normalizedApplyToAll,
          categoryIds: normalizedCategoryIds,
        },
      });

      if (allRoomIds.length > 0) {
        // Full replace by feature is intentional: easier to reason about than partial diffs.
        await tx.roomFeatureOnRoom.deleteMany({
          where: {
            featureId: feature.id,
            roomId: { in: allRoomIds },
          },
        });

        await tx.roomCustomFeature.deleteMany({
          where: {
            roomId: { in: allRoomIds },
            name: paidLabel,
          },
        });
      }

      if (targetRoomIds.length > 0) {
        await tx.roomFeatureOnRoom.createMany({
          data: targetRoomIds.map((roomId) => ({
            roomId,
            featureId: feature.id,
          })),
          skipDuplicates: true,
        });

        if (normalizedIsPaid) {
          // Paid state is mirrored as "<feature> (платно)" custom feature for existing public surfaces.
          await tx.roomCustomFeature.createMany({
            data: targetRoomIds.map((roomId) => ({
              roomId,
              name: paidLabel,
            })),
            skipDuplicates: true,
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === keyAmenityLimitErrorMessage) {
      return NextResponse.json(
        { error: `Можно выбрать не более ${MAX_KEY_AMENITIES_PER_PROPERTY} ключевых удобств` },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Не удалось сохранить настройки удобства" }, { status: 500 });
  }

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, property.id);

  return NextResponse.json({
    item: {
      featureId: feature.id,
      enabled: normalizedEnabled,
      isPaid: normalizedIsPaid,
      isKeyAmenity: normalizedIsKeyAmenity,
      applyToAllCategories: normalizedApplyToAll,
      categoryIds: normalizedApplyToAll ? [] : normalizedCategoryIds,
    },
  });
}

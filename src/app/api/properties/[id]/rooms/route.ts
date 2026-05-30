// API route handler for /api/properties/[id]/rooms.
import { randomUUID } from "node:crypto";
import { Prisma, type BathroomType } from "@prisma/client";
import { NextResponse } from "next/server";
import { areDatabaseColumnsAvailable, db, type DbTransactionClient } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import {
  markPropertyNeedsRemoderationAfterOwnerEdit,
  preparePropertyForPublishedOwnerEdit,
} from "@/lib/properties";
import { logDatabaseFallbackOnce } from "@/lib/prisma-errors";
import { normalizeRoomTitle } from "@/lib/room-title";
import {
  buildRoomMetaWithFallbackSortOrder,
  compareSerializedRoomsBySortOrder,
  resolveBathroomTypeFromMeta,
  resolveSerializedRoomSortOrder,
  roomInclude,
  serializeRoom,
  serializeRoomForChessboard,
} from "@/lib/rooms";
import { createRoomSchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

function getDatabaseBathroomType(type: BathroomType): string {
  switch (type) {
    case "IN_ROOM":
      return "in_room";
    case "ON_FLOOR":
      return "on_floor";
    case "OUTSIDE":
      return "outside";
    default:
      return type;
  }
}

async function createRoomWithoutSortOrderColumn(
  client: DbTransactionClient,
  input: {
    propertyId: string;
    title: string;
    beds: number;
    extraBeds: number;
    roomsCount: number;
    areaSqm: number | null;
    bathroomType: BathroomType;
    meta: Prisma.InputJsonValue;
  },
): Promise<{ id: string }> {
  logDatabaseFallbackOnce(
    "room-create-compat",
    "Room creation is using a legacy insert compatibility path because the database schema is missing sortOrder. Apply the latest Prisma migration when DB owner access is available.",
  );

  const roomId = `room_${randomUUID().replace(/-/g, "")}`;
  const now = new Date();
  const rows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "Room" (
      "id",
      "propertyId",
      "title",
      "beds",
      "extraBeds",
      "roomsCount",
      "areaSqm",
      "bathroomType",
      "meta",
      "isActive",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${roomId},
      ${input.propertyId},
      ${input.title},
      ${input.beds},
      ${input.extraBeds},
      ${input.roomsCount},
      ${input.areaSqm === null ? null : new Prisma.Decimal(input.areaSqm)},
      CAST(${getDatabaseBathroomType(input.bathroomType)} AS "BathroomType"),
      CAST(${JSON.stringify(input.meta)} AS JSONB),
      true,
      ${now},
      ${now}
    )
    RETURNING "id"
  `);

  const room = rows[0];
  if (!room) {
    throw new Error("ROOM_CREATE_COMPAT_INSERT_FAILED");
  }

  return room;
}

async function ensurePropertyAccess(
  propertyId: string,
  editor: Awaited<ReturnType<typeof getEditorSession>>,
) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, ownerId: true, ownerDeletedAt: true },
  });

  if (!property || property.ownerDeletedAt) {
    return null;
  }

  if (!editor?.isAdmin && property.ownerId !== editor?.id) {
    return null;
  }

  return property;
}

export async function GET(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await ensurePropertyAccess(id, editor);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const view = new URL(request.url).searchParams.get("view");

  if (view === "chessboard") {
    const items = await db.room.findMany({
      where: {
        propertyId: property.id,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        propertyId: true,
        title: true,
        beds: true,
        extraBeds: true,
        roomsCount: true,
        areaSqm: true,
        bathroomType: true,
        meta: true,
        sortOrder: true,
        isActive: true,
        prices: {
          orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            roomId: true,
            dateFrom: true,
            dateTo: true,
            price: true,
            priceType: true,
            minGuests: true,
            minNights: true,
            extraBedPrice: true,
            currency: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      items: items.map(serializeRoomForChessboard).sort(compareSerializedRoomsBySortOrder),
      activeRoomCount: items.length,
    });
  }

  const items = await db.room.findMany({
    where: {
      propertyId: property.id,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: roomInclude,
  });

  return NextResponse.json({
    items: items.map(serializeRoom).sort(compareSerializedRoomsBySortOrder),
    activeRoomCount: items.length,
  });
}

export async function POST(request: Request, context: RouteContext) {
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

  const parsed = createRoomSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность полей номера" }, { status: 400 });
  }

  const data = parsed.data;
  const normalizedTitle = normalizeRoomTitle(data.title) || data.title.trim();
  const normalizedBathroomType = resolveBathroomTypeFromMeta(data.meta, data.bathroomType);
  // Room endpoints still accept featureIds/customFeatures for backward compatibility.
  // Current product flow edits amenities through /room-amenities; this endpoint persists what it receives.
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
        // Keep error text generic because clients may send stale ids after catalog changes.
        { error: "Часть оснащения номера не найдена в справочнике" },
        { status: 400 },
      );
    }
  }

  await preparePropertyForPublishedOwnerEdit(db, property.id);
  const canPersistRoomSortOrder = await areDatabaseColumnsAvailable("Room", ["sortOrder"]);

  const created = await db.$transaction(async (tx) => {
    const existingRoomOrderSources = await tx.room.findMany({
      where: {
        propertyId: property.id,
      },
      select: {
        meta: true,
        sortOrder: true,
      },
    });
    const maxSortOrder = existingRoomOrderSources.reduce(
      (currentMax, room) => Math.max(currentMax, resolveSerializedRoomSortOrder(room)),
      0,
    );
    const nextSortOrder = Math.max(maxSortOrder, existingRoomOrderSources.length) + 1;
    const roomMeta = buildRoomMetaWithFallbackSortOrder(data.meta, nextSortOrder);
    const room = canPersistRoomSortOrder
      ? await tx.room.create({
          data: {
            propertyId: property.id,
            title: normalizedTitle,
            beds: data.beds,
            extraBeds: data.extraBeds,
            roomsCount: data.roomsCount,
            areaSqm: data.areaSqm,
            bathroomType: normalizedBathroomType,
            meta: roomMeta,
            sortOrder: nextSortOrder,
          },
        })
      : await createRoomWithoutSortOrderColumn(tx, {
          propertyId: property.id,
          title: normalizedTitle,
          beds: data.beds,
          extraBeds: data.extraBeds,
          roomsCount: data.roomsCount,
          areaSqm: data.areaSqm,
          bathroomType: normalizedBathroomType,
          meta: roomMeta,
        });

    const enabledObjectAmenitySettings = await tx.objectRoomAmenitySetting.findMany({
      where: {
        propertyId: property.id,
        enabled: true,
      },
      select: {
        featureId: true,
        isPaid: true,
        applyToAllCategories: true,
        categoryIds: true,
        feature: {
          select: {
            isActive: true,
            name: true,
          },
        },
      },
    });
    const autoAppliedAmenitySettings = enabledObjectAmenitySettings.filter((setting) => {
      if (!setting.feature.isActive) {
        return false;
      }
      return setting.applyToAllCategories || setting.categoryIds.includes(room.id);
    });
    const allFeatureIds = Array.from(
      new Set([...featureIds, ...autoAppliedAmenitySettings.map((setting) => setting.featureId)]),
    );

    if (allFeatureIds.length > 0) {
      await tx.roomFeatureOnRoom.createMany({
        data: allFeatureIds.map((featureId) => ({
          roomId: room.id,
          featureId,
        })),
      });
    }

    const autoPaidLabels = autoAppliedAmenitySettings
      .filter((setting) => setting.isPaid && paidOptionFeatureIds.has(setting.featureId))
      .map((setting) => `${setting.feature.name} (платно)`);
    const allCustomFeatures = Array.from(
      new Map(
        [...customFeatures, ...autoPaidLabels]
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .map((item) => [item.toLowerCase(), item]),
      ).values(),
    );

    if (allCustomFeatures.length > 0) {
      await tx.roomCustomFeature.createMany({
        data: allCustomFeatures.map((name) => ({
          roomId: room.id,
          name,
        })),
      });
    }

    return tx.room.findUnique({
      where: { id: room.id },
      include: roomInclude,
    });
  });

  if (!created) {
    return NextResponse.json({ error: "Не удалось создать номер" }, { status: 500 });
  }

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, property.id);

  const activeRoomCount = await db.room.count({
    where: {
      propertyId: property.id,
      isActive: true,
    },
  });

  return NextResponse.json(
    {
      item: serializeRoom(created),
      activeRoomCount,
    },
    { status: 201 },
  );
}

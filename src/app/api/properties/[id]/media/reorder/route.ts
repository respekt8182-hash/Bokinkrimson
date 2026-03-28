// Property media reorder endpoint: validates complete media order and persists sort positions atomically.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeMedia } from "@/lib/media";
import {
  markPropertyNeedsRemoderationAfterOwnerEdit,
  preparePropertyForPublishedOwnerEdit,
} from "@/lib/properties";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const reorderSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).min(1).max(200),
});

async function ensureOwner(propertyId: string, userId: string) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, ownerId: true, ownerDeletedAt: true },
  });

  if (!property || property.ownerId !== userId || property.ownerDeletedAt) {
    return null;
  }

  return property;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await ensureOwner(id, session.id);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = reorderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте порядок медиа" }, { status: 400 });
  }

  const orderedIds = Array.from(new Set(parsed.data.orderedIds));

  const existing = await db.media.findMany({
    where: {
      propertyId: property.id,
      roomId: null,
    },
    select: { id: true },
  });

  if (existing.length !== orderedIds.length) {
    return NextResponse.json({ error: "Передан неполный список медиа" }, { status: 400 });
  }

  const existingSet = new Set(existing.map((item) => item.id));
  if (!orderedIds.every((idValue) => existingSet.has(idValue))) {
    return NextResponse.json({ error: "Список медиа содержит посторонние элементы" }, { status: 400 });
  }

  await preparePropertyForPublishedOwnerEdit(db, property.id);

  await db.$transaction(
    orderedIds.map((mediaId, index) =>
      db.media.update({
        where: { id: mediaId },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, property.id);

  const items = await db.media.findMany({
    where: {
      propertyId: property.id,
      roomId: null,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ items: items.map(serializeMedia) });
}

// Room reorder endpoint: validates a complete active-room order and persists display positions.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import {
  markPropertyNeedsRemoderationAfterOwnerEdit,
  preparePropertyForPublishedOwnerEdit,
} from "@/lib/properties";
import { roomInclude, serializeRoom } from "@/lib/rooms";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const reorderSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).min(1).max(200),
});

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

  const parsed = reorderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте порядок номеров" }, { status: 400 });
  }

  const orderedIds = Array.from(new Set(parsed.data.orderedIds));

  const existing = await db.room.findMany({
    where: {
      propertyId: property.id,
      isActive: true,
    },
    select: { id: true },
  });

  if (existing.length !== orderedIds.length) {
    return NextResponse.json({ error: "Передан неполный список номеров" }, { status: 400 });
  }

  const existingSet = new Set(existing.map((item) => item.id));
  if (!orderedIds.every((roomId) => existingSet.has(roomId))) {
    return NextResponse.json(
      { error: "Список номеров содержит посторонние элементы" },
      { status: 400 },
    );
  }

  await preparePropertyForPublishedOwnerEdit(db, property.id);

  await db.$transaction(
    orderedIds.map((roomId, index) =>
      db.room.update({
        where: { id: roomId },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, property.id);

  const items = await db.room.findMany({
    where: {
      propertyId: property.id,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: roomInclude,
  });

  return NextResponse.json({ items: items.map(serializeRoom) });
}

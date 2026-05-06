// Owner support endpoint: creates admin messages and validates source entity ownership (property/excursion).
import { AdminMessageSourceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { serializeAdminMessage } from "@/lib/admin-messages";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAdminMessageSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createAdminMessageSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность данных сообщения" }, { status: 400 });
  }

  const data = parsed.data;

  if (data.sourceType === AdminMessageSourceType.OBJECT) {
    const property = await db.property.findFirst({
      where: {
        id: data.propertyId ?? undefined,
        ownerId: session.id,
        ownerDeletedAt: null,
      },
      select: { id: true },
    });

    if (!property) {
      return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
    }
  }

  if (data.sourceType === AdminMessageSourceType.EXCURSION) {
    const excursion = await db.excursion.findFirst({
      where: {
        id: data.excursionId ?? undefined,
        ownerId: session.id,
      },
      select: { id: true },
    });

    if (!excursion) {
      return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
    }
  }

  const created = await db.adminMessage.create({
    data: {
      senderUserId: session.id,
      sourceType: data.sourceType,
      propertyId: data.sourceType === AdminMessageSourceType.OBJECT ? (data.propertyId ?? null) : null,
      excursionId:
        data.sourceType === AdminMessageSourceType.EXCURSION ? (data.excursionId ?? null) : null,
      message: data.message,
    },
    include: {
      senderUser: {
        select: {
          id: true,
          firstName: true,
          email: true,
        },
      },
      property: {
        select: {
          id: true,
          name: true,
        },
      },
      excursion: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return NextResponse.json({ item: serializeAdminMessage(created) }, { status: 201 });
}

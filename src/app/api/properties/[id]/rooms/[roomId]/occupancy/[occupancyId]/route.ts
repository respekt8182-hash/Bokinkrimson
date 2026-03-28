// Room occupancy item endpoint: read/update/delete a single booking block for the selected room.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeRoomOccupancy } from "@/lib/occupancy";
import { markPropertyNeedsRemoderationAfterOwnerEdit } from "@/lib/properties";
import { parseIsoDate } from "@/lib/pricing";
import { updateRoomOccupancySchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ id: string; roomId: string; occupancyId: string }>;
};

async function getOwnedOccupancy(propertyId: string, roomId: string, occupancyId: string, userId: string) {
  return db.roomOccupancy.findFirst({
    where: {
      id: occupancyId,
      roomId,
      room: {
        propertyId,
        isActive: true,
        property: {
          ownerId: userId,
          ownerDeletedAt: null,
        },
      },
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId, occupancyId } = await context.params;
  const occupancy = await getOwnedOccupancy(id, roomId, occupancyId, session.id);

  if (!occupancy) {
    return NextResponse.json({ error: "Бронирование не найдено" }, { status: 404 });
  }

  return NextResponse.json({ item: serializeRoomOccupancy(occupancy) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId, occupancyId } = await context.params;
  const existing = await getOwnedOccupancy(id, roomId, occupancyId, session.id);

  if (!existing) {
    return NextResponse.json({ error: "Бронирование не найдено" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateRoomOccupancySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность данных бронирования" }, { status: 400 });
  }

  const data = parsed.data;
  const dateFrom = parseIsoDate(data.dateFrom);
  const dateTo = parseIsoDate(data.dateTo);

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "Некорректный формат дат" }, { status: 400 });
  }

  const overlap = await db.roomOccupancy.findFirst({
    where: {
      roomId: existing.roomId,
      id: { not: existing.id },
      dateFrom: { lte: dateTo },
      dateTo: { gte: dateFrom },
    },
    select: { id: true },
  });

  if (overlap) {
    return NextResponse.json({ error: "В выбранном периоде уже есть бронирование" }, { status: 409 });
  }

  const updated = await db.roomOccupancy.update({
    where: { id: existing.id },
    data: {
      dateFrom,
      dateTo,
      timeFrom: data.timeFrom ?? null,
      timeTo: data.timeTo ?? null,
      status: data.status ?? existing.status,
      tag: data.tag ?? null,
      source: data.source ?? null,
      color: data.color ?? null,
      adultsCount: data.adultsCount ?? 1,
      childrenCount: data.childrenCount ?? 0,
      guestName: data.guestName ?? null,
      guestPhone: data.guestPhone ?? null,
      guestContacts: data.guestContacts ?? null,
      description: data.description ?? null,
    },
  });

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, id);

  return NextResponse.json({ item: serializeRoomOccupancy(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId, occupancyId } = await context.params;
  const existing = await getOwnedOccupancy(id, roomId, occupancyId, session.id);

  if (!existing) {
    return NextResponse.json({ error: "Бронирование не найдено" }, { status: 404 });
  }

  await db.roomOccupancy.delete({ where: { id: existing.id } });

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, id);

  return NextResponse.json({ ok: true });
}

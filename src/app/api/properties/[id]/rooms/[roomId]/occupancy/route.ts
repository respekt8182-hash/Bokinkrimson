// Room occupancy endpoint: list/create booking blocks used by owner chessboard availability workflow.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import { serializeRoomOccupancy } from "@/lib/occupancy";
import { parseIsoDate } from "@/lib/pricing";
import { createRoomOccupancySchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ id: string; roomId: string }>;
};

async function getAccessibleRoom(
  propertyId: string,
  roomId: string,
  editor: Awaited<ReturnType<typeof getEditorSession>>,
) {
  return db.room.findFirst({
    where: {
      id: roomId,
      propertyId,
      isActive: true,
      property: editor?.isAdmin
        ? {
            ownerDeletedAt: null,
          }
        : {
            ownerId: editor?.id,
            ownerDeletedAt: null,
          },
    },
    select: { id: true },
  });
}

export async function GET(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId } = await context.params;
  const room = await getAccessibleRoom(id, roomId, editor);

  if (!room) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const fromDate = from ? parseIsoDate(from) : null;
  const toDate = to ? parseIsoDate(to) : null;

  if ((from && !fromDate) || (to && !toDate)) {
    return NextResponse.json({ error: "Некорректный формат дат" }, { status: 400 });
  }

  const items = await db.roomOccupancy.findMany({
    where: {
      roomId: room.id,
      ...(fromDate && toDate
        ? {
            dateFrom: { lte: toDate },
            dateTo: { gte: fromDate },
          }
        : {}),
    },
    orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ items: items.map(serializeRoomOccupancy) });
}

export async function POST(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId } = await context.params;
  const room = await getAccessibleRoom(id, roomId, editor);

  if (!room) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createRoomOccupancySchema.safeParse(payload);

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
      roomId: room.id,
      dateFrom: { lte: dateTo },
      dateTo: { gte: dateFrom },
    },
    select: { id: true },
  });

  if (overlap) {
    return NextResponse.json({ error: "В выбранном периоде уже есть бронирование" }, { status: 409 });
  }

  const created = await db.roomOccupancy.create({
    data: {
      roomId: room.id,
      dateFrom,
      dateTo,
      timeFrom: data.timeFrom ?? null,
      timeTo: data.timeTo ?? null,
      status: data.status ?? "CONFIRMED",
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

  return NextResponse.json({ item: serializeRoomOccupancy(created) }, { status: 201 });
}

// Room pricing endpoint: list/create date periods and optionally preview stay cost for selected check-in/check-out.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import { markPropertyNeedsRemoderationAfterOwnerEdit } from "@/lib/properties";
import { calculateRoomStayPrice, parseIsoDate, serializeRoomPrice } from "@/lib/pricing";
import { createRoomPriceSchema } from "@/lib/schemas";

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
    select: {
      id: true,
      prices: {
        orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
      },
    },
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
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");

  const items = room.prices.map(serializeRoomPrice);

  if (checkIn && checkOut) {
    const preview = calculateRoomStayPrice({
      prices: items.map((item) => ({
        dateFrom: item.dateFrom,
        dateTo: item.dateTo,
        price: item.price,
        minGuests: item.minGuests,
        currency: item.currency,
      })),
      checkIn,
      checkOut,
    });

    return NextResponse.json({ items, preview });
  }

  return NextResponse.json({ items });
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

  const parsed = createRoomPriceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность периода цены" }, { status: 400 });
  }

  const data = parsed.data;
  const dateFrom = parseIsoDate(data.dateFrom);
  const dateTo = parseIsoDate(data.dateTo);

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "Некорректный формат дат" }, { status: 400 });
  }

  const overlap = await db.roomPrice.findFirst({
    where: {
      roomId: room.id,
      dateFrom: { lte: dateTo },
      dateTo: { gte: dateFrom },
    },
    select: { id: true },
  });

  if (overlap) {
    return NextResponse.json({ error: "Период пересекается с уже заданной ценой" }, { status: 409 });
  }

  const created = await db.roomPrice.create({
    data: {
      roomId: room.id,
      dateFrom,
      dateTo,
      price: data.price,
      minGuests: data.minGuests ?? null,
      currency: data.currency,
    },
  });

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, id);

  return NextResponse.json({ item: serializeRoomPrice(created) }, { status: 201 });
}

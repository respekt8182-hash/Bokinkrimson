// Room pricing item endpoint: read/update/delete a single room price period with overlap protection.
import { NextResponse } from "next/server";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import { defaultRoomPriceType, parseIsoDate, serializeRoomPrice } from "@/lib/pricing";
import { updateRoomPriceCompat } from "@/lib/room-price-compat";
import { updateRoomPriceSchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ id: string; roomId: string; priceId: string }>;
};

async function getAccessiblePrice(
  propertyId: string,
  roomId: string,
  priceId: string,
  editor: Awaited<ReturnType<typeof getEditorSession>>,
) {
  return db.roomPrice.findFirst({
    where: {
      id: priceId,
      roomId,
      room: {
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
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId, priceId } = await context.params;
  const price = await getAccessiblePrice(id, roomId, priceId, editor);

  if (!price) {
    return NextResponse.json({ error: "Период цены не найден" }, { status: 404 });
  }

  return NextResponse.json({ item: serializeRoomPrice(price) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId, priceId } = await context.params;
  const existing = await getAccessiblePrice(id, roomId, priceId, editor);

  if (!existing) {
    return NextResponse.json({ error: "Период цены не найден" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateRoomPriceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность периода цены" }, { status: 400 });
  }

  const data = parsed.data;
  const dateFrom = parseIsoDate(data.dateFrom);
  const dateTo = parseIsoDate(data.dateTo);
  const supportsRoomPriceWriteColumns = await areDatabaseColumnsAvailable("RoomPrice", [
    "priceType",
    "minNights",
    "extraBedPrice",
  ]);
  const usesAdvancedPriceFields =
    data.priceType !== defaultRoomPriceType ||
    data.minNights != null ||
    data.extraBedPrice != null;

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "Некорректный формат дат" }, { status: 400 });
  }

  if (!supportsRoomPriceWriteColumns && usesAdvancedPriceFields) {
    return NextResponse.json(
      {
        error:
          "База данных не готова сохранить расширенные условия цены. Примените последние миграции и повторите сохранение.",
      },
      { status: 409 },
    );
  }

  const overlap = await db.roomPrice.findFirst({
    where: {
      roomId: existing.roomId,
      id: { not: existing.id },
      dateFrom: { lte: dateTo },
      dateTo: { gte: dateFrom },
    },
    select: { id: true },
  });

  if (overlap) {
    return NextResponse.json(
      { error: "Период пересекается с уже заданной ценой" },
      { status: 409 },
    );
  }

  const updated = supportsRoomPriceWriteColumns
    ? await db.roomPrice.update({
        where: { id: existing.id },
        data: {
          dateFrom,
          dateTo,
          price: data.price,
          priceType: data.priceType,
          minGuests: data.minGuests ?? null,
          minNights: data.minNights ?? null,
          extraBedPrice: data.extraBedPrice ?? null,
          currency: data.currency,
        },
      })
    : await updateRoomPriceCompat(existing.id, {
        dateFrom,
        dateTo,
        price: data.price,
        minGuests: data.minGuests ?? null,
        minNights: data.minNights ?? null,
        extraBedPrice: data.extraBedPrice ?? null,
        currency: data.currency,
      });

  return NextResponse.json({ item: serializeRoomPrice(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId, priceId } = await context.params;
  const existing = await getAccessiblePrice(id, roomId, priceId, editor);

  if (!existing) {
    return NextResponse.json({ error: "Период цены не найден" }, { status: 404 });
  }

  await db.roomPrice.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}

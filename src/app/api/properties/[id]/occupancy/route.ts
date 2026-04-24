import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import { serializeRoomOccupancy } from "@/lib/occupancy";
import { parseIsoDate } from "@/lib/pricing";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
    return NextResponse.json(
      { error: "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044f" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const property = await ensurePropertyAccess(id, editor);

  if (!property) {
    return NextResponse.json(
      { error: "\u041e\u0431\u044a\u0435\u043a\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d" },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const fromDate = from ? parseIsoDate(from) : null;
  const toDate = to ? parseIsoDate(to) : null;

  if ((from && !fromDate) || (to && !toDate)) {
    return NextResponse.json(
      {
        error:
          "\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u0444\u043e\u0440\u043c\u0430\u0442 \u0434\u0430\u0442",
      },
      { status: 400 },
    );
  }

  const rooms = await db.room.findMany({
    where: {
      propertyId: property.id,
      isActive: true,
    },
    select: { id: true },
  });

  if (rooms.length === 0) {
    return NextResponse.json({ itemsByRoom: {} });
  }

  const roomIds = rooms.map((room) => room.id);
  const items = await db.roomOccupancy.findMany({
    where: {
      roomId: { in: roomIds },
      ...(fromDate && toDate
        ? {
            dateFrom: { lte: toDate },
            dateTo: { gte: fromDate },
          }
        : {}),
    },
    orderBy: [{ roomId: "asc" }, { dateFrom: "asc" }, { createdAt: "asc" }],
  });

  const itemsByRoom = Object.fromEntries(
    roomIds.map((roomId) => [roomId, [] as ReturnType<typeof serializeRoomOccupancy>[]]),
  );

  for (const item of items) {
    itemsByRoom[item.roomId]?.push(serializeRoomOccupancy(item));
  }

  return NextResponse.json({ itemsByRoom });
}

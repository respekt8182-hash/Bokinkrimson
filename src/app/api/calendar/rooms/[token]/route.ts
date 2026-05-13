import { NextResponse } from "next/server";
import {
  buildRoomOccupancyCalendar,
  findFallbackCalendarRoomByToken,
  stripCalendarTokenSuffix,
} from "@/lib/calendar-sync";
import { db, isDatabaseTableAvailable } from "@/lib/db";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { token: rawToken } = await context.params;
  const token = stripCalendarTokenSuffix(rawToken);

  if (!token) {
    return new NextResponse("Not found", { status: 404 });
  }

  const syncTableAvailable = await isDatabaseTableAvailable("RoomCalendarSync");
  let room = syncTableAvailable
    ? (
        await db.roomCalendarSync.findUnique({
          where: { exportToken: token },
          select: {
            room: {
              select: {
                id: true,
                title: true,
                property: {
                  select: {
                    name: true,
                    ownerDeletedAt: true,
                  },
                },
              },
            },
          },
        })
      )?.room
    : null;

  room ??= await findFallbackCalendarRoomByToken(token);

  if (!room || room.property.ownerDeletedAt) {
    return new NextResponse("Not found", { status: 404 });
  }

  const occupancies = await db.roomOccupancy.findMany({
    where: {
      roomId: room.id,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
    orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      dateFrom: true,
      dateTo: true,
      tag: true,
      source: true,
      guestName: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const calendar = buildRoomOccupancyCalendar({
    room: {
      id: room.id,
      title: room.title,
      property: {
        name: room.property.name,
      },
    },
    occupancies,
  });

  return new NextResponse(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="room-${room.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

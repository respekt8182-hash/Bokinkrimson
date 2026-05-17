// Bulk room price copy endpoint: copies all active room prices from one calendar year to another.
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import { normalizeRoomPriceType } from "@/lib/pricing";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const copyYearPricesSchema = z
  .object({
    sourceYear: z.number().int().min(2000).max(2100),
    targetYear: z.number().int().min(2000).max(2100),
    replaceExisting: z.boolean().optional().default(false),
  })
  .refine((data) => data.sourceYear !== data.targetYear, {
    message: "Source and target years must be different",
    path: ["targetYear"],
  });

function getUtcYearStart(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

function getUtcYearEnd(year: number): Date {
  return new Date(Date.UTC(year, 11, 31));
}

function getUtcMonthDays(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function copyDateToYear(value: Date, targetYear: number): Date {
  const monthIndex = value.getUTCMonth();
  const day = Math.min(value.getUTCDate(), getUtcMonthDays(targetYear, monthIndex));
  return new Date(Date.UTC(targetYear, monthIndex, day));
}

function maxDate(left: Date, right: Date): Date {
  return left >= right ? left : right;
}

function minDate(left: Date, right: Date): Date {
  return left <= right ? left : right;
}

async function getAccessibleProperty(
  propertyId: string,
  editor: Awaited<ReturnType<typeof getEditorSession>>,
) {
  return db.property.findFirst({
    where: {
      id: propertyId,
      ownerDeletedAt: null,
      ...(editor?.isAdmin ? {} : { ownerId: editor?.id }),
    },
    select: { id: true },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await getAccessibleProperty(id, editor);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = copyYearPricesSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте годы для переноса цен" }, { status: 400 });
  }

  const { sourceYear, targetYear, replaceExisting } = parsed.data;
  const sourceStart = getUtcYearStart(sourceYear);
  const sourceEnd = getUtcYearEnd(sourceYear);
  const targetStart = getUtcYearStart(targetYear);
  const targetEnd = getUtcYearEnd(targetYear);

  const rooms = await db.room.findMany({
    where: {
      propertyId: property.id,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      prices: {
        where: {
          dateFrom: { lte: sourceEnd },
          dateTo: { gte: sourceStart },
        },
        orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
        select: {
          roomId: true,
          dateFrom: true,
          dateTo: true,
          price: true,
          priceType: true,
          minGuests: true,
          minNights: true,
          currency: true,
        },
      },
    },
  });

  const roomIds = rooms.map((room) => room.id);
  if (roomIds.length === 0) {
    return NextResponse.json({ error: "В объекте нет активных номеров" }, { status: 400 });
  }

  const rowsToCreate = rooms.flatMap((room) =>
    room.prices.map((price) => {
      const clippedFrom = maxDate(price.dateFrom, sourceStart);
      const clippedTo = minDate(price.dateTo, sourceEnd);

      return {
        roomId: room.id,
        dateFrom: copyDateToYear(clippedFrom, targetYear),
        dateTo: copyDateToYear(clippedTo, targetYear),
        price: Number(price.price),
        priceType: normalizeRoomPriceType(price.priceType),
        minGuests: price.minGuests,
        minNights: price.minNights,
        currency: price.currency,
      };
    }),
  );

  if (rowsToCreate.length === 0) {
    return NextResponse.json(
      { error: `В ${sourceYear} году нет цен для переноса` },
      { status: 400 },
    );
  }

  const existingTargetPrices = await db.roomPrice.findMany({
    where: {
      roomId: { in: roomIds },
      dateFrom: { lte: targetEnd },
      dateTo: { gte: targetStart },
    },
    take: 6,
    select: {
      dateFrom: true,
      dateTo: true,
      room: {
        select: { title: true },
      },
    },
    orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
  });

  if (existingTargetPrices.length > 0 && !replaceExisting) {
    return NextResponse.json(
      {
        error:
          "В целевом году уже есть цены. Включите замену существующих цен или выберите другой год.",
        conflictsCount: existingTargetPrices.length,
        conflictPreview: existingTargetPrices.map((price) => ({
          roomTitle: price.room.title,
          dateFrom: price.dateFrom.toISOString().slice(0, 10),
          dateTo: price.dateTo.toISOString().slice(0, 10),
        })),
      },
      { status: 409 },
    );
  }

  const supportsRoomPriceWriteColumns = await areDatabaseColumnsAvailable("RoomPrice", [
    "priceType",
    "minNights",
  ]);

  const replacedCount = await db.$transaction(async (tx) => {
    const deleteResult = replaceExisting
      ? await tx.roomPrice.deleteMany({
          where: {
            roomId: { in: roomIds },
            dateFrom: { lte: targetEnd },
            dateTo: { gte: targetStart },
          },
        })
      : { count: 0 };

    if (supportsRoomPriceWriteColumns) {
      await tx.roomPrice.createMany({
        data: rowsToCreate.map((row) => ({
          roomId: row.roomId,
          dateFrom: row.dateFrom,
          dateTo: row.dateTo,
          price: new Prisma.Decimal(row.price),
          priceType: row.priceType,
          minGuests: row.minGuests,
          minNights: row.minNights,
          currency: row.currency,
        })),
      });
    } else {
      const now = new Date();
      for (const row of rowsToCreate) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "RoomPrice" (
            "id",
            "roomId",
            "dateFrom",
            "dateTo",
            "price",
            "minGuests",
            "currency",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${`room_price_${randomUUID().replace(/-/g, "")}`},
            ${row.roomId},
            ${row.dateFrom},
            ${row.dateTo},
            ${new Prisma.Decimal(row.price)},
            ${row.minGuests},
            ${row.currency},
            ${now},
            ${now}
          )
        `);
      }
    }

    return deleteResult.count;
  });

  return NextResponse.json({
    copiedCount: rowsToCreate.length,
    roomsCount: rooms.filter((room) => room.prices.length > 0).length,
    replacedCount,
    sourceYear,
    targetYear,
  });
}

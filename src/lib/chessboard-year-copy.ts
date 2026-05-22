// Shared service for copying room price periods between calendar years.
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { normalizeRoomPriceType } from "@/lib/pricing";

export type CopyYearRoomPricesConflictPreviewItem = {
  propertyId: string;
  propertyName: string | null;
  propertyPublicId: number | null;
  roomTitle: string;
  dateFrom: string;
  dateTo: string;
};

export type CopyYearRoomPricesResult = {
  copiedCount: number;
  roomsCount: number;
  propertiesCount: number;
  replacedCount: number;
  sourceYear: number;
  targetYear: number;
};

type CopyYearRoomPricesErrorCode = "NO_ACTIVE_ROOMS" | "NO_SOURCE_PRICES" | "TARGET_CONFLICTS";

type CopyYearRoomPricesErrorDetails = {
  conflictsCount?: number;
  conflictPreview?: CopyYearRoomPricesConflictPreviewItem[];
};

export class CopyYearRoomPricesError extends Error {
  readonly code: CopyYearRoomPricesErrorCode;
  readonly details: CopyYearRoomPricesErrorDetails;

  constructor(code: CopyYearRoomPricesErrorCode, details: CopyYearRoomPricesErrorDetails = {}) {
    super(code);
    this.name = "CopyYearRoomPricesError";
    this.code = code;
    this.details = details;
  }
}

type CopyYearRoomPricesInput = {
  sourceYear: number;
  targetYear: number;
  replaceExisting: boolean;
  propertyId?: string;
  conflictPreviewLimit?: number;
};

type RoomPriceCopyRow = {
  roomId: string;
  propertyId: string;
  dateFrom: Date;
  dateTo: Date;
  price: number;
  priceType: ReturnType<typeof normalizeRoomPriceType>;
  minGuests: number | null;
  minNights: number | null;
  extraBedPrice: number | null;
  currency: string;
};

const createManyChunkSize = 1000;

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

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export async function copyYearRoomPrices({
  sourceYear,
  targetYear,
  replaceExisting,
  propertyId,
  conflictPreviewLimit = 8,
}: CopyYearRoomPricesInput): Promise<CopyYearRoomPricesResult> {
  const sourceStart = getUtcYearStart(sourceYear);
  const sourceEnd = getUtcYearEnd(sourceYear);
  const targetStart = getUtcYearStart(targetYear);
  const targetEnd = getUtcYearEnd(targetYear);

  const rooms = await db.room.findMany({
    where: {
      isActive: true,
      ...(propertyId
        ? { propertyId }
        : {
            property: {
              ownerDeletedAt: null,
              owner: { deletedAt: null },
            },
          }),
    },
    orderBy: [{ propertyId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      propertyId: true,
      prices: {
        where: {
          dateFrom: { lte: sourceEnd },
          dateTo: { gte: sourceStart },
        },
        orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
        select: {
          dateFrom: true,
          dateTo: true,
          price: true,
          priceType: true,
          minGuests: true,
          minNights: true,
          extraBedPrice: true,
          currency: true,
        },
      },
    },
  });

  const roomIds = rooms.map((room) => room.id);
  if (roomIds.length === 0) {
    throw new CopyYearRoomPricesError("NO_ACTIVE_ROOMS");
  }

  const rowsToCreate: RoomPriceCopyRow[] = rooms.flatMap((room) =>
    room.prices.map((price) => {
      const clippedFrom = maxDate(price.dateFrom, sourceStart);
      const clippedTo = minDate(price.dateTo, sourceEnd);

      return {
        roomId: room.id,
        propertyId: room.propertyId,
        dateFrom: copyDateToYear(clippedFrom, targetYear),
        dateTo: copyDateToYear(clippedTo, targetYear),
        price: Number(price.price),
        priceType: normalizeRoomPriceType(price.priceType),
        minGuests: price.minGuests,
        minNights: price.minNights,
        extraBedPrice: price.extraBedPrice === null ? null : Number(price.extraBedPrice),
        currency: price.currency,
      };
    }),
  );

  if (rowsToCreate.length === 0) {
    throw new CopyYearRoomPricesError("NO_SOURCE_PRICES");
  }

  const targetPriceWhere = {
    roomId: { in: roomIds },
    dateFrom: { lte: targetEnd },
    dateTo: { gte: targetStart },
  };

  if (!replaceExisting) {
    const conflictsCount = await db.roomPrice.count({
      where: targetPriceWhere,
    });

    if (conflictsCount > 0) {
      const conflictPreview = await db.roomPrice.findMany({
        where: targetPriceWhere,
        take: conflictPreviewLimit,
        select: {
          dateFrom: true,
          dateTo: true,
          room: {
            select: {
              title: true,
              property: {
                select: {
                  id: true,
                  name: true,
                  publicId: true,
                },
              },
            },
          },
        },
        orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
      });

      throw new CopyYearRoomPricesError("TARGET_CONFLICTS", {
        conflictsCount,
        conflictPreview: conflictPreview.map((price) => ({
          propertyId: price.room.property.id,
          propertyName: price.room.property.name,
          propertyPublicId: price.room.property.publicId,
          roomTitle: price.room.title,
          dateFrom: toIsoDate(price.dateFrom),
          dateTo: toIsoDate(price.dateTo),
        })),
      });
    }
  }

  const supportsRoomPriceWriteColumns = await areDatabaseColumnsAvailable("RoomPrice", [
    "priceType",
    "minNights",
    "extraBedPrice",
  ]);

  const replacedCount = await db.$transaction(
    async (tx) => {
      const deleteResult = replaceExisting
        ? await tx.roomPrice.deleteMany({
            where: targetPriceWhere,
          })
        : { count: 0 };

      if (supportsRoomPriceWriteColumns) {
        for (const rowsChunk of chunkArray(rowsToCreate, createManyChunkSize)) {
          await tx.roomPrice.createMany({
            data: rowsChunk.map((row) => ({
              roomId: row.roomId,
              dateFrom: row.dateFrom,
              dateTo: row.dateTo,
              price: new Prisma.Decimal(row.price),
              priceType: row.priceType,
              minGuests: row.minGuests,
              minNights: row.minNights,
              extraBedPrice:
                row.extraBedPrice === null ? null : new Prisma.Decimal(row.extraBedPrice),
              currency: row.currency,
            })),
          });
        }
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
    },
    { maxWait: 10000, timeout: 120000 },
  );

  const roomsWithSourcePrices = new Set(rowsToCreate.map((row) => row.roomId));
  const propertiesWithSourcePrices = new Set(rowsToCreate.map((row) => row.propertyId));

  return {
    copiedCount: rowsToCreate.length,
    roomsCount: roomsWithSourcePrices.size,
    propertiesCount: propertiesWithSourcePrices.size,
    replacedCount,
    sourceYear,
    targetYear,
  };
}

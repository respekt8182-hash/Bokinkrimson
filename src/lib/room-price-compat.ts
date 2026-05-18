import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logDatabaseFallbackOnce } from "@/lib/prisma-errors";

type RoomPriceCompatWriteInput = {
  roomId: string;
  dateFrom: Date;
  dateTo: Date;
  price: number;
  minGuests: number | null;
  minNights?: number | null;
  extraBedPrice?: number | null;
  currency: string;
};

async function loadRoomPriceById(id: string) {
  const price = await db.roomPrice.findUnique({
    where: { id },
  });

  if (!price) {
    throw new Error("ROOM_PRICE_COMPAT_READ_FAILED");
  }

  return price;
}

export async function createRoomPriceCompat(input: RoomPriceCompatWriteInput) {
  logDatabaseFallbackOnce(
    "room-price-write-compat",
    "RoomPrice writes are using a legacy insert compatibility path because the database schema is missing priceType, minNights, or extraBedPrice. Apply the latest Prisma migration when DB owner access is available.",
  );

  const id = `room_price_${randomUUID().replace(/-/g, "")}`;
  const now = new Date();

  await db.$executeRaw(Prisma.sql`
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
      ${id},
      ${input.roomId},
      ${input.dateFrom},
      ${input.dateTo},
      ${new Prisma.Decimal(input.price)},
      ${input.minGuests},
      ${input.currency},
      ${now},
      ${now}
    )
  `);

  return loadRoomPriceById(id);
}

export async function updateRoomPriceCompat(
  id: string,
  input: Omit<RoomPriceCompatWriteInput, "roomId">,
) {
  logDatabaseFallbackOnce(
    "room-price-write-compat",
    "RoomPrice writes are using a legacy update compatibility path because the database schema is missing priceType, minNights, or extraBedPrice. Apply the latest Prisma migration when DB owner access is available.",
  );

  const updatedAt = new Date();
  const affectedRows = await db.$executeRaw(Prisma.sql`
    UPDATE "RoomPrice"
    SET
      "dateFrom" = ${input.dateFrom},
      "dateTo" = ${input.dateTo},
      "price" = ${new Prisma.Decimal(input.price)},
      "minGuests" = ${input.minGuests},
      "currency" = ${input.currency},
      "updatedAt" = ${updatedAt}
    WHERE "id" = ${id}
  `);

  if (affectedRows < 1) {
    throw new Error("ROOM_PRICE_COMPAT_UPDATE_FAILED");
  }

  return loadRoomPriceById(id);
}

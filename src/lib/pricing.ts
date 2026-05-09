import type { Prisma } from "@prisma/client";

// Pricing helper module for stage 6+:
// - validates/normalizes date strings
// - serializes room price rows
// - calculates stay total by nightly periods
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const roomPriceTypeValues = ["PER_ROOM", "PER_PERSON"] as const;
export type RoomPriceType = (typeof roomPriceTypeValues)[number];
export type RoomPriceCalculationType = RoomPriceType | "MIXED";

export const defaultRoomPriceType: RoomPriceType = "PER_ROOM";

export function normalizeRoomPriceType(value: unknown): RoomPriceType {
  if (value === "PER_PERSON" || value === "per_person") {
    return "PER_PERSON";
  }

  return defaultRoomPriceType;
}

export function getRoomPriceUnitText(priceType: unknown): string {
  return normalizeRoomPriceType(priceType) === "PER_PERSON" ? "за человека" : "за комнату";
}

export function getRoomPriceNightlySuffix(
  priceType: RoomPriceCalculationType | null | undefined,
): string {
  return priceType === "PER_PERSON" ? "/ чел" : "/ ночь";
}

export function getRoomPriceShortUnit(priceType: unknown): string {
  return normalizeRoomPriceType(priceType) === "PER_PERSON" ? "чел" : "комн.";
}

export type SerializedRoomPrice = {
  id: string;
  roomId: string;
  dateFrom: string;
  dateTo: string;
  price: number;
  priceType: RoomPriceType;
  minGuests: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomPriceCalculation =
  | {
      ok: true;
      nights: number;
      total: number;
      unitTotal: number;
      currency: string;
      priceType: RoomPriceCalculationType;
      guests: number;
      breakdown: Array<{
        date: string;
        price: number;
        priceType: RoomPriceType;
        totalPrice: number;
      }>;
    }
  | {
      ok: false;
      message: string;
      missingDates: string[];
    };

// Strict parser avoids implicit timezone drift and invalid dates like 2026-02-31.
export function parseIsoDate(value: string): Date | null {
  if (!isoDateRegex.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (toIsoDate(parsed) !== value) {
    return null;
  }

  return parsed;
}

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function dateRangesOverlap(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export function serializeRoomPrice(price: {
  id: string;
  roomId: string;
  dateFrom: Date;
  dateTo: Date;
  price: Prisma.Decimal;
  priceType?: RoomPriceType | string | null;
  minGuests?: number | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}): SerializedRoomPrice {
  return {
    id: price.id,
    roomId: price.roomId,
    dateFrom: toIsoDate(price.dateFrom),
    dateTo: toIsoDate(price.dateTo),
    price: Number(price.price),
    priceType: normalizeRoomPriceType(price.priceType),
    minGuests: price.minGuests ?? null,
    currency: price.currency,
    createdAt: price.createdAt.toISOString(),
    updatedAt: price.updatedAt.toISOString(),
  };
}

export function normalizeSerializedRoomPrice(price: SerializedRoomPrice): SerializedRoomPrice {
  return {
    ...price,
    priceType: normalizeRoomPriceType(price.priceType),
  };
}

export function calculateRoomStayPrice(input: {
  prices: Array<{
    dateFrom: string;
    dateTo: string;
    price: number;
    priceType?: RoomPriceType | string | null;
    minGuests?: number | null;
    currency: string;
  }>;
  checkIn: string;
  checkOut: string;
  guests?: number;
}): RoomPriceCalculation {
  const checkInDate = parseIsoDate(input.checkIn);
  const checkOutDate = parseIsoDate(input.checkOut);

  if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
    return {
      ok: false,
      message: "Введите корректный период проживания: дата выезда должна быть позже даты заезда",
      missingDates: [],
    };
  }

  const nights = Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 86400000);
  const guests =
    typeof input.guests === "number" && Number.isFinite(input.guests)
      ? Math.max(1, Math.floor(input.guests))
      : 1;
  const normalizedPrices = input.prices.map((price) => ({
    ...price,
    dateFrom: price.dateFrom,
    dateTo: price.dateTo,
    priceType: normalizeRoomPriceType(price.priceType),
  }));

  const missingDates: string[] = [];
  const breakdown: Array<{
    date: string;
    price: number;
    priceType: RoomPriceType;
    totalPrice: number;
  }> = [];
  const priceTypes = new Set<RoomPriceType>();
  let total = 0;
  let unitTotal = 0;
  let currency = "RUB";

  for (let i = 0; i < nights; i += 1) {
    // Pricing model is period-based, so each stay night must be covered by one period.
    const day = toIsoDate(addDays(checkInDate, i));
    const matched = normalizedPrices.find((price) => price.dateFrom <= day && price.dateTo >= day);

    if (!matched) {
      missingDates.push(day);
      continue;
    }

    const priceType = normalizeRoomPriceType(matched.priceType);
    const totalPrice = priceType === "PER_PERSON" ? matched.price * guests : matched.price;
    unitTotal += matched.price;
    total += totalPrice;
    currency = matched.currency;
    priceTypes.add(priceType);
    breakdown.push({ date: day, price: matched.price, priceType, totalPrice });
  }

  if (missingDates.length > 0) {
    return {
      ok: false,
      message: "Не на все даты проживания задана цена",
      missingDates,
    };
  }

  return {
    ok: true,
    nights,
    total,
    unitTotal,
    currency,
    priceType: priceTypes.size === 1 ? Array.from(priceTypes)[0] : "MIXED",
    guests,
    breakdown,
  };
}

import type { Prisma } from "@prisma/client";

// Pricing helper module for stage 6+:
// - validates/normalizes date strings
// - serializes room price rows
// - calculates stay total by nightly periods
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export type SerializedRoomPrice = {
  id: string;
  roomId: string;
  dateFrom: string;
  dateTo: string;
  price: number;
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
      currency: string;
      breakdown: Array<{ date: string; price: number }>;
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
    minGuests: price.minGuests ?? null,
    currency: price.currency,
    createdAt: price.createdAt.toISOString(),
    updatedAt: price.updatedAt.toISOString(),
  };
}

export function calculateRoomStayPrice(input: {
  prices: Array<{
    dateFrom: string;
    dateTo: string;
    price: number;
    minGuests?: number | null;
    currency: string;
  }>;
  checkIn: string;
  checkOut: string;
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
  const normalizedPrices = input.prices.map((price) => ({
    ...price,
    dateFrom: price.dateFrom,
    dateTo: price.dateTo,
  }));

  const missingDates: string[] = [];
  const breakdown: Array<{ date: string; price: number }> = [];
  let total = 0;
  let currency = "RUB";

  for (let i = 0; i < nights; i += 1) {
    // Pricing model is period-based, so each stay night must be covered by one period.
    const day = toIsoDate(addDays(checkInDate, i));
    const matched = normalizedPrices.find((price) => price.dateFrom <= day && price.dateTo >= day);

    if (!matched) {
      missingDates.push(day);
      continue;
    }

    total += matched.price;
    currency = matched.currency;
    breakdown.push({ date: day, price: matched.price });
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
    currency,
    breakdown,
  };
}

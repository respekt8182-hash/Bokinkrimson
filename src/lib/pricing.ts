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
  minNights: number | null;
  extraBedPrice: number | null;
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
      minNights: number | null;
      breakdown: Array<{
        date: string;
        price: number;
        priceType: RoomPriceType;
        extraBedPrice: number | null;
        extraGuests: number;
        extraTotal: number;
        totalPrice: number;
      }>;
    }
  | {
      ok: false;
      message: string;
      missingDates: string[];
      minNights?: number;
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
  minNights?: number | null;
  extraBedPrice?: Prisma.Decimal | number | null;
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
    minNights: price.minNights ?? null,
    extraBedPrice:
      price.extraBedPrice === null || price.extraBedPrice === undefined
        ? null
        : Number(price.extraBedPrice),
    currency: price.currency,
    createdAt: price.createdAt.toISOString(),
    updatedAt: price.updatedAt.toISOString(),
  };
}

export function normalizeSerializedRoomPrice(
  price:
    | SerializedRoomPrice
    | (Omit<SerializedRoomPrice, "minNights" | "extraBedPrice"> & {
        minNights?: number | null;
        extraBedPrice?: number | null;
      }),
): SerializedRoomPrice {
  return {
    ...price,
    priceType: normalizeRoomPriceType(price.priceType),
    minNights: price.minNights ?? null,
    extraBedPrice: price.extraBedPrice ?? null,
  };
}

export function calculateRoomStayPrice(input: {
  prices: Array<{
    dateFrom: string;
    dateTo: string;
    price: number;
    priceType?: RoomPriceType | string | null;
    minGuests?: number | null;
    minNights?: number | null;
    extraBedPrice?: number | null;
    currency: string;
  }>;
  checkIn: string;
  checkOut: string;
  guests?: number;
  includedGuests?: number | null;
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
  const includedGuests =
    typeof input.includedGuests === "number" && Number.isFinite(input.includedGuests)
      ? Math.max(1, Math.floor(input.includedGuests))
      : null;
  const normalizedPrices = input.prices.map((price) => ({
    ...price,
    dateFrom: price.dateFrom,
    dateTo: price.dateTo,
    priceType: normalizeRoomPriceType(price.priceType),
    extraBedPrice:
      typeof price.extraBedPrice === "number" && Number.isFinite(price.extraBedPrice)
        ? Math.max(0, price.extraBedPrice)
        : null,
  }));

  const missingDates: string[] = [];
  const breakdown: Array<{
    date: string;
    price: number;
    priceType: RoomPriceType;
    extraBedPrice: number | null;
    extraGuests: number;
    extraTotal: number;
    totalPrice: number;
  }> = [];
  const priceTypes = new Set<RoomPriceType>();
  let total = 0;
  let unitTotal = 0;
  let currency = "RUB";
  let requiredMinNights = 1;

  for (let i = 0; i < nights; i += 1) {
    // Pricing model is period-based, so each stay night must be covered by one period.
    const day = toIsoDate(addDays(checkInDate, i));
    const matched = normalizedPrices.find((price) => price.dateFrom <= day && price.dateTo >= day);

    if (!matched) {
      missingDates.push(day);
      continue;
    }

    const priceType = normalizeRoomPriceType(matched.priceType);
    if (matched.minNights && matched.minNights > requiredMinNights) {
      requiredMinNights = matched.minNights;
    }
    const extraGuests =
      includedGuests !== null ? Math.max(0, guests - includedGuests) : 0;
    const hasPerPersonExtraBedPrice =
      priceType === "PER_PERSON" && extraGuests > 0 && matched.extraBedPrice !== null;
    const displayedExtraGuests =
      priceType === "PER_ROOM" || hasPerPersonExtraBedPrice ? extraGuests : 0;
    const extraTotal =
      priceType === "PER_ROOM"
        ? extraGuests * (matched.extraBedPrice ?? 0)
        : hasPerPersonExtraBedPrice
          ? extraGuests * (matched.extraBedPrice ?? 0)
          : 0;
    const totalPrice =
      priceType === "PER_PERSON"
        ? hasPerPersonExtraBedPrice
          ? matched.price * Math.max(0, guests - extraGuests) + extraTotal
          : matched.price * guests
        : matched.price + extraTotal;
    unitTotal += priceType === "PER_PERSON" ? matched.price : totalPrice;
    total += totalPrice;
    currency = matched.currency;
    priceTypes.add(priceType);
    breakdown.push({
      date: day,
      price: matched.price,
      priceType,
      extraBedPrice: matched.extraBedPrice,
      extraGuests: displayedExtraGuests,
      extraTotal,
      totalPrice,
    });
  }

  if (missingDates.length > 0) {
    return {
      ok: false,
      message: "Даты уже забронированы",
      missingDates,
    };
  }

  if (nights < requiredMinNights) {
    return {
      ok: false,
      message: `Минимальное бронирование на выбранные даты — от ${requiredMinNights} ${getNightsWord(requiredMinNights)}`,
      missingDates: [],
      minNights: requiredMinNights,
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
    minNights: requiredMinNights > 1 ? requiredMinNights : null,
    breakdown,
  };
}

function getNightsWord(value: number): string {
  const absolute = Math.abs(value);
  const lastTwo = absolute % 100;
  const last = absolute % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return "ночей";
  }
  if (last === 1) {
    return "ночи";
  }
  if (last >= 2 && last <= 4) {
    return "ночей";
  }
  return "ночей";
}

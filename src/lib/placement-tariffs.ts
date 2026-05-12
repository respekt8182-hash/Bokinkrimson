import { OBJECT_YEARLY_PRICE_RUB } from "@/lib/object-placement-tariffs";

export const PLACEMENT_PRICE_VERSION = "placement-pricing-2026-05-07";

export const PLACEMENT_CATEGORIES = ["object", "excursion", "tour", "transfer"] as const;
export type PlacementCategory = (typeof PLACEMENT_CATEGORIES)[number];

export type PlacementPeriod =
  | "month"
  | "season"
  | "year"
  | "may_june"
  | "july"
  | "august"
  | "september"
  | "october"
  | "off_season"
  | string;

export const placementTariffs = {
  object: {
    label: "Объект",
    yearPrice: OBJECT_YEARLY_PRICE_RUB,
    firstYearDiscountPercent: 20,
    discountsOnlyForPeriod: "year",
  },
  excursion: {
    label: "Экскурсия",
    seasonPrice: 990,
    yearPrice: 1490,
    firstYearDiscountPercent: 20,
    discountsOnlyForPeriod: "year",
  },
  tour: {
    label: "Тур",
    seasonPrice: 1290,
    yearPrice: 1790,
    firstYearDiscountPercent: 20,
    discountsOnlyForPeriod: "year",
  },
  transfer: {
    label: "Трансфер",
    seasonPrice: 990,
    yearPrice: 1490,
    firstYearDiscountPercent: 20,
    discountsOnlyForPeriod: "year",
    includedCars: 1,
    additionalCarPrice: 490,
  },
} as const;

export function roundDownToTenRub(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.floor(Math.max(0, value) / 10) * 10;
}

export function calculateDiscountedPlacementPrice(
  basePrice: number,
  discountPercent: number,
): number {
  if (discountPercent <= 0) {
    return Math.max(0, Math.round(basePrice));
  }

  return roundDownToTenRub((basePrice * (100 - discountPercent)) / 100);
}

export type PlacementDiscountType = "launch_renewal_year_20" | null;

export type PlacementAdditionalOptions = {
  additionalCars?: number;
  [key: string]: unknown;
};

export type PlacementPriceResult = {
  category: PlacementCategory;
  period: PlacementPeriod;
  basePrice: number;
  finalPrice: number;
  discountPercent: number;
  discountType: PlacementDiscountType;
  discountLabel: "Скидка 20% после тестового периода" | null;
  discountText: string;
  discountReason: string;
  isDiscountApplied: boolean;
  isFirstPlacementInCategory: boolean;
  isRepeatPlacementInCategory: boolean;
  additionalOptionsPrice: number;
  additionalOptions: PlacementAdditionalOptions;
  totalPrice: number;
  currency: "RUB";
  priceVersion: string;
  freePeriodActive: boolean;
  freePeriodUntil: string | null;
  freePeriodEndsAtIso?: string | null;
  priceAfterFreePeriod: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parsePlacementPricingPayload(value: unknown): PlacementPriceResult | null {
  if (!isRecord(value) || !isRecord(value.placementPricing)) {
    return null;
  }

  const payload = value.placementPricing;
  const category = payload.category;
  const period = payload.period;

  if (
    typeof category !== "string" ||
    !PLACEMENT_CATEGORIES.includes(category as PlacementCategory) ||
    typeof period !== "string"
  ) {
    return null;
  }

  return payload as unknown as PlacementPriceResult;
}

export function buildPlacementPricingPayload(
  pricing: PlacementPriceResult,
): Record<string, unknown> {
  return {
    placementPricing: pricing,
    priceVersion: pricing.priceVersion,
    category: pricing.category,
    period: pricing.period,
    basePrice: pricing.basePrice,
    finalPrice: pricing.finalPrice,
    discountPercent: pricing.discountPercent,
    discountType: pricing.discountType,
    discountLabel: pricing.discountLabel,
    discountReason: pricing.discountReason,
    isFirstPlacementInCategory: pricing.isFirstPlacementInCategory,
    isRepeatPlacementInCategory: pricing.isRepeatPlacementInCategory,
    additionalOptions: pricing.additionalOptions,
    additionalOptionsPrice: pricing.additionalOptionsPrice,
    totalPrice: pricing.totalPrice,
    freePeriodActive: pricing.freePeriodActive,
    freePeriodUntil: pricing.freePeriodUntil,
    freePeriodEndsAtIso: pricing.freePeriodEndsAtIso ?? null,
    priceAfterFreePeriod: pricing.priceAfterFreePeriod,
    currency: pricing.currency,
  };
}

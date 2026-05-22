import type { Prisma } from "@prisma/client";
import {
  PLACEMENT_PROMO_ENDS_AT_ISO,
  PLACEMENT_PROMO_END_LABEL,
  isPlacementPromoActive,
} from "@/lib/placement-promo";
import {
  PLACEMENT_PRICE_VERSION,
  placementTariffs,
  type PlacementAdditionalOptions,
  type PlacementCategory,
  type PlacementDiscountType,
  type PlacementPeriod,
  type PlacementPriceResult,
} from "@/lib/placement-tariffs";

export {
  PLACEMENT_CATEGORIES,
  PLACEMENT_PRICE_VERSION,
  calculateDiscountedPlacementPrice,
  placementTariffs,
  roundDownToTenRub,
  parsePlacementPricingPayload,
  buildPlacementPricingPayload,
  type PlacementAdditionalOptions,
  type PlacementCategory,
  type PlacementDiscountType,
  type PlacementPeriod,
  type PlacementPriceResult,
} from "@/lib/placement-tariffs";

function normalizePeriod(period: PlacementPeriod): PlacementPeriod {
  const normalized = period.trim().toLowerCase();
  if (normalized === "yearly" || normalized === "annual") return "year";
  if (normalized === "offseason" || normalized === "off-season") return "off_season";
  return normalized;
}

export function getPlacementCategoryLabel(category: PlacementCategory): string {
  return placementTariffs[category].label;
}

export function getPlacementPeriodLabel(period: PlacementPeriod): string {
  switch (normalizePeriod(period)) {
    case "year":
      return "год";
    case "season":
      return "сезон";
    case "month":
      return "месяц";
    case "may_june":
      return "май-июнь";
    case "july":
      return "июль";
    case "august":
      return "август";
    case "september":
      return "сентябрь";
    case "october":
      return "октябрь";
    case "off_season":
      return "межсезонье";
    default:
      return period;
  }
}

export function getPlacementBasePrice(
  category: PlacementCategory,
  period: PlacementPeriod,
): number {
  const tariff = placementTariffs[category];
  const normalizedPeriod = normalizePeriod(period);

  if (normalizedPeriod === "year") {
    return tariff.yearPrice;
  }

  if (normalizedPeriod === "season" && "seasonPrice" in tariff) {
    return tariff.seasonPrice;
  }

  if (category === "object") {
    return 0;
  }

  return tariff.yearPrice;
}

export function getPlacementAdditionalOptionsPrice(input: {
  category: PlacementCategory;
  additionalOptions?: PlacementAdditionalOptions | null;
}): number {
  if (input.category !== "transfer") {
    return 0;
  }

  const additionalCars = Number(input.additionalOptions?.additionalCars ?? 0);
  const normalizedAdditionalCars = Number.isFinite(additionalCars)
    ? Math.max(0, Math.round(additionalCars))
    : 0;

  return normalizedAdditionalCars * placementTariffs.transfer.additionalCarPrice;
}

export async function getPlacementPrice(input: {
  userId?: string | null;
  category: PlacementCategory;
  period: PlacementPeriod;
  additionalOptions?: PlacementAdditionalOptions | null;
  basePrice?: number | null;
  hasPriorPaidYearPlacementInCategory?: boolean;
  hasLaunchDemoPlacementInCategory?: boolean;
  excludePaymentId?: string | null;
  now?: Date;
  client?: Prisma.TransactionClient;
}): Promise<PlacementPriceResult> {
  const now = input.now ?? new Date();
  const period = normalizePeriod(input.period);
  const basePrice = Math.max(
    0,
    Math.round(input.basePrice ?? getPlacementBasePrice(input.category, period)),
  );
  const additionalOptions = input.additionalOptions ?? {};
  const additionalOptionsPrice = getPlacementAdditionalOptionsPrice({
    category: input.category,
    additionalOptions,
  });

  const finalPrice = basePrice;
  const discountPercent = 0;
  const discountType: PlacementDiscountType = null;
  const discountLabel = null;
  const discountText = "После бесплатного периода действует базовая стоимость выбранного тарифа.";
  const discountReason = "Не применяется.";
  const isDiscountApplied = false;
  const totalPrice = finalPrice + additionalOptionsPrice;
  const freePeriodActive = isPlacementPromoActive(now);

  return {
    category: input.category,
    period,
    basePrice,
    finalPrice,
    discountPercent,
    discountType,
    discountLabel,
    discountText,
    discountReason,
    isDiscountApplied,
    isFirstPlacementInCategory: isDiscountApplied,
    isRepeatPlacementInCategory: false,
    additionalOptionsPrice,
    additionalOptions,
    totalPrice,
    currency: "RUB",
    priceVersion: PLACEMENT_PRICE_VERSION,
    freePeriodActive,
    freePeriodUntil: freePeriodActive ? PLACEMENT_PROMO_END_LABEL : null,
    freePeriodEndsAtIso: freePeriodActive ? PLACEMENT_PROMO_ENDS_AT_ISO : null,
    priceAfterFreePeriod: totalPrice,
  };
}

import { ExcursionOfferType, PaymentProvider, PaymentStatus, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  PLACEMENT_PROMO_END_LABEL,
  isPlacementPromoActive,
} from "@/lib/placement-promo";
import {
  PLACEMENT_PRICE_VERSION,
  calculateDiscountedPlacementPrice,
  placementTariffs,
  parsePlacementPricingPayload,
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

const categoryAccusativeLabels: Record<PlacementCategory, string> = {
  object: "объект",
  excursion: "экскурсию",
  tour: "тур",
  transfer: "трансфер",
};

const categoryGenitiveLabels: Record<PlacementCategory, string> = {
  object: "объекта",
  excursion: "экскурсии",
  tour: "тура",
  transfer: "трансфера",
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFreeDemoPayment(providerPayload: unknown): boolean {
  return (
    isRecord(providerPayload) &&
    (providerPayload.placementMode === "demo" ||
      providerPayload.placementCampaignType === "free_placement_until_2026_06_20")
  );
}

async function hasSuccessfulPaidYearPlacementInCategory(input: {
  userId: string;
  category: PlacementCategory;
  excludePaymentId?: string | null;
  client?: Prisma.TransactionClient;
}): Promise<boolean> {
  const client = input.client ?? db;
  const payments = await client.payment.findMany({
    where: {
      ownerId: input.userId,
      status: PaymentStatus.SUCCEEDED,
      provider: { not: PaymentProvider.MOCK },
      amount: { gt: 0 },
      ...(input.excludePaymentId ? { id: { not: input.excludePaymentId } } : {}),
      ...(input.category === "object"
        ? {
            propertyId: { not: null },
            OR: [{ tariffType: "YEARLY" }, { tariffCode: "object_yearly" }],
          }
        : input.category === "excursion"
          ? {
              excursion: { offerType: ExcursionOfferType.EXCURSION },
              tariffCode: { in: ["excursion_year", "excursion_standard"] },
            }
          : input.category === "tour"
            ? {
                excursion: { offerType: ExcursionOfferType.TOUR },
                tariffCode: { in: ["tour_year", "tour_standard"] },
              }
            : {
                OR: [
                  { transferId: { not: null } },
                  { tariffCode: { startsWith: "transfer_standard" } },
                  { tariffCode: "transfer_year" },
                ],
              }),
    },
    select: {
      id: true,
      tariffCode: true,
      providerPayload: true,
    },
    take: 20,
  });

  return payments.some((payment) => {
    if (isFreeDemoPayment(payment.providerPayload)) {
      return false;
    }

    const pricing = parsePlacementPricingPayload(payment.providerPayload);
    if (pricing) {
      return pricing.category === input.category && normalizePeriod(pricing.period) === "year";
    }

    return true;
  });
}

export async function getPlacementPrice(input: {
  userId?: string | null;
  category: PlacementCategory;
  period: PlacementPeriod;
  additionalOptions?: PlacementAdditionalOptions | null;
  basePrice?: number | null;
  hasPriorPaidYearPlacementInCategory?: boolean;
  excludePaymentId?: string | null;
  now?: Date;
  client?: Prisma.TransactionClient;
}): Promise<PlacementPriceResult> {
  const period = normalizePeriod(input.period);
  const tariff = placementTariffs[input.category];
  const basePrice = Math.max(
    0,
    Math.round(input.basePrice ?? getPlacementBasePrice(input.category, period)),
  );
  const additionalOptions = input.additionalOptions ?? {};
  const additionalOptionsPrice = getPlacementAdditionalOptionsPrice({
    category: input.category,
    additionalOptions,
  });

  const canApplyDiscount = period === tariff.discountsOnlyForPeriod;
  const hasPriorPaidYearPlacement =
    input.hasPriorPaidYearPlacementInCategory ??
    (input.userId
      ? await hasSuccessfulPaidYearPlacementInCategory({
          userId: input.userId,
          category: input.category,
          excludePaymentId: input.excludePaymentId,
          client: input.client,
        })
      : false);

  const discountPercent = canApplyDiscount
    ? hasPriorPaidYearPlacement
      ? tariff.repeatYearDiscountPercent
      : tariff.firstYearDiscountPercent
    : 0;
  const finalPrice = calculateDiscountedPlacementPrice(basePrice, discountPercent);
  const isDiscountApplied = discountPercent > 0 && finalPrice < basePrice;
  const discountType: PlacementDiscountType = isDiscountApplied
    ? hasPriorPaidYearPlacement
      ? "repeat_category_year_10"
      : "first_category_year_20"
    : null;
  const discountLabel =
    discountType === "first_category_year_20"
      ? "Стартовая скидка 20%"
      : discountType === "repeat_category_year_10"
        ? "Скидка 10%"
        : null;
  const discountText = !canApplyDiscount
    ? "Для этого тарифа скидка не применяется. Скидки 20% и 10% доступны только на годовое размещение."
    : discountType === "first_category_year_20"
      ? `Вы впервые размещаете ${categoryAccusativeLabels[input.category]} в этой категории. Для первого годового размещения действует стартовая скидка 20%.`
      : `Для повторного годового размещения ${categoryGenitiveLabels[input.category]} действует скидка 10%.`;
  const discountReason = !canApplyDiscount
    ? "Скидки применяются только к годовому размещению."
    : discountType === "first_category_year_20"
      ? `Пользователь впервые оплачивает годовое размещение в категории ${placementTariffs[input.category].label.toLowerCase()}.`
      : `Пользователь уже оплачивал годовое размещение в категории ${placementTariffs[input.category].label.toLowerCase()}.`;
  const totalPrice = finalPrice + additionalOptionsPrice;
  const now = input.now ?? new Date();
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
    isFirstPlacementInCategory: canApplyDiscount && !hasPriorPaidYearPlacement,
    isRepeatPlacementInCategory: canApplyDiscount && hasPriorPaidYearPlacement,
    additionalOptionsPrice,
    additionalOptions,
    totalPrice,
    currency: "RUB",
    priceVersion: PLACEMENT_PRICE_VERSION,
    freePeriodActive,
    freePeriodUntil: freePeriodActive ? PLACEMENT_PROMO_END_LABEL : null,
    priceAfterFreePeriod: totalPrice,
  };
}

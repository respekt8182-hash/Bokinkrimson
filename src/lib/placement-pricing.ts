import { ExcursionOfferType, PaymentProvider, PaymentStatus, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  PLACEMENT_PROMO_ENDS_AT_ISO,
  PLACEMENT_PROMO_END_LABEL,
  isLaunchPlacementDemoPayload,
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

const categoryGenitiveLabels: Record<PlacementCategory, string> = {
  object: "объекта",
  excursion: "экскурсии",
  tour: "тура",
  transfer: "трансфера",
};

type PaymentFindManyRunner<TPayment> = {
  payment: {
    findMany(args: unknown): Promise<TPayment[]>;
  };
};

type PaidYearPlacementProbePayment = {
  id: string;
  tariffCode: string;
  providerPayload: Prisma.JsonValue | null;
};

type LaunchDemoPlacementProbePayment = {
  providerPayload: Prisma.JsonValue | null;
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
  const client = (input.client ?? db) as unknown as PaymentFindManyRunner<
    PaidYearPlacementProbePayment
  >;
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

async function hasSuccessfulLaunchDemoPlacementInCategory(input: {
  userId: string;
  category: PlacementCategory;
  client?: Prisma.TransactionClient;
}): Promise<boolean> {
  const client = (input.client ?? db) as unknown as PaymentFindManyRunner<
    LaunchDemoPlacementProbePayment
  >;
  const payments = await client.payment.findMany({
    where: {
      ownerId: input.userId,
      status: PaymentStatus.SUCCEEDED,
      provider: { not: PaymentProvider.MOCK },
      amount: 0,
      ...(input.category === "object"
        ? {
            propertyId: { not: null },
          }
        : input.category === "excursion"
          ? {
              excursion: { offerType: ExcursionOfferType.EXCURSION },
            }
          : input.category === "tour"
            ? {
                excursion: { offerType: ExcursionOfferType.TOUR },
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
      providerPayload: true,
    },
    take: 50,
  });

  return payments.some((payment) => isLaunchPlacementDemoPayload(payment.providerPayload));
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

  const hasLaunchDemoPlacement =
    input.hasLaunchDemoPlacementInCategory ??
    (input.userId
      ? await hasSuccessfulLaunchDemoPlacementInCategory({
          userId: input.userId,
          category: input.category,
          client: input.client,
        })
      : false);
  const canApplyLaunchRenewalDiscount =
    canApplyDiscount &&
    !hasPriorPaidYearPlacement &&
    (isPlacementPromoActive(now) || hasLaunchDemoPlacement);
  const discountPercent = canApplyLaunchRenewalDiscount ? tariff.firstYearDiscountPercent : 0;
  const finalPrice = calculateDiscountedPlacementPrice(basePrice, discountPercent);
  const isDiscountApplied = discountPercent > 0 && finalPrice < basePrice;
  const discountType: PlacementDiscountType = isDiscountApplied ? "launch_renewal_year_20" : null;
  const discountLabel =
    discountType === "launch_renewal_year_20" ? "Скидка 20% после тестового периода" : null;
  const discountText = !canApplyDiscount
    ? "Для этого тарифа скидка не применяется. Скидка 20% доступна только участникам тестового периода на первое годовое продление."
    : discountType === "launch_renewal_year_20"
      ? `Для первого годового продления после тестового периода действует скидка 20% на размещение ${categoryGenitiveLabels[input.category]}.`
      : "После 20 июня новые карточки получают пробный месяц; скидка 20% доступна только участникам бесплатного периода на первое годовое продление.";
  const discountReason = !canApplyDiscount
    ? "Скидка применяется только к годовому размещению."
    : discountType === "launch_renewal_year_20"
      ? `Пользователь участвовал в тестовом периоде в категории ${placementTariffs[input.category].label.toLowerCase()} и впервые продлевает ее на год.`
      : "Пользователь не относится к участникам тестового периода с первым годовым продлением.";
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

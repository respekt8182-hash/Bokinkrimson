// Payment domain helpers: tariff quote calculation, status transitions, placement validity, and API-safe serialization.
import { PaymentProvider, PaymentStatus, type ObjectTariffType, type Prisma } from "@prisma/client";
import {
  getPlacementPricingGroupByType,
  type PlacementPricingGroup,
  placementTariffsByGroup,
} from "@/lib/constants";
import {
  getDefaultObjectPlacementTariffType,
  getObjectPlacementTariffOption,
  getObjectPlacementTariffOptions,
  getObjectTariffLabel,
  getObjectTariffTypeFromPaymentTariffCode,
  isObjectPlacementTariffType,
  serializeObjectPlacementTariffOption,
  type ObjectPlacementPaymentTariffType,
  type ObjectPlacementTariffType,
  type SerializedObjectPlacementTariffOption,
} from "@/lib/object-placement-tariffs";
import {
  PLACEMENT_POST_LAUNCH_TRIAL_CAMPAIGN_TYPE,
  PLACEMENT_POST_LAUNCH_TRIAL_CODE,
  PLACEMENT_PROMO_CODE,
  PLACEMENT_PROMO_DEMO_ENDS_AT_ISO,
  PLACEMENT_PROMO_DEMO_MODE,
  buildPostLaunchTrialPayload,
  buildPlacementPromoPayload,
  getFreePlacementDemoValidUntil,
  getPlacementFreePeriodPrice,
  getPlacementPromoOriginalCoverageAmount,
  getPlacementPromoPrice,
  isFreePlacementDemoPayload,
  type PlacementPromoPayload,
  type PlacementPromoPrice,
} from "@/lib/placement-promo";
import {
  buildPlacementPricingPayload,
  parsePlacementPricingPayload,
  type PlacementPriceResult,
} from "@/lib/placement-tariffs";

export type PlacementTariff =
  SerializedObjectPlacementTariffOption & {
    baseAmountRub?: number;
    finalAmountRub?: number;
    placementPricing?: PlacementPriceResult;
  };
export type LegacyRoomCountPlacementTariff =
  (typeof placementTariffsByGroup)[keyof typeof placementTariffsByGroup][number];

export type TariffQuote = {
  tariff: PlacementTariff;
  pricingGroup: PlacementPricingGroup;
  propertyType: string | null;
  roomCount: number;
  availableTariffs: PlacementTariff[];
  tariffType: ObjectPlacementTariffType;
  paidFrom: string;
  paidUntil: string;
  periodLabel: string;
  monthlyLabel: string;
  savingsRub: number | null;
  originalAmount: number;
  amount: number;
  promo: PlacementPromoPrice | null;
  placementPricing: PlacementPriceResult | null;
  currency: "RUB";
};

export type SerializedPayment = {
  id: string;
  propertyId: string | null;
  excursionId: string | null;
  transferId: string | null;
  ownerId: string;
  amount: number;
  originalCoverageAmount: number;
  tariffCode: string;
  tariffType: ObjectTariffType | null;
  tariffLabel: string;
  roomCount: number;
  status: PaymentStatus;
  statusLabel: string;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  confirmationUrl: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  paidFrom: string | null;
  canceledAt: string | null;
  placementValidUntil: string | null;
  propertyName: string | null;
  excursionName: string | null;
  transferName: string | null;
  placementPricing: PlacementPriceResult | null;
};

export type TransferPaymentPayload = {
  entityType: "transfer";
  transferId: string;
  transferTitle: string;
  paymentReason?: "publication" | "fleet_topup";
  vehicleCount?: number;
  totalAmountRub?: number;
  coveredAmountRub?: number;
  requiredAmountRub?: number;
};

const TRANSFER_PAYMENT_TARIFF_PREFIX = "transfer_standard:";
const ADMIN_REVENUE_INCLUDED_KEY = "includeInAdminRevenue";

export type PlacementCoverageState = {
  hasActivePlacement: boolean;
  paidUntil: string | null;
  coveredAmount: number;
  coveredOriginalAmount: number;
  coveredRoomCount: number;
  requiredPaymentAmount: number;
  requiredOriginalPaymentAmount: number;
  fullyCovered: boolean;
};

export type TransferPlacementCoverageState = {
  hasActivePlacement: boolean;
  paidUntil: string | null;
  coveredAmount: number;
  coveredOriginalAmount: number;
  coveredVehicleCount: number;
  requiredPaymentAmount: number;
  requiredOriginalPaymentAmount: number;
  fullyCovered: boolean;
};

export const PLACEMENT_VALIDITY_DAYS = 365;

export function getPaymentStatusLabel(status: PaymentStatus, provider?: PaymentProvider): string {
  if (provider === PaymentProvider.MANAGER) {
    switch (status) {
      case PaymentStatus.CREATED:
      case PaymentStatus.PENDING:
        return "Ожидает подтверждения менеджером";
      case PaymentStatus.SUCCEEDED:
        return "Оплата подтверждена менеджером";
      case PaymentStatus.CANCELED:
        return "Отклонено менеджером";
      default:
        return status;
    }
  }

  switch (status) {
    case PaymentStatus.CREATED:
      return "Создан";
    case PaymentStatus.PENDING:
      return "Ожидает оплату";
    case PaymentStatus.SUCCEEDED:
      return "Оплачен";
    case PaymentStatus.CANCELED:
      return "Отменен";
    default:
      return status;
  }
}

export function getProviderLabel(provider: PaymentProvider): string {
  switch (provider) {
    case PaymentProvider.MANAGER:
      return "Через менеджера";
    case PaymentProvider.MOCK:
      return "Тестовый";
    default:
      return provider;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function getTransferPaymentTariffCode(transferId: string): string {
  return `${TRANSFER_PAYMENT_TARIFF_PREFIX}${transferId}`;
}

export function getTransferPaymentBaseTariffCode(tariffCode: string): string {
  const trimmed = tariffCode.trim();
  return trimmed.startsWith(TRANSFER_PAYMENT_TARIFF_PREFIX)
    ? TRANSFER_PAYMENT_TARIFF_PREFIX.slice(0, -1)
    : trimmed;
}

export function getTransferIdFromPaymentTariffCode(tariffCode: string): string | null {
  const trimmed = tariffCode.trim();
  if (!trimmed.startsWith(TRANSFER_PAYMENT_TARIFF_PREFIX)) {
    return null;
  }

  const transferId = trimmed.slice(TRANSFER_PAYMENT_TARIFF_PREFIX.length).trim();
  return transferId || null;
}

export function buildTransferPaymentPayload(input: {
  transferId: string;
  transferTitle?: string | null;
  paymentReason?: TransferPaymentPayload["paymentReason"];
  vehicleCount?: number;
  totalAmountRub?: number;
  coveredAmountRub?: number;
  requiredAmountRub?: number;
  placementPromo?: PlacementPromoPayload | null;
}): Prisma.InputJsonObject {
  return {
    entityType: "transfer",
    transferId: input.transferId,
    transferTitle: input.transferTitle?.trim() ?? "",
    ...(input.paymentReason ? { paymentReason: input.paymentReason } : {}),
    ...(input.vehicleCount !== undefined ? { vehicleCount: input.vehicleCount } : {}),
    ...(input.totalAmountRub !== undefined ? { totalAmountRub: input.totalAmountRub } : {}),
    ...(input.coveredAmountRub !== undefined ? { coveredAmountRub: input.coveredAmountRub } : {}),
    ...(input.requiredAmountRub !== undefined
      ? { requiredAmountRub: input.requiredAmountRub }
      : {}),
    ...(input.placementPromo ? { placementPromo: input.placementPromo } : {}),
  };
}

function getOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value);
}

function getOptionalNonNegativeNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return value;
}

function normalizePrismaObjectTariffType(
  tariffType: ObjectTariffType | null | undefined,
): ObjectPlacementPaymentTariffType | null {
  if (!tariffType) {
    return null;
  }

  return tariffType.toLowerCase() as ObjectPlacementPaymentTariffType;
}

export function getTransferPaymentPayload(value: unknown): TransferPaymentPayload | null {
  if (!isRecord(value) || value.entityType !== "transfer") {
    return null;
  }

  const transferId = typeof value.transferId === "string" ? value.transferId.trim() : "";
  if (!transferId) {
    return null;
  }

  const paymentReason =
    value.paymentReason === "fleet_topup" || value.paymentReason === "publication"
      ? value.paymentReason
      : undefined;
  const vehicleCount = getOptionalPositiveInteger(value.vehicleCount);
  const totalAmountRub = getOptionalNonNegativeNumber(value.totalAmountRub);
  const coveredAmountRub = getOptionalNonNegativeNumber(value.coveredAmountRub);
  const requiredAmountRub = getOptionalNonNegativeNumber(value.requiredAmountRub);

  return {
    entityType: "transfer",
    transferId,
    transferTitle: typeof value.transferTitle === "string" ? value.transferTitle.trim() : "",
    ...(paymentReason ? { paymentReason } : {}),
    ...(vehicleCount !== undefined ? { vehicleCount } : {}),
    ...(totalAmountRub !== undefined ? { totalAmountRub } : {}),
    ...(coveredAmountRub !== undefined ? { coveredAmountRub } : {}),
    ...(requiredAmountRub !== undefined ? { requiredAmountRub } : {}),
  };
}

export function getTransferPaymentReference(input: {
  transferId?: string | null;
  tariffCode?: string | null;
  providerPayload?: unknown;
}): { transferId: string; transferTitle: string | null } | null {
  const directTransferId = input.transferId?.trim() ?? "";
  const transferPayload = getTransferPaymentPayload(input.providerPayload);
  const tariffTransferId = input.tariffCode
    ? getTransferIdFromPaymentTariffCode(input.tariffCode)
    : null;
  const transferId = directTransferId || transferPayload?.transferId || tariffTransferId;

  if (!transferId) {
    return null;
  }

  return {
    transferId,
    transferTitle: transferPayload?.transferTitle || null,
  };
}

export function shouldCountPaymentInAdminRevenue(providerPayload: unknown): boolean {
  if (!isRecord(providerPayload)) {
    return true;
  }

  return providerPayload[ADMIN_REVENUE_INCLUDED_KEY] !== false;
}

export function setPaymentAdminRevenueIncluded(
  providerPayload: Prisma.JsonValue | null,
  included: boolean,
): Prisma.InputJsonObject {
  if (isRecord(providerPayload)) {
    return {
      ...providerPayload,
      [ADMIN_REVENUE_INCLUDED_KEY]: included,
    } as Prisma.InputJsonObject;
  }

  return {
    [ADMIN_REVENUE_INCLUDED_KEY]: included,
    ...(providerPayload === null ? {} : { legacyProviderPayload: providerPayload }),
  } as Prisma.InputJsonObject;
}

export function buildFreePlacementPaymentPayload(input: {
  originalAmountRub: number;
  discountedAmountRub?: number;
  now?: Date;
  context?: Prisma.InputJsonObject;
  placementPricing?: PlacementPriceResult | null;
}): Prisma.InputJsonObject {
  const placementPromo = buildPlacementPromoPayload({
    originalAmountRub: input.originalAmountRub,
    discountedAmountRub: input.discountedAmountRub ?? 0,
    now: input.now,
  });

  return {
    ...(input.context ?? {}),
    placementCampaign: PLACEMENT_PROMO_CODE,
    placementCampaignType: "free_placement_until_2026_06_20",
    placementMode: PLACEMENT_PROMO_DEMO_MODE,
    placementDemoEndsAtIso: PLACEMENT_PROMO_DEMO_ENDS_AT_ISO,
    includeInAdminRevenue: false,
    ...(placementPromo ? { placementPromo } : {}),
    ...(input.placementPricing ? buildPlacementPricingPayload(input.placementPricing) : {}),
  };
}

export function buildPostLaunchTrialPaymentPayload(input: {
  originalAmountRub: number;
  discountedAmountRub?: number;
  now?: Date;
  validUntil?: Date;
  context?: Prisma.InputJsonObject;
  placementPricing?: PlacementPriceResult | null;
}): Prisma.InputJsonObject {
  const postLaunchTrial = buildPostLaunchTrialPayload({
    originalAmountRub: input.originalAmountRub,
    discountedAmountRub: input.discountedAmountRub ?? 0,
    now: input.now,
    validUntil: input.validUntil,
  });

  return {
    ...(input.context ?? {}),
    placementCampaign: PLACEMENT_POST_LAUNCH_TRIAL_CODE,
    placementCampaignType: PLACEMENT_POST_LAUNCH_TRIAL_CAMPAIGN_TYPE,
    includeInAdminRevenue: false,
    ...(postLaunchTrial ? { postLaunchTrial } : {}),
    ...(input.placementPricing ? buildPlacementPricingPayload(input.placementPricing) : {}),
  };
}

export function isPaymentAwaitingCompletion(status: PaymentStatus): boolean {
  return status === PaymentStatus.CREATED || status === PaymentStatus.PENDING;
}

export function resolvePaymentStatusTransition(
  currentStatus: PaymentStatus,
  nextStatus: PaymentStatus,
): PaymentStatus {
  // Once succeeded we never downgrade status on duplicate/late callbacks.
  if (currentStatus === PaymentStatus.SUCCEEDED) {
    return PaymentStatus.SUCCEEDED;
  }

  // Success can override any non-success status.
  if (nextStatus === PaymentStatus.SUCCEEDED) {
    return PaymentStatus.SUCCEEDED;
  }

  // If payment was canceled, keep it terminal unless success arrives later.
  if (currentStatus === PaymentStatus.CANCELED) {
    return PaymentStatus.CANCELED;
  }

  return nextStatus;
}

export function getTariffByRoomCount(
  roomCount: number,
  propertyType: string | null,
): LegacyRoomCountPlacementTariff {
  const normalizedRoomCount = Math.max(1, roomCount);
  const pricingGroup = getPlacementPricingGroupByType(propertyType);
  const tariffs = placementTariffsByGroup[pricingGroup];
  const found = tariffs.find((tariff) => {
    const max = tariff.roomCountMax ?? Number.POSITIVE_INFINITY;
    return normalizedRoomCount >= tariff.roomCountMin && normalizedRoomCount <= max;
  });

  if (!found) {
    return tariffs[tariffs.length - 1];
  }

  return found;
}

export function getTariffQuote(input: {
  roomCount: number;
  propertyType: string | null;
  tariffType?: string | null;
  now?: Date;
  placementPricesByTariffType?: Partial<Record<ObjectPlacementTariffType, PlacementPriceResult>>;
}): TariffQuote {
  const normalizedRoomCount = Math.max(1, input.roomCount);
  const pricingGroup = getPlacementPricingGroupByType(input.propertyType);
  const now = input.now ?? new Date();
  const requestedType = isObjectPlacementTariffType(input.tariffType)
    ? input.tariffType
    : getDefaultObjectPlacementTariffType(now);
  const tariffOption =
    getObjectPlacementTariffOption(requestedType, now) ??
    getObjectPlacementTariffOption(getDefaultObjectPlacementTariffType(now), now) ??
    getObjectPlacementTariffOptions(now)[0];

  if (!tariffOption) {
    throw new Error("No object placement tariff is available for the current date.");
  }

  const selectedPlacementPricing = input.placementPricesByTariffType?.[tariffOption.type] ?? null;
  const tariff: PlacementTariff = {
    ...serializeObjectPlacementTariffOption(tariffOption),
    ...(selectedPlacementPricing
      ? {
          baseAmountRub: selectedPlacementPricing.basePrice,
          finalAmountRub: selectedPlacementPricing.totalPrice,
          placementPricing: selectedPlacementPricing,
        }
      : {}),
  };
  const availableTariffs = getObjectPlacementTariffOptions(now).map((option) => {
    const placementPricing = input.placementPricesByTariffType?.[option.type] ?? null;
    return {
      ...serializeObjectPlacementTariffOption(option),
      ...(placementPricing
        ? {
            baseAmountRub: placementPricing.basePrice,
            finalAmountRub: placementPricing.totalPrice,
            placementPricing,
          }
        : {}),
    };
  });
  const amountBeforePromo = selectedPlacementPricing?.totalPrice ?? tariff.amountRub;
  const promoPrice = selectedPlacementPricing?.freePeriodActive
    ? getPlacementFreePeriodPrice({
        originalAmountRub: amountBeforePromo,
        code:
          selectedPlacementPricing.freePeriodEndsAtIso === PLACEMENT_PROMO_DEMO_ENDS_AT_ISO
            ? PLACEMENT_PROMO_CODE
            : PLACEMENT_POST_LAUNCH_TRIAL_CODE,
        endsAtIso: selectedPlacementPricing.freePeriodEndsAtIso ?? PLACEMENT_PROMO_DEMO_ENDS_AT_ISO,
        endsLabel: selectedPlacementPricing.freePeriodUntil ?? tariff.periodLabel,
        shortEndsLabel: selectedPlacementPricing.freePeriodUntil ?? tariff.periodLabel,
      })
    : getPlacementPromoPrice(amountBeforePromo, now);

  return {
    tariff,
    pricingGroup,
    propertyType: input.propertyType,
    roomCount: normalizedRoomCount,
    availableTariffs,
    tariffType: tariff.type,
    paidFrom: tariff.paidFrom,
    paidUntil: tariff.paidUntil,
    periodLabel: tariff.periodLabel,
    monthlyLabel: tariff.monthlyLabel,
    savingsRub: tariff.savingsRub,
    originalAmount: promoPrice.originalAmountRub,
    amount: promoPrice.finalAmountRub,
    promo: promoPrice.isDiscounted ? promoPrice : null,
    placementPricing: selectedPlacementPricing,
    currency: "RUB",
  };
}

export function serializePayment(payment: {
  id: string;
  propertyId: string | null;
  excursionId?: string | null;
  transferId?: string | null;
  ownerId: string;
  amount: Prisma.Decimal;
  tariffCode: string;
  tariffType?: ObjectTariffType | null;
  roomCount: number;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  confirmationUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  paidFrom?: Date | null;
  canceledAt: Date | null;
  placementValidUntil?: Date | null;
  property?: { name: string | null } | null;
  excursion?: { title: string | null } | null;
  transfer?: { title: string | null } | null;
  providerPayload?: Prisma.JsonValue | null;
}): SerializedPayment {
  const transferReference = getTransferPaymentReference({
    transferId: payment.transferId,
    tariffCode: payment.tariffCode,
    providerPayload: payment.providerPayload,
  });
  const serializedPlacementValidUntil = isFreePlacementDemoPayload(payment.providerPayload)
    ? getFreePlacementDemoValidUntil(payment.providerPayload).toISOString()
    : payment.placementValidUntil
      ? payment.placementValidUntil.toISOString()
      : null;
  const tariffTypeFromCode = getObjectTariffTypeFromPaymentTariffCode(payment.tariffCode);
  const resolvedTariffType = isFreePlacementDemoPayload(payment.providerPayload)
    ? ("DEMO" as ObjectTariffType)
    : (payment.tariffType ?? null);
  const normalizedTariffType =
    normalizePrismaObjectTariffType(resolvedTariffType) ?? tariffTypeFromCode;
  const tariffLabel = getObjectTariffLabel(
    normalizedTariffType,
    payment.tariffCode,
  );
  const placementPricing = parsePlacementPricingPayload(payment.providerPayload);

  return {
    id: payment.id,
    propertyId: payment.propertyId,
    excursionId: payment.excursionId ?? null,
    transferId: transferReference?.transferId ?? null,
    ownerId: payment.ownerId,
    amount: Number(payment.amount),
    tariffCode: payment.tariffCode,
    tariffType: resolvedTariffType,
    tariffLabel,
    roomCount: payment.roomCount,
    status: payment.status,
    statusLabel: getPaymentStatusLabel(payment.status, payment.provider),
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    confirmationUrl: payment.confirmationUrl,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    paidFrom: payment.paidFrom ? payment.paidFrom.toISOString() : null,
    canceledAt: payment.canceledAt ? payment.canceledAt.toISOString() : null,
    placementValidUntil: serializedPlacementValidUntil,
    propertyName: payment.property?.name ?? null,
    excursionName: payment.excursion?.title ?? null,
    transferName: payment.transfer?.title ?? transferReference?.transferTitle ?? null,
    placementPricing,
    originalCoverageAmount: getPlacementPromoOriginalCoverageAmount(
      payment.providerPayload,
      Number(payment.amount),
    ),
  };
}

export function getPlacementValidUntil(anchorDate: Date): Date {
  const next = new Date(anchorDate);
  next.setDate(next.getDate() + PLACEMENT_VALIDITY_DAYS);
  return next;
}

export function hasActivePlacementFromPaidAt(anchorDate: Date, now = new Date()): boolean {
  return getPlacementValidUntil(anchorDate).getTime() > now.getTime();
}

export function resolvePaymentPlacementValidUntil(payment: {
  paidAt: Date | null;
  createdAt: Date;
  placementValidUntil?: Date | null;
  providerPayload?: Prisma.JsonValue | null;
}): Date {
  if (isFreePlacementDemoPayload(payment.providerPayload)) {
    return getFreePlacementDemoValidUntil(payment.providerPayload);
  }

  return payment.placementValidUntil ?? getPlacementValidUntil(payment.paidAt ?? payment.createdAt);
}

export function getPlacementCoverageState(input: {
  payments: Array<{
    amount: Prisma.Decimal | number;
    roomCount: number;
    status: PaymentStatus;
    provider?: PaymentProvider;
    paidAt: Date | null;
    paidFrom?: Date | null;
    createdAt: Date;
    placementValidUntil?: Date | null;
    providerPayload?: Prisma.JsonValue | null;
  }>;
  quote: TariffQuote | null;
  now?: Date;
}): PlacementCoverageState {
  const now = input.now ?? new Date();
  const succeededPayments = input.payments
    .filter(
      (item) => item.status === PaymentStatus.SUCCEEDED && item.provider !== PaymentProvider.MOCK,
    )
    .map((item) => ({
      amount: typeof item.amount === "number" ? item.amount : Number(item.amount),
      roomCount: item.roomCount,
      paidFrom: item.paidFrom ?? item.paidAt ?? item.createdAt,
      validUntil: resolvePaymentPlacementValidUntil(item),
      originalCoverageAmount: getPlacementPromoOriginalCoverageAmount(
        item.providerPayload,
        typeof item.amount === "number" ? item.amount : Number(item.amount),
      ),
    }))
    .filter(
      (item) =>
        item.validUntil.getTime() > now.getTime() && item.paidFrom.getTime() <= now.getTime(),
    );

  if (succeededPayments.length === 0) {
    const requiredPaymentAmount = input.quote?.amount ?? 0;
    const requiredOriginalPaymentAmount = input.quote?.originalAmount ?? requiredPaymentAmount;
    return {
      hasActivePlacement: false,
      paidUntil: null,
      coveredAmount: 0,
      coveredOriginalAmount: 0,
      coveredRoomCount: 0,
      requiredPaymentAmount,
      requiredOriginalPaymentAmount,
      fullyCovered: requiredPaymentAmount <= 0,
    };
  }

  const latestValidUntilMs = Math.max(
    ...succeededPayments.map((item) => item.validUntil.getTime()),
  );
  const currentCyclePayments = succeededPayments.filter(
    (item) => item.validUntil.getTime() === latestValidUntilMs,
  );
  const coveredAmount = currentCyclePayments.reduce((sum, item) => sum + item.amount, 0);
  const coveredOriginalAmount = currentCyclePayments.reduce(
    (sum, item) => sum + item.originalCoverageAmount,
    0,
  );
  const coveredRoomCount = currentCyclePayments.reduce(
    (max, item) => Math.max(max, item.roomCount),
    0,
  );

  return {
    hasActivePlacement: true,
    paidUntil: new Date(latestValidUntilMs).toISOString(),
    coveredAmount,
    coveredOriginalAmount,
    coveredRoomCount,
    requiredPaymentAmount: 0,
    requiredOriginalPaymentAmount: 0,
    fullyCovered: true,
  };
}

export function getTransferPlacementCoverageState(input: {
  payments: Array<{
    amount: Prisma.Decimal | number;
    roomCount: number;
    status: PaymentStatus;
    provider?: PaymentProvider;
    paidAt: Date | null;
    createdAt: Date;
    placementValidUntil?: Date | null;
    providerPayload?: Prisma.JsonValue | null;
  }>;
  publicationFeeRub: number;
  originalPublicationFeeRub?: number;
  now?: Date;
}): TransferPlacementCoverageState {
  const now = input.now ?? new Date();
  const requiredTotal = Math.max(0, input.publicationFeeRub);
  const requiredOriginalTotal = Math.max(0, input.originalPublicationFeeRub ?? requiredTotal);
  const succeededPayments = input.payments
    .filter(
      (item) => item.status === PaymentStatus.SUCCEEDED && item.provider !== PaymentProvider.MOCK,
    )
    .map((item) => ({
      amount: typeof item.amount === "number" ? item.amount : Number(item.amount),
      vehicleCount: item.roomCount,
      validUntil: resolvePaymentPlacementValidUntil(item),
      originalCoverageAmount: getPlacementPromoOriginalCoverageAmount(
        item.providerPayload,
        typeof item.amount === "number" ? item.amount : Number(item.amount),
      ),
    }))
    .filter((item) => item.validUntil.getTime() > now.getTime());

  if (succeededPayments.length === 0) {
    return {
      hasActivePlacement: false,
      paidUntil: null,
      coveredAmount: 0,
      coveredOriginalAmount: 0,
      coveredVehicleCount: 0,
      requiredPaymentAmount: requiredTotal,
      requiredOriginalPaymentAmount: requiredOriginalTotal,
      fullyCovered: requiredTotal <= 0,
    };
  }

  const latestValidUntilMs = Math.max(
    ...succeededPayments.map((item) => item.validUntil.getTime()),
  );
  const currentCyclePayments = succeededPayments.filter(
    (item) => item.validUntil.getTime() === latestValidUntilMs,
  );
  const coveredAmount = currentCyclePayments.reduce((sum, item) => sum + item.amount, 0);
  const coveredOriginalAmount = currentCyclePayments.reduce(
    (sum, item) => sum + item.originalCoverageAmount,
    0,
  );
  const coveredVehicleCount = currentCyclePayments.reduce(
    (max, item) => Math.max(max, item.vehicleCount),
    0,
  );
  const activeCoverageAmount =
    requiredTotal < requiredOriginalTotal ? coveredAmount : coveredOriginalAmount;
  const requiredPaymentAmount = Math.max(0, requiredTotal - activeCoverageAmount);
  const requiredOriginalPaymentAmount = Math.max(0, requiredOriginalTotal - coveredOriginalAmount);

  return {
    hasActivePlacement: true,
    paidUntil: new Date(latestValidUntilMs).toISOString(),
    coveredAmount,
    coveredOriginalAmount,
    coveredVehicleCount,
    requiredPaymentAmount,
    requiredOriginalPaymentAmount,
    fullyCovered: requiredPaymentAmount <= 0,
  };
}

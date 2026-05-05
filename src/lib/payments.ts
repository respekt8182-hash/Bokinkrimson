// Payment domain helpers: tariff quote calculation, status transitions, placement validity, and API-safe serialization.
import { PaymentProvider, PaymentStatus, type Prisma } from "@prisma/client";
import {
  getPlacementPricingGroupByType,
  type PlacementPricingGroup,
  placementTariffsByGroup,
} from "@/lib/constants";
import {
  getPlacementPromoOriginalCoverageAmount,
  getPlacementPromoPrice,
  type PlacementPromoPayload,
  type PlacementPromoPrice,
} from "@/lib/placement-promo";

export type PlacementTariff =
  (typeof placementTariffsByGroup)[keyof typeof placementTariffsByGroup][number];

export type TariffQuote = {
  tariff: PlacementTariff;
  pricingGroup: PlacementPricingGroup;
  propertyType: string | null;
  roomCount: number;
  originalAmount: number;
  amount: number;
  promo: PlacementPromoPrice | null;
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
  roomCount: number;
  status: PaymentStatus;
  statusLabel: string;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  confirmationUrl: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  canceledAt: string | null;
  placementValidUntil: string | null;
  propertyName: string | null;
  excursionName: string | null;
  transferName: string | null;
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
    case PaymentProvider.YOOKASSA:
      return "ЮKassa";
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

export type YookassaStatus = "pending" | "waiting_for_capture" | "succeeded" | "canceled";

export function mapYookassaStatus(status: YookassaStatus): PaymentStatus {
  switch (status) {
    case "pending":
    case "waiting_for_capture":
      return PaymentStatus.PENDING;
    case "succeeded":
      return PaymentStatus.SUCCEEDED;
    case "canceled":
      return PaymentStatus.CANCELED;
    default:
      return PaymentStatus.PENDING;
  }
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
): PlacementTariff {
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
  now?: Date;
}): TariffQuote {
  const normalizedRoomCount = Math.max(1, input.roomCount);
  const pricingGroup = getPlacementPricingGroupByType(input.propertyType);
  const tariff = getTariffByRoomCount(normalizedRoomCount, input.propertyType);
  const promoPrice = getPlacementPromoPrice(tariff.amountRub, input.now);

  return {
    tariff,
    pricingGroup,
    propertyType: input.propertyType,
    roomCount: normalizedRoomCount,
    originalAmount: promoPrice.originalAmountRub,
    amount: promoPrice.finalAmountRub,
    promo: promoPrice.isDiscounted ? promoPrice : null,
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
  roomCount: number;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  confirmationUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
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

  return {
    id: payment.id,
    propertyId: payment.propertyId,
    excursionId: payment.excursionId ?? null,
    transferId: transferReference?.transferId ?? null,
    ownerId: payment.ownerId,
    amount: Number(payment.amount),
    tariffCode: payment.tariffCode,
    roomCount: payment.roomCount,
    status: payment.status,
    statusLabel: getPaymentStatusLabel(payment.status, payment.provider),
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    confirmationUrl: payment.confirmationUrl,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    canceledAt: payment.canceledAt ? payment.canceledAt.toISOString() : null,
    placementValidUntil: payment.placementValidUntil
      ? payment.placementValidUntil.toISOString()
      : null,
    propertyName: payment.property?.name ?? null,
    excursionName: payment.excursion?.title ?? null,
    transferName: payment.transfer?.title ?? transferReference?.transferTitle ?? null,
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
}): Date {
  return payment.placementValidUntil ?? getPlacementValidUntil(payment.paidAt ?? payment.createdAt);
}

export function getPlacementCoverageState(input: {
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
      validUntil: resolvePaymentPlacementValidUntil(item),
      originalCoverageAmount: getPlacementPromoOriginalCoverageAmount(
        item.providerPayload,
        typeof item.amount === "number" ? item.amount : Number(item.amount),
      ),
    }))
    .filter((item) => item.validUntil.getTime() > now.getTime());

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
  const activeCoverageAmount = input.quote?.promo ? coveredAmount : coveredOriginalAmount;
  const requiredPaymentAmount = input.quote
    ? Math.max(0, input.quote.amount - activeCoverageAmount)
    : 0;
  const requiredOriginalPaymentAmount = input.quote
    ? Math.max(0, input.quote.originalAmount - coveredOriginalAmount)
    : 0;

  return {
    hasActivePlacement: true,
    paidUntil: new Date(latestValidUntilMs).toISOString(),
    coveredAmount,
    coveredOriginalAmount,
    coveredRoomCount,
    requiredPaymentAmount,
    requiredOriginalPaymentAmount,
    fullyCovered: requiredPaymentAmount <= 0,
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

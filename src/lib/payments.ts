// Payment domain helpers: tariff quote calculation, status transitions, placement validity, and API-safe serialization.
import { PaymentProvider, PaymentStatus, type Prisma } from "@prisma/client";
import {
  getPlacementPricingGroupByType,
  type PlacementPricingGroup,
  placementTariffsByGroup,
} from "@/lib/constants";

export type PlacementTariff =
  (typeof placementTariffsByGroup)[keyof typeof placementTariffsByGroup][number];

export type TariffQuote = {
  tariff: PlacementTariff;
  pricingGroup: PlacementPricingGroup;
  propertyType: string | null;
  roomCount: number;
  amount: number;
  currency: "RUB";
};

export type SerializedPayment = {
  id: string;
  propertyId: string | null;
  ownerId: string;
  amount: number;
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
};

export type PlacementCoverageState = {
  hasActivePlacement: boolean;
  paidUntil: string | null;
  coveredAmount: number;
  coveredRoomCount: number;
  requiredPaymentAmount: number;
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

export function getTariffByRoomCount(roomCount: number, propertyType: string | null): PlacementTariff {
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

export function getTariffQuote(input: { roomCount: number; propertyType: string | null }): TariffQuote {
  const normalizedRoomCount = Math.max(1, input.roomCount);
  const pricingGroup = getPlacementPricingGroupByType(input.propertyType);
  const tariff = getTariffByRoomCount(normalizedRoomCount, input.propertyType);
  return {
    tariff,
    pricingGroup,
    propertyType: input.propertyType,
    roomCount: normalizedRoomCount,
    amount: tariff.amountRub,
    currency: "RUB",
  };
}

export function serializePayment(payment: {
  id: string;
  propertyId: string | null;
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
}): SerializedPayment {
  return {
    id: payment.id,
    propertyId: payment.propertyId,
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
    placementValidUntil: payment.placementValidUntil ? payment.placementValidUntil.toISOString() : null,
    propertyName: payment.property?.name ?? null,
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
    paidAt: Date | null;
    createdAt: Date;
    placementValidUntil?: Date | null;
  }>;
  quote: TariffQuote | null;
  now?: Date;
}): PlacementCoverageState {
  const now = input.now ?? new Date();
  const succeededPayments = input.payments
    .filter((item) => item.status === PaymentStatus.SUCCEEDED)
    .map((item) => ({
      amount: typeof item.amount === "number" ? item.amount : Number(item.amount),
      roomCount: item.roomCount,
      validUntil: resolvePaymentPlacementValidUntil(item),
    }))
    .filter((item) => item.validUntil.getTime() > now.getTime());

  if (succeededPayments.length === 0) {
    const requiredPaymentAmount = input.quote?.amount ?? 0;
    return {
      hasActivePlacement: false,
      paidUntil: null,
      coveredAmount: 0,
      coveredRoomCount: 0,
      requiredPaymentAmount,
      fullyCovered: requiredPaymentAmount <= 0,
    };
  }

  const latestValidUntilMs = Math.max(...succeededPayments.map((item) => item.validUntil.getTime()));
  const currentCyclePayments = succeededPayments.filter(
    (item) => item.validUntil.getTime() === latestValidUntilMs,
  );
  const coveredAmount = currentCyclePayments.reduce((sum, item) => sum + item.amount, 0);
  const coveredRoomCount = currentCyclePayments.reduce(
    (max, item) => Math.max(max, item.roomCount),
    0,
  );
  const requiredPaymentAmount = input.quote ? Math.max(0, input.quote.amount - coveredAmount) : 0;

  return {
    hasActivePlacement: true,
    paidUntil: new Date(latestValidUntilMs).toISOString(),
    coveredAmount,
    coveredRoomCount,
    requiredPaymentAmount,
    fullyCovered: requiredPaymentAmount <= 0,
  };
}

import { ObjectPaymentStatus, ObjectTariffType, type Prisma } from "@prisma/client";
import {
  OBJECT_YEARLY_SAVINGS_RUB,
  getDaysUntil,
  getObjectTariffLabel,
  type ObjectPlacementPaymentTariffType,
} from "@/lib/object-placement-tariffs";
import { isFreePlacementDemoPayload } from "@/lib/placement-promo";
import { resolvePaymentPlacementValidUntil } from "@/lib/payments";

export type ObjectPaymentDisplayStatus =
  | "paid"
  | "unpaid"
  | "demo"
  | "expired"
  | "expiring";

export type ObjectPaymentDisplay = {
  status: ObjectPaymentDisplayStatus;
  label: string;
  toneClassName: string;
  tariffLabel: string;
  tariffType: ObjectTariffType | null;
  paidFrom: Date | null;
  paidUntil: Date | null;
  paidAmount: number | null;
  paidAt: Date | null;
  daysLeft: number | null;
};

type PaymentLike = {
  amount: Prisma.Decimal | number;
  tariffCode: string;
  tariffType?: ObjectTariffType | null;
  paidFrom?: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  placementValidUntil?: Date | null;
  providerPayload?: Prisma.JsonValue | null;
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getStatusTone(status: ObjectPaymentDisplayStatus): string {
  switch (status) {
    case "paid":
      return "bg-emerald-100 text-emerald-700";
    case "demo":
      return "bg-sky-100 text-sky-700";
    case "expiring":
      return "bg-amber-100 text-amber-700";
    case "expired":
      return "bg-red-100 text-red-700";
    case "unpaid":
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function normalizeTariffType(
  tariffType: ObjectTariffType | null | undefined,
): ObjectPlacementPaymentTariffType | null {
  return tariffType ? (tariffType.toLowerCase() as ObjectPlacementPaymentTariffType) : null;
}

function getStatusLabel(input: {
  status: ObjectPaymentDisplayStatus;
  paidUntil: Date | null;
}): string {
  switch (input.status) {
    case "demo":
      return "Демо до 20 июня";
    case "paid":
      return "Оплачено";
    case "expired":
      return "Истекло";
    case "expiring":
      return "Скоро истекает";
    case "unpaid":
    default:
      return "Не оплачено";
  }
}

function getPaymentFallbackDisplay(
  payment: PaymentLike | null | undefined,
): Pick<
  ObjectPaymentDisplay,
  "paidFrom" | "paidUntil" | "paidAmount" | "paidAt" | "tariffLabel" | "tariffType"
> {
  if (!payment) {
    return {
      paidFrom: null,
      paidUntil: null,
      paidAmount: null,
      paidAt: null,
      tariffLabel: "Не указан",
      tariffType: null,
    };
  }

  const tariffType = isFreePlacementDemoPayload(payment.providerPayload)
    ? ObjectTariffType.DEMO
    : (payment.tariffType ?? null);

  return {
    paidFrom: payment.paidFrom ?? payment.paidAt ?? payment.createdAt,
    paidUntil: resolvePaymentPlacementValidUntil(payment),
    paidAmount: toNumber(payment.amount),
    paidAt: payment.paidAt,
    tariffLabel: getObjectTariffLabel(normalizeTariffType(tariffType), payment.tariffCode),
    tariffType,
  };
}

export function getObjectPaymentDisplay(input: {
  paymentStatus?: ObjectPaymentStatus | null;
  tariffType?: ObjectTariffType | null;
  paidFrom?: Date | null;
  paidUntil?: Date | null;
  paidAmount?: Prisma.Decimal | number | null;
  paidAt?: Date | null;
  latestPayment?: PaymentLike | null;
  now?: Date;
  expiringDays?: number;
}): ObjectPaymentDisplay {
  const now = input.now ?? new Date();
  const expiringDays = input.expiringDays ?? 30;
  const fallback = getPaymentFallbackDisplay(input.latestPayment);
  const paidFrom = input.paidFrom ?? fallback.paidFrom;
  const paidUntil = input.paidUntil ?? fallback.paidUntil;
  const paidAmount = toNumber(input.paidAmount) ?? fallback.paidAmount;
  const paidAt = input.paidAt ?? fallback.paidAt;
  const tariffType = input.tariffType ?? fallback.tariffType;
  const tariffLabel =
    tariffType !== null ? getObjectTariffLabel(normalizeTariffType(tariffType)) : fallback.tariffLabel;
  const daysLeft = paidUntil ? getDaysUntil(paidUntil, now) : null;

  let status: ObjectPaymentDisplayStatus;
  if (!paidUntil) {
    status = "unpaid";
  } else if (paidUntil.getTime() <= now.getTime()) {
    status = "expired";
  } else if (paidFrom && paidFrom.getTime() > now.getTime()) {
    status = "unpaid";
  } else if (input.paymentStatus === ObjectPaymentStatus.DEMO || tariffType === ObjectTariffType.DEMO) {
    status = "demo";
  } else if (daysLeft !== null && daysLeft <= expiringDays) {
    status = "expiring";
  } else {
    status = "paid";
  }

  return {
    status,
    label: getStatusLabel({ status, paidUntil }),
    toneClassName: getStatusTone(status),
    tariffLabel,
    tariffType,
    paidFrom,
    paidUntil,
    paidAmount,
    paidAt,
    daysLeft,
  };
}

export { OBJECT_YEARLY_SAVINGS_RUB };

import {
  ExcursionStatus,
  PaymentProvider,
  PaymentStatus,
  PropertyStatus,
  TransferStatus,
  type Prisma,
} from "@prisma/client";
import type { DbClientLike } from "@/lib/db";
import { autoSubmitExcursionAfterSuccessfulPayment } from "@/lib/excursions";
import {
  getPlacementValidUntil,
  getTransferPaymentReference,
  isPaymentAwaitingCompletion,
  resolvePaymentStatusTransition,
} from "@/lib/payments";
import {
  autoSubmitPropertyAfterSuccessfulPayment,
  syncPropertyPlacementFromPayment,
} from "@/lib/properties";
import { autoSubmitTransferAfterSuccessfulPayment } from "@/lib/transfers";
import {
  getYooKassaPayment,
  isYooKassaConfigured,
  mapYooKassaPaymentStatus,
  mergeYooKassaPaymentPayload,
} from "@/lib/yookassa";

export async function finalizeSuccessfulPayment(
  client: DbClientLike,
  paymentId: string,
  input: {
    now?: Date;
    providerPaymentId?: string | null;
    confirmationUrl?: string | null;
    providerPayload?: Prisma.InputJsonValue;
  } = {},
) {
  const now = input.now ?? new Date();
  const payment = await client.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return null;
  }

  const transferReference = getTransferPaymentReference({
    transferId: payment.transferId,
    tariffCode: payment.tariffCode,
    providerPayload: payment.providerPayload,
  });
  const paymentTransferId = transferReference?.transferId ?? null;
  const placementValidUntil =
    (payment.propertyId || payment.excursionId || paymentTransferId) &&
    payment.placementValidUntil === null
      ? getPlacementValidUntil(now)
      : payment.placementValidUntil;

  const updated = await client.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.SUCCEEDED,
      paidAt: payment.paidAt ?? now,
      paidFrom: payment.paidFrom ?? payment.paidAt ?? payment.createdAt,
      placementValidUntil,
      canceledAt: null,
      ...(input.providerPaymentId !== undefined
        ? { providerPaymentId: input.providerPaymentId }
        : {}),
      ...(input.confirmationUrl !== undefined ? { confirmationUrl: input.confirmationUrl } : {}),
      ...(input.providerPayload !== undefined ? { providerPayload: input.providerPayload } : {}),
    },
  });

  if (payment.propertyId) {
    await syncPropertyPlacementFromPayment(client, updated, now);
    await autoSubmitPropertyAfterSuccessfulPayment(client, payment.propertyId);
    await client.property.updateMany({
      where: { id: payment.propertyId, status: PropertyStatus.PUBLISHED },
      data: { isPublishedVisible: true },
    });
  }

  if (payment.excursionId) {
    await autoSubmitExcursionAfterSuccessfulPayment(client, payment.excursionId);
    await client.excursion.updateMany({
      where: { id: payment.excursionId, status: ExcursionStatus.PUBLISHED },
      data: { isPublishedVisible: true },
    });
  }

  if (paymentTransferId) {
    await autoSubmitTransferAfterSuccessfulPayment(client, paymentTransferId);
    await client.transfer.updateMany({
      where: { id: paymentTransferId, status: TransferStatus.PUBLISHED },
      data: { isPublishedVisible: true },
    });
  }

  return updated;
}

export async function applyProviderPaymentStatus(
  client: DbClientLike,
  paymentId: string,
  nextStatus: PaymentStatus,
  input: {
    now?: Date;
    providerPaymentId?: string | null;
    confirmationUrl?: string | null;
    providerPayload?: Prisma.InputJsonValue;
  } = {},
) {
  if (nextStatus === PaymentStatus.SUCCEEDED) {
    return finalizeSuccessfulPayment(client, paymentId, input);
  }

  const now = input.now ?? new Date();
  const payment = await client.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return null;
  }

  const resolvedStatus = resolvePaymentStatusTransition(payment.status, nextStatus);
  return client.payment.update({
    where: { id: payment.id },
    data: {
      status: resolvedStatus,
      canceledAt:
        resolvedStatus === PaymentStatus.CANCELED && payment.canceledAt === null
          ? now
          : payment.canceledAt,
      ...(input.providerPaymentId !== undefined
        ? { providerPaymentId: input.providerPaymentId }
        : {}),
      ...(input.confirmationUrl !== undefined ? { confirmationUrl: input.confirmationUrl } : {}),
      ...(input.providerPayload !== undefined ? { providerPayload: input.providerPayload } : {}),
    },
  });
}

export function getOnlinePaymentProviders(): PaymentProvider[] {
  return [PaymentProvider.MANAGER, PaymentProvider.YOOKASSA];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getYooKassaPaymentIdFromPayload(providerPayload: Prisma.JsonValue | null): string | null {
  if (!isRecord(providerPayload) || !isRecord(providerPayload.yookassa)) {
    return null;
  }

  const id = providerPayload.yookassa.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function shouldSyncYooKassaPayment(payment: {
  status: PaymentStatus;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  providerPayload?: Prisma.JsonValue | null;
}): boolean {
  return (
    payment.provider === PaymentProvider.YOOKASSA &&
    isPaymentAwaitingCompletion(payment.status) &&
    Boolean(
      payment.providerPaymentId || getYooKassaPaymentIdFromPayload(payment.providerPayload ?? null),
    )
  );
}

export async function syncYooKassaPaymentStatus(
  client: DbClientLike,
  paymentId: string,
  input: {
    now?: Date;
  } = {},
) {
  const payment = await client.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment || !shouldSyncYooKassaPayment(payment) || !isYooKassaConfigured()) {
    return payment;
  }

  const providerPaymentId =
    payment.providerPaymentId ?? getYooKassaPaymentIdFromPayload(payment.providerPayload);

  if (!providerPaymentId) {
    return payment;
  }

  const yooPayment = await getYooKassaPayment(providerPaymentId);
  const providerPayload = mergeYooKassaPaymentPayload(payment.providerPayload, yooPayment);

  return applyProviderPaymentStatus(
    client,
    payment.id,
    mapYooKassaPaymentStatus(yooPayment.status),
    {
      now: input.now,
      providerPaymentId: yooPayment.id,
      confirmationUrl: yooPayment.confirmation?.confirmation_url ?? payment.confirmationUrl,
      providerPayload,
    },
  );
}

export async function syncOpenYooKassaPayments(
  client: DbClientLike,
  payments: Array<{
    id: string;
    status: PaymentStatus;
    provider: PaymentProvider;
    providerPaymentId: string | null;
    providerPayload?: Prisma.JsonValue | null;
  }>,
): Promise<boolean> {
  if (!isYooKassaConfigured()) {
    return false;
  }

  let synced = false;

  for (const payment of payments) {
    if (!shouldSyncYooKassaPayment(payment)) {
      continue;
    }

    try {
      const updated = await syncYooKassaPaymentStatus(client, payment.id);
      synced = synced || Boolean(updated);
    } catch (error) {
      console.error("Failed to sync YooKassa payment status", {
        paymentId: payment.id,
        error,
      });
    }
  }

  return synced;
}

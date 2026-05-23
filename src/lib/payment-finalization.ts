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
  resolvePaymentStatusTransition,
} from "@/lib/payments";
import {
  autoSubmitPropertyAfterSuccessfulPayment,
  syncPropertyPlacementFromPayment,
} from "@/lib/properties";
import { autoSubmitTransferAfterSuccessfulPayment } from "@/lib/transfers";

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

// API route handler for /api/payments/[id].
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { areDatabaseColumnsAvailable, db, type DbClientLike } from "@/lib/db";
import { autoSubmitExcursionAfterSuccessfulPayment } from "@/lib/excursions";
import {
  getPlacementValidUntil,
  getTransferPaymentReference,
  isPaymentAwaitingCompletion,
  mapYookassaStatus,
  resolvePaymentStatusTransition,
  serializePayment,
} from "@/lib/payments";
import { autoSubmitPropertyAfterSuccessfulPayment } from "@/lib/properties";
import {
  autoSubmitTransferAfterSuccessfulPayment,
  submitTransferToModerationIfReady,
} from "@/lib/transfers";
import { getYookassaPayment } from "@/lib/yookassa";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function autoSubmitTransferForPayment(
  client: DbClientLike,
  payment: {
    transferId?: string | null;
    tariffCode?: string | null;
    providerPayload?: unknown;
  },
) {
  const transferReference = getTransferPaymentReference({
    transferId: payment.transferId,
    tariffCode: payment.tariffCode,
    providerPayload: payment.providerPayload,
  });

  if (!transferReference) {
    return;
  }

  if (payment.transferId) {
    await autoSubmitTransferAfterSuccessfulPayment(client, payment.transferId);
    return;
  }

  await submitTransferToModerationIfReady(client, transferReference.transferId);
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const transferPaymentsSupported = await areDatabaseColumnsAvailable("Payment", ["transferId"]);

  let payment = await db.payment.findFirst({
    where: {
      id,
      ownerId: session.id,
    },
    include: {
      property: {
        select: {
          name: true,
          status: true,
          pendingEditStatus: true,
        },
      },
      excursion: {
        select: {
          title: true,
        },
      },
      ...(transferPaymentsSupported
        ? {
            transfer: {
              select: {
                title: true,
              },
            },
          }
        : {}),
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Платеж не найден" }, { status: 404 });
  }

  if (
    payment.provider === PaymentProvider.YOOKASSA &&
    payment.providerPaymentId &&
    isPaymentAwaitingCompletion(payment.status)
  ) {
    try {
      const external = await getYookassaPayment(payment.providerPaymentId);
      const nextStatus = resolvePaymentStatusTransition(
        payment.status,
        mapYookassaStatus(external.status),
      );

      const shouldUpdate =
        nextStatus !== payment.status ||
        payment.confirmationUrl !== (external.confirmation?.confirmation_url ?? null);

      if (shouldUpdate) {
        const currentPayment = payment;
        const placementValidUntil =
          currentPayment.placementValidUntil ??
          (nextStatus === PaymentStatus.SUCCEEDED && currentPayment.propertyId
            ? getPlacementValidUntil(new Date())
            : null);

        payment = await db.$transaction(async (tx) => {
          const updated = await tx.payment.update({
            where: { id: currentPayment.id },
            data: {
              status: nextStatus,
              confirmationUrl: external.confirmation?.confirmation_url ?? null,
              providerPayload: external,
              paidAt:
                nextStatus === PaymentStatus.SUCCEEDED
                  ? (currentPayment.paidAt ?? new Date())
                  : currentPayment.paidAt,
              canceledAt:
                nextStatus === PaymentStatus.CANCELED
                  ? (currentPayment.canceledAt ?? new Date())
                  : currentPayment.canceledAt,
              placementValidUntil,
            },
            include: {
              property: {
                select: {
                  name: true,
                  status: true,
                  pendingEditStatus: true,
                },
              },
              excursion: {
                select: {
                  title: true,
                },
              },
              ...(transferPaymentsSupported
                ? {
                    transfer: {
                      select: {
                        title: true,
                      },
                    },
                  }
                : {}),
            },
          });

          if (updated.status === PaymentStatus.SUCCEEDED && currentPayment.propertyId) {
            await autoSubmitPropertyAfterSuccessfulPayment(tx, currentPayment.propertyId);
          }
          if (updated.status === PaymentStatus.SUCCEEDED && currentPayment.excursionId) {
            await autoSubmitExcursionAfterSuccessfulPayment(tx, currentPayment.excursionId);
          }
          if (updated.status === PaymentStatus.SUCCEEDED) {
            await autoSubmitTransferForPayment(tx, currentPayment);
          }

          return updated;
        });
      } else if (nextStatus === PaymentStatus.SUCCEEDED && payment.propertyId) {
        await autoSubmitPropertyAfterSuccessfulPayment(db, payment.propertyId);
      } else if (nextStatus === PaymentStatus.SUCCEEDED && payment.excursionId) {
        await autoSubmitExcursionAfterSuccessfulPayment(db, payment.excursionId);
      } else if (nextStatus === PaymentStatus.SUCCEEDED) {
        await autoSubmitTransferForPayment(db, payment);
      }
    } catch (error) {
      console.error("Failed to refresh payment status from YooKassa", error);
    }
  }

  return NextResponse.json({ item: serializePayment(payment) });
}

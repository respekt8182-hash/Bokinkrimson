// API route handler for /api/payments/[id].
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getPlacementValidUntil,
  isPaymentAwaitingCompletion,
  mapYookassaStatus,
  resolvePaymentStatusTransition,
  serializePayment,
} from "@/lib/payments";
import { autoSubmitPropertyAfterSuccessfulPayment } from "@/lib/properties";
import { getYookassaPayment } from "@/lib/yookassa";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;

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
        const paymentId = currentPayment.id;
        const placementValidUntil =
          currentPayment.placementValidUntil ??
          (nextStatus === PaymentStatus.SUCCEEDED ? getPlacementValidUntil(new Date()) : null);

        payment = await db.$transaction(async (tx) => {
          const updated = await tx.payment.update({
            where: { id: paymentId },
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
            },
          });

          if (updated.status === PaymentStatus.SUCCEEDED) {
            await autoSubmitPropertyAfterSuccessfulPayment(tx, currentPayment.propertyId);
          }

          return updated;
        });
      } else if (nextStatus === PaymentStatus.SUCCEEDED) {
        await autoSubmitPropertyAfterSuccessfulPayment(db, payment.propertyId);
      }
    } catch (error) {
      console.error("Failed to refresh payment status from YooKassa", error);
    }
  }

  return NextResponse.json({ item: serializePayment(payment) });
}

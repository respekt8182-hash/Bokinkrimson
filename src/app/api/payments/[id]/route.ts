// API route handler for /api/payments/[id].
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { syncYooKassaPaymentStatus } from "@/lib/payment-finalization";
import { serializePayment } from "@/lib/payments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function buildPaymentInclude(transferPaymentsSupported: boolean) {
  return {
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
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const transferPaymentsSupported = await areDatabaseColumnsAvailable("Payment", ["transferId"]);
  const include = buildPaymentInclude(transferPaymentsSupported);

  let payment = await db.payment.findFirst({
    where: {
      id,
      ownerId: session.id,
    },
    include,
  });

  if (!payment) {
    return NextResponse.json({ error: "Платеж не найден" }, { status: 404 });
  }

  if (
    payment.provider === PaymentProvider.YOOKASSA &&
    (payment.status === PaymentStatus.CREATED || payment.status === PaymentStatus.PENDING)
  ) {
    const paymentId = payment.id;

    try {
      await syncYooKassaPaymentStatus(db, paymentId);
      payment = await db.payment.findFirst({
        where: {
          id,
          ownerId: session.id,
        },
        include,
      });
    } catch (error) {
      console.error("Failed to sync YooKassa payment status", {
        paymentId,
        error,
      });
    }
  }

  if (!payment) {
    return NextResponse.json({ error: "Платеж не найден" }, { status: 404 });
  }

  return NextResponse.json({ item: serializePayment(payment) });
}

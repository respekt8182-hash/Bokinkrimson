// API route handler for /api/payments/[id].
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { serializePayment } from "@/lib/payments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const transferPaymentsSupported = await areDatabaseColumnsAvailable("Payment", ["transferId"]);

  const payment = await db.payment.findFirst({
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

  return NextResponse.json({ item: serializePayment(payment) });
}

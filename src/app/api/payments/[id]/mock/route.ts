// API route handler for /api/payments/[id]/mock.
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getPlacementValidUntil,
  resolvePaymentStatusTransition,
  serializePayment,
} from "@/lib/payments";
import { autoSubmitPropertyAfterSuccessfulPayment } from "@/lib/properties";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const mockActionSchema = z.object({
  action: z.enum(["succeed", "cancel"]),
});

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await db.payment.findFirst({
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

  if (!existing) {
    return NextResponse.json({ error: "Платеж не найден" }, { status: 404 });
  }

  if (existing.provider !== PaymentProvider.MOCK) {
    return NextResponse.json(
      { error: "Эта операция доступна только для mock-платежей" },
      { status: 400 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = mockActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректное действие" }, { status: 400 });
  }

  const requestedStatus =
    parsed.data.action === "succeed" ? PaymentStatus.SUCCEEDED : PaymentStatus.CANCELED;
  const nextStatus = resolvePaymentStatusTransition(existing.status, requestedStatus);

  if (nextStatus === existing.status) {
    if (requestedStatus === PaymentStatus.SUCCEEDED) {
      await autoSubmitPropertyAfterSuccessfulPayment(db, existing.propertyId);
    }

    return NextResponse.json({ item: serializePayment(existing) });
  }

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.payment.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        paidAt:
          nextStatus === PaymentStatus.SUCCEEDED
            ? (existing.paidAt ?? new Date())
            : existing.paidAt,
        canceledAt:
          nextStatus === PaymentStatus.CANCELED
            ? (existing.canceledAt ?? new Date())
            : existing.canceledAt,
        placementValidUntil:
          nextStatus === PaymentStatus.SUCCEEDED
            ? (existing.placementValidUntil ?? getPlacementValidUntil(new Date()))
            : existing.placementValidUntil,
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

    if (next.status === PaymentStatus.SUCCEEDED) {
      await autoSubmitPropertyAfterSuccessfulPayment(tx, existing.propertyId);
    }

    return next;
  });

  return NextResponse.json({ item: serializePayment(updated) });
}

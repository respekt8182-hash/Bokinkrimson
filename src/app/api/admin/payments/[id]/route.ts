// Admin API: confirm or reject a manager payment request.
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminRelationUserId } from "@/lib/admin-user-reference";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { autoSubmitExcursionAfterSuccessfulPayment } from "@/lib/excursions";
import { getPlacementValidUntil, getTransferPaymentReference } from "@/lib/payments";
import { autoSubmitPropertyAfterSuccessfulPayment } from "@/lib/properties";
import { autoSubmitTransferAfterSuccessfulPayment } from "@/lib/transfers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const actionSchema = z.object({
  action: z.enum(["confirm", "reject"]),
  notes: z.string().max(2000).optional().default(""),
});

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;
  const transferPaymentsSupported = await areDatabaseColumnsAvailable("Payment", ["transferId"]);
  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      property: { select: { id: true, name: true, status: true } },
      excursion: { select: { id: true, title: true, status: true } },
      ...(transferPaymentsSupported
        ? { transfer: { select: { id: true, title: true, status: true } } }
        : {}),
      owner: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Платеж не найден" }, { status: 404 });
  }

  if (payment.provider !== PaymentProvider.MANAGER) {
    return NextResponse.json(
      { error: "Операция доступна только для платежей через менеджера" },
      { status: 400 },
    );
  }

  if (payment.status === PaymentStatus.SUCCEEDED) {
    return NextResponse.json({ error: "Платеж уже подтвержден" }, { status: 409 });
  }

  if (payment.status === PaymentStatus.CANCELED) {
    return NextResponse.json({ error: "Платеж уже отклонен" }, { status: 409 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const { action, notes } = parsed.data;
  const confirmedById = resolveAdminRelationUserId(admin.id);

  if (action === "confirm") {
    const now = new Date();
    const transferReference = getTransferPaymentReference({
      transferId: payment.transferId,
      tariffCode: payment.tariffCode,
      providerPayload: payment.providerPayload,
    });
    const paymentTransferId = transferReference?.transferId ?? null;
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          paidAt: now,
          placementValidUntil:
            (payment.propertyId || paymentTransferId) && payment.placementValidUntil === null
              ? getPlacementValidUntil(now)
              : payment.placementValidUntil,
          managerNotes: notes || null,
          confirmedById,
        },
      });

      if (payment.propertyId) {
        await autoSubmitPropertyAfterSuccessfulPayment(tx, payment.propertyId);
      }
      if (payment.excursionId) {
        await autoSubmitExcursionAfterSuccessfulPayment(tx, payment.excursionId);
      }
      if (paymentTransferId) {
        await autoSubmitTransferAfterSuccessfulPayment(tx, paymentTransferId);
      }

      await writeAdminAuditLog(tx, {
        adminUserId: admin.id,
        action: "payment_confirm",
        targetType: "payment",
        targetId: payment.id,
        details: {
          provider: payment.provider,
          previousStatus: payment.status,
          nextStatus: PaymentStatus.SUCCEEDED,
          notes,
          outcome: "confirmed",
        },
      });

      return result;
    });

    return NextResponse.json({
      ok: true,
      payment: {
        id: updated.id,
        status: updated.status,
        paidAt: updated.paidAt?.toISOString(),
      },
    });
  }

  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.CANCELED,
      canceledAt: new Date(),
      managerNotes: notes || null,
      confirmedById,
    },
  });

  await writeAdminAuditLog(db, {
    adminUserId: admin.id,
    action: "payment_reject",
    targetType: "payment",
    targetId: payment.id,
    details: {
      provider: payment.provider,
      previousStatus: payment.status,
      nextStatus: PaymentStatus.CANCELED,
      notes,
      outcome: "rejected",
    },
  });

  return NextResponse.json({ ok: true });
}

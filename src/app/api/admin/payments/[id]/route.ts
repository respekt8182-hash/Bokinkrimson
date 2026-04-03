// Admin API: confirm or reject a manager payment request.
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { getPlacementValidUntil } from "@/lib/payments";
import { autoSubmitPropertyAfterSuccessfulPayment } from "@/lib/properties";

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

  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      property: { select: { id: true, name: true, status: true } },
      excursion: { select: { id: true, title: true, status: true } },
      owner: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Платёж не найден" }, { status: 404 });
  }

  if (payment.provider !== PaymentProvider.MANAGER) {
    return NextResponse.json(
      { error: "Операция доступна только для платежей через менеджера" },
      { status: 400 },
    );
  }

  if (payment.status === PaymentStatus.SUCCEEDED) {
    return NextResponse.json({ error: "Платёж уже подтверждён" }, { status: 409 });
  }

  if (payment.status === PaymentStatus.CANCELED) {
    return NextResponse.json({ error: "Платёж уже отклонён" }, { status: 409 });
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

  if (action === "confirm") {
    const now = new Date();
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          paidAt: now,
          placementValidUntil: payment.placementValidUntil ?? getPlacementValidUntil(now),
          managerNotes: notes || null,
          confirmedById: admin.id,
        },
      });

      // Auto-submit property for moderation after successful payment
      if (payment.propertyId) {
        await autoSubmitPropertyAfterSuccessfulPayment(tx, payment.propertyId);
      }

      // For excursions: update status to PENDING_MODERATION if still DRAFT
      if (payment.excursionId) {
        const excursion = await tx.excursion.findUnique({
          where: { id: payment.excursionId },
          select: { status: true },
        });
        if (excursion && (excursion.status === "DRAFT" || excursion.status === "NEEDS_FIX" || excursion.status === "REJECTED")) {
          await tx.excursion.update({
            where: { id: payment.excursionId },
            data: { status: "PENDING_MODERATION" },
          });
        }
      }

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

  // action === "reject"
  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.CANCELED,
      canceledAt: new Date(),
      managerNotes: notes || null,
      confirmedById: admin.id,
    },
  });

  return NextResponse.json({ ok: true });
}

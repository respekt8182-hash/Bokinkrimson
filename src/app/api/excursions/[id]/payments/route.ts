// Owner excursion payment endpoint: creates payment for excursion placement.
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlacementValidUntil, serializePayment } from "@/lib/payments";
import { createYookassaPayment, isYookassaConfigured } from "@/lib/yookassa";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const EXCURSION_FEE = 1990;

const createPaymentSchema = z.object({
  provider: z.enum(["YOOKASSA", "MANAGER"]).optional().default("YOOKASSA"),
});

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const excursion = await db.excursion.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
  });

  if (!excursion || excursion.ownerId !== session.id) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  const payments = await db.payment.findMany({
    where: { excursionId: id, ownerId: session.id },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({
    items: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      provider: p.provider,
      statusLabel:
        p.provider === "MANAGER"
          ? p.status === "SUCCEEDED"
            ? "Подтверждена менеджером"
            : p.status === "CANCELED"
              ? "Отклонена"
              : "Ожидает подтверждения"
          : p.status === "SUCCEEDED"
            ? "Оплачено"
            : p.status === "CANCELED"
              ? "Отменено"
              : "В обработке",
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
    })),
    hasPaid: payments.some((p) => p.status === PaymentStatus.SUCCEEDED),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let body: z.infer<typeof createPaymentSchema> = { provider: "YOOKASSA" };
  try {
    const raw = await request.json();
    const parsed = createPaymentSchema.safeParse(raw);
    if (parsed.success) body = parsed.data;
  } catch {
    // defaults
  }

  const { id } = await context.params;
  const excursion = await db.excursion.findUnique({
    where: { id },
    select: { id: true, ownerId: true, title: true, status: true },
  });

  if (!excursion || excursion.ownerId !== session.id) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  // Check for already succeeded payment
  const existingSucceeded = await db.payment.findFirst({
    where: { excursionId: id, ownerId: session.id, status: PaymentStatus.SUCCEEDED },
  });
  if (existingSucceeded) {
    return NextResponse.json(
      { error: "Оплата уже прошла. Повторная оплата не требуется." },
      { status: 409 },
    );
  }

  // Check for open payment
  const existingOpen = await db.payment.findFirst({
    where: {
      excursionId: id,
      ownerId: session.id,
      status: { in: [PaymentStatus.CREATED, PaymentStatus.PENDING] },
    },
  });
  if (existingOpen) {
    return NextResponse.json(
      { error: "У вас уже есть незавершённый платёж по этой экскурсии" },
      { status: 409 },
    );
  }

  const idempotenceKey = crypto.randomUUID();

  // --- MANAGER flow ---
  if (body.provider === "MANAGER") {
    const created = await db.payment.create({
      data: {
        excursionId: excursion.id,
        ownerId: session.id,
        amount: EXCURSION_FEE,
        tariffCode: "excursion_standard",
        roomCount: 0,
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.MANAGER,
        idempotenceKey,
      },
    });

    return NextResponse.json({
      item: {
        id: created.id,
        status: created.status,
        provider: created.provider,
        amount: Number(created.amount),
      },
      managerRequested: true,
    });
  }

  // --- YOOKASSA flow ---
  if (isYookassaConfigured()) {
    const created = await db.payment.create({
      data: {
        excursionId: excursion.id,
        ownerId: session.id,
        amount: EXCURSION_FEE,
        tariffCode: "excursion_standard",
        roomCount: 0,
        status: PaymentStatus.CREATED,
        provider: PaymentProvider.YOOKASSA,
        idempotenceKey,
      },
    });

    try {
      const yooPayment = await createYookassaPayment({
        idempotenceKey,
        amountRub: EXCURSION_FEE,
        description: `Публикация экскурсии «${excursion.title ?? "Без названия"}»`,
        metadata: { paymentId: created.id, excursionId: excursion.id },
      });

      const updated = await db.payment.update({
        where: { id: created.id },
        data: {
          providerPaymentId: yooPayment.id,
          confirmationUrl: yooPayment.confirmation?.confirmation_url ?? null,
          providerPayload: yooPayment,
          status: PaymentStatus.PENDING,
        },
      });

      return NextResponse.json({
        item: {
          id: updated.id,
          status: updated.status,
          provider: updated.provider,
          amount: Number(updated.amount),
        },
        redirectUrl: yooPayment.confirmation?.confirmation_url ?? null,
      });
    } catch (error) {
      await db.payment.update({
        where: { id: created.id },
        data: { status: PaymentStatus.CANCELED, canceledAt: new Date() },
      });
      console.error("YooKassa excursion payment creation failed", error);
      return NextResponse.json(
        { error: "Не удалось создать платёж. Попробуйте позже или выберите оплату через менеджера." },
        { status: 502 },
      );
    }
  }

  // --- MOCK fallback ---
  const created = await db.payment.create({
    data: {
      excursionId: excursion.id,
      ownerId: session.id,
      amount: EXCURSION_FEE,
      tariffCode: "excursion_standard",
      roomCount: 0,
      status: PaymentStatus.CREATED,
      provider: PaymentProvider.MOCK,
      idempotenceKey,
    },
  });

  // Auto-succeed mock in dev
  const updated = await db.payment.update({
    where: { id: created.id },
    data: {
      status: PaymentStatus.SUCCEEDED,
      paidAt: new Date(),
      placementValidUntil: getPlacementValidUntil(new Date()),
    },
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      status: updated.status,
      provider: updated.provider,
      amount: Number(updated.amount),
    },
    mockSucceeded: true,
  });
}

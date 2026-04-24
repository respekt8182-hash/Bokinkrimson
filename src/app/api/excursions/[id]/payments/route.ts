// Owner excursion payment endpoint: returns payment history and creates new publication payment attempts.
import { ExcursionOfferType, PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializePayment } from "@/lib/payments";
import { ensurePaymentProviderAllowed } from "@/lib/payment-security";
import { EXCURSION_PUBLICATION_FEE_RUB } from "@/lib/site-tariffs";
import { createYookassaPayment, isYookassaConfigured } from "@/lib/yookassa";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const createPaymentSchema = z.object({
  provider: z.enum(["YOOKASSA", "MANAGER"]).optional().default("YOOKASSA"),
});

async function getOwnedExcursion(excursionId: string) {
  return db.excursion.findUnique({
    where: { id: excursionId },
    select: {
      id: true,
      ownerId: true,
      offerType: true,
      title: true,
      status: true,
      pendingEditStatus: true,
    },
  });
}

async function listExcursionPayments(excursionId: string, ownerId: string) {
  return db.payment.findMany({
    where: {
      excursionId,
      ownerId,
      provider: {
        in: [PaymentProvider.YOOKASSA, PaymentProvider.MANAGER],
      },
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      excursion: {
        select: {
          title: true,
        },
      },
    },
  });
}

function getOfferLabels(offerType: ExcursionOfferType) {
  if (offerType === ExcursionOfferType.TOUR) {
    return {
      genitive: "тура",
      prepositional: "туре",
    };
  }

  return {
    genitive: "экскурсии",
    prepositional: "экскурсии",
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const excursion = await getOwnedExcursion(id);

  if (!excursion || excursion.ownerId !== session.id) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  const payments = await listExcursionPayments(excursion.id, session.id);
  const latestOpenPayment =
    payments.find((item) => item.status === PaymentStatus.CREATED || item.status === PaymentStatus.PENDING) ??
    null;

  return NextResponse.json({
    status: excursion.status,
    pendingEditStatus: excursion.pendingEditStatus ?? null,
    items: payments.map(serializePayment),
    hasPaid: payments.some((item) => item.status === PaymentStatus.SUCCEEDED),
    hasPendingManagerPayment: latestOpenPayment?.provider === PaymentProvider.MANAGER,
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
    if (parsed.success) {
      body = parsed.data;
    }
  } catch {
    // Empty body is allowed.
  }

  try {
    ensurePaymentProviderAllowed(PaymentProvider[body.provider]);
  } catch {
    return NextResponse.json({ error: "Выбранный способ оплаты недоступен" }, { status: 403 });
  }

  const { id } = await context.params;
  const excursion = await getOwnedExcursion(id);

  if (!excursion || excursion.ownerId !== session.id) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  const payments = await listExcursionPayments(excursion.id, session.id);
  const existingSucceeded =
    payments.find((item) => item.status === PaymentStatus.SUCCEEDED) ?? null;
  if (existingSucceeded) {
    return NextResponse.json(
      {
        error: "Публикация уже оплачена. Повторная оплата не требуется.",
        item: serializePayment(existingSucceeded),
      },
      { status: 409 },
    );
  }

  const existingOpen =
    payments.find((item) => item.status === PaymentStatus.CREATED || item.status === PaymentStatus.PENDING) ??
    null;
  if (existingOpen) {
    return NextResponse.json(
      {
        error: `У вас уже есть незавершенный платеж по этой ${getOfferLabels(excursion.offerType).prepositional}.`,
        item: serializePayment(existingOpen),
      },
      { status: 409 },
    );
  }

  const idempotenceKey = crypto.randomUUID();
  const tariffCode =
    excursion.offerType === ExcursionOfferType.TOUR ? "tour_standard" : "excursion_standard";

  if (body.provider === "MANAGER") {
    const created = await db.payment.create({
      data: {
        excursionId: excursion.id,
        ownerId: session.id,
        amount: EXCURSION_PUBLICATION_FEE_RUB,
        tariffCode,
        roomCount: 0,
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.MANAGER,
        idempotenceKey,
      },
      include: {
        excursion: {
          select: {
            title: true,
          },
        },
      },
    });

    return NextResponse.json({
      item: serializePayment(created),
      managerRequested: true,
      redirectUrl: null,
    });
  }

  if (!isYookassaConfigured()) {
    return NextResponse.json(
      { error: "YooKassa временно недоступна. Используйте оплату через менеджера." },
      { status: 503 },
    );
  }

  const created = await db.payment.create({
    data: {
      excursionId: excursion.id,
      ownerId: session.id,
      amount: EXCURSION_PUBLICATION_FEE_RUB,
      tariffCode,
      roomCount: 0,
      status: PaymentStatus.CREATED,
      provider: PaymentProvider.YOOKASSA,
      idempotenceKey,
    },
    include: {
      excursion: {
        select: {
          title: true,
        },
      },
    },
  });

  try {
    const offerLabels = getOfferLabels(excursion.offerType);
    const yooPayment = await createYookassaPayment({
      idempotenceKey,
      amountRub: EXCURSION_PUBLICATION_FEE_RUB,
      description: `Публикация ${offerLabels.genitive} «${excursion.title ?? "Без названия"}»`,
      metadata: {
        paymentId: created.id,
        excursionId: excursion.id,
        offerType: excursion.offerType,
      },
    });

    const updated = await db.payment.update({
      where: { id: created.id },
      data: {
        providerPaymentId: yooPayment.id,
        confirmationUrl: yooPayment.confirmation?.confirmation_url ?? null,
        providerPayload: yooPayment,
        status: PaymentStatus.PENDING,
      },
      include: {
        excursion: {
          select: {
            title: true,
          },
        },
      },
    });

    return NextResponse.json({
      item: serializePayment(updated),
      redirectUrl: yooPayment.confirmation?.confirmation_url ?? null,
    });
  } catch (error) {
    await db.payment.update({
      where: { id: created.id },
      data: { status: PaymentStatus.CANCELED, canceledAt: new Date() },
    });

    console.error("YooKassa excursion payment creation failed", error);
    return NextResponse.json(
      { error: "Не удалось создать платеж. Попробуйте позже или выберите оплату через менеджера." },
      { status: 502 },
    );
  }
}

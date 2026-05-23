// Owner excursion payment endpoint: returns payment history and creates new publication payment attempts.
import { ExcursionOfferType, PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  buildFreePlacementPaymentPayload,
  buildPostLaunchTrialPaymentPayload,
  getProgramPlacementValidUntil,
  resolvePaymentPlacementValidUntil,
  serializePayment,
} from "@/lib/payments";
import { applyProviderPaymentStatus, getOnlinePaymentProviders } from "@/lib/payment-finalization";
import { buildPlacementPricingPayload, getPlacementPrice } from "@/lib/placement-pricing";
import {
  applyPlacementFreePeriodToPricing,
  buildPlacementPromoPayload,
  getPlacementPromoDemoValidUntil,
  getPlacementPromoPrice,
  getPostLaunchTrialValidUntil,
  isPostLaunchTrialEligible,
} from "@/lib/placement-promo";
import { EXCURSION_PUBLICATION_FEE_RUB, TOUR_PUBLICATION_FEE_RUB } from "@/lib/site-tariffs";
import { autoSubmitExcursionAfterSuccessfulPayment } from "@/lib/excursions";
import {
  buildAbsoluteAppUrl,
  buildYooKassaPaymentReceipt,
  buildYooKassaReceiptItemDescription,
  createYooKassaPayment,
  isYooKassaConfigured,
  mapYooKassaPaymentStatus,
  mergeYooKassaPaymentPayload,
  YooKassaApiError,
  YooKassaConfigurationError,
} from "@/lib/yookassa";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const createPaymentSchema = z.object({
  provider: z.enum(["MANAGER", "YOOKASSA"]).optional().default("MANAGER"),
  period: z.enum(["season", "year"]).optional().default("year"),
});

async function getOwnedExcursion(excursionId: string) {
  return db.excursion.findUnique({
    where: { id: excursionId },
    select: {
      id: true,
      ownerId: true,
      offerType: true,
      title: true,
      contactEmail: true,
      contactPhone: true,
      contactFirstName: true,
      contactLastName: true,
      createdAt: true,
      status: true,
      pendingEditStatus: true,
      owner: {
        select: { email: true, firstName: true, lastName: true, phone: true },
      },
    },
  });
}

async function listExcursionPayments(excursionId: string, ownerId: string) {
  return db.payment.findMany({
    where: {
      excursionId,
      ownerId,
      provider: {
        in: getOnlinePaymentProviders(),
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
  const now = new Date();
  const category = excursion.offerType === ExcursionOfferType.TOUR ? "tour" : "excursion";
  const trialUntil = isPostLaunchTrialEligible({
    listingCreatedAt: excursion.createdAt,
    now,
    hasSuccessfulPlacement: payments.some((item) => item.status === PaymentStatus.SUCCEEDED),
  })
    ? getPostLaunchTrialValidUntil(now)
    : null;
  const [baseYearPrice, baseSeasonPrice] = await Promise.all([
    getPlacementPrice({
      userId: session.id,
      category,
      period: "year",
      basePrice:
        excursion.offerType === ExcursionOfferType.TOUR
          ? TOUR_PUBLICATION_FEE_RUB
          : EXCURSION_PUBLICATION_FEE_RUB,
      now,
    }),
    getPlacementPrice({
      userId: session.id,
      category,
      period: "season",
      now,
    }),
  ]);
  const yearPrice = trialUntil
    ? applyPlacementFreePeriodToPricing(baseYearPrice, { validUntil: trialUntil })
    : baseYearPrice;
  const seasonPrice = trialUntil
    ? applyPlacementFreePeriodToPricing(baseSeasonPrice, { validUntil: trialUntil })
    : baseSeasonPrice;
  const latestOpenPayment =
    payments.find(
      (item) => item.status === PaymentStatus.CREATED || item.status === PaymentStatus.PENDING,
    ) ?? null;

  return NextResponse.json({
    status: excursion.status,
    pendingEditStatus: excursion.pendingEditStatus ?? null,
    items: payments.map(serializePayment),
    hasPaid: payments.some(
      (item) =>
        item.status === PaymentStatus.SUCCEEDED &&
        resolvePaymentPlacementValidUntil(item).getTime() > now.getTime(),
    ),
    hasPendingManagerPayment: latestOpenPayment?.provider === PaymentProvider.MANAGER,
    hasPendingOnlinePayment: latestOpenPayment?.provider === PaymentProvider.YOOKASSA,
    quote: yearPrice,
    availablePrices: [seasonPrice, yearPrice],
    onlinePaymentAvailable: isYooKassaConfigured(),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let body: z.infer<typeof createPaymentSchema> = { provider: "MANAGER", period: "year" };
  try {
    const raw = await request.json();
    const parsed = createPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Выберите доступный способ оплаты." }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    // Empty body is allowed.
  }

  const { id } = await context.params;
  const excursion = await getOwnedExcursion(id);

  if (!excursion || excursion.ownerId !== session.id) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  const payments = await listExcursionPayments(excursion.id, session.id);
  const now = new Date();
  const existingSucceeded =
    payments.find(
      (item) =>
        item.status === PaymentStatus.SUCCEEDED &&
        resolvePaymentPlacementValidUntil(item).getTime() > now.getTime(),
    ) ?? null;
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
    payments.find(
      (item) => item.status === PaymentStatus.CREATED || item.status === PaymentStatus.PENDING,
    ) ?? null;
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
  const category = excursion.offerType === ExcursionOfferType.TOUR ? "tour" : "excursion";
  const tariffCode =
    body.period === "season"
      ? excursion.offerType === ExcursionOfferType.TOUR
        ? "tour_season"
        : "excursion_season"
      : excursion.offerType === ExcursionOfferType.TOUR
        ? "tour_year"
        : "excursion_year";
  const trialUntil = isPostLaunchTrialEligible({
    listingCreatedAt: excursion.createdAt,
    now,
    hasSuccessfulPlacement: payments.some((item) => item.status === PaymentStatus.SUCCEEDED),
  })
    ? getPostLaunchTrialValidUntil(now)
    : null;
  const basePlacementPricing = await getPlacementPrice({
    userId: session.id,
    category,
    period: body.period,
    basePrice:
      body.period === "year"
        ? excursion.offerType === ExcursionOfferType.TOUR
          ? TOUR_PUBLICATION_FEE_RUB
          : EXCURSION_PUBLICATION_FEE_RUB
        : undefined,
    now,
  });
  const placementPricing = trialUntil
    ? applyPlacementFreePeriodToPricing(basePlacementPricing, { validUntil: trialUntil })
    : basePlacementPricing;
  const publicationPrice = getPlacementPromoPrice(placementPricing.totalPrice, now);
  const amount = placementPricing.freePeriodActive ? 0 : publicationPrice.finalAmountRub;
  const placementPromo = buildPlacementPromoPayload({
    originalAmountRub: publicationPrice.originalAmountRub,
    discountedAmountRub: amount,
  });
  const paidFrom = now;
  const paidUntil = getProgramPlacementValidUntil(body.period, now);
  const tariffLabel = body.period === "season" ? "Сезон" : "Годовое размещение";
  const serviceLabel =
    excursion.offerType === ExcursionOfferType.TOUR
      ? "Размещение тура на сайте Крым Вокруг"
      : "Размещение экскурсии на сайте Крым Вокруг";
  const receiptItemDescription = buildYooKassaReceiptItemDescription({
    serviceLabel,
    listingName: excursion.title,
    tariffLabel,
    paidFrom,
    paidUntil,
  });

  if (amount <= 0) {
    const created = await db.payment.create({
      data: {
        excursionId: excursion.id,
        ownerId: session.id,
        amount: 0,
        tariffCode,
        roomCount: 0,
        status: PaymentStatus.SUCCEEDED,
        provider: PaymentProvider.MANAGER,
        idempotenceKey,
        confirmationUrl: null,
        paidFrom: now,
        paidAt: now,
        placementValidUntil: trialUntil ?? getPlacementPromoDemoValidUntil(),
        providerPayload: trialUntil
          ? buildPostLaunchTrialPaymentPayload({
              originalAmountRub: publicationPrice.originalAmountRub,
              now,
              validUntil: trialUntil,
              placementPricing,
            })
          : buildFreePlacementPaymentPayload({
              originalAmountRub: publicationPrice.originalAmountRub,
              now,
              placementPricing,
            }),
      },
      include: {
        excursion: {
          select: {
            title: true,
          },
        },
      },
    });

    await autoSubmitExcursionAfterSuccessfulPayment(db, excursion.id);

    return NextResponse.json({
      item: serializePayment(created),
      managerRequested: false,
      redirectUrl: null,
      freePlacementGranted: true,
    });
  }

  const created = await db.payment.create({
    data: {
      excursionId: excursion.id,
      ownerId: session.id,
      amount,
      tariffCode,
      roomCount: 0,
      status: body.provider === "YOOKASSA" ? PaymentStatus.CREATED : PaymentStatus.PENDING,
      provider: body.provider === "YOOKASSA" ? PaymentProvider.YOOKASSA : PaymentProvider.MANAGER,
      idempotenceKey,
      confirmationUrl: null,
      paidFrom,
      placementValidUntil: paidUntil,
      providerPayload: {
        ...(placementPromo ? { placementPromo } : {}),
        ...buildPlacementPricingPayload(placementPricing),
      },
    },
    include: {
      excursion: {
        select: {
          title: true,
        },
      },
    },
  });

  if (body.provider === "YOOKASSA") {
    if (!isYooKassaConfigured()) {
      await db.payment.update({
        where: { id: created.id },
        data: { status: PaymentStatus.CANCELED, canceledAt: new Date() },
      });
      return NextResponse.json(
        { error: "Онлайн-оплата временно недоступна. Выберите оплату через менеджера." },
        { status: 503 },
      );
    }

    try {
      const yooPayment = await createYooKassaPayment({
        amountRub: amount,
        idempotenceKey,
        description: receiptItemDescription,
        returnUrl: buildAbsoluteAppUrl(`/dashboard/excursions/${excursion.id}`),
        metadata: {
          local_payment_id: created.id,
          entity_type: excursion.offerType === ExcursionOfferType.TOUR ? "tour" : "excursion",
          excursion_id: excursion.id,
          owner_id: session.id,
          tariff_code: tariffCode,
          tariff_label: tariffLabel,
          paid_from: paidFrom.toISOString(),
          paid_until: paidUntil.toISOString(),
        },
        receipt: buildYooKassaPaymentReceipt({
          amountRub: amount,
          itemDescription: receiptItemDescription,
          customer: {
            email: excursion.contactEmail ?? excursion.owner.email,
            phone: excursion.contactPhone ?? excursion.owner.phone ?? session.phone,
            fullName:
              [excursion.contactFirstName, excursion.contactLastName].filter(Boolean).join(" ") ||
              `${excursion.owner.firstName} ${excursion.owner.lastName}`,
          },
        }),
      });
      const providerPayload = mergeYooKassaPaymentPayload(created.providerPayload, yooPayment);
      const updated = await applyProviderPaymentStatus(
        db,
        created.id,
        mapYooKassaPaymentStatus(yooPayment.status),
        {
          providerPaymentId: yooPayment.id,
          confirmationUrl: yooPayment.confirmation?.confirmation_url ?? null,
          providerPayload,
        },
      );

      return NextResponse.json({
        item: serializePayment(updated ?? created),
        managerRequested: false,
        redirectUrl: yooPayment.confirmation?.confirmation_url ?? null,
      });
    } catch (error) {
      await db.payment.update({
        where: { id: created.id },
        data: { status: PaymentStatus.CANCELED, canceledAt: new Date() },
      });

      const isConfigurationError = error instanceof YooKassaConfigurationError;
      const isApiError = error instanceof YooKassaApiError;
      return NextResponse.json(
        {
          error: isConfigurationError
            ? "Онлайн-оплата временно недоступна. Выберите оплату через менеджера."
            : isApiError
              ? "YooKassa не приняла платеж. Проверьте настройки магазина или выберите оплату через менеджера."
              : "Не удалось создать онлайн-платеж. Выберите оплату через менеджера.",
        },
        { status: isConfigurationError ? 503 : 502 },
      );
    }
  }

  return NextResponse.json({
    item: serializePayment(created),
    managerRequested: true,
    redirectUrl: null,
  });
}

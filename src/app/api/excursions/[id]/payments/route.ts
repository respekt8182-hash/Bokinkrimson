// Owner excursion payment endpoint: returns payment history and creates new publication payment attempts.
import { ExcursionOfferType, PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  buildFreePlacementPaymentPayload,
  buildPostLaunchTrialPaymentPayload,
  resolvePaymentPlacementValidUntil,
  serializePayment,
} from "@/lib/payments";
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

type RouteContext = {
  params: Promise<{ id: string }>;
};

const createPaymentSchema = z.object({
  provider: z.literal("MANAGER").optional().default("MANAGER"),
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
      createdAt: true,
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
        in: [PaymentProvider.MANAGER],
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
    quote: yearPrice,
    availablePrices: [seasonPrice, yearPrice],
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
      return NextResponse.json({ error: "Онлайн-оплата отключена. Используйте заявку менеджеру." }, { status: 400 });
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
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.MANAGER,
      idempotenceKey,
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

  return NextResponse.json({
    item: serializePayment(created),
    managerRequested: true,
    redirectUrl: null,
  });
}

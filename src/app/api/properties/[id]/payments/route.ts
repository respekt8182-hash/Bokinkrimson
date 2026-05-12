// Owner property payment endpoint: returns readiness/history and creates new placement payment attempts.
import { ObjectTariffType, PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  buildFreePlacementPaymentPayload,
  buildPostLaunchTrialPaymentPayload,
  getPlacementCoverageState,
  serializePayment,
} from "@/lib/payments";
import { getPersonalTariffQuote } from "@/lib/personal-tariff-quote";
import { buildPlacementPricingPayload } from "@/lib/placement-pricing";
import {
  buildPlacementPromoPayload,
  getPlacementPromoDemoValidUntil,
  getPostLaunchTrialValidUntil,
  isPostLaunchTrialEligible,
} from "@/lib/placement-promo";
import {
  getPropertyPaymentReadinessIssues,
  getPropertyProgress,
  autoSubmitPropertyAfterSuccessfulPayment,
  purgeExpiredPropertyDraftsForOwner,
  syncPropertyPlacementFromPayment,
} from "@/lib/properties";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getOwnedPropertyForPayment(propertyId: string) {
  return db.property.findUnique({
    where: { id: propertyId },
    include: {
      media: {
        where: { roomId: null },
        select: { id: true, type: true, url: true, sortOrder: true },
      },
      rooms: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          prices: {
            select: { id: true },
          },
        },
      },
      amenities: {
        include: { amenity: true },
      },
      customAmenities: {
        select: { name: true },
      },
    },
  });
}

async function buildReadiness(
  property: NonNullable<Awaited<ReturnType<typeof getOwnedPropertyForPayment>>>,
  ownerId: string,
  tariffType?: string | null,
  freeTrialUntil?: Date | null,
) {
  const progress = getPropertyProgress(property);
  const roomCount = property.rooms.length;
  const issues = getPropertyPaymentReadinessIssues(property.id, progress).map((issue) =>
    issue.id === "chessboard-pricing"
      ? {
          ...issue,
          href: `/dashboard/chessboard?propertyId=${encodeURIComponent(property.id)}&from=payment`,
        }
      : issue,
  );
  const reasons = issues.map((issue) => issue.reason);

  return {
    ready: issues.length === 0,
    reasons,
    issues,
    progressStep: progress.lastCompletedStep,
    roomCount,
    quote:
      roomCount > 0
        ? await getPersonalTariffQuote({
            userId: ownerId,
            roomCount,
            propertyType: property.type,
            tariffType,
            freeTrialUntil,
          })
        : null,
  };
}

function toPrismaObjectTariffType(tariffType: string): ObjectTariffType {
  switch (tariffType) {
    case "season":
      return ObjectTariffType.SEASON;
    case "offseason":
      return ObjectTariffType.OFFSEASON;
    case "yearly":
      return ObjectTariffType.YEARLY;
    default:
      return ObjectTariffType.YEARLY;
  }
}

async function listPropertyPayments(propertyId: string, ownerId: string) {
  return db.payment.findMany({
    where: {
      propertyId,
      ownerId,
      provider: {
        in: [PaymentProvider.MANAGER],
      },
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      property: {
        select: { name: true },
      },
    },
  });
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  await purgeExpiredPropertyDraftsForOwner(db, session.id);

  const { id } = await context.params;
  const property = await getOwnedPropertyForPayment(id);

  if (!property || property.ownerId !== session.id || property.ownerDeletedAt) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const payments = await listPropertyPayments(property.id, session.id);
  const { searchParams } = new URL(request.url);
  const freeTrialUntil = isPostLaunchTrialEligible({
    listingCreatedAt: property.createdAt,
    hasSuccessfulPlacement: payments.some((item) => item.status === PaymentStatus.SUCCEEDED),
  })
    ? getPostLaunchTrialValidUntil()
    : null;
  const readiness = await buildReadiness(
    property,
    session.id,
    searchParams.get("tariffType"),
    freeTrialUntil,
  );
  const placement = getPlacementCoverageState({
    payments,
    quote: readiness.quote,
  });

  return NextResponse.json({
    readiness,
    status: property.status,
    pendingEditStatus: property.pendingEditStatus,
    moderationNotes: property.moderationNotes,
    placement,
    items: payments.map(serializePayment),
  });
}

const createPaymentSchema = z.object({
  provider: z.literal("MANAGER").optional().default("MANAGER"),
  tariffType: z.enum(["season", "offseason", "yearly"]).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let body: z.infer<typeof createPaymentSchema> = { provider: "MANAGER" };
  try {
    const raw = await request.json();
    const parsed = createPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Онлайн-оплата отключена. Используйте заявку менеджеру." }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    // Empty body is fine.
  }

  await purgeExpiredPropertyDraftsForOwner(db, session.id);

  const { id } = await context.params;
  const property = await getOwnedPropertyForPayment(id);

  if (!property || property.ownerId !== session.id || property.ownerDeletedAt) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const payments = await listPropertyPayments(property.id, session.id);
  const now = new Date();
  const freeTrialUntil = isPostLaunchTrialEligible({
    listingCreatedAt: property.createdAt,
    now,
    hasSuccessfulPlacement: payments.some((item) => item.status === PaymentStatus.SUCCEEDED),
  })
    ? getPostLaunchTrialValidUntil(now)
    : null;
  const readiness = await buildReadiness(property, session.id, body.tariffType, freeTrialUntil);

  if (!readiness.ready || !readiness.quote) {
    return NextResponse.json(
      {
        error: "Объект пока не готов к оплате",
        readiness,
      },
      { status: 400 },
    );
  }

  const placement = getPlacementCoverageState({
    payments,
    quote: readiness.quote,
  });

  if (placement.hasActivePlacement && placement.fullyCovered) {
    return NextResponse.json(
      {
        error:
          "Размещение уже оплачено на текущий период. Повторная оплата не требуется: отправьте объект на модерацию.",
        paidUntil: placement.paidUntil,
      },
      { status: 409 },
    );
  }

  const amount = placement.hasActivePlacement
    ? placement.requiredPaymentAmount
    : readiness.quote.amount;
  const originalAmount = placement.hasActivePlacement
    ? placement.requiredOriginalPaymentAmount
    : readiness.quote.originalAmount;

  const latestOpenPayment =
    payments.find(
      (item) => item.status === PaymentStatus.CREATED || item.status === PaymentStatus.PENDING,
    ) ?? null;

  if (latestOpenPayment) {
    return NextResponse.json(
      {
        error: "У вас уже есть незавершенный платеж по этому объекту",
        item: serializePayment(latestOpenPayment),
      },
      { status: 409 },
    );
  }

  if (amount <= 0) {
    const now = new Date();
    const created = await db.payment.create({
      data: {
        propertyId: property.id,
        ownerId: session.id,
        amount: 0,
        tariffCode: "object_demo",
        tariffType: ObjectTariffType.DEMO,
        roomCount: readiness.quote.roomCount,
        status: PaymentStatus.SUCCEEDED,
        provider: PaymentProvider.MANAGER,
        idempotenceKey: crypto.randomUUID(),
        confirmationUrl: null,
        paidFrom: now,
        paidAt: now,
        placementValidUntil: freeTrialUntil ?? getPlacementPromoDemoValidUntil(),
        providerPayload: freeTrialUntil
          ? buildPostLaunchTrialPaymentPayload({
              originalAmountRub: originalAmount,
              now,
              validUntil: freeTrialUntil,
              placementPricing: readiness.quote.placementPricing,
            })
          : buildFreePlacementPaymentPayload({
              originalAmountRub: originalAmount,
              now,
              placementPricing: readiness.quote.placementPricing,
            }),
      },
      include: {
        property: { select: { name: true } },
      },
    });

    await syncPropertyPlacementFromPayment(db, created, now);
    await autoSubmitPropertyAfterSuccessfulPayment(db, property.id);

    return NextResponse.json({
      item: serializePayment(created),
      redirectUrl: null,
      freePlacementGranted: true,
    });
  }

  const placementPromo = buildPlacementPromoPayload({
    originalAmountRub: originalAmount,
    discountedAmountRub: Number(amount),
  });

  const idempotenceKey = crypto.randomUUID();
  const paidFrom = new Date(readiness.quote.paidFrom);
  const paidUntil = new Date(readiness.quote.paidUntil);
  const selectedTariffType = toPrismaObjectTariffType(readiness.quote.tariffType);

  const created = await db.payment.create({
    data: {
      propertyId: property.id,
      ownerId: session.id,
      amount,
      tariffCode: readiness.quote.tariff.code,
      tariffType: selectedTariffType,
      roomCount: readiness.quote.roomCount,
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.MANAGER,
      idempotenceKey,
      confirmationUrl: null,
      paidFrom,
      placementValidUntil: paidUntil,
      providerPayload: {
        ...(placementPromo ? { placementPromo } : {}),
        ...(readiness.quote.placementPricing
          ? buildPlacementPricingPayload(readiness.quote.placementPricing)
          : {}),
      },
    },
    include: {
      property: { select: { name: true } },
    },
  });

  return NextResponse.json({
    item: serializePayment(created),
    redirectUrl: null,
    managerRequested: true,
  });
}

// Owner property payment endpoint: returns readiness/history and creates new placement payment attempts.
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getPlacementCoverageState,
  getTariffQuote,
  serializePayment,
} from "@/lib/payments";
import {
  getPropertyPaymentReadinessIssues,
  getPropertyProgress,
  purgeExpiredPropertyDraftsForOwner,
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

function buildReadiness(property: NonNullable<Awaited<ReturnType<typeof getOwnedPropertyForPayment>>>) {
  const progress = getPropertyProgress(property);
  const roomCount = property.rooms.length;
  const issues = getPropertyPaymentReadinessIssues(property.id, progress);
  const reasons = issues.map((issue) => issue.reason);

  return {
    ready: issues.length === 0,
    reasons,
    issues,
    progressStep: progress.lastCompletedStep,
    roomCount,
    quote:
      roomCount > 0
        ? getTariffQuote({
            roomCount,
            propertyType: property.type,
          })
        : null,
  };
}

async function listPropertyPayments(propertyId: string, ownerId: string) {
  return db.payment.findMany({
    where: {
      propertyId,
      ownerId,
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      property: {
        select: { name: true },
      },
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
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
  const readiness = buildReadiness(property);
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

export async function POST(_request: Request, context: RouteContext) {
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

  const readiness = buildReadiness(property);

  if (!readiness.ready || !readiness.quote) {
    return NextResponse.json(
      {
        error: "Объект пока не готов к оплате",
        readiness,
      },
      { status: 400 },
    );
  }

  const payments = await listPropertyPayments(property.id, session.id);
  const latestOpenPayment = payments.find(
    (item) => item.status === PaymentStatus.CREATED || item.status === PaymentStatus.PENDING,
  );

  if (latestOpenPayment) {
    return NextResponse.json(
      {
        error: "У вас уже есть незавершенный платеж по этому объекту",
        item: serializePayment(latestOpenPayment),
      },
      { status: 409 },
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

  const created = await db.payment.create({
    data: {
      propertyId: property.id,
      ownerId: session.id,
      amount,
      tariffCode: readiness.quote.tariff.code,
      roomCount: readiness.quote.roomCount,
      status: PaymentStatus.CREATED,
      provider: PaymentProvider.MOCK,
      idempotenceKey: crypto.randomUUID(),
      confirmationUrl: null,
      placementValidUntil: placement.paidUntil ? new Date(placement.paidUntil) : null,
    },
    include: {
      property: {
        select: { name: true },
      },
    },
  });

  return NextResponse.json({
    item: serializePayment(created),
    redirectUrl: null,
  });
}

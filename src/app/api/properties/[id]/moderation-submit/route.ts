// Owner moderation-submit endpoint: enforces readiness + active paid placement before moving object to moderation.
import { PaymentProvider, PaymentStatus, PropertyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  buildFreePlacementPaymentPayload,
  getPlacementCoverageState,
  getTariffQuote,
  serializePayment,
} from "@/lib/payments";
import { getPlacementPromoDemoValidUntil } from "@/lib/placement-promo";
import {
  getPropertyPaymentReadinessIssues,
  getPropertyProgress,
  getPropertyWorkflowStatusLabel,
  normalizePropertyWorkflowStatus,
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

function buildReadiness(
  property: NonNullable<Awaited<ReturnType<typeof getOwnedPropertyForPayment>>>,
) {
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

function canSubmitInitialModeration(status: PropertyStatus): boolean {
  const normalizedStatus = normalizePropertyWorkflowStatus(status);
  return normalizedStatus === PropertyStatus.DRAFT || normalizedStatus === PropertyStatus.REJECTED;
}

function canSubmitPublishedEdit(status: PropertyStatus | null): boolean {
  if (!status) {
    return false;
  }

  const normalizedStatus = normalizePropertyWorkflowStatus(status);
  return normalizedStatus === PropertyStatus.DRAFT || normalizedStatus === PropertyStatus.REJECTED;
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
        error: "Объект пока не готов к отправке на модерацию",
        readiness,
      },
      { status: 400 },
    );
  }

  let payments = await db.payment.findMany({
    where: {
      propertyId: property.id,
      ownerId: session.id,
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      property: {
        select: { name: true },
      },
    },
  });
  let placement = getPlacementCoverageState({
    payments,
    quote: readiness.quote,
  });
  const freePlacementAvailable = placement.fullyCovered && readiness.quote.amount <= 0;

  if (!placement.hasActivePlacement && freePlacementAvailable) {
    const now = new Date();
    const freePayment = await db.payment.create({
      data: {
        propertyId: property.id,
        ownerId: session.id,
        amount: 0,
        tariffCode: readiness.quote.tariff.code,
        roomCount: readiness.quote.roomCount,
        status: PaymentStatus.SUCCEEDED,
        provider: PaymentProvider.MANAGER,
        idempotenceKey: crypto.randomUUID(),
        confirmationUrl: null,
        paidAt: now,
        placementValidUntil: getPlacementPromoDemoValidUntil(),
        providerPayload: buildFreePlacementPaymentPayload({
          originalAmountRub: readiness.quote.originalAmount,
          now,
        }),
      },
      include: {
        property: {
          select: { name: true },
        },
      },
    });

    payments = [freePayment, ...payments];
    placement = getPlacementCoverageState({
      payments,
      quote: readiness.quote,
    });
  }

  if (!placement.hasActivePlacement && !freePlacementAvailable) {
    return NextResponse.json(
      {
        error: "Сначала оплатите размещение, чтобы отправить объект на модерацию",
        readiness,
      },
      { status: 400 },
    );
  }

  if (!placement.fullyCovered) {
    return NextResponse.json(
      {
        error:
          "Для текущего количества номеров нужна доплата. Оплатите разницу по тарифу и после этого отправьте объект на модерацию.",
        requiredPaymentAmount: placement.requiredPaymentAmount,
        paidUntil: placement.paidUntil,
      },
      { status: 400 },
    );
  }

  if (property.status === PropertyStatus.PUBLISHED) {
    if (!property.pendingEditStatus) {
      return NextResponse.json(
        { error: "Сначала внесите изменения в опубликованную карточку объекта" },
        { status: 400 },
      );
    }

    if (!canSubmitPublishedEdit(property.pendingEditStatus)) {
      return NextResponse.json(
        {
          error: `Нельзя отправить изменения на модерацию в текущем статусе: ${getPropertyWorkflowStatusLabel(property.status, property.moderationNotes, property.pendingEditStatus)}`,
        },
        { status: 400 },
      );
    }

    const updated = await db.property.update({
      where: { id: property.id },
      data: {
        pendingEditStatus: PropertyStatus.PENDING_MODERATION,
        moderationNotes: null,
        moderatedById: null,
        moderatedAt: null,
      },
      select: {
        id: true,
        status: true,
        pendingEditStatus: true,
        moderationNotes: true,
        moderatedById: true,
        moderatedAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      item: {
        id: updated.id,
        status: updated.status,
        pendingEditStatus: updated.pendingEditStatus,
        statusLabel: getPropertyWorkflowStatusLabel(
          updated.status,
          updated.moderationNotes,
          updated.pendingEditStatus,
        ),
        moderationNotes: updated.moderationNotes,
        moderatedById: updated.moderatedById,
        moderatedAt: updated.moderatedAt ? updated.moderatedAt.toISOString() : null,
        updatedAt: updated.updatedAt.toISOString(),
      },
      paidUntil: placement.paidUntil,
      lastPaidItem: payments[0] ? serializePayment(payments[0]) : null,
    });
  }

  if (!canSubmitInitialModeration(property.status)) {
    return NextResponse.json(
      {
        error: `Нельзя отправить объект на модерацию в текущем статусе: ${getPropertyWorkflowStatusLabel(property.status, property.moderationNotes, property.pendingEditStatus ?? null)}`,
      },
      { status: 400 },
    );
  }

  const updated = await db.property.update({
    where: { id: property.id },
    data: {
      status: PropertyStatus.PENDING_MODERATION,
      moderationNotes: null,
      moderatedById: null,
      moderatedAt: null,
    },
    select: {
      id: true,
      status: true,
      pendingEditStatus: true,
      moderationNotes: true,
      moderatedById: true,
      moderatedAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      status: updated.status,
      pendingEditStatus: updated.pendingEditStatus,
      statusLabel: getPropertyWorkflowStatusLabel(
        updated.status,
        updated.moderationNotes,
        updated.pendingEditStatus,
      ),
      moderationNotes: updated.moderationNotes,
      moderatedById: updated.moderatedById,
      moderatedAt: updated.moderatedAt ? updated.moderatedAt.toISOString() : null,
      updatedAt: updated.updatedAt.toISOString(),
    },
    paidUntil: placement.paidUntil,
    lastPaidItem: payments[0] ? serializePayment(payments[0]) : null,
  });
}

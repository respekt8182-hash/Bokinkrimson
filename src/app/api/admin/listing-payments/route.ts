import {
  ExcursionOfferType,
  ExcursionStatus,
  ObjectTariffType,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  PropertyStatus,
  TransferStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminRelationUserId } from "@/lib/admin-user-reference";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { autoSubmitExcursionAfterSuccessfulPayment } from "@/lib/excursions";
import { OBJECT_TARIFF_CODES, type ObjectPlacementTariffType } from "@/lib/object-placement-tariffs";
import { getPersonalTariffQuote } from "@/lib/personal-tariff-quote";
import {
  buildTransferPaymentPayload,
  getPlacementValidUntil,
  getTransferPaymentTariffCode,
  serializePayment,
} from "@/lib/payments";
import { getPlacementPromoPrice } from "@/lib/placement-promo";
import { buildPlacementPricingPayload, getPlacementPrice } from "@/lib/placement-pricing";
import {
  autoSubmitPropertyAfterSuccessfulPayment,
  syncPropertyPlacementFromPayment,
} from "@/lib/properties";
import { autoSubmitTransferAfterSuccessfulPayment, getTransferFleet } from "@/lib/transfers";

const manualListingPaymentSchema = z.object({
  entityType: z.enum(["property", "excursion", "transfer"]),
  entityId: z.string().trim().min(1),
  tariff: z.enum(["season", "offseason", "yearly", "year"]).default("year"),
  notes: z.string().trim().max(2000).optional().default(""),
});

function toPrismaObjectTariffType(tariffType: ObjectPlacementTariffType): ObjectTariffType {
  switch (tariffType) {
    case "season":
      return ObjectTariffType.SEASON;
    case "offseason":
      return ObjectTariffType.OFFSEASON;
    case "yearly":
      return ObjectTariffType.YEARLY;
  }
}

function getSeasonPlacementValidUntil(now: Date): Date {
  const year = now.getMonth() <= 9 ? now.getFullYear() : now.getFullYear() + 1;
  return new Date(year, 9, 31, 23, 59, 59, 999);
}

function getProgramPlacementValidUntil(period: "season" | "year", now: Date): Date {
  return period === "season" ? getSeasonPlacementValidUntil(now) : getPlacementValidUntil(now);
}

async function createPropertyPayment(input: {
  propertyId: string;
  tariff: "season" | "offseason" | "yearly";
  notes: string;
  confirmedById: string | null;
  adminId: string;
  now: Date;
}) {
  const property = await db.property.findUnique({
    where: { id: input.propertyId },
    select: {
      id: true,
      ownerId: true,
      type: true,
      name: true,
      status: true,
      rooms: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const quote = await getPersonalTariffQuote({
    userId: property.ownerId,
    roomCount: Math.max(1, property.rooms.length),
    propertyType: property.type,
    tariffType: input.tariff,
    now: input.now,
  });

  const payment = await db.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        propertyId: property.id,
        ownerId: property.ownerId,
        amount: new Prisma.Decimal(quote.amount),
        tariffCode: OBJECT_TARIFF_CODES[quote.tariffType],
        tariffType: toPrismaObjectTariffType(quote.tariffType),
        roomCount: quote.roomCount,
        status: PaymentStatus.SUCCEEDED,
        provider: PaymentProvider.MANAGER,
        idempotenceKey: crypto.randomUUID(),
        confirmationUrl: null,
        paidAt: input.now,
        paidFrom: new Date(quote.paidFrom),
        placementValidUntil: new Date(quote.paidUntil),
        managerNotes: input.notes || null,
        confirmedById: input.confirmedById,
        providerPayload: {
          adminManualPayment: true,
          ...(quote.placementPricing ? buildPlacementPricingPayload(quote.placementPricing) : {}),
        },
      },
      include: {
        property: { select: { name: true } },
      },
    });

    await syncPropertyPlacementFromPayment(tx, created, input.now);
    await autoSubmitPropertyAfterSuccessfulPayment(tx, property.id);

    if (property.status === PropertyStatus.PUBLISHED) {
      await tx.property.update({
        where: { id: property.id },
        data: { isPublishedVisible: true },
      });
    }

    await writeAdminAuditLog(tx, {
      adminUserId: input.adminId,
      action: "listing_payment_confirm",
      targetType: "property",
      targetId: property.id,
      details: {
        paymentId: created.id,
        tariff: input.tariff,
        amount: Number(created.amount),
        notes: input.notes || null,
      },
    });

    return created;
  });

  return NextResponse.json({ ok: true, payment: serializePayment(payment) });
}

async function createExcursionPayment(input: {
  excursionId: string;
  period: "season" | "year";
  notes: string;
  confirmedById: string | null;
  adminId: string;
  now: Date;
}) {
  const excursion = await db.excursion.findUnique({
    where: { id: input.excursionId },
    select: {
      id: true,
      ownerId: true,
      offerType: true,
      title: true,
      status: true,
    },
  });

  if (!excursion) {
    return NextResponse.json({ error: "Экскурсия или тур не найдены" }, { status: 404 });
  }

  const category = excursion.offerType === ExcursionOfferType.TOUR ? "tour" : "excursion";
  const placementPricing = await getPlacementPrice({
    userId: excursion.ownerId,
    category,
    period: input.period,
    now: input.now,
  });
  const promoPrice = getPlacementPromoPrice(placementPricing.totalPrice, input.now);
  const tariffCode =
    input.period === "season"
      ? excursion.offerType === ExcursionOfferType.TOUR
        ? "tour_season"
        : "excursion_season"
      : excursion.offerType === ExcursionOfferType.TOUR
        ? "tour_year"
        : "excursion_year";

  const payment = await db.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        excursionId: excursion.id,
        ownerId: excursion.ownerId,
        amount: new Prisma.Decimal(promoPrice.finalAmountRub),
        tariffCode,
        roomCount: 0,
        status: PaymentStatus.SUCCEEDED,
        provider: PaymentProvider.MANAGER,
        idempotenceKey: crypto.randomUUID(),
        confirmationUrl: null,
        paidAt: input.now,
        paidFrom: input.now,
        placementValidUntil: getProgramPlacementValidUntil(input.period, input.now),
        managerNotes: input.notes || null,
        confirmedById: input.confirmedById,
        providerPayload: {
          adminManualPayment: true,
          ...buildPlacementPricingPayload(placementPricing),
        },
      },
      include: {
        excursion: { select: { title: true } },
      },
    });

    await autoSubmitExcursionAfterSuccessfulPayment(tx, excursion.id);

    if (excursion.status === ExcursionStatus.PUBLISHED) {
      await tx.excursion.update({
        where: { id: excursion.id },
        data: { isPublishedVisible: true },
      });
    }

    await writeAdminAuditLog(tx, {
      adminUserId: input.adminId,
      action: "listing_payment_confirm",
      targetType: "excursion",
      targetId: excursion.id,
      details: {
        paymentId: created.id,
        period: input.period,
        amount: Number(created.amount),
        notes: input.notes || null,
      },
    });

    return created;
  });

  return NextResponse.json({ ok: true, payment: serializePayment(payment) });
}

async function createTransferPayment(input: {
  transferId: string;
  period: "season" | "year";
  notes: string;
  confirmedById: string | null;
  adminId: string;
  now: Date;
}) {
  const transferPaymentsSupported = await areDatabaseColumnsAvailable("Payment", ["transferId"]);
  const transfer = await db.transfer.findUnique({
    where: { id: input.transferId },
    select: {
      id: true,
      ownerId: true,
      title: true,
      status: true,
      fleet: true,
      photoUrls: true,
      priceUnitLabel: true,
    },
  });

  if (!transfer) {
    return NextResponse.json({ error: "Трансфер не найден" }, { status: 404 });
  }

  const fleet = getTransferFleet(transfer);
  const vehicleCount = Math.max(1, fleet.length);
  const placementPricing = await getPlacementPrice({
    userId: transfer.ownerId,
    category: "transfer",
    period: input.period,
    additionalOptions: { additionalCars: Math.max(0, vehicleCount - 1) },
    now: input.now,
  });
  const promoPrice = getPlacementPromoPrice(placementPricing.totalPrice, input.now);
  const transferPaymentPayload = buildTransferPaymentPayload({
    transferId: transfer.id,
    transferTitle: transfer.title,
    paymentReason: "publication",
    vehicleCount,
    totalAmountRub: promoPrice.finalAmountRub,
    coveredAmountRub: 0,
    requiredAmountRub: promoPrice.finalAmountRub,
  });
  const tariffCode = transferPaymentsSupported ? "transfer_standard" : getTransferPaymentTariffCode(transfer.id);

  const payment = await db.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        ...(transferPaymentsSupported ? { transferId: transfer.id } : {}),
        ownerId: transfer.ownerId,
        amount: new Prisma.Decimal(promoPrice.finalAmountRub),
        tariffCode,
        roomCount: vehicleCount,
        status: PaymentStatus.SUCCEEDED,
        provider: PaymentProvider.MANAGER,
        idempotenceKey: crypto.randomUUID(),
        confirmationUrl: null,
        paidAt: input.now,
        paidFrom: input.now,
        placementValidUntil: getProgramPlacementValidUntil(input.period, input.now),
        managerNotes: input.notes || null,
        confirmedById: input.confirmedById,
        providerPayload: {
          adminManualPayment: true,
          ...transferPaymentPayload,
          ...buildPlacementPricingPayload(placementPricing),
        },
      },
      include: {
        ...(transferPaymentsSupported ? { transfer: { select: { title: true } } } : {}),
      },
    });

    await autoSubmitTransferAfterSuccessfulPayment(tx, transfer.id);

    if (transfer.status === TransferStatus.PUBLISHED) {
      await tx.transfer.update({
        where: { id: transfer.id },
        data: { isPublishedVisible: true },
      });
    }

    await writeAdminAuditLog(tx, {
      adminUserId: input.adminId,
      action: "listing_payment_confirm",
      targetType: "transfer",
      targetId: transfer.id,
      details: {
        paymentId: created.id,
        period: input.period,
        amount: Number(created.amount),
        notes: input.notes || null,
      },
    });

    return created;
  });

  return NextResponse.json({ ok: true, payment: serializePayment(payment) });
}

export async function POST(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = manualListingPaymentSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные оплаты" }, { status: 400 });
  }

  const confirmedById = resolveAdminRelationUserId(admin.id);
  const now = new Date();
  const notes = parsed.data.notes;

  if (parsed.data.entityType === "property") {
    const tariff =
      parsed.data.tariff === "season" || parsed.data.tariff === "offseason"
        ? parsed.data.tariff
        : "yearly";

    return createPropertyPayment({
      propertyId: parsed.data.entityId,
      tariff,
      notes,
      confirmedById,
      adminId: admin.id,
      now,
    });
  }

  const period = parsed.data.tariff === "season" ? "season" : "year";

  if (parsed.data.entityType === "excursion") {
    return createExcursionPayment({
      excursionId: parsed.data.entityId,
      period,
      notes,
      confirmedById,
      adminId: admin.id,
      now,
    });
  }

  return createTransferPayment({
    transferId: parsed.data.entityId,
    period,
    notes,
    confirmedById,
    adminId: admin.id,
    now,
  });
}

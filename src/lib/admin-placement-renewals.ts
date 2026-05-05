import {
  ExcursionOfferType,
  ExcursionStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  PropertyStatus,
  TransferStatus,
} from "@prisma/client";
import { areDatabaseColumnsAvailable, db, type DbClientLike } from "@/lib/db";
import {
  PLACEMENT_PROMO_DEMO_RENEWAL_LOOKAHEAD_DAYS,
  isFreePlacementDemoPayload,
} from "@/lib/placement-promo";
import {
  getTransferPaymentReference,
  getTransferPaymentTariffCode,
  resolvePaymentPlacementValidUntil,
} from "@/lib/payments";
import { buildPublicExcursionPath } from "@/lib/public-excursions";
import { buildPublicTransferPath } from "@/lib/public-marketplace";
import { buildPublicPropertyPath } from "@/lib/public-properties";

export const DEFAULT_PLACEMENT_RENEWAL_LOOKAHEAD_DAYS = 30;
export const PLACEMENT_RENEWAL_LOOKAHEAD_OPTIONS = [7, 30, 60, 90] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const renewalPaymentSelect = Prisma.validator<Prisma.PaymentSelect>()({
  id: true,
  amount: true,
  tariffCode: true,
  roomCount: true,
  provider: true,
  providerPayload: true,
  paidAt: true,
  createdAt: true,
  placementValidUntil: true,
});

const successfulRealPaymentWhere = Prisma.validator<Prisma.PaymentWhereInput>()({
  status: PaymentStatus.SUCCEEDED,
  provider: { not: PaymentProvider.MOCK },
});

const renewalPropertySelect = Prisma.validator<Prisma.PropertySelect>()({
  id: true,
  name: true,
  type: true,
  locationId: true,
  locationName: true,
  address: true,
  phone: true,
  phoneName: true,
  phone2: true,
  phone2Name: true,
  phone3: true,
  phone3Name: true,
  contactPersonName: true,
  contactEmail: true,
  websiteUrl: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    },
  },
  payments: {
    where: successfulRealPaymentWhere,
    orderBy: [{ placementValidUntil: "desc" }, { paidAt: "desc" }, { createdAt: "desc" }],
    select: renewalPaymentSelect,
  },
});

const renewalExcursionSelect = Prisma.validator<Prisma.ExcursionSelect>()({
  id: true,
  offerType: true,
  title: true,
  locationId: true,
  locationName: true,
  contactFirstName: true,
  contactLastName: true,
  contactPhone: true,
  contactPhone2: true,
  contactEmail: true,
  websiteUrl: true,
  updatedAt: true,
  anchorLocation: {
    select: {
      slug: true,
      name: true,
    },
  },
  mainLocation: {
    select: {
      name: true,
    },
  },
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    },
  },
  payments: {
    where: successfulRealPaymentWhere,
    orderBy: [{ placementValidUntil: "desc" }, { paidAt: "desc" }, { createdAt: "desc" }],
    select: renewalPaymentSelect,
  },
});

const renewalTransferBaseSelect = Prisma.validator<Prisma.TransferSelect>()({
  id: true,
  title: true,
  transferType: true,
  locationName: true,
  contactName: true,
  phone: true,
  phone2: true,
  websiteUrl: true,
  updatedAt: true,
  location: {
    select: {
      name: true,
    },
  },
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    },
  },
});

const renewalTransferSelect = Prisma.validator<Prisma.TransferSelect>()({
  ...renewalTransferBaseSelect,
  payments: {
    where: successfulRealPaymentWhere,
    orderBy: [{ placementValidUntil: "desc" }, { paidAt: "desc" }, { createdAt: "desc" }],
    select: renewalPaymentSelect,
  },
});

export type PlacementRenewalEntityType = "property" | "excursion" | "tour" | "transfer";

export type PlacementRenewalPayment = Prisma.PaymentGetPayload<{
  select: typeof renewalPaymentSelect;
}>;

type RenewalPropertyRow = Prisma.PropertyGetPayload<{ select: typeof renewalPropertySelect }>;
type RenewalExcursionRow = Prisma.ExcursionGetPayload<{ select: typeof renewalExcursionSelect }>;
type RenewalTransferBaseRow = Prisma.TransferGetPayload<{
  select: typeof renewalTransferBaseSelect;
}>;
type RenewalTransferRow = Prisma.TransferGetPayload<{ select: typeof renewalTransferSelect }>;

type LatestPlacementPayment<TPayment extends PlacementRenewalPaymentLike> = {
  payment: TPayment;
  validUntil: Date;
};

export type PlacementRenewalPaymentLike = {
  paidAt: Date | null;
  createdAt: Date;
  placementValidUntil?: Date | null;
  providerPayload?: Prisma.JsonValue | null;
};

export type PlacementRenewalTiming = {
  daysLeft: number;
  inWindow: boolean;
};

export type PlacementRenewalContactPhone = {
  label: string;
  phone: string;
};

export type AdminPlacementRenewalItem = {
  id: string;
  entityType: PlacementRenewalEntityType;
  entityLabel: string;
  title: string;
  subtitle: string | null;
  locationName: string | null;
  owner: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  };
  contactName: string | null;
  contactEmail: string | null;
  contactPhones: PlacementRenewalContactPhone[];
  websiteUrl: string | null;
  adminHref: string;
  publicHref: string;
  payment: {
    id: string;
    amount: number;
    tariffCode: string;
    roomCount: number;
    provider: PaymentProvider;
    paidAt: Date | null;
    createdAt: Date;
    isDemo: boolean;
  };
  validUntil: Date;
  daysLeft: number;
  updatedAt: Date;
};

export function parsePlacementRenewalLookaheadDays(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);

  return PLACEMENT_RENEWAL_LOOKAHEAD_OPTIONS.includes(
    parsed as (typeof PLACEMENT_RENEWAL_LOOKAHEAD_OPTIONS)[number],
  )
    ? parsed
    : DEFAULT_PLACEMENT_RENEWAL_LOOKAHEAD_DAYS;
}

export function addPlacementRenewalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getPlacementRenewalTiming(input: {
  validUntil: Date;
  now: Date;
  lookaheadDays?: number;
}): PlacementRenewalTiming {
  const lookaheadDays = input.lookaheadDays ?? DEFAULT_PLACEMENT_RENEWAL_LOOKAHEAD_DAYS;
  const windowEnd = addPlacementRenewalDays(input.now, lookaheadDays);
  const msLeft = input.validUntil.getTime() - input.now.getTime();

  return {
    daysLeft: Math.ceil(msLeft / DAY_MS),
    inWindow:
      input.validUntil.getTime() >= input.now.getTime() &&
      input.validUntil.getTime() <= windowEnd.getTime(),
  };
}

export function getLatestPlacementPayment<TPayment extends PlacementRenewalPaymentLike>(
  payments: readonly TPayment[],
): LatestPlacementPayment<TPayment> | null {
  let latest: LatestPlacementPayment<TPayment> | null = null;

  for (const payment of payments) {
    const validUntil = resolvePaymentPlacementValidUntil(payment);
    if (!latest) {
      latest = { payment, validUntil };
      continue;
    }

    const validityDiff = validUntil.getTime() - latest.validUntil.getTime();
    if (validityDiff > 0) {
      latest = { payment, validUntil };
      continue;
    }

    if (validityDiff < 0) {
      continue;
    }

    const paymentAnchor = payment.paidAt ?? payment.createdAt;
    const latestAnchor = latest.payment.paidAt ?? latest.payment.createdAt;
    if (paymentAnchor.getTime() > latestAnchor.getTime()) {
      latest = { payment, validUntil };
    }
  }

  return latest;
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function compactStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;

    const key = trimmed.replace(/\D/g, "") || trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function ownerName(owner: { firstName: string; lastName: string }): string {
  return compactStrings([owner.firstName, owner.lastName]).join(" ") || "Владелец без имени";
}

function contactName(...values: Array<string | null | undefined>): string | null {
  return compactStrings(values).join(" ") || null;
}

function mapPhones(
  items: Array<{ label: string; phone: string | null | undefined }>,
): PlacementRenewalContactPhone[] {
  const seen = new Set<string>();
  const result: PlacementRenewalContactPhone[] = [];

  for (const item of items) {
    const phone = item.phone?.trim();
    if (!phone) continue;

    const key = phone.replace(/\D/g, "") || phone.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push({ label: item.label, phone });
  }

  return result;
}

function paymentSummary(payment: PlacementRenewalPayment) {
  return {
    id: payment.id,
    amount: Number(payment.amount),
    tariffCode: payment.tariffCode,
    roomCount: payment.roomCount,
    provider: payment.provider,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    isDemo: isFreePlacementDemoPayload(payment.providerPayload),
  };
}

function getRenewalTimingForLatest(input: {
  latest: LatestPlacementPayment<PlacementRenewalPayment>;
  now: Date;
  lookaheadDays: number;
}): PlacementRenewalTiming {
  const isDemo = isFreePlacementDemoPayload(input.latest.payment.providerPayload);

  return getPlacementRenewalTiming({
    validUntil: input.latest.validUntil,
    now: input.now,
    lookaheadDays: isDemo
      ? PLACEMENT_PROMO_DEMO_RENEWAL_LOOKAHEAD_DAYS
      : input.lookaheadDays,
  });
}

function createPropertyRenewalItem(input: {
  row: RenewalPropertyRow;
  latest: LatestPlacementPayment<PlacementRenewalPayment>;
  now: Date;
  lookaheadDays: number;
}): AdminPlacementRenewalItem | null {
  const timing = getRenewalTimingForLatest(input);

  if (!timing.inWindow) {
    return null;
  }

  const row = input.row;
  const owner = ownerName(row.owner);

  return {
    id: row.id,
    entityType: "property",
    entityLabel: "Жильё",
    title: row.name?.trim() || "Жильё без названия",
    subtitle: row.type?.trim() || row.address?.trim() || null,
    locationName: trimToNull(row.locationName),
    owner: {
      id: row.owner.id,
      name: owner,
      phone: row.owner.phone,
      email: trimToNull(row.owner.email),
    },
    contactName: trimToNull(row.contactPersonName),
    contactEmail: trimToNull(row.contactEmail) ?? trimToNull(row.owner.email),
    contactPhones: mapPhones([
      { label: row.phoneName?.trim() || "Телефон объявления", phone: row.phone },
      { label: row.phone2Name?.trim() || "Доп. телефон", phone: row.phone2 },
      { label: row.phone3Name?.trim() || "Доп. телефон", phone: row.phone3 },
    ]),
    websiteUrl: trimToNull(row.websiteUrl),
    adminHref: `/admin/objects/${row.id}`,
    publicHref: buildPublicPropertyPath({
      id: row.id,
      locationId: row.locationId,
      name: row.name,
    }),
    payment: paymentSummary(input.latest.payment),
    validUntil: input.latest.validUntil,
    daysLeft: timing.daysLeft,
    updatedAt: row.updatedAt,
  };
}

function createExcursionRenewalItem(input: {
  row: RenewalExcursionRow;
  latest: LatestPlacementPayment<PlacementRenewalPayment>;
  now: Date;
  lookaheadDays: number;
}): AdminPlacementRenewalItem | null {
  const timing = getRenewalTimingForLatest(input);

  if (!timing.inWindow) {
    return null;
  }

  const row = input.row;
  const isTour = row.offerType === ExcursionOfferType.TOUR;
  const organizerName = contactName(row.contactFirstName, row.contactLastName);

  return {
    id: row.id,
    entityType: isTour ? "tour" : "excursion",
    entityLabel: isTour ? "Тур" : "Экскурсия",
    title: row.title?.trim() || (isTour ? "Тур без названия" : "Экскурсия без названия"),
    subtitle: organizerName,
    locationName:
      trimToNull(row.anchorLocation?.name) ??
      trimToNull(row.mainLocation?.name) ??
      trimToNull(row.locationName),
    owner: {
      id: row.owner.id,
      name: ownerName(row.owner),
      phone: row.owner.phone,
      email: trimToNull(row.owner.email),
    },
    contactName: organizerName,
    contactEmail: trimToNull(row.contactEmail) ?? trimToNull(row.owner.email),
    contactPhones: mapPhones([
      { label: "Телефон программы", phone: row.contactPhone },
      { label: "Доп. телефон", phone: row.contactPhone2 },
    ]),
    websiteUrl: trimToNull(row.websiteUrl),
    adminHref: `/admin/excursions/${row.id}`,
    publicHref: buildPublicExcursionPath({
      id: row.id,
      locationId: row.locationId,
      title: row.title,
      anchorLocationSlug: row.anchorLocation?.slug ?? null,
    }),
    payment: paymentSummary(input.latest.payment),
    validUntil: input.latest.validUntil,
    daysLeft: timing.daysLeft,
    updatedAt: row.updatedAt,
  };
}

function createTransferRenewalItem(input: {
  row: RenewalTransferBaseRow;
  latest: LatestPlacementPayment<PlacementRenewalPayment>;
  now: Date;
  lookaheadDays: number;
}): AdminPlacementRenewalItem | null {
  const timing = getRenewalTimingForLatest(input);

  if (!timing.inWindow) {
    return null;
  }

  const row = input.row;

  return {
    id: row.id,
    entityType: "transfer",
    entityLabel: "Трансфер",
    title: row.title?.trim() || "Трансфер без названия",
    subtitle: row.transferType?.trim() || null,
    locationName: trimToNull(row.location?.name) ?? trimToNull(row.locationName),
    owner: {
      id: row.owner.id,
      name: ownerName(row.owner),
      phone: row.owner.phone,
      email: trimToNull(row.owner.email),
    },
    contactName: trimToNull(row.contactName),
    contactEmail: trimToNull(row.owner.email),
    contactPhones: mapPhones([
      { label: "Телефон трансфера", phone: row.phone },
      { label: "Доп. телефон", phone: row.phone2 },
    ]),
    websiteUrl: trimToNull(row.websiteUrl),
    adminHref: `/admin/transfers/${row.id}`,
    publicHref: buildPublicTransferPath({ id: row.id, title: row.title }),
    payment: paymentSummary(input.latest.payment),
    validUntil: input.latest.validUntil,
    daysLeft: timing.daysLeft,
    updatedAt: row.updatedAt,
  };
}

function groupLegacyTransferPayments(
  payments: readonly PlacementRenewalPayment[],
): Map<string, PlacementRenewalPayment[]> {
  const byTransferId = new Map<string, PlacementRenewalPayment[]>();

  for (const payment of payments) {
    const reference = getTransferPaymentReference({
      tariffCode: payment.tariffCode,
      providerPayload: payment.providerPayload,
    });

    if (!reference) continue;

    const current = byTransferId.get(reference.transferId) ?? [];
    current.push(payment);
    byTransferId.set(reference.transferId, current);
  }

  return byTransferId;
}

export async function getAdminPlacementRenewals(input?: {
  now?: Date;
  lookaheadDays?: number;
  client?: DbClientLike;
}): Promise<AdminPlacementRenewalItem[]> {
  const now = input?.now ?? new Date();
  const lookaheadDays = input?.lookaheadDays ?? DEFAULT_PLACEMENT_RENEWAL_LOOKAHEAD_DAYS;
  const client = input?.client ?? db;
  const transferPaymentsSupported = await areDatabaseColumnsAvailable("Payment", ["transferId"]);
  const transferPaymentTariffPrefix = getTransferPaymentTariffCode("");

  const [properties, excursions] = await Promise.all([
    client.property.findMany({
      where: {
        status: PropertyStatus.PUBLISHED,
        isPublishedVisible: true,
        ownerDeletedAt: null,
        owner: { deletedAt: null },
        payments: { some: successfulRealPaymentWhere },
      },
      select: renewalPropertySelect,
      orderBy: [{ updatedAt: "desc" }],
    }),
    client.excursion.findMany({
      where: {
        status: ExcursionStatus.PUBLISHED,
        isPublishedVisible: true,
        deletedAt: null,
        owner: { deletedAt: null },
        payments: { some: successfulRealPaymentWhere },
      },
      select: renewalExcursionSelect,
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  const transfers = transferPaymentsSupported
    ? await client.transfer.findMany({
        where: {
          status: TransferStatus.PUBLISHED,
          isPublishedVisible: true,
          owner: { deletedAt: null },
          payments: { some: successfulRealPaymentWhere },
        },
        select: renewalTransferSelect,
        orderBy: [{ updatedAt: "desc" }],
      })
    : await client.transfer.findMany({
        where: {
          status: TransferStatus.PUBLISHED,
          isPublishedVisible: true,
          owner: { deletedAt: null },
        },
        select: renewalTransferBaseSelect,
        orderBy: [{ updatedAt: "desc" }],
      });
  const legacyTransferPaymentsById = transferPaymentsSupported
    ? new Map<string, PlacementRenewalPayment[]>()
    : groupLegacyTransferPayments(
        await client.payment.findMany({
          where: {
            ...successfulRealPaymentWhere,
            tariffCode: { startsWith: transferPaymentTariffPrefix },
          },
          select: renewalPaymentSelect,
          orderBy: [{ placementValidUntil: "desc" }, { paidAt: "desc" }, { createdAt: "desc" }],
        }),
      );

  const items = [
    ...properties
      .map((row) => {
        const latest = getLatestPlacementPayment(row.payments);
        return latest ? createPropertyRenewalItem({ row, latest, now, lookaheadDays }) : null;
      })
      .filter((item): item is AdminPlacementRenewalItem => item !== null),
    ...excursions
      .map((row) => {
        const latest = getLatestPlacementPayment(row.payments);
        return latest ? createExcursionRenewalItem({ row, latest, now, lookaheadDays }) : null;
      })
      .filter((item): item is AdminPlacementRenewalItem => item !== null),
    ...transfers
      .map((row) => {
        const payments = transferPaymentsSupported
          ? (row as RenewalTransferRow).payments
          : (legacyTransferPaymentsById.get(row.id) ?? []);
        const latest = getLatestPlacementPayment(payments);
        return latest ? createTransferRenewalItem({ row, latest, now, lookaheadDays }) : null;
      })
      .filter((item): item is AdminPlacementRenewalItem => item !== null),
  ];

  return items.sort((left, right) => {
    const byValidUntil = left.validUntil.getTime() - right.validUntil.getTime();
    if (byValidUntil !== 0) return byValidUntil;
    return left.title.localeCompare(right.title, "ru");
  });
}

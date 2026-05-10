import {
  ExcursionStatus,
  ObjectPaymentStatus,
  PaymentProvider,
  PaymentStatus,
  PropertyStatus,
  TransferStatus,
  type Prisma,
} from "@prisma/client";

export function buildPublishedPropertyVisibilityWhere(now = new Date()): Prisma.PropertyWhereInput {
  return {
    status: PropertyStatus.PUBLISHED,
    isPublishedVisible: true,
    OR: [
      {
        paymentStatus: {
          in: [ObjectPaymentStatus.PAID, ObjectPaymentStatus.DEMO],
        },
        paidUntil: { gt: now },
        OR: [{ paidFrom: null }, { paidFrom: { lte: now } }],
      },
      {
        payments: {
          some: {
            status: PaymentStatus.SUCCEEDED,
            provider: { not: PaymentProvider.MOCK },
            placementValidUntil: { gt: now },
          },
        },
      },
    ],
    ownerDeletedAt: null,
    owner: {
      is: {
        deletedAt: null,
      },
    },
  };
}

export function buildPublicCatalogPropertyVisibilityWhere(
  now = new Date(),
): Prisma.PropertyWhereInput {
  return {
    AND: [
      buildPublishedPropertyVisibilityWhere(now),
      {
        NOT: {
          id: {
            startsWith: "demo_property_",
          },
        },
      },
    ],
  };
}

export function buildPublishedExcursionVisibilityWhere(): Prisma.ExcursionWhereInput {
  return {
    status: ExcursionStatus.PUBLISHED,
    isPublishedVisible: true,
    deletedAt: null,
    owner: {
      is: {
        deletedAt: null,
      },
    },
  };
}

export function buildPublicCatalogExcursionVisibilityWhere(): Prisma.ExcursionWhereInput {
  return {
    AND: [
      buildPublishedExcursionVisibilityWhere(),
      {
        NOT: [
          {
            id: {
              startsWith: "demo_excursion_",
            },
          },
          {
            id: {
              startsWith: "demo_tour_",
            },
          },
        ],
      },
    ],
  };
}

export function buildPublishedTransferVisibilityWhere(): Prisma.TransferWhereInput {
  return {
    status: TransferStatus.PUBLISHED,
    isPublishedVisible: true,
    owner: {
      is: {
        deletedAt: null,
      },
    },
  };
}

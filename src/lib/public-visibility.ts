import { ExcursionStatus, PropertyStatus, TransferStatus, type Prisma } from "@prisma/client";

export function buildPublishedPropertyVisibilityWhere(): Prisma.PropertyWhereInput {
  return {
    status: PropertyStatus.PUBLISHED,
    isPublishedVisible: true,
    ownerDeletedAt: null,
    owner: {
      is: {
        deletedAt: null,
      },
    },
  };
}

export function buildPublicCatalogPropertyVisibilityWhere(
  _now = new Date(),
): Prisma.PropertyWhereInput {
  void _now;

  return {
    AND: [
      buildPublishedPropertyVisibilityWhere(),
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

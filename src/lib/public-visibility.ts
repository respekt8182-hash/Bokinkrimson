import {
  ExcursionStatus,
  PropertyStatus,
  TransferStatus,
  type Prisma,
} from "@prisma/client";

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

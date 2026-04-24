import {
  ExcursionStatus,
  PropertyStatus,
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

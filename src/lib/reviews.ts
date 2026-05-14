// Domain/service module for reviews.
import { Prisma, ReviewEntityType, ReviewReactionValue, ReviewStatus } from "@prisma/client";
import type { DbTransactionClient } from "@/lib/db";
import { formatPublicPersonName } from "@/lib/public-display-name";

export const PUBLIC_REVIEWS_PAGE_SIZE = 5;

export type SerializedReview = {
  id: string;
  entityType: ReviewEntityType;
  propertyId: string | null;
  excursionId: string | null;
  transferId: string | null;
  userId: string | null;
  userName: string;
  userAvatarUrl: string | null;
  rating: number;
  text: string;
  isImported: boolean;
  importedAuthorName: string | null;
  externalSourceUrl: string | null;
  externalSourceName: string | null;
  verifiedAt: string | null;
  guestCity: string | null;
  reviewedAt: string | null;
  likesCount: number;
  dislikesCount: number;
  currentUserReaction: ReviewReactionValue | null;
  ownerReply: string | null;
  ownerRepliedAt: string | null;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export function serializeReview(review: {
  id: string;
  entityType: ReviewEntityType;
  propertyId: string | null;
  excursionId: string | null;
  transferId?: string | null;
  userId: string | null;
  rating: Prisma.Decimal | number;
  text: string;
  isImported?: boolean | null;
  importedAuthorName?: string | null;
  externalSourceUrl?: string | null;
  externalSourceName?: string | null;
  verifiedAt?: Date | null;
  guestCity?: string | null;
  reviewedAt?: Date | null;
  likesCount?: number | null;
  dislikesCount?: number | null;
  ownerReply: string | null;
  ownerRepliedAt: Date | null;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  currentUserReaction?: ReviewReactionValue | null;
  reactions?: Array<{ value: ReviewReactionValue }> | null;
  user?: { firstName: string; lastName?: string | null; avatarUrl?: string | null } | null;
}): SerializedReview {
  const currentUserReaction = review.currentUserReaction ?? review.reactions?.[0]?.value ?? null;
  const importedAuthorName = review.importedAuthorName?.trim() || null;
  const isImported = Boolean(review.isImported);
  const userName =
    isImported && importedAuthorName
      ? importedAuthorName
      : review.user
        ? formatPublicPersonName(review.user, "Пользователь")
        : "Пользователь";

  return {
    id: review.id,
    entityType: review.entityType,
    propertyId: review.propertyId,
    excursionId: review.excursionId,
    transferId: review.transferId ?? null,
    userId: review.userId,
    userName,
    userAvatarUrl: review.user?.avatarUrl ?? null,
    rating: Number(review.rating),
    text: review.text,
    isImported,
    importedAuthorName,
    externalSourceUrl: review.externalSourceUrl ?? null,
    externalSourceName: review.externalSourceName ?? null,
    verifiedAt: review.verifiedAt ? review.verifiedAt.toISOString() : null,
    guestCity: normalizeReviewGuestCity(review.guestCity),
    reviewedAt: review.reviewedAt ? review.reviewedAt.toISOString() : null,
    likesCount: Math.max(0, Number(review.likesCount ?? 0)),
    dislikesCount: Math.max(0, Number(review.dislikesCount ?? 0)),
    currentUserReaction,
    ownerReply: review.ownerReply,
    ownerRepliedAt: review.ownerRepliedAt ? review.ownerRepliedAt.toISOString() : null,
    status: review.status,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    deletedAt: review.deletedAt ? review.deletedAt.toISOString() : null,
  };
}

export function normalizeReviewGuestCity(value?: string | null): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized || null;
}

export function parseReviewDateInput(value?: string | null): Date | null {
  const normalized = value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function refreshEntityReviewStats(
  tx: DbTransactionClient,
  input:
    | { entityType: "PROPERTY"; propertyId: string }
    | { entityType: "EXCURSION"; excursionId: string }
    | { entityType: "TRANSFER"; transferId: string },
): Promise<{ avgRating: number; reviewsCount: number }> {
  const where: Prisma.ReviewWhereInput =
    input.entityType === ReviewEntityType.PROPERTY
      ? {
          entityType: ReviewEntityType.PROPERTY,
          propertyId: input.propertyId,
          status: ReviewStatus.ACTIVE,
          rating: { gte: 0.5 },
        }
      : input.entityType === ReviewEntityType.EXCURSION
        ? {
            entityType: ReviewEntityType.EXCURSION,
            excursionId: input.excursionId,
            status: ReviewStatus.ACTIVE,
            rating: { gte: 0.5 },
          }
        : {
            entityType: ReviewEntityType.TRANSFER,
            transferId: input.transferId,
            status: ReviewStatus.ACTIVE,
            rating: { gte: 0.5 },
          };

  const aggregate = await tx.review.aggregate({
    where,
    _avg: { rating: true },
    _count: { _all: true },
  });

  const avgRating = Number(aggregate._avg.rating ?? 0);
  const reviewsCount = aggregate._count._all;

  if (input.entityType === ReviewEntityType.PROPERTY) {
    await tx.property.update({
      where: { id: input.propertyId },
      data: {
        avgRating,
        reviewsCount,
      },
    });
  } else if (input.entityType === ReviewEntityType.EXCURSION) {
    await tx.excursion.update({
      where: { id: input.excursionId },
      data: {
        avgRating,
        reviewsCount,
      },
    });
  } else {
    await tx.transfer.update({
      where: { id: input.transferId },
      data: {
        avgRating,
        reviewsCount,
      },
    });
  }

  return {
    avgRating,
    reviewsCount,
  };
}

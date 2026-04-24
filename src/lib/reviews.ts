// Domain/service module for reviews.
import {
  Prisma,
  ReviewEntityType,
  ReviewReactionValue,
  ReviewStatus,
} from "@prisma/client";
import type { DbTransactionClient } from "@/lib/db";

export type SerializedReview = {
  id: string;
  entityType: ReviewEntityType;
  propertyId: string | null;
  excursionId: string | null;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  rating: number;
  text: string;
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
  userId: string;
  rating: Prisma.Decimal | number;
  text: string;
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
  user?: { firstName: string; lastName: string; avatarUrl?: string | null } | null;
}): SerializedReview {
  const currentUserReaction =
    review.currentUserReaction ?? review.reactions?.[0]?.value ?? null;

  return {
    id: review.id,
    entityType: review.entityType,
    propertyId: review.propertyId,
    excursionId: review.excursionId,
    userId: review.userId,
    userName: review.user ? `${review.user.firstName} ${review.user.lastName}` : "Пользователь",
    userAvatarUrl: review.user?.avatarUrl ?? null,
    rating: Number(review.rating),
    text: review.text,
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

export async function refreshEntityReviewStats(
  tx: DbTransactionClient,
  input:
    | { entityType: "PROPERTY"; propertyId: string }
    | { entityType: "EXCURSION"; excursionId: string },
): Promise<{ avgRating: number; reviewsCount: number }> {
  const where: Prisma.ReviewWhereInput =
    input.entityType === ReviewEntityType.PROPERTY
      ? {
          entityType: ReviewEntityType.PROPERTY,
          propertyId: input.propertyId,
          status: ReviewStatus.ACTIVE,
        }
      : {
          entityType: ReviewEntityType.EXCURSION,
          excursionId: input.excursionId,
          status: ReviewStatus.ACTIVE,
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
  } else {
    await tx.excursion.update({
      where: { id: input.excursionId },
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

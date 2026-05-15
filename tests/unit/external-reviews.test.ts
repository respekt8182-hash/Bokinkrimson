import { ReviewEntityType, ReviewStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildPublicReviewOrderSeed,
  getPublicReviewOrderSeedDate,
  orderReviewsForPublicDisplay,
} from "../../src/lib/external-reviews";
import type { SerializedReview } from "../../src/lib/reviews";

function makeReview(id: string): SerializedReview {
  const createdAt = "2026-05-01T12:00:00.000Z";

  return {
    id,
    entityType: ReviewEntityType.PROPERTY,
    propertyId: "property-1",
    excursionId: null,
    transferId: null,
    userId: null,
    userName: "Guest",
    userAvatarUrl: null,
    rating: 5,
    text: "Helpful review text",
    isImported: false,
    importedAuthorName: null,
    externalSourceUrl: null,
    externalSourceName: null,
    verifiedAt: null,
    guestCity: null,
    reviewedAt: null,
    likesCount: 0,
    dislikesCount: 0,
    currentUserReaction: null,
    ownerReply: null,
    ownerRepliedAt: null,
    status: ReviewStatus.ACTIVE,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };
}

describe("public external review ordering", () => {
  it("rotates by the Moscow calendar day", () => {
    expect(getPublicReviewOrderSeedDate(new Date("2026-05-14T20:59:00.000Z"))).toBe("2026-05-14");
    expect(getPublicReviewOrderSeedDate(new Date("2026-05-14T21:00:00.000Z"))).toBe("2026-05-15");
  });

  it("keeps one daily order per entity and changes it on the next day", () => {
    const reviews = [
      "review-1",
      "review-2",
      "review-3",
      "review-4",
      "review-5",
      "review-6",
      "review-7",
    ].map(makeReview);

    const entity = { entityType: "property" as const, entityId: "property-1" };
    const morningSeed = buildPublicReviewOrderSeed(entity, new Date("2026-05-15T05:00:00.000Z"));
    const eveningSeed = buildPublicReviewOrderSeed(entity, new Date("2026-05-15T18:00:00.000Z"));
    const nextDaySeed = buildPublicReviewOrderSeed(entity, new Date("2026-05-15T21:00:00.000Z"));

    const morningOrder = orderReviewsForPublicDisplay(reviews, morningSeed).map(
      (review) => review.id,
    );
    const eveningOrder = orderReviewsForPublicDisplay(reviews, eveningSeed).map(
      (review) => review.id,
    );
    const nextDayOrder = orderReviewsForPublicDisplay(reviews, nextDaySeed).map(
      (review) => review.id,
    );

    expect(eveningOrder).toEqual(morningOrder);
    expect(nextDayOrder).not.toEqual(morningOrder);
  });
});

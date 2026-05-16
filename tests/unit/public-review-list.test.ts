import { ReviewEntityType, ReviewStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildPublicReviewMeta,
  filterAndSortPublicReviews,
} from "../../src/lib/public-review-list";
import type { SerializedReview } from "../../src/lib/reviews";

function makeReview(id: string, patch?: Partial<SerializedReview>): SerializedReview {
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
    text: "Очень уютные, комфортные номера и чисто.",
    isImported: true,
    importedAuthorName: "Guest",
    externalSourceUrl: null,
    externalSourceName: null,
    verifiedAt: null,
    guestCity: null,
    reviewedAt: null,
    reviewCategory: "comfort",
    reviewHighlight: "уютные",
    reviewCategoryMatches: [
      {
        category: "comfort",
        label: "Комфорт",
        badge: null,
        sentiment: "positive",
        score: 0.92,
        highlights: ["уютные", "комфортные"],
      },
      {
        category: "cleanliness",
        label: "Чистота",
        badge: null,
        sentiment: "positive",
        score: 0.81,
        highlights: ["чисто"],
      },
    ],
    likesCount: 0,
    dislikesCount: 0,
    currentUserReaction: null,
    ownerReply: null,
    ownerRepliedAt: null,
    status: ReviewStatus.ACTIVE,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    ...patch,
  };
}

describe("public review list", () => {
  it("counts one review in each matched category", () => {
    const meta = buildPublicReviewMeta([makeReview("review-1")]);

    expect(meta.categories).toEqual([
      { id: "cleanliness", label: "Чистота", count: 1 },
      { id: "comfort", label: "Комфорт", count: 1 },
    ]);
  });

  it("filters by any matched category, not only the primary one", () => {
    const review = makeReview("review-1");

    expect(filterAndSortPublicReviews({ reviews: [review], category: "comfort" })).toHaveLength(1);
    expect(filterAndSortPublicReviews({ reviews: [review], category: "cleanliness" })).toHaveLength(1);
  });
});

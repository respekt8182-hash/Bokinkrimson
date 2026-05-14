import { ReviewEntityType, ReviewStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  reviewFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    review: {
      findFirst: dbMocks.reviewFindFirst,
    },
    $transaction: dbMocks.transaction,
  },
  isDatabaseTableAvailable: vi.fn(),
}));

function makeImportedReview(status: ReviewStatus) {
  return {
    id: "review-1",
    entityType: ReviewEntityType.PROPERTY,
    propertyId: "property-1",
    excursionId: null,
    transferId: null,
    userId: null,
    rating: 5,
    text: "External review text",
    likesCount: 0,
    dislikesCount: 0,
    status,
    ownerReply: null,
    ownerRepliedAt: null,
    isImported: true,
    importedAuthorName: "Anna",
    externalSourceUrl: "https://example.com/review",
    externalSourceName: "Example",
    importedByOwnerId: "owner-1",
    verifiedAt: null,
    verifiedByAdminId: null,
    guestCity: null,
    reviewedAt: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    deletedAt: null,
    user: null,
  };
}

async function loadModerationModule() {
  vi.resetModules();
  return import("../../src/lib/external-review-moderation");
}

describe("external review moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not let owners approve imported reviews", async () => {
    dbMocks.reviewFindFirst.mockResolvedValue(makeImportedReview(ReviewStatus.PENDING));
    const { updateExternalReviewModeration } = await loadModerationModule();

    await expect(
      updateExternalReviewModeration({
        id: "review-1",
        actorId: "owner-1",
        actorRole: "owner",
        action: "approve",
        rating: 5,
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "OWNER_REVIEW_MODERATION_FORBIDDEN",
    });
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });

  it("does not let owners change already approved imported reviews", async () => {
    dbMocks.reviewFindFirst.mockResolvedValue(makeImportedReview(ReviewStatus.ACTIVE));
    const { updateExternalReviewModeration } = await loadModerationModule();

    await expect(
      updateExternalReviewModeration({
        id: "review-1",
        actorId: "owner-1",
        actorRole: "owner",
        action: "delete",
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "OWNER_REVIEW_MODERATION_FORBIDDEN",
    });
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });
});

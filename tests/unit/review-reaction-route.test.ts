import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  reviewFindUnique: vi.fn(),
}));

const externalReviewMocks = vi.hoisted(() => ({
  tryUpdateFallbackExternalReviewReaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: authMocks.getSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    review: {
      findUnique: dbMocks.reviewFindUnique,
    },
  },
}));

vi.mock("@/lib/external-reviews", () => ({
  tryUpdateFallbackExternalReviewReaction:
    externalReviewMocks.tryUpdateFallbackExternalReviewReaction,
}));

function buildSerializedReview(overrides: Record<string, unknown> = {}) {
  return {
    id: "ext_review-1",
    entityType: "PROPERTY",
    propertyId: "property-1",
    excursionId: null,
    transferId: null,
    userId: null,
    userName: "Роман",
    userAvatarUrl: null,
    rating: 5,
    text: "Отличный отзыв про отдых.",
    isImported: true,
    importedAuthorName: "Роман",
    externalSourceUrl: null,
    externalSourceName: "Куда на море",
    verifiedAt: null,
    guestCity: null,
    reviewedAt: null,
    likesCount: 1,
    dislikesCount: 0,
    currentUserReaction: "LIKE",
    ownerReply: null,
    ownerRepliedAt: null,
    status: "ACTIVE",
    createdAt: new Date("2026-05-13T12:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-05-13T12:00:00.000Z").toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

async function loadReactionRoute() {
  vi.resetModules();
  return import("../../src/app/api/public/reviews/[id]/reaction/route");
}

describe("public review reaction route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ id: "user-1" });
  });

  it("updates fallback external reviews without looking them up in the Review table first", async () => {
    const item = buildSerializedReview();
    externalReviewMocks.tryUpdateFallbackExternalReviewReaction.mockResolvedValue({
      ok: true,
      item,
    });
    const { PUT } = await loadReactionRoute();

    const response = await PUT(
      new Request("http://localhost:3000/api/public/reviews/ext_review-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ value: "LIKE" }),
        headers: {
          "content-type": "application/json",
        },
      }),
      { params: Promise.resolve({ id: "ext_review-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ item });
    expect(dbMocks.reviewFindUnique).not.toHaveBeenCalled();
    expect(externalReviewMocks.tryUpdateFallbackExternalReviewReaction).toHaveBeenCalledWith({
      id: "ext_review-1",
      userId: "user-1",
      value: "LIKE",
    });
  });
});

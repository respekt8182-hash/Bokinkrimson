import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  propertyFindFirst: vi.fn(),
  reviewFindFirst: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: authMocks.getSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    property: {
      findFirst: dbMocks.propertyFindFirst,
    },
    review: {
      findFirst: dbMocks.reviewFindFirst,
    },
  },
}));

async function loadReviewRoute() {
  vi.resetModules();
  return import("../../src/app/api/public/properties/[identifier]/reviews/route");
}

describe("property review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ id: "user-1" });
    dbMocks.propertyFindFirst.mockResolvedValue({
      id: "property-1",
      ownerId: "owner-1",
      avgRating: 0,
      reviewsCount: 0,
    });
  });

  it("rejects duplicate reviews from the same user", async () => {
    dbMocks.reviewFindFirst.mockResolvedValue({ id: "review-1" });
    const { POST } = await loadReviewRoute();

    const response = await POST(
      new Request("http://localhost:3000/api/public/properties/property-1/reviews", {
        method: "POST",
        body: JSON.stringify({
          rating: 5,
          text: "Great place",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      { params: Promise.resolve({ identifier: "property-1" }) },
    );

    expect(response.status).toBe(409);
  });
});

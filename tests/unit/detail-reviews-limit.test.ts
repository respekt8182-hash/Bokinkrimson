import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_REVIEWS_PAGE_SIZE } from "../../src/lib/reviews";

const { excursionFindFirstMock, propertyFindFirstMock, reviewReactionFindManyMock } = vi.hoisted(
  () => ({
    excursionFindFirstMock: vi.fn(),
    propertyFindFirstMock: vi.fn(),
    reviewReactionFindManyMock: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({
  db: {
    property: {
      findFirst: propertyFindFirstMock,
      findMany: vi.fn(),
    },
    excursion: {
      findFirst: excursionFindFirstMock,
      findMany: vi.fn(),
    },
    reviewReaction: {
      findMany: reviewReactionFindManyMock,
    },
    customLocation: {
      findFirst: vi.fn(),
    },
    excursionDistrict: {
      findFirst: vi.fn(),
    },
    excursionCategory: {
      findFirst: vi.fn(),
    },
  },
}));

describe("public detail review payloads", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    propertyFindFirstMock.mockResolvedValue(null);
    excursionFindFirstMock.mockResolvedValue(null);
    reviewReactionFindManyMock.mockResolvedValue([]);
  });

  it("limits initial property reviews in the detail query", async () => {
    const { getPublicPropertyByIdentifier } = await import("../../src/lib/public-properties");

    await getPublicPropertyByIdentifier("property_aaaaaaaaaa");

    const findFirstInput = propertyFindFirstMock.mock.calls[0]?.[0];
    expect(findFirstInput.include.reviews.take).toBe(PUBLIC_REVIEWS_PAGE_SIZE);
  });

  it("limits initial excursion reviews in the detail query", async () => {
    const { getPublicExcursionByIdentifier } = await import("../../src/lib/public-excursions");

    await getPublicExcursionByIdentifier("excursion_aaaaaaaaaa");

    const findFirstInput = excursionFindFirstMock.mock.calls[0]?.[0];
    expect(findFirstInput.include.reviews.take).toBe(PUBLIC_REVIEWS_PAGE_SIZE);
  });
});

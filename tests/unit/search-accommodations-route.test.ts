import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublicCatalogMock } = vi.hoisted(() => ({
  getPublicCatalogMock: vi.fn(),
}));

vi.mock("@/lib/public-properties", () => ({
  getPublicCatalog: getPublicCatalogMock,
}));

async function loadRoute() {
  vi.resetModules();
  return import("../../src/app/api/search/accommodations/route");
}

describe("search accommodations route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublicCatalogMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 30,
      totalPages: 1,
      filters: {
        locationId: null,
        locationName: null,
        type: null,
        query: null,
        minPrice: null,
        maxPrice: null,
        minRating: null,
        hasPhotos: false,
        hasReviews: false,
        familyFriendly: false,
        petsAllowed: false,
        nearSea: false,
        hasPool: false,
        hasKitchen: false,
        hasAirConditioner: false,
        hasParking: false,
        smokingForbidden: false,
        quietHours: false,
        amenityIds: [],
        roomFeatureIds: [],
        sort: "relevance",
        nearbyRadiusKm: null,
      },
    });
  });

  it("returns no-store cache headers for housing search results", async () => {
    const { GET } = await loadRoute();

    const response = await GET(
      new Request("http://localhost:3000/api/search/accommodations?page=1&page_size=30"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0, must-revalidate");
  });
});

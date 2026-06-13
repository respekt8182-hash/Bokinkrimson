import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getPublicCatalogMock,
  getLocationDirectoryItemsMock,
  getPopularHousingSuggestionsMock,
  getSearchSeoStateMock,
} = vi.hoisted(() => ({
  getPublicCatalogMock: vi.fn(),
  getLocationDirectoryItemsMock: vi.fn(),
  getPopularHousingSuggestionsMock: vi.fn(),
  getSearchSeoStateMock: vi.fn(),
}));

vi.mock("@/components/public/housing-catalog-client", () => ({
  HousingCatalogClient: () => null,
}));

vi.mock("@/components/public/excursion-search-results", () => ({
  ExcursionSearchResults: () => null,
}));

vi.mock("@/components/seo/JsonLd", () => ({
  JsonLd: () => null,
}));

vi.mock("@/lib/location-directory", () => ({
  getLocationDirectoryItems: getLocationDirectoryItemsMock,
}));

vi.mock("@/lib/public-excursions", () => ({
  getExcursionSeoDirectoryData: vi.fn().mockResolvedValue({
    districts: [],
    categories: [],
    cities: [],
  }),
  getPublicExcursionCatalog: vi.fn(),
}));

vi.mock("@/lib/public-properties", () => ({
  getPublicCatalog: getPublicCatalogMock,
}));

vi.mock("@/lib/search-suggestions", () => ({
  getPopularExcursionSuggestions: vi.fn().mockResolvedValue([]),
  getPopularHousingSuggestions: getPopularHousingSuggestionsMock,
}));

vi.mock("@/lib/seo/structured-data", () => ({
  buildBreadcrumbListStructuredData: vi.fn().mockReturnValue({}),
  buildCollectionPageStructuredData: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/seo/search-metadata", () => ({
  buildSearchMetadata: vi.fn(),
  getSearchSeoState: getSearchSeoStateMock,
}));

vi.mock("@/lib/seo/url-normalize", () => ({
  parseDateRangeParam: vi.fn().mockReturnValue({ checkIn: "", checkOut: "" }),
}));

vi.mock("@/lib/search-contracts", () => ({
  parseBoundsParam: vi.fn().mockReturnValue(null),
}));

describe("search page housing catalog bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSearchSeoStateMock.mockResolvedValue({
      direction: "housing",
      index: false,
      heading: "Жилье в Крыму",
      description: "",
      canonicalPath: "/search?direction=housing",
      breadcrumbItems: [],
    });
    getLocationDirectoryItemsMock.mockResolvedValue([]);
    getPopularHousingSuggestionsMock.mockResolvedValue([]);
    getPublicCatalogMock
      .mockResolvedValueOnce({
        items: [],
        total: 42,
        page: 3,
        pageSize: 30,
        totalPages: 5,
        filters: {
          locationId: "yalta",
          locationName: "Ялта",
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
      })
      .mockResolvedValueOnce({
        items: [],
        total: 42,
        page: 1,
        pageSize: 1,
        totalPages: 42,
        filters: {
          locationId: "yalta",
          locationName: "Ялта",
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

  it("passes the requested page to the initial housing catalog query", async () => {
    const { default: SearchPage } = await import("../../src/app/search/page");

    await SearchPage({
      searchParams: Promise.resolve({
        direction: "housing",
        location: "Ялта",
        page: "3",
      }),
    });

    expect(getPublicCatalogMock).toHaveBeenCalled();
    expect(getPublicCatalogMock.mock.calls[0]?.[0]).toMatchObject({
      location: "Ялта",
      page: 3,
      pageSize: 30,
    });
  });
});

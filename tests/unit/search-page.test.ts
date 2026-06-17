import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getPublicCatalogMock,
  getPublicHousingCatalogOverviewMock,
  getPublicExcursionCatalogOverviewMock,
  getLocationDirectoryItemsMock,
  getPopularHousingSuggestionsMock,
  getSearchSeoStateMock,
} = vi.hoisted(() => ({
  getPublicCatalogMock: vi.fn(),
  getPublicHousingCatalogOverviewMock: vi.fn(),
  getPublicExcursionCatalogOverviewMock: vi.fn(),
  getLocationDirectoryItemsMock: vi.fn(),
  getPopularHousingSuggestionsMock: vi.fn(),
  getSearchSeoStateMock: vi.fn(),
}));

vi.mock("@/components/public/housing-catalog-client", () => ({
  HousingCatalogClient: () => null,
}));

vi.mock("next/cache", () => ({
  unstable_cache: (callback: unknown) => callback,
  unstable_noStore: vi.fn(),
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

vi.mock("@/lib/public-catalog-overview", () => ({
  getPublicHousingCatalogOverview: getPublicHousingCatalogOverviewMock,
  getPublicExcursionCatalogOverview: getPublicExcursionCatalogOverviewMock,
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
    getPublicCatalogMock.mockResolvedValue({
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
    });
    getPublicHousingCatalogOverviewMock.mockResolvedValue({
      total: 42,
      priceBounds: { min: 0, max: 12000 },
    });
    getPublicExcursionCatalogOverviewMock.mockResolvedValue({
      total: 0,
      priceBounds: { min: 0, max: 0 },
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
    expect(getPublicCatalogMock).toHaveBeenCalledTimes(1);
    expect(getPublicCatalogMock.mock.calls[0]?.[0]).toMatchObject({
      location: "Ялта",
      page: 3,
      pageSize: 30,
    });
    expect(getPublicHousingCatalogOverviewMock).toHaveBeenCalledWith({ location: "Ялта" });
    expect(getPublicHousingCatalogOverviewMock).toHaveBeenCalledWith();
  });
});

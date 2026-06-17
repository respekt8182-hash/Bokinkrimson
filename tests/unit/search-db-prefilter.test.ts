import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  excursionFindManyMock,
  getRankingStatsByEntityMock,
  customLocationFindFirstMock,
  propertyFindManyMock,
  propertyUpdateManyMock,
  transferFindManyMock,
} = vi.hoisted(() => ({
  excursionFindManyMock: vi.fn(),
  getRankingStatsByEntityMock: vi.fn(),
  customLocationFindFirstMock: vi.fn(),
  propertyFindManyMock: vi.fn(),
  propertyUpdateManyMock: vi.fn(),
  transferFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    property: {
      findMany: propertyFindManyMock,
      updateMany: propertyUpdateManyMock,
    },
    excursion: {
      findMany: excursionFindManyMock,
    },
    transfer: {
      findMany: transferFindManyMock,
    },
    customLocation: {
      findFirst: customLocationFindFirstMock,
    },
  },
}));

vi.mock("@/lib/ranking-stats", () => ({
  getRankingStatsByEntity: getRankingStatsByEntityMock,
}));

vi.mock("@/lib/location-directory", () => ({
  normalizeLocationName: (value: string) => value.trim().toLowerCase().replace(/\s+/g, " "),
  searchLocationDirectory: vi.fn(async () => []),
}));

vi.mock("@/lib/storage", () => ({
  filterExistingLocalPublicUploadUrls: vi.fn(async (urls: string[]) => urls),
}));

function resetPrefilterEnv() {
  delete process.env.SEARCH_PROPERTY_DB_PREFILTER;
  delete process.env.SEARCH_EXCURSION_DB_PREFILTER;
  delete process.env.SEARCH_TRANSFER_DB_PREFILTER;
  delete process.env.SEARCH_DB_PREFILTER_FORCE_FALLBACK;
}

function buildTransferRow(id: string) {
  return {
    id,
    publicId: 100,
    ownerId: "user_owner",
    title: "Transfer Yalta Airport",
    slug: "transfer-yalta-airport",
    transferType: "Taxi",
    vehicleClass: "Comfort",
    vehicleModel: "Minivan",
    seats: 6,
    luggage: 4,
    locationId: "yalta",
    locationName: "Yalta",
    districtId: null,
    serviceArea: "South Coast",
    routeExamples: "Yalta - airport",
    latitude: 44.5,
    longitude: 34.1,
    priceFrom: 3000,
    priceUnitLabel: "per trip",
    currency: "RUB",
    shortDescription: "Comfort transfer around Crimea",
    description: "Comfort transfer around Crimea with airport routes",
    photoUrls: ["/car.jpg"],
    serviceTags: ["airport"],
    fleet: [],
    contactName: "Dispatcher",
    phone: "+79990000000",
    phoneName: null,
    phone2: null,
    phone2Name: null,
    phone3: null,
    phone3Name: null,
    websiteUrl: "https://example.test",
    contactEmail: "transfer@example.test",
    whatsappUrl: null,
    telegramUrl: null,
    vkUrl: null,
    maxUrl: null,
    okUrl: null,
    receiveRequests: true,
    avgRating: 4.8,
    reviewsCount: 12,
    profileViews: 0,
    moderationNotes: null,
    status: "PUBLISHED",
    pendingEditStatus: null,
    publishedSnapshot: null,
    isPublishedVisible: true,
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    owner: {
      id: "user_owner",
      firstName: "Ivan",
      email: "owner@example.test",
      phone: "+79991111111",
      avatarUrl: null,
      phoneVerifiedAt: null,
    },
    location: {
      id: "yalta",
      name: "Yalta",
      latitude: 44.5,
      longitude: 34.1,
    },
    district: {
      name: "South Coast",
    },
  };
}

describe("search DB candidate prefilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrefilterEnv();
    getRankingStatsByEntityMock.mockResolvedValue(new Map());
    customLocationFindFirstMock.mockResolvedValue(null);
    propertyFindManyMock.mockResolvedValue([]);
    propertyUpdateManyMock.mockResolvedValue({ count: 0 });
    excursionFindManyMock.mockResolvedValue([]);
    transferFindManyMock.mockResolvedValue([]);
  });

  afterEach(() => {
    resetPrefilterEnv();
  });

  it("uses an opt-in property ID stage before the heavy catalog select", async () => {
    process.env.SEARCH_PROPERTY_DB_PREFILTER = "true";
    propertyFindManyMock
      .mockResolvedValueOnce([{ id: "property_a" }])
      .mockResolvedValueOnce([]);
    const { getPublicCatalog } = await import("../../src/lib/public-properties");

    const result = await getPublicCatalog({ type: "hotel", page: 1, pageSize: 30 });
    const candidateCall = propertyFindManyMock.mock.calls[0]?.[0];
    const heavyCall = propertyFindManyMock.mock.calls[1]?.[0];

    expect(result.items).toEqual([]);
    expect(propertyFindManyMock).toHaveBeenCalledTimes(2);
    expect(candidateCall.select).toEqual({ id: true });
    expect(candidateCall.take).toBe(3000);
    expect(JSON.stringify(candidateCall.where)).toContain('"type":"hotel"');
    expect(heavyCall.select.rooms).toBeDefined();
    expect(heavyCall.where.AND[1].id.in).toEqual(["property_a"]);
    expect(heavyCall.take).toBe(1);
  });

  it("falls back to the legacy property fetch when a text prefilter is sparse", async () => {
    process.env.SEARCH_PROPERTY_DB_PREFILTER = "true";
    propertyFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const { getPublicCatalog } = await import("../../src/lib/public-properties");

    await getPublicCatalog({ query: "yalta typo", page: 1, pageSize: 30 });
    const heavyCall = propertyFindManyMock.mock.calls[1]?.[0];

    expect(propertyFindManyMock).toHaveBeenCalledTimes(2);
    expect(heavyCall.select.rooms).toBeDefined();
    expect(JSON.stringify(heavyCall.where)).not.toContain('"in":[]');
    expect(heavyCall.take).toBe(5000);
  });

  it("uses an opt-in excursion ID stage before relation-heavy includes", async () => {
    process.env.SEARCH_EXCURSION_DB_PREFILTER = "true";
    excursionFindManyMock
      .mockResolvedValueOnce([{ id: "excursion_a" }])
      .mockResolvedValueOnce([]);
    const { getPublicExcursionCatalog } = await import("../../src/lib/public-excursions");

    const result = await getPublicExcursionCatalog({
      offerType: "excursion",
      page: 1,
      pageSize: 30,
    });
    const candidateCall = excursionFindManyMock.mock.calls[0]?.[0];
    const heavyCall = excursionFindManyMock.mock.calls[1]?.[0];

    expect(result.items).toEqual([]);
    expect(excursionFindManyMock).toHaveBeenCalledTimes(2);
    expect(candidateCall.select).toEqual({ id: true });
    expect(candidateCall.take).toBe(3000);
    expect(JSON.stringify(candidateCall.where)).toContain('"offerType":"EXCURSION"');
    expect(heavyCall.include.routeLocations).toBeDefined();
    expect(heavyCall.include.sessions).toBeDefined();
    expect(heavyCall.where.AND[1].id.in).toEqual(["excursion_a"]);
    expect(heavyCall.take).toBe(1);
  });

  it("bounds the transfer catalog behind the opt-in transfer prefilter flag", async () => {
    process.env.SEARCH_TRANSFER_DB_PREFILTER = "true";
    transferFindManyMock
      .mockResolvedValueOnce([{ id: "transfer_a" }])
      .mockResolvedValueOnce([buildTransferRow("transfer_a")]);
    const { getPublicTransferCatalog } = await import("../../src/lib/public-marketplace");

    const result = await getPublicTransferCatalog({ page: 1, pageSize: 30 });
    const candidateCall = transferFindManyMock.mock.calls[0]?.[0];
    const heavyCall = transferFindManyMock.mock.calls[1]?.[0];

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "transfer_a",
      title: "Transfer Yalta Airport",
      contacts: {
        phone: null,
        email: null,
      },
    });
    expect(transferFindManyMock).toHaveBeenCalledTimes(2);
    expect(candidateCall.select).toEqual({ id: true });
    expect(candidateCall.take).toBe(5000);
    expect(heavyCall.include.owner.select.email).toBe(true);
    expect(heavyCall.where.AND[1].id.in).toEqual(["transfer_a"]);
    expect(heavyCall.take).toBe(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  excursionFindManyMock,
  getFavoritePropertyIdsMock,
  getPublicCatalogMock,
  getPublicExcursionCatalogMock,
  getPublicTransferCatalogMock,
  getSessionMock,
  propertyFindManyMock,
  transferFindManyMock,
} = vi.hoisted(() => ({
  excursionFindManyMock: vi.fn(),
  getFavoritePropertyIdsMock: vi.fn(),
  getPublicCatalogMock: vi.fn(),
  getPublicExcursionCatalogMock: vi.fn(),
  getPublicTransferCatalogMock: vi.fn(),
  getSessionMock: vi.fn(),
  propertyFindManyMock: vi.fn(),
  transferFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    property: {
      findMany: propertyFindManyMock,
    },
    excursion: {
      findMany: excursionFindManyMock,
    },
    transfer: {
      findMany: transferFindManyMock,
    },
  },
}));

vi.mock("@/lib/favorites", () => ({
  getFavoritePropertyIds: getFavoritePropertyIdsMock,
}));

vi.mock("@/lib/public-properties", async () => {
  const actual = await vi.importActual<typeof import("@/lib/public-properties")>(
    "@/lib/public-properties",
  );

  return {
    ...actual,
    getPublicCatalog: getPublicCatalogMock,
  };
});

vi.mock("@/lib/public-excursions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/public-excursions")>(
    "@/lib/public-excursions",
  );

  return {
    ...actual,
    getPublicExcursionCatalog: getPublicExcursionCatalogMock,
  };
});

vi.mock("@/lib/public-marketplace", async () => {
  const actual = await vi.importActual<typeof import("@/lib/public-marketplace")>(
    "@/lib/public-marketplace",
  );

  return {
    ...actual,
    getPublicTransferCatalog: getPublicTransferCatalogMock,
  };
});

describe("lightweight map endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(null);
    getFavoritePropertyIdsMock.mockResolvedValue(new Set<string>());
    propertyFindManyMock.mockResolvedValue([]);
    excursionFindManyMock.mockResolvedValue([]);
    transferFindManyMock.mockResolvedValue([]);
  });

  it("serves accommodation map points without the public catalog pipeline", async () => {
    const { GET } = await import("../../src/app/api/map/accommodations/route");

    const response = await GET(
      new Request(
        "http://localhost/api/map/accommodations?bounds=44,33,45,34&locationId=yalta&limit=300",
      ),
    );
    const payload = await response.json();
    const findManyInput = propertyFindManyMock.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(payload.meta).toMatchObject({
      boundsApplied: true,
      limit: 300,
      truncated: false,
    });
    expect(getPublicCatalogMock).not.toHaveBeenCalled();
    expect(propertyFindManyMock).toHaveBeenCalledTimes(1);
    expect(findManyInput.take).toBe(301);
    expect(JSON.stringify(findManyInput.where)).toContain('"gte":44');
    expect(JSON.stringify(findManyInput.where)).toContain('"lte":45');
    expect(findManyInput.select.rooms.take).toBe(1);
    expect(findManyInput.select.media.take).toBe(1);
  });

  it("serves excursion map points without the public excursion catalog pipeline", async () => {
    const { GET } = await import("../../src/app/api/map/excursions/route");

    const response = await GET(
      new Request(
        "http://localhost/api/map/excursions?bounds=44,33,45,34&offerType=excursion&limit=300",
      ),
    );
    const payload = await response.json();
    const findManyInput = excursionFindManyMock.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(payload.meta).toMatchObject({
      boundsApplied: true,
      limit: 300,
      truncated: false,
    });
    expect(getPublicExcursionCatalogMock).not.toHaveBeenCalled();
    expect(excursionFindManyMock).toHaveBeenCalledTimes(1);
    expect(findManyInput.take).toBe(301);
    expect(JSON.stringify(findManyInput.where)).toContain('"gte":44');
    expect(JSON.stringify(findManyInput.where)).toContain('"lte":45');
    expect(findManyInput.select.sessions).toBeUndefined();
    expect(findManyInput.select.routeLocations).toBeUndefined();
  });

  it("serves transfer map points without the public transfer catalog pipeline", async () => {
    transferFindManyMock.mockResolvedValue([
      {
        id: "transfer_aaaaaaaaaa",
        publicId: 1,
        status: "PUBLISHED",
        pendingEditStatus: null,
        publishedSnapshot: null,
        title: "Трансфер Ялта",
        transferType: "Такси",
        vehicleClass: "Комфорт",
        vehicleModel: "Минивэн",
        seats: 6,
        luggage: 4,
        locationId: "yalta",
        locationName: "Ялта",
        districtId: null,
        serviceArea: "Южный берег",
        routeExamples: "Ялта - аэропорт",
        latitude: 44.5,
        longitude: 34.1,
        priceFrom: 3000,
        priceUnitLabel: "за поездку",
        currency: "RUB",
        shortDescription: "Комфортный трансфер",
        description: "Комфортный трансфер по Крыму",
        photoUrls: ["/car.jpg"],
        serviceTags: ["аэропорт"],
        contactName: "Диспетчер",
        avgRating: 4.8,
        reviewsCount: 12,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        owner: {
          id: "user_aaaaaaaaaa",
          firstName: "Иван",
          avatarUrl: null,
          phoneVerifiedAt: null,
        },
        location: {
          id: "yalta",
          name: "Ялта",
          latitude: 44.5,
          longitude: 34.1,
        },
        district: null,
      },
    ]);
    const { GET } = await import("../../src/app/api/map/transfers/route");

    const response = await GET({
      nextUrl: new URL(
        "http://localhost/api/map/transfers?bounds=44,33,45,34&location=Ялта&limit=300",
      ),
    } as never);
    const payload = await response.json();
    const findManyInput = transferFindManyMock.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=45, stale-while-revalidate=180",
    );
    expect(payload.meta).toMatchObject({
      boundsApplied: true,
      limit: 300,
      truncated: false,
    });
    expect(payload.map_points[0]).toMatchObject({
      id: "transfer_aaaaaaaaaa",
      title: "Трансфер Ялта",
      latitude: 44.5,
      longitude: 34.1,
      priceFrom: 3000,
    });
    expect(getPublicTransferCatalogMock).not.toHaveBeenCalled();
    expect(transferFindManyMock).toHaveBeenCalledTimes(1);
    expect(findManyInput.take).toBe(301);
    expect(JSON.stringify(findManyInput.where)).toContain('"gte":44');
    expect(JSON.stringify(findManyInput.where)).toContain('"lte":45');
    expect(findManyInput.select.owner.select.email).toBeUndefined();
    expect(findManyInput.select.fleet).toBeUndefined();
  });
});

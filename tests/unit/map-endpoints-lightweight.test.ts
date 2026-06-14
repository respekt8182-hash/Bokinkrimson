import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  excursionFindManyMock,
  getFavoritePropertyIdsMock,
  getPublicCatalogMock,
  getPublicExcursionCatalogMock,
  getSessionMock,
  propertyFindManyMock,
} = vi.hoisted(() => ({
  excursionFindManyMock: vi.fn(),
  getFavoritePropertyIdsMock: vi.fn(),
  getPublicCatalogMock: vi.fn(),
  getPublicExcursionCatalogMock: vi.fn(),
  getSessionMock: vi.fn(),
  propertyFindManyMock: vi.fn(),
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

describe("lightweight map endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(null);
    getFavoritePropertyIdsMock.mockResolvedValue(new Set<string>());
    propertyFindManyMock.mockResolvedValue([]);
    excursionFindManyMock.mockResolvedValue([]);
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
});

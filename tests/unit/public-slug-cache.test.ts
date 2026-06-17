import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  excursionFindManyMock,
  propertyFindManyMock,
  transferFindManyMock,
} = vi.hoisted(() => ({
  excursionFindManyMock: vi.fn(),
  propertyFindManyMock: vi.fn(),
  transferFindManyMock: vi.fn(),
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

function propertyIdentifierRow(input: { id: string; name: string; locationId?: string }) {
  return {
    id: input.id,
    name: input.name,
    locationId: input.locationId ?? "yalta",
    status: "PUBLISHED",
    pendingEditStatus: null,
    publishedSnapshot: null,
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  };
}

function excursionIdentifierRow(input: {
  id: string;
  title: string;
  locationId?: string;
  anchorSlug?: string | null;
}) {
  return {
    id: input.id,
    title: input.title,
    locationId: input.locationId ?? "yalta",
    status: "PUBLISHED",
    pendingEditStatus: null,
    publishedSnapshot: null,
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    anchorLocation:
      input.anchorSlug === null
        ? null
        : {
            slug: input.anchorSlug ?? "yalta",
          },
  };
}

function transferIdentifierRow(input: { id: string; title: string; slug?: string }) {
  return {
    id: input.id,
    title: input.title,
    slug: input.slug ?? input.title,
    status: "PUBLISHED",
    pendingEditStatus: null,
    publishedSnapshot: null,
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  };
}

async function clearSlugCache() {
  const { clearPublicSlugLookupCache } = await import("../../src/lib/public-slug-cache");
  clearPublicSlugLookupCache();
}

describe("public slug lookup cache", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.PUBLIC_SLUG_LOOKUP_CACHE_TTL_MS = "60000";
    await clearSlugCache();
  });

  afterEach(async () => {
    delete process.env.PUBLIC_SLUG_LOOKUP_CACHE_TTL_MS;
    await clearSlugCache();
  });

  it("caches public property slug lookup misses and hits by slug/location", async () => {
    propertyFindManyMock.mockResolvedValue([
      propertyIdentifierRow({
        id: "property_a",
        name: "Sea House",
        locationId: "yalta",
      }),
    ]);
    const { findPropertyIdByPublicSlug } = await import("../../src/lib/public-properties");

    const first = await findPropertyIdByPublicSlug({
      identifier: "sea-house",
      expectedLocationId: "yalta",
    });
    const second = await findPropertyIdByPublicSlug({
      identifier: "sea-house",
      expectedLocationId: "yalta",
    });

    expect(first).toBe("property_a");
    expect(second).toBe("property_a");
    expect(propertyFindManyMock).toHaveBeenCalledTimes(1);
  });

  it("keeps public property slug lookup scoped to published-visible rows", async () => {
    propertyFindManyMock.mockResolvedValue([]);
    const { findPropertyIdByPublicSlug } = await import("../../src/lib/public-properties");

    const id = await findPropertyIdByPublicSlug({ identifier: "hidden-house" });
    const where = propertyFindManyMock.mock.calls[0]?.[0].where;

    expect(id).toBeNull();
    expect(where).toMatchObject({
      status: "PUBLISHED",
      isPublishedVisible: true,
      ownerDeletedAt: null,
    });
  });

  it("caches excursion slug lookups without changing expected-location matching", async () => {
    excursionFindManyMock.mockResolvedValue([
      excursionIdentifierRow({
        id: "excursion_a",
        title: "Sea Walk",
        anchorSlug: "yalta",
      }),
    ]);
    const { findExcursionIdByPublicSlug } = await import("../../src/lib/public-excursions");

    const first = await findExcursionIdByPublicSlug({
      identifier: "sea-walk",
      expectedLocationId: "yalta",
    });
    const second = await findExcursionIdByPublicSlug({
      identifier: "sea-walk",
      expectedLocationId: "yalta",
    });

    expect(first).toBe("excursion_a");
    expect(second).toBe("excursion_a");
    expect(excursionFindManyMock).toHaveBeenCalledTimes(1);
  });

  it("preserves transfer slug collision behavior from the ordered legacy scan", async () => {
    transferFindManyMock.mockResolvedValue([
      transferIdentifierRow({
        id: "transfer_newer",
        title: "Airport Taxi",
        slug: "airport-taxi",
      }),
      transferIdentifierRow({
        id: "transfer_older",
        title: "Airport Taxi",
        slug: "airport-taxi",
      }),
    ]);
    const { findTransferIdByPublicSlug } = await import("../../src/lib/public-marketplace");

    const first = await findTransferIdByPublicSlug({ identifier: "airport-taxi" });
    const second = await findTransferIdByPublicSlug({ identifier: "airport-taxi" });
    const orderBy = transferFindManyMock.mock.calls[0]?.[0].orderBy;

    expect(first).toBe("transfer_newer");
    expect(second).toBe("transfer_newer");
    expect(orderBy).toEqual([{ updatedAt: "desc" }]);
    expect(transferFindManyMock).toHaveBeenCalledTimes(1);
  });
});

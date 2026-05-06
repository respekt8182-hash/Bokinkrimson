// Unit tests for home-page popular properties database fallbacks.
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaErrorMocks = vi.hoisted(() => ({
  isConfiguredDatabaseReachable: vi.fn<() => Promise<boolean>>(),
  isDatabaseFallbackEligibleError: vi.fn<(error: unknown) => boolean>(),
  logDatabaseFallbackOnce: vi.fn<(context: string, message: string) => void>(),
}));

const dbMocks = vi.hoisted(() => ({
  propertyFindMany: vi.fn<(args?: unknown) => Promise<unknown[]>>(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: never[]) => unknown) => fn,
}));

vi.mock("@/lib/db", () => ({
  db: {
    property: {
      findMany: dbMocks.propertyFindMany,
    },
  },
}));

vi.mock("@/lib/prisma-errors", () => ({
  isConfiguredDatabaseReachable: prismaErrorMocks.isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError: prismaErrorMocks.isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce: prismaErrorMocks.logDatabaseFallbackOnce,
}));

vi.mock("@/lib/public-properties", () => ({
  buildPublicPropertyPath: vi.fn(() => "/property/test"),
}));

async function loadGetPopularProperties() {
  vi.resetModules();
  return (await import("../../src/lib/popular-properties")).getPopularProperties;
}

describe("popular properties fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaErrorMocks.isConfiguredDatabaseReachable.mockResolvedValue(true);
    prismaErrorMocks.isDatabaseFallbackEligibleError.mockReturnValue(false);
  });

  it("returns an empty list without querying Prisma when the database is unreachable", async () => {
    prismaErrorMocks.isConfiguredDatabaseReachable.mockResolvedValue(false);

    const getPopularProperties = await loadGetPopularProperties();

    await expect(getPopularProperties()).resolves.toEqual([]);
    expect(dbMocks.propertyFindMany).not.toHaveBeenCalled();
    expect(prismaErrorMocks.logDatabaseFallbackOnce).toHaveBeenCalledWith(
      "popular-properties",
      "Database is unavailable. Popular properties section will stay hidden.",
    );
  });

  it("returns an empty list when Prisma raises a fallback-eligible initialization error", async () => {
    prismaErrorMocks.isDatabaseFallbackEligibleError.mockReturnValue(true);
    dbMocks.propertyFindMany.mockRejectedValue(
      new Prisma.PrismaClientInitializationError(
        "Can't reach database server at localhost:5432",
        "6.16.2",
        "P1001",
      ),
    );

    const getPopularProperties = await loadGetPopularProperties();

    await expect(getPopularProperties()).resolves.toEqual([]);
    expect(dbMocks.propertyFindMany).toHaveBeenCalledTimes(1);
    expect(prismaErrorMocks.logDatabaseFallbackOnce).toHaveBeenCalledWith(
      "popular-properties",
      "Database is unavailable or credentials are invalid. Popular properties section will stay hidden.",
    );
  });

  it("requests the latest published object-level photo listings", async () => {
    dbMocks.propertyFindMany.mockResolvedValue([
      {
        id: "new-property",
        name: "New property",
        locationId: null,
        locationName: "Yalta",
        address: null,
        media: [{ url: "/uploads/new.webp" }],
        rooms: [
          {
            prices: [
              {
                price: 2500,
                currency: "RUB",
                dateFrom: new Date("2026-06-01T00:00:00.000Z"),
                dateTo: new Date("2026-06-30T00:00:00.000Z"),
              },
            ],
          },
        ],
      },
    ]);

    const getPopularProperties = await loadGetPopularProperties();

    await expect(getPopularProperties()).resolves.toMatchObject([
      {
        id: "new-property",
        imageUrls: ["/uploads/new.webp"],
        minNightPrice: 2500,
      },
    ]);
    expect(dbMocks.propertyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          media: { some: { type: "IMAGE", roomId: null } },
        }),
        select: expect.objectContaining({
          media: expect.objectContaining({
            where: { type: "IMAGE", roomId: null },
          }),
        }),
        orderBy: [
          { moderatedAt: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
          { updatedAt: "desc" },
        ],
        take: 12,
      }),
    );
  });
});

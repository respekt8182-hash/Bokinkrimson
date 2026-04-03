// Unit tests for home-page popular properties database fallbacks.
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaErrorMocks = vi.hoisted(() => ({
  isConfiguredDatabaseReachable: vi.fn<() => Promise<boolean>>(),
  isDatabaseFallbackEligibleError: vi.fn<(error: unknown) => boolean>(),
  logDatabaseFallbackOnce: vi.fn<(context: string, message: string) => void>(),
}));

const dbMocks = vi.hoisted(() => ({
  propertyFindMany: vi.fn<() => Promise<unknown[]>>(),
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

import { getPopularProperties } from "../../src/lib/popular-properties";

describe("popular properties fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaErrorMocks.isConfiguredDatabaseReachable.mockResolvedValue(true);
    prismaErrorMocks.isDatabaseFallbackEligibleError.mockReturnValue(false);
  });

  it("returns an empty list without querying Prisma when the database is unreachable", async () => {
    prismaErrorMocks.isConfiguredDatabaseReachable.mockResolvedValue(false);

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

    await expect(getPopularProperties()).resolves.toEqual([]);
    expect(dbMocks.propertyFindMany).toHaveBeenCalledTimes(1);
    expect(prismaErrorMocks.logDatabaseFallbackOnce).toHaveBeenCalledWith(
      "popular-properties",
      "Database is unavailable or credentials are invalid. Popular properties section will stay hidden.",
    );
  });
});

// Unit tests for owner dashboard database fallback helper.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaErrorMocks = vi.hoisted(() => ({
  isConfiguredDatabaseReachable: vi.fn<() => Promise<boolean>>(),
  isDatabaseFallbackEligibleError: vi.fn<(error: unknown) => boolean>(),
  logDatabaseFallbackOnce: vi.fn<(context: string, message: string) => void>(),
}));

vi.mock("@/lib/prisma-errors", () => ({
  isConfiguredDatabaseReachable: prismaErrorMocks.isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError: prismaErrorMocks.isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce: prismaErrorMocks.logDatabaseFallbackOnce,
}));

const originalNodeEnv = process.env.NODE_ENV;
const writableEnv = process.env as Record<string, string | undefined>;

async function loadDashboardPageDb() {
  vi.resetModules();
  return import("../../src/lib/dashboard-page-db");
}

describe("dashboard page database fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writableEnv.NODE_ENV = originalNodeEnv ?? "test";
    prismaErrorMocks.isConfiguredDatabaseReachable.mockResolvedValue(true);
    prismaErrorMocks.isDatabaseFallbackEligibleError.mockReturnValue(false);
  });

  afterEach(() => {
    writableEnv.NODE_ENV = originalNodeEnv;
  });

  it("returns loader data when the database is reachable", async () => {
    const load = vi.fn(async () => ["property-1"]);
    const { loadDashboardPageData } = await loadDashboardPageDb();

    await expect(
      loadDashboardPageData(
        {
          contextId: "dashboard-objects",
          pageLabel: "Objects dashboard",
          fallbackDescription: "Showing empty state.",
        },
        load,
        [],
      ),
    ).resolves.toEqual(["property-1"]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(prismaErrorMocks.logDatabaseFallbackOnce).not.toHaveBeenCalled();
  });

  it("returns fallback data without running the loader when the database is unreachable", async () => {
    prismaErrorMocks.isConfiguredDatabaseReachable.mockResolvedValue(false);
    const load = vi.fn(async () => ["property-1"]);
    const { loadDashboardPageData } = await loadDashboardPageDb();

    await expect(
      loadDashboardPageData(
        {
          contextId: "dashboard-objects",
          pageLabel: "Objects dashboard",
          fallbackDescription: "Showing empty state.",
        },
        load,
        [],
      ),
    ).resolves.toEqual([]);

    expect(load).not.toHaveBeenCalled();
    expect(prismaErrorMocks.logDatabaseFallbackOnce).toHaveBeenCalledWith(
      "dashboard-objects",
      "Objects dashboard: database is unavailable. Showing empty state.",
    );
  });

  it("returns fallback data for fallback-eligible Prisma failures", async () => {
    prismaErrorMocks.isDatabaseFallbackEligibleError.mockReturnValue(true);
    const { loadDashboardPageData } = await loadDashboardPageDb();

    await expect(
      loadDashboardPageData(
        {
          contextId: "dashboard-objects",
          pageLabel: "Objects dashboard",
          fallbackDescription: "Showing empty state.",
        },
        async () => {
          throw new Error("db down");
        },
        [],
      ),
    ).resolves.toEqual([]);

    expect(prismaErrorMocks.logDatabaseFallbackOnce).toHaveBeenCalledWith(
      "dashboard-objects",
      "Objects dashboard: database is unavailable or credentials are invalid. Showing empty state.",
    );
  });

  it("rethrows non-fallback errors", async () => {
    const error = new Error("unexpected");
    const { loadDashboardPageData } = await loadDashboardPageDb();

    await expect(
      loadDashboardPageData(
        {
          contextId: "dashboard-objects",
          pageLabel: "Objects dashboard",
          fallbackDescription: "Showing empty state.",
        },
        async () => {
          throw error;
        },
        [],
      ),
    ).rejects.toBe(error);
  });

  it("disables the fallback in production", async () => {
    writableEnv.NODE_ENV = "production";
    prismaErrorMocks.isConfiguredDatabaseReachable.mockResolvedValue(false);
    const error = new Error("db down");
    const { loadDashboardPageData } = await loadDashboardPageDb();

    await expect(
      loadDashboardPageData(
        {
          contextId: "dashboard-objects",
          pageLabel: "Objects dashboard",
          fallbackDescription: "Showing empty state.",
        },
        async () => {
          throw error;
        },
        [],
      ),
    ).rejects.toBe(error);

    expect(prismaErrorMocks.logDatabaseFallbackOnce).not.toHaveBeenCalled();
  });
});

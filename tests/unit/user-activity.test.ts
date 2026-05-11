import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseFallbackMocks = vi.hoisted(() => ({
  loadDataWithDatabaseFallback: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  areDatabaseColumnsAvailable: vi.fn<() => Promise<boolean>>(),
  userUpdateMany: vi.fn<(args?: unknown) => Promise<unknown>>(),
}));

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
}));

vi.mock("@/lib/database-fallback", () => ({
  loadDataWithDatabaseFallback: databaseFallbackMocks.loadDataWithDatabaseFallback,
}));

vi.mock("@/lib/db", () => ({
  areDatabaseColumnsAvailable: dbMocks.areDatabaseColumnsAvailable,
  db: {
    user: {
      updateMany: dbMocks.userUpdateMany,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: loggerMocks,
}));

async function loadUserActivity() {
  vi.resetModules();
  return import("../../src/lib/user-activity");
}

describe("user activity database fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.areDatabaseColumnsAvailable.mockResolvedValue(true);
    dbMocks.userUpdateMany.mockResolvedValue({ count: 1 });
    databaseFallbackMocks.loadDataWithDatabaseFallback.mockImplementation(
      async (_context, load) => load(),
    );
  });

  it("skips Prisma writes when the fallback helper returns the fallback value", async () => {
    databaseFallbackMocks.loadDataWithDatabaseFallback.mockImplementation(
      async (_context, _load, fallbackValue) =>
        typeof fallbackValue === "function" ? fallbackValue() : fallbackValue,
    );

    const { markUserSeen } = await loadUserActivity();

    await expect(markUserSeen("user-1")).resolves.toBe(false);
    expect(dbMocks.areDatabaseColumnsAvailable).not.toHaveBeenCalled();
    expect(dbMocks.userUpdateMany).not.toHaveBeenCalled();
    expect(loggerMocks.warn).not.toHaveBeenCalled();
  });

  it("updates lastSeenAt when the database is reachable", async () => {
    const { markUserSeen } = await loadUserActivity();

    await expect(markUserSeen("user-1", new Date("2026-05-10T23:54:54.755Z"))).resolves.toBe(true);
    expect(dbMocks.areDatabaseColumnsAvailable).toHaveBeenCalledWith("User", [
      "lastLoginAt",
      "lastSeenAt",
      "lastLogoutAt",
    ]);
    expect(dbMocks.userUpdateMany).toHaveBeenCalledTimes(1);
    expect(loggerMocks.warn).not.toHaveBeenCalled();
  });

  it("logs and returns false for unexpected update errors", async () => {
    dbMocks.userUpdateMany.mockRejectedValue(new Error("boom"));

    const { markUserSeen } = await loadUserActivity();

    await expect(markUserSeen("user-1")).resolves.toBe(false);
    expect(loggerMocks.warn).toHaveBeenCalledWith("User activity update failed", {
      userId: "user-1",
      kind: "seen",
      error: "boom",
    });
  });
});

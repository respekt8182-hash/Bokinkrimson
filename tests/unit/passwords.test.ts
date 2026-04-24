import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  areDatabaseColumnsAvailable: vi.fn<() => Promise<boolean>>(),
}));

const prismaErrorMocks = vi.hoisted(() => ({
  logDatabaseFallbackOnce: vi.fn<(context: string, message: string) => void>(),
}));

vi.mock("@/lib/db", () => ({
  areDatabaseColumnsAvailable: dbMocks.areDatabaseColumnsAvailable,
}));

vi.mock("@/lib/prisma-errors", () => ({
  logDatabaseFallbackOnce: prismaErrorMocks.logDatabaseFallbackOnce,
}));

async function loadPasswords() {
  vi.resetModules();
  return import("../../src/lib/passwords");
}

describe("password helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds password security fields when the schema supports them", async () => {
    dbMocks.areDatabaseColumnsAvailable.mockResolvedValue(true);
    const { buildUserPasswordUpdateData } = await loadPasswords();
    const changedAt = new Date("2026-04-24T10:00:00.000Z");

    await expect(buildUserPasswordUpdateData("hash_123", changedAt)).resolves.toEqual({
      passwordHash: "hash_123",
      passwordChangedAt: changedAt,
      sessionVersion: {
        increment: 1,
      },
    });

    expect(dbMocks.areDatabaseColumnsAvailable).toHaveBeenCalledWith("User", [
      "passwordChangedAt",
      "sessionVersion",
    ]);
    expect(prismaErrorMocks.logDatabaseFallbackOnce).not.toHaveBeenCalled();
  });

  it("falls back to password-only updates when security columns are missing", async () => {
    dbMocks.areDatabaseColumnsAvailable.mockResolvedValue(false);
    const { buildUserPasswordUpdateData } = await loadPasswords();

    await expect(buildUserPasswordUpdateData("hash_compat")).resolves.toEqual({
      passwordHash: "hash_compat",
    });

    expect(prismaErrorMocks.logDatabaseFallbackOnce).toHaveBeenCalledWith(
      "password-update-compat",
      "Password updates are running in compatibility mode without session invalidation because the database schema is missing passwordChangedAt/sessionVersion. Apply the latest Prisma migration when DB owner access is available.",
    );
  });
});

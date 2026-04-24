// Unit tests for auth-route database availability guards and fallback responses.
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaErrorMocks = vi.hoisted(() => ({
  isConfiguredDatabaseReachable: vi.fn<() => Promise<boolean>>(),
  logDatabaseFallbackOnce: vi.fn<(context: string, message: string) => void>(),
  isDatabaseUnavailableError: vi.fn<(error: unknown) => boolean>(),
  isDatabaseAuthenticationError: vi.fn<(error: unknown) => boolean>(),
}));

vi.mock("@/lib/prisma-errors", () => ({
  isConfiguredDatabaseReachable: prismaErrorMocks.isConfiguredDatabaseReachable,
  isDatabaseAuthenticationError: prismaErrorMocks.isDatabaseAuthenticationError,
  isDatabaseUnavailableError: prismaErrorMocks.isDatabaseUnavailableError,
  logDatabaseFallbackOnce: prismaErrorMocks.logDatabaseFallbackOnce,
}));

async function loadAuthRouteDb() {
  vi.resetModules();
  return import("../../src/lib/auth-route-db");
}

describe("auth route database guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when database is reachable", async () => {
    prismaErrorMocks.isConfiguredDatabaseReachable.mockResolvedValue(true);
    const { ensureAuthDatabaseAvailable } = await loadAuthRouteDb();

    const response = await ensureAuthDatabaseAvailable({
      routeId: "auth-login",
      routeLabel: "Login",
    });

    expect(response).toBeNull();
    expect(prismaErrorMocks.logDatabaseFallbackOnce).not.toHaveBeenCalled();
  });

  it("returns 503 response when database is unreachable", async () => {
    prismaErrorMocks.isConfiguredDatabaseReachable.mockResolvedValue(false);
    const { ensureAuthDatabaseAvailable, getAuthDatabaseUnavailableMessage } = await loadAuthRouteDb();

    const response = await ensureAuthDatabaseAvailable({
      routeId: "auth-login",
      routeLabel: "Login",
    });

    expect(response).not.toBeNull();
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      error: getAuthDatabaseUnavailableMessage(),
    });
    expect(prismaErrorMocks.logDatabaseFallbackOnce).toHaveBeenCalledWith(
      "auth-login",
      "Login: database is unavailable, returning 503 instead of Prisma failure.",
    );
  });

  it("reuses prisma unavailability detection", async () => {
    prismaErrorMocks.isDatabaseUnavailableError.mockReturnValue(true);
    prismaErrorMocks.isDatabaseAuthenticationError.mockReturnValue(false);
    const { isAuthDatabaseUnavailable } = await loadAuthRouteDb();

    expect(isAuthDatabaseUnavailable(new Error("db"))).toBe(true);
    expect(prismaErrorMocks.isDatabaseUnavailableError).toHaveBeenCalledTimes(1);
  });

  it("treats authentication failures as auth service unavailability", async () => {
    prismaErrorMocks.isDatabaseUnavailableError.mockReturnValue(false);
    prismaErrorMocks.isDatabaseAuthenticationError.mockReturnValue(true);
    const { isAuthDatabaseUnavailable } = await loadAuthRouteDb();

    expect(isAuthDatabaseUnavailable(new Error("db auth"))).toBe(true);
    expect(prismaErrorMocks.isDatabaseAuthenticationError).toHaveBeenCalledTimes(1);
  });
});

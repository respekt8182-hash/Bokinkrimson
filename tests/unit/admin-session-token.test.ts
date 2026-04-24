import { afterEach, describe, expect, it } from "vitest";
import {
  createAdminSessionToken,
  getAdminAuthConfigurationError,
  verifyAdminSessionToken,
} from "../../src/lib/admin-session-token";

const originalAdminLogin = process.env.ADMIN_LOGIN;
const originalAdminJwtSecret = process.env.ADMIN_JWT_SECRET;
const originalAdminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

afterEach(() => {
  if (originalAdminLogin === undefined) {
    delete process.env.ADMIN_LOGIN;
  } else {
    process.env.ADMIN_LOGIN = originalAdminLogin;
  }

  if (originalAdminJwtSecret === undefined) {
    delete process.env.ADMIN_JWT_SECRET;
  } else {
    process.env.ADMIN_JWT_SECRET = originalAdminJwtSecret;
  }

  if (originalAdminPasswordHash === undefined) {
    delete process.env.ADMIN_PASSWORD_HASH;
  } else {
    process.env.ADMIN_PASSWORD_HASH = originalAdminPasswordHash;
  }
});

describe("admin session token", () => {
  it("reports configuration error when admin JWT secret is missing", () => {
    delete process.env.ADMIN_JWT_SECRET;
    delete process.env.ADMIN_LOGIN;
    delete process.env.ADMIN_PASSWORD_HASH;

    expect(getAdminAuthConfigurationError()).toBe(
      "Админ-вход не настроен: задайте ADMIN_JWT_SECRET длиной минимум 16 символов.",
    );
  });

  it("creates and verifies admin token payload", async () => {
    process.env.ADMIN_JWT_SECRET = "admin-secret-at-least-16-chars";
    process.env.ADMIN_LOGIN = "admin";
    process.env.ADMIN_PASSWORD_HASH = "$2b$10$abcdefghijklmnopqrstuv";

    const token = await createAdminSessionToken("admin", 3);
    const session = await verifyAdminSessionToken(token);

    expect(session).toEqual({
      isAdmin: true,
      login: "admin",
      sessionVersion: 3,
    });
  });

  it("returns null for broken token", async () => {
    process.env.ADMIN_JWT_SECRET = "admin-secret-at-least-16-chars";

    await expect(verifyAdminSessionToken("broken-token")).resolves.toBeNull();
  });
});

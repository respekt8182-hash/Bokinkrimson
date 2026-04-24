import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createAdminSessionToken } from "../../src/lib/admin-session-token";
import { proxy } from "../../src/proxy";

const originalAdminLogin = process.env.ADMIN_LOGIN;
const originalAdminJwtSecret = process.env.ADMIN_JWT_SECRET;
const originalAdminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

function makeRequest(pathname: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

beforeEach(() => {
  process.env.ADMIN_LOGIN = "admin";
  process.env.ADMIN_JWT_SECRET = "admin-secret-at-least-16-chars";
  process.env.ADMIN_PASSWORD_HASH = "$2b$10$abcdefghijklmnopqrstuv";
});

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

describe("admin proxy protection", () => {
  it("redirects unauthenticated admin requests to login", async () => {
    const response = await proxy(makeRequest("/admin"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/login");
  });

  it("clears invalid admin cookie and redirects protected page to login", async () => {
    const response = await proxy(makeRequest("/admin", "boking_admin_session=broken-token"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/login");
    expect(response.headers.get("set-cookie")).toContain("boking_admin_session=");
  });

  it("allows opening login page even if an invalid cookie is present", async () => {
    const response = await proxy(makeRequest("/admin/login", "boking_admin_session=broken-token"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("boking_admin_session=");
  });

  it("redirects authenticated login page to admin home", async () => {
    const token = await createAdminSessionToken("admin");
    const response = await proxy(makeRequest("/admin/login", `boking_admin_session=${token}`));

    expect(response.headers.get("location")).toBe("http://localhost:3000/admin");
  });

  it("allows protected admin page with valid standalone session", async () => {
    const token = await createAdminSessionToken("admin");
    const response = await proxy(makeRequest("/admin", `boking_admin_session=${token}`));

    expect(response.headers.get("location")).toBeNull();
  });
});

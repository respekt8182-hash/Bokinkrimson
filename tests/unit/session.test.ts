// Unit tests for session token creation, parsing, and expiration handling.
import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "../../src/lib/session";

describe("session token", () => {
  it("creates and verifies token payload", async () => {
    const token = await createSessionToken({
      id: "user_1",
      phone: "79781234567",
      firstName: "Owner",
      lastName: "User",
      role: "USER",
      sessionVersion: 0,
    });

    const session = await verifySessionToken(token);

    expect(session).not.toBeNull();
    expect(session?.id).toBe("user_1");
    expect(session?.phone).toBe("79781234567");
    expect(session?.role).toBe("USER");
    expect(session?.sessionVersion).toBe(0);
  });

  it("returns null for invalid token", async () => {
    const session = await verifySessionToken("broken-token");
    expect(session).toBeNull();
  });
});

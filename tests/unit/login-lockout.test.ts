import { beforeEach, describe, expect, it } from "vitest";
import {
  clearFailedLoginLockoutStoresForTest,
  createFailedLoginLockout,
} from "../../src/lib/login-lockout";

describe("failed login lockout", () => {
  beforeEach(() => {
    clearFailedLoginLockoutStoresForTest();
  });

  it("locks a key on the eighth failed attempt for the configured duration", () => {
    let now = 1_000;
    const lockout = createFailedLoginLockout({
      id: "test-login",
      lockoutMs: 60_000,
      maxFailedAttempts: 8,
      now: () => now,
    });

    for (let attempt = 1; attempt <= 7; attempt += 1) {
      const result = lockout.recordFailure("127.0.0.1");
      expect(result.locked).toBe(false);
      expect(result.remainingAttempts).toBe(8 - attempt);
    }

    const locked = lockout.recordFailure("127.0.0.1");
    expect(locked.locked).toBe(true);
    expect(locked.retryAfterSeconds).toBe(60);

    now += 30_000;
    const duringLockout = lockout.check("127.0.0.1");
    expect(duringLockout.locked).toBe(true);
    expect(duringLockout.retryAfterSeconds).toBe(30);

    now += 30_001;
    const afterLockout = lockout.check("127.0.0.1");
    expect(afterLockout.locked).toBe(false);
    expect(afterLockout.remainingAttempts).toBe(8);
  });

  it("can reset failures after a successful login", () => {
    const lockout = createFailedLoginLockout({
      id: "test-reset",
      lockoutMs: 60_000,
      maxFailedAttempts: 8,
      now: () => 1_000,
    });

    lockout.recordFailure("127.0.0.1");
    lockout.recordFailure("127.0.0.1");
    lockout.reset("127.0.0.1");

    const result = lockout.check("127.0.0.1");
    expect(result.locked).toBe(false);
    expect(result.remainingAttempts).toBe(8);
  });
});

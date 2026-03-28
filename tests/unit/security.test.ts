// Unit tests for security helpers, origin checks, and request-guard behavior.
import { describe, expect, it } from "vitest";
import { getRequestIp } from "../../src/lib/security";

function makeRequest(headers: HeadersInit = {}) {
  return new Request("http://localhost:3000/api/auth/login", { headers });
}

describe("getRequestIp", () => {
  it("uses first address from x-forwarded-for", () => {
    const request = makeRequest({
      "x-forwarded-for": "198.51.100.1, 203.0.113.2",
      "x-real-ip": "192.0.2.9",
    });

    expect(getRequestIp(request)).toBe("198.51.100.1");
  });

  it("uses x-real-ip when x-forwarded-for is absent", () => {
    const request = makeRequest({
      "x-real-ip": "192.0.2.9",
    });

    expect(getRequestIp(request)).toBe("192.0.2.9");
  });

  it("normalizes ipv6-mapped ipv4 addresses", () => {
    const request = makeRequest({
      "x-real-ip": "::ffff:10.0.0.5",
    });

    expect(getRequestIp(request)).toBe("10.0.0.5");
  });

  it("falls back to deterministic client fingerprint when no ip headers exist", () => {
    const requestA = makeRequest({
      "user-agent": "Mozilla/5.0 Example Browser",
      "accept-language": "ru-RU,ru;q=0.9",
    });
    const requestB = makeRequest({
      "user-agent": "Mozilla/5.0 Example Browser",
      "accept-language": "ru-RU,ru;q=0.9",
    });

    const keyA = getRequestIp(requestA);
    const keyB = getRequestIp(requestB);

    expect(keyA.startsWith("fp-")).toBe(true);
    expect(keyA).toBe(keyB);
  });

  it("produces different fingerprint for different clients", () => {
    const requestA = makeRequest({
      "user-agent": "Mozilla/5.0 Example Browser A",
      "accept-language": "ru-RU,ru;q=0.9",
    });
    const requestB = makeRequest({
      "user-agent": "Mozilla/5.0 Example Browser B",
      "accept-language": "ru-RU,ru;q=0.9",
    });

    expect(getRequestIp(requestA)).not.toBe(getRequestIp(requestB));
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { getAllowedOrigins, isSameOrigin } from "../../src/lib/csrf";

type RequestContextOptions = {
  url?: string;
  headers?: HeadersInit;
};

function makeRequestContext(options: RequestContextOptions = {}) {
  return {
    headers: new Headers(options.headers),
    nextUrl: new URL(options.url ?? "http://localhost:3000/api/auth/login"),
  };
}

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalTrustedOrigins = process.env.CSRF_TRUSTED_ORIGINS;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }

  if (originalTrustedOrigins === undefined) {
    delete process.env.CSRF_TRUSTED_ORIGINS;
  } else {
    process.env.CSRF_TRUSTED_ORIGINS = originalTrustedOrigins;
  }
});

describe("isSameOrigin", () => {
  it("accepts origin that matches the incoming host header", () => {
    const request = makeRequestContext({
      headers: {
        host: "192.168.1.50:3000",
        origin: "http://192.168.1.50:3000",
      },
    });

    expect(isSameOrigin(request)).toBe(true);
  });

  it("accepts origin that matches forwarded host and protocol", () => {
    const request = makeRequestContext({
      headers: {
        host: "127.0.0.1:3000",
        origin: "https://booking.example.com",
        "x-forwarded-host": "booking.example.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(isSameOrigin(request)).toBe(true);
  });

  it("accepts origin explicitly listed in CSRF_TRUSTED_ORIGINS", () => {
    process.env.CSRF_TRUSTED_ORIGINS = "http://192.168.1.50:3000 http://boking.local:3000";

    const request = makeRequestContext({
      headers: {
        host: "localhost:3000",
        origin: "http://boking.local:3000",
      },
    });

    expect(isSameOrigin(request)).toBe(true);
  });

  it("rejects malformed origin headers", () => {
    const request = makeRequestContext({
      headers: {
        host: "localhost:3000",
        origin: "null",
      },
    });

    expect(isSameOrigin(request)).toBe(false);
  });

  it("rejects unrelated origins", () => {
    const request = makeRequestContext({
      headers: {
        host: "localhost:3000",
        origin: "https://evil.example",
      },
    });

    expect(isSameOrigin(request)).toBe(false);
  });
});

describe("getAllowedOrigins", () => {
  it("includes current request origin and configured origins without duplicates", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.CSRF_TRUSTED_ORIGINS = "http://192.168.1.50:3000";

    const origins = getAllowedOrigins(
      makeRequestContext({
        headers: {
          host: "192.168.1.50:3000",
        },
      }),
    );

    expect(origins).toEqual(["http://localhost:3000", "http://192.168.1.50:3000"]);
  });
});

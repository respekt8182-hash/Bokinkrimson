import { afterEach, describe, expect, it } from "vitest";
import {
  validateUploadFile,
  sanitizeStoredFileName,
} from "../../src/lib/upload-validation";
import { normalizeStorageKey } from "../../src/lib/storage";
import {
  createRateLimiter,
  RateLimitConfigurationError,
} from "../../src/lib/rate-limit";
import { collectPublicStorageKeysFromUnknown } from "../../src/lib/storage-cleanup";

const originalNodeEnv = process.env.NODE_ENV;
const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const originalRateLimitMode = process.env.RATE_LIMIT_MODE;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;

  if (originalUpstashUrl === undefined) {
    delete process.env.UPSTASH_REDIS_REST_URL;
  } else {
    process.env.UPSTASH_REDIS_REST_URL = originalUpstashUrl;
  }

  if (originalUpstashToken === undefined) {
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  } else {
    process.env.UPSTASH_REDIS_REST_TOKEN = originalUpstashToken;
  }

  if (originalRateLimitMode === undefined) {
    delete process.env.RATE_LIMIT_MODE;
  } else {
    process.env.RATE_LIMIT_MODE = originalRateLimitMode;
  }
});

describe("upload validation hardening", () => {
  it("rejects dangerous document uploads even when client metadata pretends they are pdf", async () => {
    const file = new File(["<script>alert('xss')</script>"], "invoice.pdf", {
      type: "application/pdf",
    });

    await expect(
      validateUploadFile({
        file,
        allowedKinds: ["document"],
        maxSizeBytes: 1024 * 1024,
      }),
    ).rejects.toThrow("UNSUPPORTED_FILE_TYPE");
  });

  it("accepts safe pdf uploads even when extension and content-type are spoofed", async () => {
    const file = new File(["%PDF-1.7\n1 0 obj\n"], "offer.html", {
      type: "text/html",
    });

    const result = await validateUploadFile({
      file,
      allowedKinds: ["document"],
      maxSizeBytes: 1024 * 1024,
    });

    expect(result.detectedMimeType).toBe("application/pdf");
    expect(result.detectedExtension).toBe("pdf");
  });

  it("sanitizes original file names into plain text", () => {
    expect(sanitizeStoredFileName("<b>../../offer</b>.pdf")).toBe("offer.pdf");
  });

  it("replaces whitespace so generated media urls stay schema-safe", () => {
    expect(sanitizeStoredFileName("my summer photo 2026 .jpg")).toBe("my-summer-photo-2026.jpg");
  });
});

describe("storage key normalization", () => {
  it("blocks traversal segments", () => {
    expect(() => normalizeStorageKey("../private/secret.txt")).toThrow("INVALID_STORAGE_KEY");
    expect(() => normalizeStorageKey("images/../../secret.txt")).toThrow("INVALID_STORAGE_KEY");
  });

  it("normalizes safe paths", () => {
    expect(normalizeStorageKey("\\avatars\\user-1\\photo.webp")).toBe(
      "avatars/user-1/photo.webp",
    );
  });
});

describe("unused upload cleanup helpers", () => {
  it("collects managed upload keys from nested draft and snapshot data", () => {
    const keys = new Set<string>();

    collectPublicStorageKeysFromUnknown(
      {
        media: [
          { url: "/uploads/properties/property-1/photo.webp" },
          { storageKey: "properties/property-1/rooms/room-1/photo.webp" },
        ],
        ignored: "https://example.com/external.webp",
      },
      keys,
    );

    expect([...keys].sort()).toEqual([
      "properties/property-1/photo.webp",
      "properties/property-1/rooms/room-1/photo.webp",
    ]);
  });
});

describe("production rate limiting configuration", () => {
  it("falls back to in-memory limiter in production for a single self-hosted node", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.RATE_LIMIT_MODE;

    const limiter = createRateLimiter({
      id: "security-test",
      windowMs: 60_000,
      maxRequests: 5,
    });

    await expect(limiter.limit("client-1")).resolves.toMatchObject({
      allowed: true,
      source: "memory",
    });
  });

  it("fails closed when Upstash mode is explicitly required but not configured", async () => {
    process.env.NODE_ENV = "production";
    process.env.RATE_LIMIT_MODE = "upstash";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    expect(() =>
      createRateLimiter({
        id: "security-test-upstash",
        windowMs: 60_000,
        maxRequests: 5,
      }),
    ).toThrow(RateLimitConfigurationError);
  });
});

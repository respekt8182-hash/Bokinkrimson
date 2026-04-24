import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const rateLimitMocks = vi.hoisted(() => ({
  limit: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  propertyFindUnique: vi.fn(),
  propertyDocumentCount: vi.fn(),
  propertyDocumentCreate: vi.fn(),
  propertyDocumentFindMany: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  uploadToStorage: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: authMocks.getSession,
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({
    limit: rateLimitMocks.limit,
  }),
  RateLimitBackendUnavailableError: class RateLimitBackendUnavailableError extends Error {},
  RateLimitConfigurationError: class RateLimitConfigurationError extends Error {},
}));

vi.mock("@/lib/db", () => ({
  db: {
    property: {
      findUnique: dbMocks.propertyFindUnique,
    },
    propertyDocument: {
      count: dbMocks.propertyDocumentCount,
      create: dbMocks.propertyDocumentCreate,
      findMany: dbMocks.propertyDocumentFindMany,
    },
  },
}));

vi.mock("@/lib/storage", () => ({
  uploadToStorage: storageMocks.uploadToStorage,
}));

async function loadDocumentsRoute() {
  vi.resetModules();
  return import("../../src/app/api/properties/[id]/documents/route");
}

describe("property documents route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ id: "user-1" });
    rateLimitMocks.limit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      retryAfterSeconds: 60,
      resetAt: Date.now() + 60_000,
      source: "memory",
    });
    dbMocks.propertyFindUnique.mockResolvedValue({
      id: "property-1",
      ownerId: "user-1",
      ownerDeletedAt: null,
    });
    dbMocks.propertyDocumentCount.mockResolvedValue(0);
    storageMocks.uploadToStorage.mockResolvedValue({ url: null });
  });

  it("rejects dangerous document uploads", async () => {
    const { POST } = await loadDocumentsRoute();
    const formData = new FormData();
    formData.set(
      "file",
      new File(["<html><body>owned</body></html>"], "contract.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(
      new Request("http://localhost:3000/api/properties/property-1/documents", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: "property-1" }) },
    );

    expect(response.status).toBe(400);
    expect(storageMocks.uploadToStorage).not.toHaveBeenCalled();
    expect(dbMocks.propertyDocumentCreate).not.toHaveBeenCalled();
  });

  it("accepts safe pdf uploads and does not leak storage keys in response", async () => {
    const { POST } = await loadDocumentsRoute();
    const now = new Date("2026-04-05T12:00:00.000Z");
    dbMocks.propertyDocumentCreate.mockResolvedValue(null);
    dbMocks.propertyDocumentFindMany.mockResolvedValue([
      {
        id: "doc-1",
        propertyId: "property-1",
        type: "DOCUMENT",
        title: "contract.pdf",
        fileName: "contract.pdf",
        mimeType: "application/pdf",
        fileSize: 24,
        url: "/api/properties/property-1/documents/doc-1",
        storageKey: "properties/property-1/documents/doc-1/secret.pdf",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const formData = new FormData();
    formData.set(
      "file",
      new File(["%PDF-1.7\n1 0 obj\n"], "contract.html", {
        type: "text/html",
      }),
    );

    const response = await POST(
      new Request("http://localhost:3000/api/properties/property-1/documents", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: "property-1" }) },
    );

    expect(response.status).toBe(201);
    expect(storageMocks.uploadToStorage).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: "private",
        contentDisposition: "attachment",
        contentType: "application/pdf",
      }),
    );

    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].storageKey).toBeUndefined();
    expect(body.items[0].mimeType).toBe("application/pdf");
  });
});

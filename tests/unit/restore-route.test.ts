import { beforeEach, describe, expect, it, vi } from "vitest";

const adminMocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
}));

const lifecycleMocks = vi.hoisted(() => ({
  isSoftDeleteWindowActive: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  propertyFindUnique: vi.fn(),
  propertyDelete: vi.fn(),
  propertyDeleteMany: vi.fn(),
  propertyUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  getAdminSession: adminMocks.getAdminSession,
}));

vi.mock("@/lib/admin-entity-lifecycle", () => ({
  isSoftDeleteWindowActive: lifecycleMocks.isSoftDeleteWindowActive,
}));

vi.mock("@/lib/admin-audit", () => ({
  writeAdminAuditLog: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    property: {
      findUnique: dbMocks.propertyFindUnique,
      delete: dbMocks.propertyDelete,
      deleteMany: dbMocks.propertyDeleteMany,
      update: dbMocks.propertyUpdate,
    },
    $transaction: dbMocks.transaction,
  },
}));

async function loadRestoreRoute() {
  vi.resetModules();
  return import("../../src/app/api/admin/properties/[id]/restore/route");
}

describe("property restore route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMocks.getAdminSession.mockResolvedValue({ id: "admin-1" });
    lifecycleMocks.isSoftDeleteWindowActive.mockReturnValue(false);
    dbMocks.propertyFindUnique.mockResolvedValue({
      id: "property-1",
      name: "Villa",
      status: "PUBLISHED",
      ownerDeletedAt: new Date("2026-04-01T00:00:00.000Z"),
      ownerDeletionExpiresAt: new Date("2026-04-02T00:00:00.000Z"),
    });
  });

  it("returns expiry error without hard-deleting the property", async () => {
    const { POST } = await loadRestoreRoute();
    const response = await POST(
      new Request("http://localhost:3000/api/admin/properties/property-1/restore", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "property-1" }) },
    );

    expect(response.status).toBe(410);
    expect(dbMocks.propertyDelete).not.toHaveBeenCalled();
    expect(dbMocks.propertyDeleteMany).not.toHaveBeenCalled();
    expect(dbMocks.propertyUpdate).not.toHaveBeenCalled();
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });
});

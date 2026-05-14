import { describe, expect, it } from "vitest";

import { __compatTestUtils } from "../../src/lib/db";

describe("db compatibility sanitizer", () => {
  it("replaces include trees with safe select trees when columns are missing", () => {
    const missingColumnsByModel = new Map<string, Set<string>>([
      ["Property", new Set(["isPublishedVisible"])],
      ["User", new Set(["deletedAt", "deletionExpiresAt"])],
    ]);

    const args = {
      where: {
        status: "published",
        isPublishedVisible: true,
      },
      include: {
        owner: {
          include: {
            properties: true,
          },
        },
      },
    };

    const sanitized = __compatTestUtils.sanitizeCompatArgs(
      args,
      "Property",
      missingColumnsByModel,
      "modelArgs",
    );

    expect(sanitized).toMatchObject({
      where: {
        status: "published",
      },
      select: {
        id: true,
        ownerId: true,
        owner: {
          select: {
            id: true,
            email: true,
            properties: {
              select: {
                id: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });
    expect("include" in sanitized).toBe(false);
    expect("isPublishedVisible" in (sanitized.select as Record<string, unknown>)).toBe(false);
    expect(
      "deletedAt" in
        ((sanitized.select as Record<string, { select: Record<string, unknown> }>).owner
          .select as Record<string, unknown>),
    ).toBe(false);
    expect(
      "isPublishedVisible" in
        ((
          sanitized.select as Record<
            string,
            { select: Record<string, { select: Record<string, unknown> }> }
          >
        ).owner.select.properties.select as Record<string, unknown>),
    ).toBe(false);
  });

  it("removes missing fields from explicit selects without changing the selection shape", () => {
    const missingColumnsByModel = new Map<string, Set<string>>([
      ["Property", new Set(["isPublishedVisible"])],
    ]);

    const args = {
      select: {
        id: true,
        isPublishedVisible: true,
      },
    };

    expect(
      __compatTestUtils.sanitizeCompatArgs(args, "Property", missingColumnsByModel, "modelArgs"),
    ).toEqual({
      select: {
        id: true,
      },
    });
  });

  it("skips omit injection for operations that do not support model selection", () => {
    const missingColumnsByModel = new Map<string, Set<string>>([
      ["Property", new Set(["isPublishedVisible"])],
    ]);

    const args = {
      where: {
        status: "published",
        isPublishedVisible: true,
      },
    };

    expect(
      __compatTestUtils.sanitizeCompatArgs(args, "Property", missingColumnsByModel, "plain"),
    ).toEqual({
      where: {
        status: "published",
      },
    });
  });

  it("sanitizes create payloads even when Prisma exposes a lower-case model name", () => {
    const missingColumnsByModel = new Map<string, Set<string>>([
      ["RoomPrice", new Set(["priceType", "minNights"])],
    ]);

    const args = {
      data: {
        roomId: "room_1",
        dateFrom: new Date("2026-05-11T00:00:00.000Z"),
        dateTo: new Date("2026-05-12T00:00:00.000Z"),
        price: 1500,
        priceType: "PER_PERSON",
        minNights: 3,
        currency: "RUB",
      },
    };

    expect(
      __compatTestUtils.sanitizeCompatArgs(args, "roomPrice", missingColumnsByModel, "modelArgs"),
    ).toEqual({
      data: {
        roomId: "room_1",
        dateFrom: new Date("2026-05-11T00:00:00.000Z"),
        dateTo: new Date("2026-05-12T00:00:00.000Z"),
        price: 1500,
        currency: "RUB",
      },
      select: {
        id: true,
        roomId: true,
        dateFrom: true,
        dateTo: true,
        price: true,
        minGuests: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("keeps relation filters clean while adding a safe root select", () => {
    const missingColumnsByModel = new Map<string, Set<string>>([
      ["Excursion", new Set(["contactPhone2", "deletedAt", "deletionExpiresAt"])],
      ["User", new Set(["deletedAt", "deletionExpiresAt"])],
    ]);

    const args = {
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        owner: {
          is: {
            deletedAt: null,
          },
        },
      },
    };

    const sanitized = __compatTestUtils.sanitizeCompatArgs(
      args,
      "Excursion",
      missingColumnsByModel,
      "modelArgs",
    );

    expect(sanitized).toMatchObject({
      where: {
        status: "PUBLISHED",
        owner: {
          is: {},
        },
      },
      select: {
        id: true,
        title: true,
      },
    });
    expect("contactPhone2" in (sanitized.select as Record<string, unknown>)).toBe(false);
    expect("select" in (sanitized.where.owner.is as Record<string, unknown>)).toBe(false);
  });

  it("hydrates missing excursion compatibility columns with safe defaults", () => {
    const missingColumnsByModel = new Map<string, Set<string>>([
      ["Excursion", new Set(["contactPhone2", "pendingEditStatus", "publishedSnapshot"])],
    ]);

    expect(
      __compatTestUtils.hydrateCompatResult(
        {
          id: "excursion_1",
          title: "Test excursion",
        },
        "Excursion",
        missingColumnsByModel,
      ),
    ).toEqual({
      id: "excursion_1",
      title: "Test excursion",
      contactPhone2: null,
      pendingEditStatus: null,
      publishedSnapshot: null,
    });
  });

  it("hydrates missing user compatibility columns with safe defaults", () => {
    const missingColumnsByModel = new Map<string, Set<string>>([
      [
        "User",
        new Set([
          "pendingEmail",
          "emailChangeTokenHash",
          "emailChangeTokenExpiresAt",
          "emailChangeRequestedAt",
          "emailVerifiedAt",
          "passwordChangedAt",
          "sessionVersion",
          "lastLoginAt",
          "lastSeenAt",
          "lastLogoutAt",
          "deletedAt",
          "deletionExpiresAt",
        ]),
      ],
    ]);

    expect(
      __compatTestUtils.hydrateCompatResult(
        {
          id: "user_1",
          email: "owner@example.com",
        },
        "User",
        missingColumnsByModel,
      ),
    ).toEqual({
      id: "user_1",
      email: "owner@example.com",
      pendingEmail: null,
      emailChangeTokenHash: null,
      emailChangeTokenExpiresAt: null,
      emailChangeRequestedAt: null,
      emailVerifiedAt: null,
      passwordChangedAt: null,
      sessionVersion: 0,
      lastLoginAt: null,
      lastSeenAt: null,
      lastLogoutAt: null,
      deletedAt: null,
      deletionExpiresAt: null,
    });
  });
});

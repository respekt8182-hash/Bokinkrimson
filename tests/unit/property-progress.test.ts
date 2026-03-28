// Unit tests for owner property wizard progress and readiness calculations.
import { MediaType, PetsPolicy, PropertyStatus, SmokingPolicy } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  getPropertyAutoModerationUpdate,
  getPropertyPaymentReadinessIssues,
  getPropertyProgress,
  getPropertyWorkflowStatusLabel,
} from "../../src/lib/properties";

function buildDraft(
  overrides: Partial<Parameters<typeof getPropertyProgress>[0]> = {},
): Parameters<typeof getPropertyProgress>[0] {
  return {
    type: "hotel",
    locationId: "yalta",
    locationName: "Ялта",
    name: "Тестовый объект",
    address: "ул. Тестовая, 1",
    seaDistance: "700 м до моря",
    latitude: 44.4952 as never,
    longitude: 34.1663 as never,
    phone: "+7 999 123-45-67",
    description: "Описание объекта заполнено для прохождения шага 5",
    checkInFrom: "14:00",
    checkOutUntil: "12:00",
    childrenAllowed: false,
    childrenMinAge: null,
    petsPolicy: PetsPolicy.FORBIDDEN,
    smokingPolicy: SmokingPolicy.FORBIDDEN,
    quietHoursEnabled: false,
    quietHoursFrom: null,
    quietHoursTo: null,
    classificationApplicable: true,
    starRating: null,
    registryNumber: "KSR-12345",
    registryNumberPending: null,
    selfAssessmentPassed: null,
    media: [
      {
        id: "media-1",
        type: MediaType.IMAGE,
        url: "/image.jpg",
        sortOrder: 0,
      },
    ],
    rooms: [
      {
        id: "room-1",
        prices: [{ id: "price-1" }],
      },
    ],
    ...overrides,
  };
}

describe("property progress step7", () => {
  it("counts step7 as complete when classification is not applicable", () => {
    const progress = getPropertyProgress(
      buildDraft({
        classificationApplicable: false,
        registryNumber: null,
        registryNumberPending: null,
      }),
    );

    expect(progress.step7).toBe(true);
    expect(progress.lastCompletedStep).toBe(10);
  });

  it("keeps step7 incomplete without registry when classification is applicable", () => {
    const progress = getPropertyProgress(
      buildDraft({
        classificationApplicable: true,
        registryNumber: null,
        registryNumberPending: null,
      }),
    );

    expect(progress.step7).toBe(false);
    expect(progress.lastCompletedStep).toBe(6);
  });
});

describe("property workflow status label", () => {
  it("shows pending edit states for published properties", () => {
    expect(
      getPropertyWorkflowStatusLabel(PropertyStatus.PUBLISHED, null, PropertyStatus.DRAFT),
    ).toBe("Черновик изменений");
    expect(
      getPropertyWorkflowStatusLabel(
        PropertyStatus.PUBLISHED,
        "Исправьте описание",
        PropertyStatus.REJECTED,
      ),
    ).toBe("Изменения отклонены");
  });
});

describe("property auto moderation update", () => {
  it("moves a paid draft to moderation", () => {
    expect(getPropertyAutoModerationUpdate(PropertyStatus.DRAFT, null)).toEqual({
      status: PropertyStatus.PENDING_MODERATION,
      moderationNotes: null,
      moderatedById: null,
      moderatedAt: null,
    });
  });

  it("moves a paid published edit to moderation without touching the live version", () => {
    expect(getPropertyAutoModerationUpdate(PropertyStatus.PUBLISHED, PropertyStatus.DRAFT)).toEqual(
      {
        pendingEditStatus: PropertyStatus.PENDING_MODERATION,
        moderationNotes: null,
        moderatedById: null,
        moderatedAt: null,
      },
    );
  });

  it("does not auto-submit already published cards without a pending edit", () => {
    expect(getPropertyAutoModerationUpdate(PropertyStatus.PUBLISHED, null)).toBeNull();
  });
});

describe("property payment readiness issues", () => {
  it("returns targeted issues with direct links", () => {
    const progress = getPropertyProgress(
      buildDraft({
        description: null,
        checkInFrom: null,
        registryNumber: null,
        media: [],
        rooms: [{ id: "room-1", prices: [] }],
      }),
    );

    const issues = getPropertyPaymentReadinessIssues("property-1", progress);
    const issueIds = issues.map((issue) => issue.id);

    expect(issueIds).toEqual([
      "about-info",
      "about-ksr",
      "about-photo",
      "rules",
      "chessboard-pricing",
    ]);
    expect(issues.find((issue) => issue.id === "about-info")?.href).toBe(
      "/dashboard/objects/property-1/about?block=info",
    );
    expect(issues.find((issue) => issue.id === "chessboard-pricing")?.href).toBe(
      "/dashboard/objects/property-1/chessboard",
    );
  });

  it("reports missing room category without duplicate chessboard pricing issue", () => {
    const progress = getPropertyProgress(
      buildDraft({
        rooms: [],
      }),
    );

    const issueIds = getPropertyPaymentReadinessIssues("property-2", progress).map(
      (issue) => issue.id,
    );

    expect(issueIds).toContain("room-categories");
    expect(issueIds).not.toContain("chessboard-pricing");
  });
});

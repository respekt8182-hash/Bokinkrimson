import {
  ExcursionAvailabilityMode,
  ExcursionOfferType,
  ExcursionStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canAdminApproveExcursionModeration,
  canAdminRequestExcursionChanges,
  getExcursionAutoModerationUpdate,
  getMissingExcursionPublishFields,
} from "../../src/lib/excursions";

describe("excursion payment and publication helpers", () => {
  it("requires tour-specific publish fields", () => {
    const missing = getMissingExcursionPublishFields({
      offerType: ExcursionOfferType.TOUR,
      title: "Горный тур",
      locationId: "yalta",
      categoryId: "mountains",
      description: "Трехдневная программа по горам Крыма",
      durationMinutes: null,
      durationDays: 3,
      durationNights: 2,
      timelineLength: 0,
      itineraryDaysLength: 0,
      routeLocationsLength: 0,
      startPoint: null,
      availabilityMode: ExcursionAvailabilityMode.DATED,
      availabilityNote: null,
      hasRegularSchedule: false,
      hasSessions: true,
      priceFrom: 15000,
      priceUnitLabel: null,
      contactFirstName: "Иван",
      contactLastName: "Петров",
      contactPhone: "+79990000000",
      contactPhone2: null,
      accommodationProvided: null,
      accommodationType: null,
      photoUrls: ["1.jpg", "2.jpg", "3.jpg"],
    });

    expect(missing).toContain("стартовая точка");
    expect(missing).toContain("единица цены");
    expect(missing).toContain("программа по дням или маршрут");
    expect(missing).toContain("проживание или отметка, что оно не включено");
  });

  it("accepts a complete excursion payload", () => {
    const missing = getMissingExcursionPublishFields({
      offerType: ExcursionOfferType.EXCURSION,
      title: "Ялта за один день",
      locationId: "yalta",
      categoryId: "city",
      description: "Обзорная экскурсия по Ялте с прогулкой и остановками.",
      durationMinutes: 240,
      durationDays: null,
      durationNights: null,
      timelineLength: 4,
      itineraryDaysLength: 0,
      routeLocationsLength: 0,
      startPoint: "Набережная",
      availabilityMode: ExcursionAvailabilityMode.REGULAR,
      availabilityNote: null,
      hasRegularSchedule: true,
      hasSessions: false,
      priceFrom: 2500,
      priceUnitLabel: null,
      contactFirstName: "Ирина",
      contactLastName: "Соколова",
      contactPhone: "+79991112233",
      contactPhone2: null,
      accommodationProvided: null,
      accommodationType: null,
      photoUrls: ["1.jpg", "2.jpg", "3.jpg"],
    });

    expect(missing).toEqual([]);
  });

  it("builds auto-moderation update for draft and published edit states", () => {
    expect(getExcursionAutoModerationUpdate(ExcursionStatus.DRAFT, null)).toEqual({
      status: ExcursionStatus.PENDING_MODERATION,
      moderationNotes: null,
      moderatedById: null,
      moderatedAt: null,
    });

    expect(
      getExcursionAutoModerationUpdate(
        ExcursionStatus.PUBLISHED,
        ExcursionStatus.REJECTED,
      ),
    ).toEqual({
      pendingEditStatus: ExcursionStatus.PENDING_MODERATION,
      moderationNotes: null,
      moderatedById: null,
      moderatedAt: null,
    });
  });

  it("allows admins to publish primary draft programs from moderation", () => {
    expect(canAdminApproveExcursionModeration(ExcursionStatus.DRAFT, null)).toBe(true);
    expect(canAdminApproveExcursionModeration(ExcursionStatus.PENDING_MODERATION, null)).toBe(
      true,
    );
    expect(canAdminApproveExcursionModeration(ExcursionStatus.PUBLISHED, null)).toBe(false);
  });

  it("keeps published draft edits out of one-click approval", () => {
    expect(
      canAdminApproveExcursionModeration(
        ExcursionStatus.PUBLISHED,
        ExcursionStatus.DRAFT,
      ),
    ).toBe(false);
    expect(
      canAdminApproveExcursionModeration(
        ExcursionStatus.PUBLISHED,
        ExcursionStatus.PENDING_MODERATION,
      ),
    ).toBe(true);
    expect(
      canAdminRequestExcursionChanges(
        ExcursionStatus.PUBLISHED,
        ExcursionStatus.PENDING_MODERATION,
      ),
    ).toBe(true);
  });
});

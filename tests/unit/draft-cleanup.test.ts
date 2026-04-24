import { ExcursionStatus, PropertyStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isExcursionEmptyDraft } from "../../src/lib/excursions";
import { isPropertyEmptyDraft } from "../../src/lib/properties";

function buildPropertyDraft(
  overrides: Partial<Parameters<typeof isPropertyEmptyDraft>[0]> = {},
): Parameters<typeof isPropertyEmptyDraft>[0] {
  return {
    status: PropertyStatus.DRAFT,
    type: null,
    locationId: null,
    locationName: null,
    name: null,
    address: null,
    seaDistance: null,
    latitude: null,
    longitude: null,
    phone: null,
    phoneName: null,
    phone2: null,
    phone2Name: null,
    phone3: null,
    phone3Name: null,
    websiteUrl: null,
    contactEmail: null,
    contactPersonName: null,
    contactPersonRole: null,
    listingChannels: null,
    whatsappUrl: null,
    telegramUrl: null,
    vkUrl: null,
    maxUrl: null,
    okUrl: null,
    description: null,
    checkInFrom: null,
    checkOutUntil: null,
    childrenAllowed: null,
    childrenMinAge: null,
    petsPolicy: null,
    smokingPolicy: null,
    quietHoursEnabled: null,
    quietHoursFrom: null,
    quietHoursTo: null,
    parkingInfo: null,
    mealOptions: null,
    prepaymentPolicy: null,
    classificationApplicable: false,
    starRating: null,
    registryNumber: null,
    registryNumberPending: null,
    registryModerationSubmittedAt: null,
    selfAssessmentPassed: null,
    amenities: [],
    customAmenities: [],
    media: [],
    rooms: [],
    documents: [],
    payments: [],
    ...overrides,
  };
}

function buildExcursionDraft(
  overrides: Partial<Parameters<typeof isExcursionEmptyDraft>[0]> = {},
): Parameters<typeof isExcursionEmptyDraft>[0] {
  return {
    status: ExcursionStatus.DRAFT,
    subtypeLabel: null,
    title: null,
    locationId: null,
    locationName: null,
    mainLocationId: null,
    anchorLocationId: null,
    districtId: null,
    categoryId: null,
    address: null,
    latitude: null,
    longitude: null,
    startPoint: null,
    meetingPointText: null,
    meetingLocationId: null,
    description: null,
    shortDescription: null,
    fullDescription: null,
    routeDescription: null,
    durationMinutes: null,
    durationDays: null,
    durationNights: null,
    finishPoint: null,
    scheduleText: null,
    availabilityNote: null,
    format: null,
    groupSizeMin: null,
    groupSizeMax: null,
    ageLimit: null,
    isKidFriendly: null,
    difficulty: null,
    priceFrom: null,
    priceTo: null,
    includedText: null,
    notIncludedText: null,
    cancellationPolicy: null,
    transferDetails: null,
    minBookingNoticeHours: null,
    contactFirstName: null,
    contactLastName: null,
    contactPhone: null,
    contactEmail: null,
    websiteUrl: null,
    whatsappUrl: null,
    telegramUrl: null,
    vkUrl: null,
    maxUrl: null,
    okUrl: null,
    priceUnitLabel: null,
    accommodationProvided: null,
    accommodationType: null,
    accommodationNights: null,
    accommodationFormat: null,
    accommodationComment: null,
    tourKind: null,
    departureMode: null,
    arrivalInfo: null,
    departureInfo: null,
    insuranceIncluded: null,
    insuranceComment: null,
    safetyInfo: null,
    routeConditions: null,
    photoUrls: [],
    videoUrls: [],
    timeline: [],
    pricingTiers: [],
    faqItems: [],
    extraOptions: [],
    itineraryDays: [],
    includedItems: [],
    excludedItems: [],
    languageCodes: [],
    physicalRequirements: [],
    whatToBring: [],
    tags: [],
    transportModes: [],
    roomTypes: [],
    documentsRequired: [],
    equipmentProvided: [],
    pickupLocations: [],
    routeLocations: [],
    sessions: [],
    scheduleRules: [],
    payments: [],
    ...overrides,
  };
}

describe("property empty draft detection", () => {
  it("recognizes a fully blank property draft", () => {
    expect(isPropertyEmptyDraft(buildPropertyDraft())).toBe(true);
  });

  it("keeps partially filled property draft from cleanup", () => {
    expect(
      isPropertyEmptyDraft(
        buildPropertyDraft({
          name: "Гостевой дом у моря",
        }),
      ),
    ).toBe(false);
  });

  it("treats uploaded media as meaningful content", () => {
    expect(
      isPropertyEmptyDraft(
        buildPropertyDraft({
          media: [{ id: "media-1" }],
        }),
      ),
    ).toBe(false);
  });
});

describe("excursion empty draft detection", () => {
  it("recognizes a fully blank excursion draft", () => {
    expect(isExcursionEmptyDraft(buildExcursionDraft())).toBe(true);
  });

  it("keeps titled excursion draft from cleanup", () => {
    expect(
      isExcursionEmptyDraft(
        buildExcursionDraft({
          title: "Ай-Петри на закате",
        }),
      ),
    ).toBe(false);
  });

  it("treats uploaded photos and schedule records as meaningful content", () => {
    expect(
      isExcursionEmptyDraft(
        buildExcursionDraft({
          photoUrls: ["/uploads/excursions/photo-1.webp"],
          scheduleRules: [{ id: "rule-1" }],
        }),
      ),
    ).toBe(false);
  });
});

import {
  ExcursionAvailabilityMode,
  ExcursionDifficulty,
  ExcursionFormat,
  ExcursionOfferType,
  ExcursionPriceType,
  ExcursionScheduleMode,
  ExcursionSessionStatus,
  ExcursionStatus,
  Prisma,
} from "@prisma/client";
import type { DbClientLike } from "@/lib/db";
import type {
  ExcursionExtraOption,
  ExcursionSectionPhotoGroups,
  FaqItem,
  ItineraryDay,
  PricingTier,
  TimelineStep,
} from "@/types/excursions";
import { normalizeExcursionSectionPhotoGroups } from "@/types/excursions";

export type PublishedExcursionSnapshot = {
  excursion: {
    offerType: ExcursionOfferType;
    subtypeLabel: string | null;
    title: string | null;
    locationId: string | null;
    locationName: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    startPoint: string | null;
    finishPoint: string | null;
    meetingPointText: string | null;
    description: string | null;
    shortDescription: string | null;
    fullDescription: string | null;
    routeDescription: string | null;
    highlights: string[];
    durationMinutes: number | null;
    durationDays: number | null;
    durationNights: number | null;
    itineraryDays: ItineraryDay[];
    scheduleText: string | null;
    scheduleMode: ExcursionScheduleMode;
    availabilityMode: ExcursionAvailabilityMode;
    availabilityNote: string | null;
    format: ExcursionFormat | null;
    groupSizeMin: number | null;
    groupSizeMax: number | null;
    languageCodes: string[];
    ageLimit: number | null;
    isKidFriendly: boolean | null;
    difficulty: ExcursionDifficulty | null;
    priceType: ExcursionPriceType;
    priceFrom: number | null;
    priceTo: number | null;
    currency: string;
    includedText: string | null;
    notIncludedText: string | null;
    includedItems: string[];
    excludedItems: string[];
    cancellationPolicy: string | null;
    cancellationPolicyType: string | null;
    transferDetails: string | null;
    physicalRequirements: string[];
    whatToBring: string[];
    meetingPointLat: number | null;
    meetingPointLng: number | null;
    minBookingNoticeHours: number | null;
    hasGuideLicense: boolean;
    pickupAvailable: boolean;
    receiveRequests: boolean;
    tags: string[];
    instantConfirmation: boolean;
    contactFirstName: string | null;
    contactLastName: string | null;
    contactPhone: string | null;
    contactPhone2: string | null;
    contactEmail: string | null;
    websiteUrl: string | null;
    whatsappUrl: string | null;
    telegramUrl: string | null;
    vkUrl: string | null;
    maxUrl: string | null;
    okUrl: string | null;
    photoUrls: string[];
    sectionPhotoGroups: ExcursionSectionPhotoGroups;
    videoUrls: string[];
    timeline: TimelineStep[];
    pricingTiers: PricingTier[];
    faqItems: FaqItem[];
    extraOptions: ExcursionExtraOption[];
    priceUnitLabel: string | null;
    accommodationProvided: boolean | null;
    accommodationType: string | null;
    accommodationNights: number | null;
    accommodationFormat: string | null;
    accommodationStars: string | null;
    roomTypes: string[];
    singleSupplementAvailable: boolean | null;
    singleSupplementPrice: number | null;
    mealPlan: string | null;
    mealDetails: string | null;
    accommodationComment: string | null;
    tourKind: string | null;
    transportModes: string[];
    departureMode: string | null;
    arrivalInfo: string | null;
    departureInfo: string | null;
    documentsRequired: string[];
    insuranceIncluded: boolean | null;
    insuranceComment: string | null;
    equipmentProvided: string[];
    safetyInfo: string | null;
    routeConditions: string | null;
    mainLocation: { id: string; slug: string; name: string } | null;
    anchorLocation: { id: string; slug: string; name: string } | null;
    district: { id: string; slug: string; name: string } | null;
    category: { id: string; slug: string; name: string } | null;
    meetingLocation: { id: string; slug: string; name: string } | null;
  };
  pickupLocations: Array<{ id: string; name: string; slug: string }>;
  routeLocations: Array<{ id: string; name: string; slug: string; sortOrder: number }>;
  sessions: Array<{
    id: string;
    startAt: string;
    endAt: string | null;
    capacity: number | null;
    priceOverride: number | null;
    status: ExcursionSessionStatus;
    bookingDeadlineMinutes: number | null;
  }>;
  scheduleRules: Array<{
    id: string;
    dateFrom: string | null;
    dateTo: string | null;
    weekdays: number[];
    timeStarts: string[];
    durationMinutes: number | null;
    capacityDefault: number | null;
    priceOverride: number | null;
  }>;
  scheduleExceptions: Array<{
    id: string;
    date: string;
    isClosed: boolean;
    overrideTimeStarts: string[];
    overrideCapacity: number | null;
    overridePrice: number | null;
    notes: string | null;
  }>;
};

export const excursionPublicSnapshotInclude = Prisma.validator<Prisma.ExcursionInclude>()({
  mainLocation: {
    select: { id: true, slug: true, name: true },
  },
  anchorLocation: {
    select: { id: true, slug: true, name: true },
  },
  district: {
    select: { id: true, slug: true, name: true },
  },
  category: {
    select: { id: true, slug: true, name: true },
  },
  meetingLocation: {
    select: { id: true, slug: true, name: true },
  },
  pickupLocations: {
    include: {
      location: {
        select: { id: true, slug: true, name: true },
      },
    },
  },
  routeLocations: {
    include: {
      location: {
        select: { id: true, slug: true, name: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }],
  },
  sessions: {
    orderBy: [{ startAt: "asc" }],
  },
  scheduleRules: {
    orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
  },
  scheduleExceptions: {
    orderBy: [{ date: "asc" }],
  },
});

export type ExcursionPublicSnapshotSource = Prisma.ExcursionGetPayload<{
  include: typeof excursionPublicSnapshotInclude;
}>;

type ExcursionSnapshotClient = DbClientLike;

function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildPublishedExcursionSnapshot(
  excursion: ExcursionPublicSnapshotSource,
): PublishedExcursionSnapshot {
  return toJson({
    excursion: {
      offerType: excursion.offerType,
      subtypeLabel: excursion.subtypeLabel,
      title: excursion.title,
      locationId: excursion.locationId,
      locationName: excursion.locationName,
      address: excursion.address,
      latitude: excursion.latitude === null ? null : Number(excursion.latitude),
      longitude: excursion.longitude === null ? null : Number(excursion.longitude),
      startPoint: excursion.startPoint,
      finishPoint: excursion.finishPoint,
      meetingPointText: excursion.meetingPointText,
      description: excursion.description,
      shortDescription: excursion.shortDescription,
      fullDescription: excursion.fullDescription,
      routeDescription: excursion.routeDescription,
      highlights: Array.isArray(excursion.highlights)
        ? excursion.highlights.filter((item): item is string => typeof item === "string")
        : [],
      durationMinutes: excursion.durationMinutes,
      durationDays: excursion.durationDays,
      durationNights: excursion.durationNights,
      itineraryDays: Array.isArray(excursion.itineraryDays)
        ? (excursion.itineraryDays as ItineraryDay[])
        : [],
      scheduleText: excursion.scheduleText,
      scheduleMode: excursion.scheduleMode,
      availabilityMode: excursion.availabilityMode,
      availabilityNote: excursion.availabilityNote,
      format: excursion.format,
      groupSizeMin: excursion.groupSizeMin,
      groupSizeMax: excursion.groupSizeMax,
      languageCodes: excursion.languageCodes,
      ageLimit: excursion.ageLimit,
      isKidFriendly: excursion.isKidFriendly,
      difficulty: excursion.difficulty,
      priceType: excursion.priceType,
      priceFrom: excursion.priceFrom === null ? null : Number(excursion.priceFrom),
      priceTo: excursion.priceTo === null ? null : Number(excursion.priceTo),
      currency: excursion.currency,
      includedText: excursion.includedText,
      notIncludedText: excursion.notIncludedText,
      includedItems: excursion.includedItems,
      excludedItems: excursion.excludedItems,
      cancellationPolicy: excursion.cancellationPolicy,
      cancellationPolicyType: excursion.cancellationPolicyType,
      transferDetails: excursion.transferDetails,
      physicalRequirements: excursion.physicalRequirements,
      whatToBring: excursion.whatToBring,
      meetingPointLat:
        excursion.meetingPointLat === null ? null : Number(excursion.meetingPointLat),
      meetingPointLng:
        excursion.meetingPointLng === null ? null : Number(excursion.meetingPointLng),
      minBookingNoticeHours: excursion.minBookingNoticeHours,
      hasGuideLicense: excursion.hasGuideLicense,
      pickupAvailable: excursion.pickupAvailable,
      receiveRequests: excursion.receiveRequests,
      tags: excursion.tags,
      instantConfirmation: excursion.instantConfirmation,
      contactFirstName: excursion.contactFirstName,
      contactLastName: excursion.contactLastName,
      contactPhone: excursion.contactPhone,
      contactPhone2: excursion.contactPhone2,
      contactEmail: excursion.contactEmail,
      websiteUrl: excursion.websiteUrl,
      whatsappUrl: excursion.whatsappUrl,
      telegramUrl: excursion.telegramUrl,
      vkUrl: excursion.vkUrl,
      maxUrl: excursion.maxUrl,
      okUrl: excursion.okUrl,
      photoUrls: excursion.photoUrls,
      sectionPhotoGroups: normalizeExcursionSectionPhotoGroups(
        excursion.sectionPhotoGroups as
          | Partial<Record<string, string[] | null | undefined>>
          | null
          | undefined,
      ),
      videoUrls: excursion.videoUrls,
      timeline: Array.isArray(excursion.timeline) ? (excursion.timeline as TimelineStep[]) : [],
      pricingTiers: Array.isArray(excursion.pricingTiers)
        ? (excursion.pricingTiers as PricingTier[])
        : [],
      faqItems: Array.isArray(excursion.faqItems) ? (excursion.faqItems as FaqItem[]) : [],
      extraOptions: Array.isArray(excursion.extraOptions)
        ? (excursion.extraOptions as ExcursionExtraOption[])
        : [],
      priceUnitLabel: excursion.priceUnitLabel,
      accommodationProvided: excursion.accommodationProvided,
      accommodationType: excursion.accommodationType,
      accommodationNights: excursion.accommodationNights,
      accommodationFormat: excursion.accommodationFormat,
      accommodationStars: excursion.accommodationStars,
      roomTypes: excursion.roomTypes,
      singleSupplementAvailable: excursion.singleSupplementAvailable,
      singleSupplementPrice:
        excursion.singleSupplementPrice === null ? null : Number(excursion.singleSupplementPrice),
      mealPlan: excursion.mealPlan,
      mealDetails: excursion.mealDetails,
      accommodationComment: excursion.accommodationComment,
      tourKind: excursion.tourKind,
      transportModes: excursion.transportModes,
      departureMode: excursion.departureMode,
      arrivalInfo: excursion.arrivalInfo,
      departureInfo: excursion.departureInfo,
      documentsRequired: excursion.documentsRequired,
      insuranceIncluded: excursion.insuranceIncluded,
      insuranceComment: excursion.insuranceComment,
      equipmentProvided: excursion.equipmentProvided,
      safetyInfo: excursion.safetyInfo,
      routeConditions: excursion.routeConditions,
      mainLocation: excursion.mainLocation,
      anchorLocation: excursion.anchorLocation,
      district: excursion.district,
      category: excursion.category,
      meetingLocation: excursion.meetingLocation,
    },
    pickupLocations: excursion.pickupLocations.map((item) => item.location),
    routeLocations: excursion.routeLocations.map((item) => ({
      ...item.location,
      sortOrder: item.sortOrder,
    })),
    sessions: excursion.sessions.map((item) => ({
      id: item.id,
      startAt: item.startAt.toISOString(),
      endAt: item.endAt ? item.endAt.toISOString() : null,
      capacity: item.capacity,
      priceOverride: item.priceOverride === null ? null : Number(item.priceOverride),
      status: item.status,
      bookingDeadlineMinutes: item.bookingDeadlineMinutes,
    })),
    scheduleRules: excursion.scheduleRules.map((item) => ({
      id: item.id,
      dateFrom: item.dateFrom ? item.dateFrom.toISOString().slice(0, 10) : null,
      dateTo: item.dateTo ? item.dateTo.toISOString().slice(0, 10) : null,
      weekdays: item.weekdays,
      timeStarts: item.timeStarts,
      durationMinutes: item.durationMinutes,
      capacityDefault: item.capacityDefault,
      priceOverride: item.priceOverride === null ? null : Number(item.priceOverride),
    })),
    scheduleExceptions: excursion.scheduleExceptions.map((item) => ({
      id: item.id,
      date: item.date.toISOString().slice(0, 10),
      isClosed: item.isClosed,
      overrideTimeStarts: item.overrideTimeStarts,
      overrideCapacity: item.overrideCapacity,
      overridePrice: item.overridePrice === null ? null : Number(item.overridePrice),
      notes: item.notes,
    })),
  });
}

export function parsePublishedExcursionSnapshot(
  value: Prisma.JsonValue | null,
): PublishedExcursionSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<PublishedExcursionSnapshot>;
  if (
    !candidate.excursion ||
    !Array.isArray(candidate.pickupLocations) ||
    !Array.isArray(candidate.routeLocations)
  ) {
    return null;
  }

  return candidate as PublishedExcursionSnapshot;
}

export function shouldUsePublishedExcursionSnapshot(input: {
  status: ExcursionStatus;
  pendingEditStatus: ExcursionStatus | null;
  publishedSnapshot: Prisma.JsonValue | null;
}): boolean {
  return (
    input.status === ExcursionStatus.PUBLISHED &&
    input.pendingEditStatus !== null &&
    parsePublishedExcursionSnapshot(input.publishedSnapshot) !== null
  );
}

export async function refreshPublishedExcursionSnapshot(
  client: ExcursionSnapshotClient,
  excursionId: string,
): Promise<PublishedExcursionSnapshot | null> {
  const excursion = await client.excursion.findUnique({
    where: { id: excursionId },
    include: excursionPublicSnapshotInclude,
  });

  if (!excursion) {
    return null;
  }

  const snapshot = buildPublishedExcursionSnapshot(excursion);
  await client.excursion.update({
    where: { id: excursionId },
    data: {
      // Runtime compatibility for older databases is handled before this write path runs.
      publishedSnapshot: snapshot as Prisma.InputJsonValue,
    },
  });

  return snapshot;
}

export async function ensurePublishedExcursionSnapshotBeforeOwnerEdit(
  client: ExcursionSnapshotClient,
  excursionId: string,
): Promise<void> {
  const excursion = await client.excursion.findUnique({
    where: { id: excursionId },
    select: {
      id: true,
      status: true,
      // Runtime compatibility for older databases is handled before this read path runs.
      pendingEditStatus: true,
      publishedSnapshot: true,
    },
  });

  if (!excursion || excursion.status !== ExcursionStatus.PUBLISHED) {
    return;
  }

  if (!parsePublishedExcursionSnapshot(excursion.publishedSnapshot)) {
    await refreshPublishedExcursionSnapshot(client, excursion.id);
  }

  if (excursion.pendingEditStatus === null) {
    await client.excursion.update({
      where: { id: excursion.id },
      data: {
        // Runtime compatibility for older databases is handled before this write path runs.
        pendingEditStatus: ExcursionStatus.DRAFT,
        moderationNotes: null,
        moderatedById: null,
        moderatedAt: null,
      },
    });
  }
}

// Domain/service module for excursions.
import {
  ExcursionAvailabilityMode,
  ExcursionDifficulty,
  ExcursionFormat,
  ExcursionOfferType,
  ExcursionPriceType,
  ExcursionScheduleMode,
  ExcursionStatus,
  type Prisma,
} from "@prisma/client";
import type {
  ExcursionExtraOption,
  FaqItem,
  ItineraryDay,
  PricingTier,
  TimelineStep,
} from "@/types/excursions";

export type SerializedExcursion = {
  id: string;
  ownerId: string;
  offerType: ExcursionOfferType;
  subtypeLabel: string | null;
  title: string | null;
  locationId: string | null;
  locationName: string | null;
  mainLocationId: string | null;
  mainLocationName: string | null;
  anchorLocationId: string | null;
  anchorLocationName: string | null;
  districtId: string | null;
  districtName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  startPoint: string | null;
  meetingPointText: string | null;
  meetingLocationId: string | null;
  meetingLocationName: string | null;
  description: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  routeDescription: string | null;
  highlights: string[];
  durationMinutes: number | null;
  durationDays: number | null;
  durationNights: number | null;
  itineraryDays: ItineraryDay[];
  finishPoint: string | null;
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
  timeline: TimelineStep[];
  extraOptions: ExcursionExtraOption[];
  pricingTiers: PricingTier[];
  faqItems: FaqItem[];
  physicalRequirements: string[];
  whatToBring: string[];
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  minBookingNoticeHours: number | null;
  hasGuideLicense: boolean;
  pickupAvailable: boolean;
  pickupLocationIds: string[];
  routeLocations: Array<{ locationId: string; sortOrder: number }>;
  tags: string[];
  instantConfirmation: boolean;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
  photoUrls: string[];
  videoUrls: string[];
  priceUnitLabel: string | null;
  accommodationProvided: boolean | null;
  accommodationType: string | null;
  accommodationNights: number | null;
  accommodationFormat: string | null;
  mealPlan: string | null;
  accommodationComment: string | null;
  avgRating: number;
  reviewsCount: number;
  moderationNotes: string | null;
  moderatedById: string | null;
  moderatedAt: string | null;
  status: ExcursionStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
};

export function getExcursionStatusLabel(status: ExcursionStatus): string {
  switch (status) {
    case ExcursionStatus.DRAFT:
      return "Черновик";
    case ExcursionStatus.PENDING_MODERATION:
      return "На модерации";
    case ExcursionStatus.PUBLISHED:
      return "Опубликована";
    case ExcursionStatus.NEEDS_FIX:
      return "Требуются правки";
    case ExcursionStatus.REJECTED:
      return "Отклонена";
    default:
      return status;
  }
}

export function getExcursionDisplayNumberFromOrderedIds(
  excursionId: string,
  orderedExcursionIds: readonly string[],
): number | null {
  const index = orderedExcursionIds.indexOf(excursionId);
  return index === -1 ? null : index + 1;
}

export function serializeExcursion(excursion: {
  id: string;
  ownerId: string;
  offerType: ExcursionOfferType;
  subtypeLabel: string | null;
  title: string | null;
  locationId: string | null;
  locationName: string | null;
  mainLocationId: string | null;
  anchorLocationId: string | null;
  districtId: string | null;
  categoryId: string | null;
  address: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  startPoint: string | null;
  meetingPointText: string | null;
  meetingLocationId: string | null;
  description: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  routeDescription: string | null;
  highlights: Prisma.JsonValue;
  durationMinutes: number | null;
  durationDays: number | null;
  durationNights: number | null;
  itineraryDays: Prisma.JsonValue;
  finishPoint: string | null;
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
  priceFrom: Prisma.Decimal | null;
  priceTo: Prisma.Decimal | null;
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
  meetingPointLat: Prisma.Decimal | null;
  meetingPointLng: Prisma.Decimal | null;
  minBookingNoticeHours: number | null;
  hasGuideLicense: boolean;
  timeline: Prisma.JsonValue;
  extraOptions: Prisma.JsonValue;
  pricingTiers: Prisma.JsonValue;
  faqItems: Prisma.JsonValue;
  pickupAvailable: boolean;
  tags: string[];
  instantConfirmation: boolean;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
  photoUrls: string[];
  videoUrls: string[];
  priceUnitLabel: string | null;
  accommodationProvided: boolean | null;
  accommodationType: string | null;
  accommodationNights: number | null;
  accommodationFormat: string | null;
  mealPlan: string | null;
  accommodationComment: string | null;
  avgRating: Prisma.Decimal;
  reviewsCount: number;
  moderationNotes: string | null;
  moderatedById: string | null;
  moderatedAt: Date | null;
  status: ExcursionStatus;
  createdAt: Date;
  updatedAt: Date;
  mainLocation?: { name: string } | null;
  anchorLocation?: { name: string } | null;
  district?: { name: string } | null;
  category?: { name: string } | null;
  meetingLocation?: { name: string } | null;
  pickupLocations?: Array<{ locationId: string }>;
  routeLocations?: Array<{ locationId: string; sortOrder: number }>;
}): SerializedExcursion {
  const routeLocations = [...(excursion.routeLocations ?? [])].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );

  return {
    id: excursion.id,
    ownerId: excursion.ownerId,
    offerType: excursion.offerType,
    subtypeLabel: excursion.subtypeLabel,
    title: excursion.title,
    locationId: excursion.locationId,
    locationName: excursion.locationName,
    mainLocationId: excursion.mainLocationId,
    mainLocationName: excursion.mainLocation?.name ?? null,
    anchorLocationId: excursion.anchorLocationId,
    anchorLocationName: excursion.anchorLocation?.name ?? null,
    districtId: excursion.districtId,
    districtName: excursion.district?.name ?? null,
    categoryId: excursion.categoryId,
    categoryName: excursion.category?.name ?? null,
    address: excursion.address,
    latitude: excursion.latitude === null ? null : Number(excursion.latitude),
    longitude: excursion.longitude === null ? null : Number(excursion.longitude),
    startPoint: excursion.startPoint,
    meetingPointText: excursion.meetingPointText,
    meetingLocationId: excursion.meetingLocationId,
    meetingLocationName: excursion.meetingLocation?.name ?? null,
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
    finishPoint: excursion.finishPoint,
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
    meetingPointLat: excursion.meetingPointLat === null ? null : Number(excursion.meetingPointLat),
    meetingPointLng: excursion.meetingPointLng === null ? null : Number(excursion.meetingPointLng),
    minBookingNoticeHours: excursion.minBookingNoticeHours,
    hasGuideLicense: excursion.hasGuideLicense,
    timeline: Array.isArray(excursion.timeline) ? (excursion.timeline as TimelineStep[]) : [],
    extraOptions: Array.isArray(excursion.extraOptions)
      ? (excursion.extraOptions as ExcursionExtraOption[])
      : [],
    pricingTiers: Array.isArray(excursion.pricingTiers)
      ? (excursion.pricingTiers as PricingTier[])
      : [],
    faqItems: Array.isArray(excursion.faqItems) ? (excursion.faqItems as FaqItem[]) : [],
    pickupAvailable: excursion.pickupAvailable,
    pickupLocationIds: (excursion.pickupLocations ?? []).map((item) => item.locationId),
    routeLocations: routeLocations.map((item) => ({
      locationId: item.locationId,
      sortOrder: item.sortOrder,
    })),
    tags: excursion.tags,
    instantConfirmation: excursion.instantConfirmation,
    contactFirstName: excursion.contactFirstName,
    contactLastName: excursion.contactLastName,
    contactPhone: excursion.contactPhone,
    contactEmail: excursion.contactEmail,
    websiteUrl: excursion.websiteUrl,
    whatsappUrl: excursion.whatsappUrl,
    telegramUrl: excursion.telegramUrl,
    vkUrl: excursion.vkUrl,
    maxUrl: excursion.maxUrl,
    okUrl: excursion.okUrl,
    photoUrls: excursion.photoUrls,
    videoUrls: excursion.videoUrls,
    priceUnitLabel: excursion.priceUnitLabel,
    accommodationProvided: excursion.accommodationProvided,
    accommodationType: excursion.accommodationType,
    accommodationNights: excursion.accommodationNights,
    accommodationFormat: excursion.accommodationFormat,
    mealPlan: excursion.mealPlan,
    accommodationComment: excursion.accommodationComment,
    avgRating: Number(excursion.avgRating),
    reviewsCount: excursion.reviewsCount,
    moderationNotes: excursion.moderationNotes,
    moderatedById: excursion.moderatedById,
    moderatedAt: excursion.moderatedAt ? excursion.moderatedAt.toISOString() : null,
    status: excursion.status,
    statusLabel: getExcursionStatusLabel(excursion.status),
    createdAt: excursion.createdAt.toISOString(),
    updatedAt: excursion.updatedAt.toISOString(),
  };
}

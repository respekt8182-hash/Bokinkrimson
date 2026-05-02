// Domain/service module for excursions.
import {
  ExcursionAvailabilityMode,
  ExcursionDifficulty,
  ExcursionFormat,
  ExcursionOfferType,
  ExcursionPriceType,
  ExcursionScheduleMode,
  ExcursionStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { areDatabaseColumnsAvailable, type DbClientLike } from "@/lib/db";
import {
  EMPTY_DRAFT_RETENTION_DAYS,
  getEmptyDraftCleanupCutoff,
  hasNonEmptyText,
} from "@/lib/draft-cleanup";
import { ensurePublishedExcursionSnapshotBeforeOwnerEdit } from "@/lib/excursion-public-snapshot";
import { logDatabaseFallbackOnce } from "@/lib/prisma-errors";
import { deleteManagedUrlFromStorage } from "@/lib/storage";
import type {
  ExcursionExtraOption,
  ExcursionSectionPhotoGroups,
  FaqItem,
  ItineraryDay,
  PricingTier,
  TimelineStep,
} from "@/types/excursions";
import {
  collectExcursionSectionPhotoUrls,
  getItineraryDayPhotoUrls,
  getTimelineStepPhotoUrls,
  normalizeExcursionSectionPhotoGroups,
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
  contactPhone2: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
  nextSessionStartAt: string | null;
  photoUrls: string[];
  sectionPhotoGroups: ExcursionSectionPhotoGroups;
  videoUrls: string[];
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
  // Tour logistics
  tourKind: string | null;
  transportModes: string[];
  departureMode: string | null;
  arrivalInfo: string | null;
  departureInfo: string | null;
  // Safety & documents
  documentsRequired: string[];
  insuranceIncluded: boolean | null;
  insuranceComment: string | null;
  equipmentProvided: string[];
  safetyInfo: string | null;
  routeConditions: string | null;
  // System / stats (read-only)
  avgRating: number;
  reviewsCount: number;
  moderationNotes: string | null;
  moderatedById: string | null;
  moderatedAt: string | null;
  status: ExcursionStatus;
  pendingEditStatus: ExcursionStatus | null;
  statusLabel: string;
  isPublishedVisible: boolean;
  deletedAt: string | null;
  deletionExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function getExcursionPendingEditStatusLabel(
  status: ExcursionStatus,
  moderationNotes: string | null,
): string | null {
  switch (status) {
    case ExcursionStatus.DRAFT:
      return "Черновик изменений";
    case ExcursionStatus.PENDING_MODERATION:
      return "Изменения на модерации";
    case ExcursionStatus.NEEDS_FIX:
      return moderationNotes?.trim() ? "Изменения требуют правок" : "Черновик изменений";
    case ExcursionStatus.REJECTED:
      return moderationNotes?.trim() ? "Изменения отклонены" : "Черновик изменений";
    default:
      return null;
  }
}

export function getExcursionWorkflowStatus(
  status: ExcursionStatus,
  pendingEditStatus: ExcursionStatus | null,
): ExcursionStatus {
  if (status === ExcursionStatus.PUBLISHED && pendingEditStatus) {
    return pendingEditStatus;
  }

  return status;
}

export function canAdminApproveExcursionModeration(
  status: ExcursionStatus,
  pendingEditStatus: ExcursionStatus | null,
): boolean {
  const workflowStatus = getExcursionWorkflowStatus(status, pendingEditStatus);

  if (status === ExcursionStatus.PUBLISHED && pendingEditStatus !== null) {
    return (
      workflowStatus === ExcursionStatus.PENDING_MODERATION ||
      workflowStatus === ExcursionStatus.NEEDS_FIX ||
      workflowStatus === ExcursionStatus.REJECTED
    );
  }

  return (
    workflowStatus === ExcursionStatus.DRAFT ||
    workflowStatus === ExcursionStatus.PENDING_MODERATION ||
    workflowStatus === ExcursionStatus.NEEDS_FIX ||
    workflowStatus === ExcursionStatus.REJECTED
  );
}

export function canAdminRequestExcursionChanges(
  status: ExcursionStatus,
  pendingEditStatus: ExcursionStatus | null,
): boolean {
  const workflowStatus = getExcursionWorkflowStatus(status, pendingEditStatus);

  return (
    workflowStatus === ExcursionStatus.PENDING_MODERATION ||
    workflowStatus === ExcursionStatus.NEEDS_FIX
  );
}

export function getExcursionStatusLabel(
  status: ExcursionStatus,
  pendingEditStatus: ExcursionStatus | null = null,
  moderationNotes: string | null = null,
): string {
  const pendingLabel =
    status === ExcursionStatus.PUBLISHED && pendingEditStatus
      ? getExcursionPendingEditStatusLabel(pendingEditStatus, moderationNotes)
      : null;

  if (pendingLabel) {
    return pendingLabel;
  }

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

export type ExcursionPublishReadinessPayload = {
  offerType: ExcursionOfferType;
  title: string | null;
  locationId: string | null;
  categoryId: string | null;
  description: string | null;
  durationMinutes: number | null;
  durationDays: number | null;
  durationNights: number | null;
  timelineLength: number;
  itineraryDaysLength: number;
  routeLocationsLength: number;
  startPoint: string | null;
  availabilityMode: ExcursionAvailabilityMode;
  availabilityNote: string | null;
  hasRegularSchedule: boolean;
  hasSessions: boolean;
  priceFrom: Prisma.Decimal | number | null;
  priceUnitLabel: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactPhone: string | null;
  contactPhone2: string | null;
  accommodationProvided: boolean | null;
  accommodationType: string | null;
  photoUrls: string[];
};

function hasPositiveExcursionPrice(value: Prisma.Decimal | number | null): boolean {
  if (value === null) {
    return false;
  }

  const numericValue = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(numericValue) && numericValue > 0;
}

export function getMissingExcursionPublishFields(
  payload: ExcursionPublishReadinessPayload,
): string[] {
  const missing: string[] = [];
  const isTour = payload.offerType === ExcursionOfferType.TOUR;

  if (!payload.title?.trim()) {
    missing.push("название");
  }
  if (!payload.locationId?.trim()) {
    missing.push("основная локация");
  }
  if (!payload.categoryId?.trim()) {
    missing.push("основная категория");
  }
  if (!payload.description?.trim()) {
    missing.push("описание");
  }

  if (isTour) {
    if (!payload.durationDays || payload.durationDays < 1) {
      missing.push("длительность в днях");
    }
  } else if (!payload.durationMinutes || payload.durationMinutes < 15) {
    missing.push("длительность");
  }

  if (
    payload.availabilityMode === ExcursionAvailabilityMode.REGULAR &&
    !payload.hasRegularSchedule
  ) {
    missing.push("валидное расписание");
  }
  if (payload.availabilityMode === ExcursionAvailabilityMode.DATED && !payload.hasSessions) {
    missing.push("заезды / даты");
  }
  if (
    payload.availabilityMode === ExcursionAvailabilityMode.ON_REQUEST &&
    !payload.availabilityNote?.trim()
  ) {
    missing.push("условия режима по запросу");
  }
  if (!hasPositiveExcursionPrice(payload.priceFrom)) {
    missing.push("цена");
  }
  if (isTour && !payload.priceUnitLabel?.trim()) {
    missing.push("единица цены");
  }
  if (
    !payload.contactFirstName?.trim() ||
    !payload.contactLastName?.trim() ||
    !payload.contactPhone?.trim()
  ) {
    missing.push("контакты организатора");
  }
  if (payload.photoUrls.length < 3) {
    missing.push("минимум 3 фото");
  }

  if (isTour) {
    if (!payload.startPoint?.trim()) {
      missing.push("стартовая точка");
    }
    if (payload.itineraryDaysLength === 0 && payload.routeLocationsLength === 0) {
      missing.push("программа по дням или маршрут");
    }
    if (payload.durationNights && payload.durationNights > 0) {
      const hasAccommodationState =
        payload.accommodationProvided !== null &&
        (payload.accommodationProvided === false || Boolean(payload.accommodationType?.trim()));
      if (!hasAccommodationState) {
        missing.push("проживание или отметка, что оно не включено");
      }
    }
  } else {
    if (!payload.startPoint?.trim()) {
      missing.push("точка старта / место встречи");
    }
    if (payload.timelineLength === 0 && payload.routeLocationsLength === 0) {
      missing.push("программа или маршрут");
    }
  }

  return missing;
}

export function getExcursionAutoModerationUpdate(
  status: ExcursionStatus,
  pendingEditStatus: ExcursionStatus | null,
): Prisma.ExcursionUpdateInput | null {
  if (status === ExcursionStatus.PUBLISHED) {
    if (
      pendingEditStatus === ExcursionStatus.DRAFT ||
      pendingEditStatus === ExcursionStatus.NEEDS_FIX ||
      pendingEditStatus === ExcursionStatus.REJECTED
    ) {
      return {
        pendingEditStatus: ExcursionStatus.PENDING_MODERATION,
        moderationNotes: null,
        moderatedById: null,
        moderatedAt: null,
      };
    }

    return null;
  }

  if (
    status === ExcursionStatus.DRAFT ||
    status === ExcursionStatus.NEEDS_FIX ||
    status === ExcursionStatus.REJECTED
  ) {
    return {
      status: ExcursionStatus.PENDING_MODERATION,
      moderationNotes: null,
      moderatedById: null,
      moderatedAt: null,
    };
  }

  return null;
}

const EXCURSION_AUTO_MODERATION_SELECT = {
  id: true,
  deletedAt: true,
  offerType: true,
  title: true,
  locationId: true,
  categoryId: true,
  description: true,
  durationMinutes: true,
  durationDays: true,
  durationNights: true,
  startPoint: true,
  availabilityMode: true,
  availabilityNote: true,
  scheduleText: true,
  priceFrom: true,
  priceUnitLabel: true,
  contactFirstName: true,
  contactLastName: true,
  contactPhone: true,
  contactPhone2: true,
  accommodationProvided: true,
  accommodationType: true,
  photoUrls: true,
  timeline: true,
  itineraryDays: true,
  status: true,
  pendingEditStatus: true,
  routeLocations: {
    select: {
      locationId: true,
    },
  },
  sessions: {
    select: {
      id: true,
    },
    take: 1,
  },
  scheduleRules: {
    select: {
      id: true,
    },
    take: 1,
  },
} as const;

type ExcursionAutoModerationSource = Prisma.ExcursionGetPayload<{
  select: typeof EXCURSION_AUTO_MODERATION_SELECT;
}>;

function buildExcursionPublishReadinessPayload(
  excursion: ExcursionAutoModerationSource,
): ExcursionPublishReadinessPayload {
  return {
    offerType: excursion.offerType,
    title: excursion.title,
    locationId: excursion.locationId,
    categoryId: excursion.categoryId,
    description: excursion.description,
    durationMinutes: excursion.durationMinutes,
    durationDays: excursion.durationDays,
    durationNights: excursion.durationNights,
    timelineLength: Array.isArray(excursion.timeline) ? excursion.timeline.length : 0,
    itineraryDaysLength: Array.isArray(excursion.itineraryDays)
      ? excursion.itineraryDays.length
      : 0,
    routeLocationsLength: excursion.routeLocations.length,
    startPoint: excursion.startPoint,
    availabilityMode: excursion.availabilityMode,
    availabilityNote: excursion.availabilityNote,
    hasRegularSchedule:
      Boolean(excursion.scheduleText?.trim()) || excursion.scheduleRules.length > 0,
    hasSessions: excursion.sessions.length > 0,
    priceFrom: excursion.priceFrom,
    priceUnitLabel: excursion.priceUnitLabel,
    contactFirstName: excursion.contactFirstName,
    contactLastName: excursion.contactLastName,
    contactPhone: excursion.contactPhone,
    contactPhone2: excursion.contactPhone2,
    accommodationProvided: excursion.accommodationProvided,
    accommodationType: excursion.accommodationType,
    photoUrls: excursion.photoUrls,
  };
}

export async function autoSubmitExcursionAfterSuccessfulPayment(
  client: DbClientLike,
  excursionId: string,
): Promise<boolean> {
  const excursion = await client.excursion.findUnique({
    where: { id: excursionId },
    select: EXCURSION_AUTO_MODERATION_SELECT,
  });

  if (!excursion || excursion.deletedAt) {
    return false;
  }

  const missingFields = getMissingExcursionPublishFields(
    buildExcursionPublishReadinessPayload(excursion),
  );
  if (missingFields.length > 0) {
    return false;
  }

  const moderationUpdate = getExcursionAutoModerationUpdate(
    excursion.status,
    excursion.pendingEditStatus ?? null,
  );
  if (!moderationUpdate) {
    return false;
  }

  await client.excursion.update({
    where: { id: excursion.id },
    data: moderationUpdate,
  });

  return true;
}

export function getExcursionDisplayNumberFromOrderedIds(
  excursionId: string,
  orderedExcursionIds: readonly string[],
): number | null {
  const index = orderedExcursionIds.indexOf(excursionId);
  return index === -1 ? null : index + 1;
}

type ExcursionDraftCleanupClient = DbClientLike;
const EXCURSION_PUBLICATION_COMPAT_COLUMNS = ["isPublishedVisible"] as const;
const EXCURSION_PUBLISHED_EDIT_COMPAT_COLUMNS = ["pendingEditStatus", "publishedSnapshot"] as const;

export const EXCURSION_DRAFT_RETENTION_DAYS = EMPTY_DRAFT_RETENTION_DAYS;

export const EXCURSION_STORAGE_CLEANUP_SELECT = {
  id: true,
  photoUrls: true,
  sectionPhotoGroups: true,
  videoUrls: true,
  itineraryDays: true,
  timeline: true,
} as const;

type ExcursionEmptyDraftCandidate = {
  status: ExcursionStatus;
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
  durationMinutes: number | null;
  durationDays: number | null;
  durationNights: number | null;
  finishPoint: string | null;
  scheduleText: string | null;
  availabilityNote: string | null;
  format: ExcursionFormat | null;
  groupSizeMin: number | null;
  groupSizeMax: number | null;
  ageLimit: number | null;
  isKidFriendly: boolean | null;
  difficulty: ExcursionDifficulty | null;
  priceFrom: Prisma.Decimal | null;
  priceTo: Prisma.Decimal | null;
  includedText: string | null;
  notIncludedText: string | null;
  cancellationPolicy: string | null;
  transferDetails: string | null;
  minBookingNoticeHours: number | null;
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
  priceUnitLabel: string | null;
  accommodationProvided: boolean | null;
  accommodationType: string | null;
  accommodationNights: number | null;
  accommodationFormat: string | null;
  accommodationComment: string | null;
  tourKind?: string | null;
  departureMode?: string | null;
  arrivalInfo?: string | null;
  departureInfo?: string | null;
  insuranceIncluded?: boolean | null;
  insuranceComment?: string | null;
  safetyInfo?: string | null;
  routeConditions?: string | null;
  photoUrls: string[];
  sectionPhotoGroups?: Prisma.JsonValue;
  videoUrls: string[];
  timeline: Prisma.JsonValue;
  pricingTiers: Prisma.JsonValue;
  faqItems: Prisma.JsonValue;
  extraOptions: Prisma.JsonValue;
  itineraryDays: Prisma.JsonValue;
  includedItems: string[];
  excludedItems: string[];
  languageCodes: string[];
  physicalRequirements: string[];
  whatToBring: string[];
  tags: string[];
  transportModes?: string[];
  roomTypes?: string[];
  documentsRequired?: string[];
  equipmentProvided?: string[];
  pickupLocations: Array<{ locationId: string }>;
  routeLocations: Array<{ locationId: string; sortOrder: number }>;
  sessions: Array<{ id: string }>;
  scheduleRules: Array<{ id: string }>;
  payments: Array<{ id: string }>;
};

export const EXCURSION_EMPTY_DRAFT_SELECT = {
  ...EXCURSION_STORAGE_CLEANUP_SELECT,
  status: true,
  subtypeLabel: true,
  title: true,
  locationId: true,
  locationName: true,
  mainLocationId: true,
  anchorLocationId: true,
  districtId: true,
  categoryId: true,
  address: true,
  latitude: true,
  longitude: true,
  startPoint: true,
  meetingPointText: true,
  meetingLocationId: true,
  description: true,
  shortDescription: true,
  fullDescription: true,
  routeDescription: true,
  durationMinutes: true,
  durationDays: true,
  durationNights: true,
  finishPoint: true,
  scheduleText: true,
  availabilityNote: true,
  format: true,
  groupSizeMin: true,
  groupSizeMax: true,
  ageLimit: true,
  isKidFriendly: true,
  difficulty: true,
  priceFrom: true,
  priceTo: true,
  includedText: true,
  notIncludedText: true,
  cancellationPolicy: true,
  transferDetails: true,
  minBookingNoticeHours: true,
  contactFirstName: true,
  contactLastName: true,
  contactPhone: true,
  contactPhone2: true,
  contactEmail: true,
  websiteUrl: true,
  whatsappUrl: true,
  telegramUrl: true,
  vkUrl: true,
  maxUrl: true,
  okUrl: true,
  priceUnitLabel: true,
  accommodationProvided: true,
  accommodationType: true,
  accommodationNights: true,
  accommodationFormat: true,
  accommodationComment: true,
  tourKind: true,
  departureMode: true,
  arrivalInfo: true,
  departureInfo: true,
  insuranceIncluded: true,
  insuranceComment: true,
  safetyInfo: true,
  routeConditions: true,
  timeline: true,
  pricingTiers: true,
  faqItems: true,
  extraOptions: true,
  itineraryDays: true,
  includedItems: true,
  excludedItems: true,
  languageCodes: true,
  physicalRequirements: true,
  whatToBring: true,
  tags: true,
  transportModes: true,
  roomTypes: true,
  documentsRequired: true,
  equipmentProvided: true,
  pickupLocations: { select: { locationId: true } },
  routeLocations: { select: { locationId: true, sortOrder: true } },
  sessions: { select: { id: true } },
  scheduleRules: { select: { id: true } },
  payments: {
    where: { status: PaymentStatus.SUCCEEDED },
    select: { id: true },
    take: 1,
  },
} as const;

function hasJsonItems(value: Prisma.JsonValue): boolean {
  return Array.isArray(value) && value.length > 0;
}

export function isExcursionEmptyDraft(candidate: ExcursionEmptyDraftCandidate): boolean {
  if (candidate.status !== ExcursionStatus.DRAFT) {
    return false;
  }

  const hasMeaningfulText = hasNonEmptyText(
    candidate.subtypeLabel,
    candidate.title,
    candidate.locationId,
    candidate.locationName,
    candidate.mainLocationId,
    candidate.anchorLocationId,
    candidate.districtId,
    candidate.categoryId,
    candidate.address,
    candidate.startPoint,
    candidate.meetingPointText,
    candidate.meetingLocationId,
    candidate.description,
    candidate.shortDescription,
    candidate.fullDescription,
    candidate.routeDescription,
    candidate.finishPoint,
    candidate.scheduleText,
    candidate.availabilityNote,
    candidate.includedText,
    candidate.notIncludedText,
    candidate.cancellationPolicy,
    candidate.transferDetails,
    candidate.contactFirstName,
    candidate.contactLastName,
    candidate.contactPhone,
    candidate.contactPhone2,
    candidate.contactEmail,
    candidate.websiteUrl,
    candidate.whatsappUrl,
    candidate.telegramUrl,
    candidate.vkUrl,
    candidate.maxUrl,
    candidate.okUrl,
    candidate.priceUnitLabel,
    candidate.accommodationType,
    candidate.accommodationFormat,
    candidate.accommodationComment,
    candidate.tourKind,
    candidate.departureMode,
    candidate.arrivalInfo,
    candidate.departureInfo,
    candidate.insuranceComment,
    candidate.safetyInfo,
    candidate.routeConditions,
  );
  const hasCoordinates = candidate.latitude !== null || candidate.longitude !== null;
  const hasNumericValues = [
    candidate.durationMinutes,
    candidate.durationDays,
    candidate.durationNights,
    candidate.groupSizeMin,
    candidate.groupSizeMax,
    candidate.ageLimit,
    candidate.priceFrom === null ? null : Number(candidate.priceFrom),
    candidate.priceTo === null ? null : Number(candidate.priceTo),
    candidate.minBookingNoticeHours,
    candidate.accommodationNights,
  ].some((value) => value !== null);
  const hasBooleanSettings =
    candidate.isKidFriendly !== null ||
    candidate.accommodationProvided !== null ||
    candidate.insuranceIncluded !== null;
  const hasEnumSelections = candidate.format !== null || candidate.difficulty !== null;
  const hasAttachedContent =
    candidate.photoUrls.length > 0 ||
    collectExcursionSectionPhotoUrls(
      candidate.sectionPhotoGroups as Partial<Record<string, string[]>> | null | undefined,
    ).length > 0 ||
    candidate.videoUrls.length > 0 ||
    candidate.includedItems.length > 0 ||
    candidate.excludedItems.length > 0 ||
    candidate.languageCodes.length > 0 ||
    candidate.physicalRequirements.length > 0 ||
    candidate.whatToBring.length > 0 ||
    candidate.tags.length > 0 ||
    (candidate.transportModes?.length ?? 0) > 0 ||
    (candidate.roomTypes?.length ?? 0) > 0 ||
    (candidate.documentsRequired?.length ?? 0) > 0 ||
    (candidate.equipmentProvided?.length ?? 0) > 0 ||
    candidate.pickupLocations.length > 0 ||
    candidate.routeLocations.length > 0 ||
    candidate.sessions.length > 0 ||
    candidate.scheduleRules.length > 0 ||
    hasJsonItems(candidate.timeline) ||
    hasJsonItems(candidate.pricingTiers) ||
    hasJsonItems(candidate.faqItems) ||
    hasJsonItems(candidate.extraOptions) ||
    hasJsonItems(candidate.itineraryDays);
  const hasSuccessfulPayment = candidate.payments.length > 0;

  return !(
    hasMeaningfulText ||
    hasCoordinates ||
    hasNumericValues ||
    hasBooleanSettings ||
    hasEnumSelections ||
    hasAttachedContent ||
    hasSuccessfulPayment
  );
}

export function collectExcursionProgramPhotoUrls(input: {
  itineraryDays?: Prisma.JsonValue | ItineraryDay[];
  timeline?: Prisma.JsonValue | TimelineStep[];
}): string[] {
  const itineraryUrls = Array.isArray(input.itineraryDays)
    ? input.itineraryDays.flatMap((day) => getItineraryDayPhotoUrls(day as ItineraryDay))
    : [];
  const timelineUrls = Array.isArray(input.timeline)
    ? input.timeline.flatMap((step) => getTimelineStepPhotoUrls(step as TimelineStep))
    : [];

  return Array.from(new Set([...itineraryUrls, ...timelineUrls]));
}

export function collectExcursionPresentationPhotoUrls(input: {
  photoUrls?: string[];
  sectionPhotoGroups?: Prisma.JsonValue | Partial<Record<string, string[] | null | undefined>>;
  itineraryDays?: Prisma.JsonValue | ItineraryDay[];
  timeline?: Prisma.JsonValue | TimelineStep[];
}): string[] {
  return Array.from(
    new Set([
      ...(input.photoUrls ?? []).map((url) => url.trim()).filter(Boolean),
      ...collectExcursionSectionPhotoUrls(
        input.sectionPhotoGroups as Partial<Record<string, string[] | null | undefined>>,
      ),
      ...collectExcursionProgramPhotoUrls(input),
    ]),
  );
}

export async function deleteExcursionStorageEntries(
  excursions: Array<{
    photoUrls: string[];
    sectionPhotoGroups?: Prisma.JsonValue;
    videoUrls: string[];
    itineraryDays?: Prisma.JsonValue | ItineraryDay[];
    timeline?: Prisma.JsonValue | TimelineStep[];
  }>,
): Promise<void> {
  const urls = excursions.flatMap((excursion) => [
    ...excursion.photoUrls,
    ...collectExcursionSectionPhotoUrls(
      excursion.sectionPhotoGroups as Partial<Record<string, string[]>> | null | undefined,
    ),
    ...excursion.videoUrls,
    ...collectExcursionProgramPhotoUrls(excursion),
  ]);
  if (urls.length === 0) {
    return;
  }

  await Promise.all(urls.map((url) => deleteManagedUrlFromStorage(url).catch(() => null)));
}

export async function purgeExpiredExcursionDraftsForOwner(
  client: ExcursionDraftCleanupClient,
  ownerId: string,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = getEmptyDraftCleanupCutoff(now);
  const drafts = await client.excursion.findMany({
    where: {
      ownerId,
      status: ExcursionStatus.DRAFT,
      updatedAt: { lt: cutoff },
    },
    select: EXCURSION_EMPTY_DRAFT_SELECT,
  });
  const emptyDrafts = drafts.filter(isExcursionEmptyDraft);
  if (emptyDrafts.length === 0) {
    return 0;
  }

  await deleteExcursionStorageEntries(emptyDrafts);

  const result = await client.excursion.deleteMany({
    where: { id: { in: emptyDrafts.map((item) => item.id) } },
  });
  return result.count;
}

export async function purgeExpiredExcursionDrafts(
  client: ExcursionDraftCleanupClient,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = getEmptyDraftCleanupCutoff(now);
  const drafts = await client.excursion.findMany({
    where: {
      status: ExcursionStatus.DRAFT,
      updatedAt: { lt: cutoff },
    },
    select: EXCURSION_EMPTY_DRAFT_SELECT,
  });
  const emptyDrafts = drafts.filter(isExcursionEmptyDraft);
  if (emptyDrafts.length === 0) {
    return 0;
  }

  await deleteExcursionStorageEntries(emptyDrafts);

  const result = await client.excursion.deleteMany({
    where: { id: { in: emptyDrafts.map((item) => item.id) } },
  });
  return result.count;
}

type CreateExcursionDraftInput = {
  ownerId: string;
  offerType: ExcursionOfferType;
  title?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail?: string | null;
};

export async function createExcursionDraft(
  client: DbClientLike,
  input: CreateExcursionDraftInput,
): Promise<{ id: string }> {
  const isPublicationSchemaAvailable = await areDatabaseColumnsAvailable(
    "Excursion",
    EXCURSION_PUBLICATION_COMPAT_COLUMNS,
  );

  if (isPublicationSchemaAvailable) {
    return client.excursion.create({
      data: {
        ownerId: input.ownerId,
        offerType: input.offerType,
        title: input.title ?? null,
        contactFirstName: input.contactFirstName ?? null,
        contactLastName: input.contactLastName ?? null,
        contactEmail: input.contactEmail ?? null,
      },
      select: {
        id: true,
      },
    });
  }

  logDatabaseFallbackOnce(
    "excursion-create-compat",
    "Excursion draft creation is using a legacy insert compatibility path because the database schema is missing publication controls. Apply the latest Prisma migration when DB owner access is available.",
  );

  const now = new Date();
  const excursionId = `excursion_${randomUUID().replace(/-/g, "")}`;
  const offerTypeDbValue = input.offerType === ExcursionOfferType.TOUR ? "tour" : "excursion";
  const rows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "Excursion" (
      "id",
      "ownerId",
      "offerType",
      "title",
      "contactFirstName",
      "contactLastName",
      "contactEmail",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${excursionId},
      ${input.ownerId},
      CAST(${offerTypeDbValue} AS "ExcursionOfferType"),
      ${input.title ?? null},
      ${input.contactFirstName ?? null},
      ${input.contactLastName ?? null},
      ${input.contactEmail ?? null},
      ${now},
      ${now}
    )
    RETURNING "id"
  `);

  if (rows.length === 0) {
    throw new Error("Excursion draft creation did not return an id.");
  }

  return rows[0];
}

export async function markExcursionNeedsRemoderationAfterOwnerEdit(
  client: DbClientLike,
  excursionId: string,
): Promise<void> {
  await Promise.all([
    client.excursion.updateMany({
      where: {
        id: excursionId,
        status: ExcursionStatus.PUBLISHED,
        OR: [
          // Runtime compatibility for older databases is handled before this update path runs.
          { pendingEditStatus: null },
          // Runtime compatibility for older databases is handled before this update path runs.
          { pendingEditStatus: ExcursionStatus.NEEDS_FIX },
          // Runtime compatibility for older databases is handled before this update path runs.
          { pendingEditStatus: ExcursionStatus.REJECTED },
        ],
      },
      data: {
        // Runtime compatibility for older databases is handled before this update path runs.
        pendingEditStatus: ExcursionStatus.DRAFT,
        moderationNotes: null,
        moderatedById: null,
        moderatedAt: null,
      },
    }),
    client.excursion.updateMany({
      where: {
        id: excursionId,
        status: {
          in: [ExcursionStatus.NEEDS_FIX, ExcursionStatus.REJECTED],
        },
      },
      data: {
        status: ExcursionStatus.DRAFT,
        moderationNotes: null,
        moderatedById: null,
        moderatedAt: null,
      },
    }),
  ]);
}

export async function prepareExcursionForPublishedOwnerEdit(
  client: DbClientLike,
  excursionId: string,
): Promise<void> {
  const isPublishedEditSchemaAvailable = await areDatabaseColumnsAvailable(
    "Excursion",
    EXCURSION_PUBLISHED_EDIT_COMPAT_COLUMNS,
  );

  if (!isPublishedEditSchemaAvailable) {
    logDatabaseFallbackOnce(
      "excursion-published-edit-compat",
      "Published excursion edit snapshots are disabled because the database schema is missing pending edit publication columns. Apply the latest Prisma migration when DB owner access is available.",
    );
    return;
  }

  await ensurePublishedExcursionSnapshotBeforeOwnerEdit(client, excursionId);
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
  contactPhone2: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
  photoUrls: string[];
  sectionPhotoGroups?: Prisma.JsonValue;
  videoUrls: string[];
  priceUnitLabel: string | null;
  accommodationProvided: boolean | null;
  accommodationType: string | null;
  accommodationNights: number | null;
  accommodationFormat: string | null;
  accommodationStars?: string | null;
  roomTypes?: string[];
  singleSupplementAvailable?: boolean | null;
  singleSupplementPrice?: Prisma.Decimal | null;
  mealPlan: string | null;
  mealDetails?: string | null;
  accommodationComment: string | null;
  tourKind?: string | null;
  transportModes?: string[];
  departureMode?: string | null;
  arrivalInfo?: string | null;
  departureInfo?: string | null;
  documentsRequired?: string[];
  insuranceIncluded?: boolean | null;
  insuranceComment?: string | null;
  equipmentProvided?: string[];
  safetyInfo?: string | null;
  routeConditions?: string | null;
  avgRating: Prisma.Decimal;
  reviewsCount: number;
  moderationNotes: string | null;
  moderatedById: string | null;
  moderatedAt: Date | null;
  status: ExcursionStatus;
  pendingEditStatus?: ExcursionStatus | null;
  isPublishedVisible: boolean;
  deletedAt: Date | null;
  deletionExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  mainLocation?: { name: string } | null;
  anchorLocation?: { name: string } | null;
  district?: { name: string } | null;
  category?: { name: string } | null;
  meetingLocation?: { name: string } | null;
  sessions?: Array<{ startAt: Date }>;
  pickupLocations?: Array<{ locationId: string }>;
  routeLocations?: Array<{ locationId: string; sortOrder: number }>;
}): SerializedExcursion {
  const routeLocations = [...(excursion.routeLocations ?? [])].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const itineraryDays = Array.isArray(excursion.itineraryDays)
    ? (excursion.itineraryDays as ItineraryDay[]).map((day) => ({
        ...day,
        photoUrls: getItineraryDayPhotoUrls(day),
      }))
    : [];
  const timeline = Array.isArray(excursion.timeline)
    ? (excursion.timeline as TimelineStep[]).map((step) => ({
        ...step,
        photoUrls: getTimelineStepPhotoUrls(step),
      }))
    : [];

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
    itineraryDays,
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
    timeline,
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
    contactPhone2: excursion.contactPhone2,
    contactEmail: excursion.contactEmail,
    websiteUrl: excursion.websiteUrl,
    whatsappUrl: excursion.whatsappUrl,
    telegramUrl: excursion.telegramUrl,
    vkUrl: excursion.vkUrl,
    maxUrl: excursion.maxUrl,
    okUrl: excursion.okUrl,
    nextSessionStartAt: excursion.sessions?.[0]?.startAt
      ? excursion.sessions[0].startAt.toISOString()
      : null,
    photoUrls: excursion.photoUrls,
    sectionPhotoGroups: normalizeExcursionSectionPhotoGroups(
      excursion.sectionPhotoGroups as
        | Partial<Record<string, string[] | null | undefined>>
        | null
        | undefined,
    ),
    videoUrls: excursion.videoUrls,
    priceUnitLabel: excursion.priceUnitLabel,
    accommodationProvided: excursion.accommodationProvided,
    accommodationType: excursion.accommodationType,
    accommodationNights: excursion.accommodationNights,
    accommodationFormat: excursion.accommodationFormat,
    accommodationStars: excursion.accommodationStars ?? null,
    roomTypes: excursion.roomTypes ?? [],
    singleSupplementAvailable: excursion.singleSupplementAvailable ?? null,
    singleSupplementPrice:
      excursion.singleSupplementPrice == null ? null : Number(excursion.singleSupplementPrice),
    mealPlan: excursion.mealPlan,
    mealDetails: excursion.mealDetails ?? null,
    accommodationComment: excursion.accommodationComment,
    tourKind: excursion.tourKind ?? null,
    transportModes: excursion.transportModes ?? [],
    departureMode: excursion.departureMode ?? null,
    arrivalInfo: excursion.arrivalInfo ?? null,
    departureInfo: excursion.departureInfo ?? null,
    documentsRequired: excursion.documentsRequired ?? [],
    insuranceIncluded: excursion.insuranceIncluded ?? null,
    insuranceComment: excursion.insuranceComment ?? null,
    equipmentProvided: excursion.equipmentProvided ?? [],
    safetyInfo: excursion.safetyInfo ?? null,
    routeConditions: excursion.routeConditions ?? null,
    avgRating: Number(excursion.avgRating),
    reviewsCount: excursion.reviewsCount,
    moderationNotes: excursion.moderationNotes,
    moderatedById: excursion.moderatedById,
    moderatedAt: excursion.moderatedAt ? excursion.moderatedAt.toISOString() : null,
    status: excursion.status,
    pendingEditStatus: excursion.pendingEditStatus ?? null,
    statusLabel: getExcursionStatusLabel(
      excursion.status,
      excursion.pendingEditStatus ?? null,
      excursion.moderationNotes,
    ),
    isPublishedVisible: excursion.isPublishedVisible,
    deletedAt: excursion.deletedAt ? excursion.deletedAt.toISOString() : null,
    deletionExpiresAt: excursion.deletionExpiresAt
      ? excursion.deletionExpiresAt.toISOString()
      : null,
    createdAt: excursion.createdAt.toISOString(),
    updatedAt: excursion.updatedAt.toISOString(),
  };
}

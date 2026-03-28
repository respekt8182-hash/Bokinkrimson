import {
  MediaType,
  PaymentStatus,
  PetsPolicy,
  PropertyStatus,
  SmokingPolicy,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { crimeaLocationById, mediaLimits, propertyTypeById } from "@/lib/constants";
import { ensurePublishedPropertySnapshotBeforeOwnerEdit } from "@/lib/property-public-snapshot";
import { getPlacementCoverageState, getTariffQuote } from "@/lib/payments";
import { serializeMedia, type SerializedMedia } from "@/lib/media";
import { deleteFromStorage } from "@/lib/storage";
import type { FaqItem } from "@/types/excursions";

// Internal serializer/progress module for owner-side property wizard.
// Internal shape used to calculate wizard progress consistently on server.
type PropertyDraftFields = {
  type: string | null;
  locationId: string | null;
  locationName: string | null;
  name: string | null;
  address: string | null;
  seaDistance?: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  phone: string | null;
  description: string | null;
  faqItems?: Prisma.JsonValue | null;
  contactPersonName?: string | null;
  contactPersonRole?: string | null;
  listingChannels?: string | null;
  checkInFrom: string | null;
  checkOutUntil: string | null;
  childrenAllowed: boolean | null;
  childrenMinAge: number | null;
  petsPolicy: PetsPolicy | null;
  smokingPolicy: SmokingPolicy | null;
  quietHoursEnabled: boolean | null;
  quietHoursFrom: string | null;
  quietHoursTo: string | null;
  parkingInfo?: string | null;
  mealOptions?: string | null;
  prepaymentPolicy?: string | null;
  classificationApplicable: boolean;
  starRating: number | null;
  registryNumber: string | null;
  registryNumberPending: string | null;
  registryModerationSubmittedAt?: Date | null;
  selfAssessmentPassed: boolean | null;
  moderationNotes?: string | null;
  moderatedById?: string | null;
  moderatedAt?: Date | null;
  pendingEditStatus?: PropertyStatus | null;
  media?: Array<{ id: string; type: MediaType; url: string; sortOrder: number }>;
  rooms?: Array<{ id: string; prices?: Array<{ id: string }> }>;
  amenities?: Array<{ amenityId: string; amenity: { id: string; name: string; category: string } }>;
  customAmenities?: Array<{ name: string }>;
};

export type PropertyProgress = {
  step1: boolean;
  step2: boolean;
  step3: boolean;
  step4: boolean;
  step5: boolean;
  step6: boolean;
  step7: boolean;
  step8: boolean;
  step9: boolean;
  step10: boolean;
  lastCompletedStep: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
};

export type SerializedProperty = {
  id: string;
  ownerId: string;
  type: string | null;
  typeLabel: string | null;
  locationId: string | null;
  locationName: string | null;
  name: string | null;
  address: string | null;
  seaDistance: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  contactPersonName: string | null;
  contactPersonRole: string | null;
  listingChannels: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
  receiveRequests: boolean;
  showEmail: boolean;
  description: string | null;
  faqItems: FaqItem[];
  checkInFrom: string | null;
  checkOutUntil: string | null;
  childrenAllowed: boolean | null;
  childrenMinAge: number | null;
  petsPolicy: PetsPolicy | null;
  smokingPolicy: SmokingPolicy | null;
  quietHoursEnabled: boolean | null;
  quietHoursFrom: string | null;
  quietHoursTo: string | null;
  parkingInfo: string | null;
  mealOptions: string | null;
  prepaymentPolicy: string | null;
  classificationApplicable: boolean;
  starRating: number | null;
  registryNumber: string | null;
  registryNumberPending: string | null;
  registryModerationPending: boolean;
  registryModerationSubmittedAt: string | null;
  registryDetails: string | null;
  selfAssessmentPassed: boolean | null;
  moderationNotes: string | null;
  moderatedById: string | null;
  moderatedAt: string | null;
  pendingEditStatus: PropertyStatus | null;
  amenityIds: string[];
  amenities: Array<{ id: string; name: string; category: string }>;
  customAmenities: string[];
  media: SerializedMedia[];
  mediaStats: {
    imageCount: number;
    videoCount: number;
  };
  activeRoomsCount: number;
  status: PropertyStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  progress: PropertyProgress;
};

type PropertyDraftCleanupClient = PrismaClient | Prisma.TransactionClient;

export const PROPERTY_DRAFT_RETENTION_DAYS = 14;

function getDraftCleanupCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - PROPERTY_DRAFT_RETENTION_DAYS);
  return cutoff;
}

const DRAFT_STORAGE_SELECT = {
  id: true,
  media: { select: { storageKey: true } },
  rooms: { select: { media: { select: { storageKey: true } } } },
  documents: { select: { storageKey: true } },
} as const;

async function deleteStorageForDrafts(
  drafts: Array<{
    media: { storageKey: string }[];
    rooms: { media: { storageKey: string }[] }[];
    documents: { storageKey: string }[];
  }>,
): Promise<void> {
  const keys: string[] = [];
  for (const p of drafts) {
    for (const m of p.media) keys.push(m.storageKey);
    for (const r of p.rooms) for (const m of r.media) keys.push(m.storageKey);
    for (const d of p.documents) keys.push(d.storageKey);
  }
  if (keys.length > 0) {
    await Promise.all(keys.map((k) => deleteFromStorage(k).catch(() => null)));
  }
}

export async function purgeExpiredPropertyDraftsForOwner(
  client: PropertyDraftCleanupClient,
  ownerId: string,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = getDraftCleanupCutoff(now);
  const where = {
    ownerId,
    ownerDeletedAt: null,
    status: PropertyStatus.DRAFT,
    updatedAt: { lt: cutoff },
  } satisfies Prisma.PropertyWhereInput;

  const drafts = await client.property.findMany({ where, select: DRAFT_STORAGE_SELECT });
  if (drafts.length === 0) return 0;

  await deleteStorageForDrafts(drafts);

  const result = await client.property.deleteMany({
    where: { id: { in: drafts.map((p) => p.id) } },
  });
  return result.count;
}

export async function purgeExpiredPropertyDrafts(
  client: PropertyDraftCleanupClient,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = getDraftCleanupCutoff(now);
  const where = {
    ownerDeletedAt: null,
    status: PropertyStatus.DRAFT,
    updatedAt: { lt: cutoff },
  } satisfies Prisma.PropertyWhereInput;

  const drafts = await client.property.findMany({ where, select: DRAFT_STORAGE_SELECT });
  if (drafts.length === 0) return 0;

  await deleteStorageForDrafts(drafts);

  const result = await client.property.deleteMany({
    where: { id: { in: drafts.map((p) => p.id) } },
  });
  return result.count;
}

function hasRequiredPropertyMedia(property: PropertyDraftFields): boolean {
  const media = property.media ?? [];
  const imageCount = media.filter((item) => item.type === MediaType.IMAGE).length;
  const videoCount = media.filter((item) => item.type === MediaType.VIDEO).length;
  const minImagesForStepCompletion = 1;

  return (
    imageCount >= minImagesForStepCompletion &&
    imageCount <= mediaLimits.property.images &&
    videoCount <= mediaLimits.property.videos
  );
}

function hasPricesForEveryRoom(property: PropertyDraftFields): boolean {
  const rooms = property.rooms ?? [];

  if (rooms.length === 0) {
    return false;
  }

  return rooms.every((room) => (room.prices?.length ?? 0) > 0);
}

export function getPropertyProgress(property: PropertyDraftFields): PropertyProgress {
  // Steps 1-5: base profile completeness.
  const step1 = Boolean(property.type && property.name?.trim());
  const step3 = Boolean(
    property.locationName?.trim() &&
    property.address?.trim() &&
    property.latitude !== null &&
    property.longitude !== null,
  );
  // Step 2 is merged into step 3 in UI, so they share the same completion signal.
  const step2 = step3;

  const step4 = Boolean(property.phone?.trim());
  const step5 = Boolean(property.description?.trim());

  // Step 6: rule consistency checks.
  const childrenOk =
    (property.childrenAllowed === false && property.childrenMinAge === null) ||
    property.childrenAllowed === true;

  const quietHoursOk =
    property.quietHoursEnabled === false ||
    (property.quietHoursEnabled === true && property.quietHoursFrom && property.quietHoursTo);

  const step6 = Boolean(
    property.checkInFrom &&
    property.checkOutUntil &&
    property.childrenAllowed !== null &&
    childrenOk &&
    property.petsPolicy !== null &&
    property.smokingPolicy !== null &&
    property.quietHoursEnabled !== null &&
    quietHoursOk,
  );

  // Step 7 is complete either with registry data or with explicit skip.
  const step7 =
    !property.classificationApplicable ||
    Boolean(property.registryNumber?.trim() || property.registryNumberPending?.trim());
  const step8 = hasRequiredPropertyMedia(property);
  // Step 9/10 belong to room and pricing modules.
  const step9 = (property.rooms?.length ?? 0) > 0;
  const step10 = hasPricesForEveryRoom(property);

  // Sequential progression: no jump if previous step is not complete.
  let lastCompletedStep: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 = 0;
  if (step1) {
    lastCompletedStep = 1;
    if (step2) {
      lastCompletedStep = 2;
      if (step3) {
        lastCompletedStep = 3;
        if (step4) {
          lastCompletedStep = 4;
          if (step5) {
            lastCompletedStep = 5;
            if (step6) {
              lastCompletedStep = 6;
              if (step7) {
                lastCompletedStep = 7;
                if (step8) {
                  lastCompletedStep = 8;
                  if (step9) {
                    lastCompletedStep = 9;
                    if (step10) {
                      lastCompletedStep = 10;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    step1,
    step2,
    step3,
    step4,
    step5,
    step6,
    step7,
    step8,
    step9,
    step10,
    lastCompletedStep,
  };
}

export function getRecommendedWizardStep(
  progress: PropertyProgress,
): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 {
  if (!progress.step1) return 1;
  if (!progress.step2) return 3;
  if (!progress.step3) return 3;
  if (!progress.step4) return 4;
  if (!progress.step5) return 5;
  if (!progress.step6) return 6;
  if (!progress.step7) return 7;
  if (!progress.step8) return 8;
  if (!progress.step9) return 9;
  return 10;
}

export type PropertyReadinessIssueId =
  | "about-info"
  | "about-location"
  | "about-ksr"
  | "about-contacts"
  | "about-photo"
  | "rules"
  | "room-categories"
  | "chessboard-pricing";

export type PropertyReadinessIssue = {
  id: PropertyReadinessIssueId;
  reason: string;
  href: string;
};

type PropertyWorkflowStatus = PropertyStatus | "PAID" | "NEEDS_FIX";

function buildOwnerObjectSectionHref(
  propertyId: string,
  section: "about" | "rules" | "room-categories" | "chessboard",
  block?: "info" | "location" | "ksr" | "contacts" | "photo",
): string {
  if (section !== "about" || !block) {
    return `/dashboard/objects/${propertyId}/${section}`;
  }

  return `/dashboard/objects/${propertyId}/about?block=${block}`;
}

export function getPropertyPaymentReadinessIssues(
  propertyId: string,
  progress: PropertyProgress,
): PropertyReadinessIssue[] {
  const issues: PropertyReadinessIssue[] = [];

  if (!progress.step1 || !progress.step5) {
    issues.push({
      id: "about-info",
      reason: "Заполните раздел «Информация об объекте».",
      href: buildOwnerObjectSectionHref(propertyId, "about", "info"),
    });
  }

  if (!progress.step3) {
    issues.push({
      id: "about-location",
      reason: "Заполните раздел «Локация».",
      href: buildOwnerObjectSectionHref(propertyId, "about", "location"),
    });
  }

  if (!progress.step7) {
    issues.push({
      id: "about-ksr",
      reason: "Укажите данные КСР или отметьте, что классификация не применяется.",
      href: buildOwnerObjectSectionHref(propertyId, "about", "ksr"),
    });
  }

  if (!progress.step4) {
    issues.push({
      id: "about-contacts",
      reason: "Заполните раздел «Контакты».",
      href: buildOwnerObjectSectionHref(propertyId, "about", "contacts"),
    });
  }

  if (!progress.step8) {
    issues.push({
      id: "about-photo",
      reason: "Добавьте фото объекта.",
      href: buildOwnerObjectSectionHref(propertyId, "about", "photo"),
    });
  }

  if (!progress.step6) {
    issues.push({
      id: "rules",
      reason: "Заполните обязательные правила проживания.",
      href: buildOwnerObjectSectionHref(propertyId, "rules"),
    });
  }

  if (!progress.step9) {
    issues.push({
      id: "room-categories",
      reason: "Добавьте минимум один активный номер.",
      href: buildOwnerObjectSectionHref(propertyId, "room-categories"),
    });
  }

  if (progress.step9 && !progress.step10) {
    issues.push({
      id: "chessboard-pricing",
      reason: "Настройте цены для номеров в шахматке.",
      href: buildOwnerObjectSectionHref(propertyId, "chessboard"),
    });
  }

  return issues;
}

// Human-readable status label for dashboard and wizard header badges.
export function getPropertyStatusLabel(status: PropertyWorkflowStatus): string {
  switch (status) {
    case PropertyStatus.DRAFT:
      return "Черновик";
    case "PAID":
      return "Черновик";
    case PropertyStatus.PENDING_MODERATION:
      return "На модерации";
    case PropertyStatus.PUBLISHED:
      return "Опубликована";
    case "NEEDS_FIX":
      return "Отклонена";
    case PropertyStatus.REJECTED:
      return "Отклонена";
    default:
      return status;
  }
}

export function getPropertyModerationStatus(
  status: PropertyStatus,
  pendingEditStatus: PropertyStatus | null,
): PropertyStatus {
  if (status === PropertyStatus.PUBLISHED && pendingEditStatus) {
    return pendingEditStatus;
  }

  return status;
}

export function getPendingEditStatusLabel(
  status: PropertyWorkflowStatus,
  moderationNotes: string | null,
): string {
  const workflowStatus = normalizePropertyWorkflowStatus(status);
  void moderationNotes;

  if (workflowStatus === PropertyStatus.DRAFT) {
    return "Черновик изменений";
  }

  if (workflowStatus === PropertyStatus.PENDING_MODERATION) {
    return "Изменения на модерации";
  }

  if (status === "PAID") {
    return "Черновик изменений";
  }

  if (workflowStatus === PropertyStatus.REJECTED) {
    return "Изменения отклонены";
  }

  return getPropertyStatusLabel(workflowStatus);
}

export function getOwnerPropertyStatusLabel(
  status: PropertyWorkflowStatus,
  _moderationNotes: string | null,
): string {
  void _moderationNotes;
  return getPropertyStatusLabel(status);
}

export function getEffectiveOwnerPropertyStatusLabel(
  status: PropertyStatus,
  moderationNotes: string | null,
  pendingEditStatus: PropertyStatus | null,
): string {
  if (status === PropertyStatus.PUBLISHED && pendingEditStatus) {
    return getPendingEditStatusLabel(pendingEditStatus, moderationNotes);
  }

  return getOwnerPropertyStatusLabel(status, moderationNotes);
}

export function normalizePropertyWorkflowStatus(status: PropertyWorkflowStatus): PropertyStatus {
  if (status === "PAID") {
    return PropertyStatus.DRAFT;
  }

  if (status === "NEEDS_FIX") {
    return PropertyStatus.REJECTED;
  }

  return status;
}

export function getPropertyWorkflowStatus(
  status: PropertyStatus,
  pendingEditStatus: PropertyStatus | null,
): PropertyStatus {
  if (status === PropertyStatus.PUBLISHED && pendingEditStatus) {
    return normalizePropertyWorkflowStatus(pendingEditStatus);
  }

  return normalizePropertyWorkflowStatus(status);
}

export function getPropertyWorkflowStatusLabel(
  status: PropertyStatus,
  moderationNotes: string | null,
  pendingEditStatus: PropertyStatus | null,
): string {
  const workflowStatus = getPropertyWorkflowStatus(status, pendingEditStatus);

  if (status === PropertyStatus.PUBLISHED && pendingEditStatus) {
    if (workflowStatus === PropertyStatus.DRAFT) {
      return "Черновик изменений";
    }

    if (workflowStatus === PropertyStatus.PENDING_MODERATION) {
      return "Изменения на модерации";
    }

    if (workflowStatus === PropertyStatus.REJECTED) {
      return moderationNotes?.trim() ? "Изменения отклонены" : "Черновик изменений";
    }
  }

  switch (workflowStatus) {
    case PropertyStatus.DRAFT:
      return "Черновик";
    case PropertyStatus.PENDING_MODERATION:
      return "На модерации";
    case PropertyStatus.PUBLISHED:
      return "Опубликована";
    case PropertyStatus.REJECTED:
      return "Отклонена";
    default:
      return workflowStatus;
  }
}

export function buildPropertyWorkflowStatusWhere(
  status: PropertyStatus,
): Prisma.PropertyWhereInput {
  const normalizedStatus = normalizePropertyWorkflowStatus(status);

  if (normalizedStatus === PropertyStatus.PUBLISHED) {
    return {
      status: PropertyStatus.PUBLISHED,
      pendingEditStatus: null,
    };
  }

  return {
    OR: [
      { status: normalizedStatus },
      {
        status: PropertyStatus.PUBLISHED,
        pendingEditStatus: normalizedStatus,
      },
    ],
  };
}

const PROPERTY_AUTO_MODERATION_SELECT = {
  id: true,
  ownerDeletedAt: true,
  type: true,
  locationId: true,
  locationName: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  phone: true,
  description: true,
  checkInFrom: true,
  checkOutUntil: true,
  childrenAllowed: true,
  childrenMinAge: true,
  petsPolicy: true,
  smokingPolicy: true,
  quietHoursEnabled: true,
  quietHoursFrom: true,
  quietHoursTo: true,
  classificationApplicable: true,
  registryNumber: true,
  registryNumberPending: true,
  status: true,
  pendingEditStatus: true,
  media: {
    where: { roomId: null },
    select: { id: true, type: true, url: true, sortOrder: true },
  },
  rooms: {
    where: { isActive: true },
    select: {
      id: true,
      prices: {
        select: { id: true },
      },
    },
  },
} as const;

type PropertyAutoModerationSource = Prisma.PropertyGetPayload<{
  select: typeof PROPERTY_AUTO_MODERATION_SELECT;
}>;

function buildPropertyPaymentReadiness(property: PropertyAutoModerationSource) {
  const progress = getPropertyProgress(property);
  const roomCount = property.rooms.length;
  const issues = getPropertyPaymentReadinessIssues(property.id, progress);

  return {
    ready: issues.length === 0,
    roomCount,
    quote:
      roomCount > 0
        ? getTariffQuote({
            roomCount,
            propertyType: property.type,
          })
        : null,
  };
}

export function getPropertyAutoModerationUpdate(
  status: PropertyStatus,
  pendingEditStatus: PropertyStatus | null,
): Prisma.PropertyUpdateInput | null {
  if (status === PropertyStatus.PUBLISHED) {
    if (
      pendingEditStatus === PropertyStatus.DRAFT ||
      pendingEditStatus === PropertyStatus.REJECTED
    ) {
      return {
        pendingEditStatus: PropertyStatus.PENDING_MODERATION,
        moderationNotes: null,
        moderatedById: null,
        moderatedAt: null,
      };
    }

    return null;
  }

  if (status === PropertyStatus.DRAFT || status === PropertyStatus.REJECTED) {
    return {
      status: PropertyStatus.PENDING_MODERATION,
      moderationNotes: null,
      moderatedById: null,
      moderatedAt: null,
    };
  }

  return null;
}

export async function autoSubmitPropertyAfterSuccessfulPayment(
  client: PrismaClient | Prisma.TransactionClient,
  propertyId: string,
): Promise<boolean> {
  const property = await client.property.findUnique({
    where: { id: propertyId },
    select: PROPERTY_AUTO_MODERATION_SELECT,
  });

  if (!property || property.ownerDeletedAt) {
    return false;
  }

  const readiness = buildPropertyPaymentReadiness(property);
  if (!readiness.ready || !readiness.quote) {
    return false;
  }

  const payments = await client.payment.findMany({
    where: {
      propertyId: property.id,
      status: PaymentStatus.SUCCEEDED,
    },
    select: {
      amount: true,
      roomCount: true,
      status: true,
      paidAt: true,
      createdAt: true,
      placementValidUntil: true,
    },
  });

  const placement = getPlacementCoverageState({
    payments,
    quote: readiness.quote,
  });

  if (!placement.hasActivePlacement || !placement.fullyCovered) {
    return false;
  }

  const moderationUpdate = getPropertyAutoModerationUpdate(
    property.status,
    property.pendingEditStatus,
  );
  if (!moderationUpdate) {
    return false;
  }

  await client.property.update({
    where: { id: property.id },
    data: moderationUpdate,
  });

  return true;
}

export async function markPropertyNeedsRemoderationAfterOwnerEdit(
  client: PrismaClient | Prisma.TransactionClient,
  propertyId: string,
): Promise<void> {
  await Promise.all([
    client.property.updateMany({
      where: {
        id: propertyId,
        status: PropertyStatus.PUBLISHED,
        OR: [{ pendingEditStatus: null }, { pendingEditStatus: PropertyStatus.REJECTED }],
      },
      data: {
        pendingEditStatus: PropertyStatus.DRAFT,
        moderationNotes: null,
        moderatedById: null,
        moderatedAt: null,
      },
    }),
    client.property.updateMany({
      where: {
        id: propertyId,
        status: {
          in: [PropertyStatus.REJECTED],
        },
      },
      data: {
        status: PropertyStatus.DRAFT,
        moderationNotes: null,
        moderatedById: null,
        moderatedAt: null,
      },
    }),
  ]);
}

export async function preparePropertyForPublishedOwnerEdit(
  client: PrismaClient | Prisma.TransactionClient,
  propertyId: string,
): Promise<void> {
  await ensurePublishedPropertySnapshotBeforeOwnerEdit(client, propertyId);
}

export function getPropertyDisplayNumberFromOrderedIds(
  propertyId: string,
  orderedPropertyIds: readonly string[],
): number | null {
  const index = orderedPropertyIds.indexOf(propertyId);
  return index === -1 ? null : index + 1;
}

export function serializeProperty(property: {
  id: string;
  ownerId: string;
  type: string | null;
  locationId: string | null;
  locationName: string | null;
  name: string | null;
  address: string | null;
  seaDistance: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  phone: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  contactPersonName: string | null;
  contactPersonRole: string | null;
  listingChannels: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
  receiveRequests: boolean;
  showEmail: boolean;
  description: string | null;
  faqItems: Prisma.JsonValue | null;
  checkInFrom: string | null;
  checkOutUntil: string | null;
  childrenAllowed: boolean | null;
  childrenMinAge: number | null;
  petsPolicy: PetsPolicy | null;
  smokingPolicy: SmokingPolicy | null;
  quietHoursEnabled: boolean | null;
  quietHoursFrom: string | null;
  quietHoursTo: string | null;
  parkingInfo: string | null;
  mealOptions: string | null;
  prepaymentPolicy: string | null;
  classificationApplicable: boolean;
  starRating: number | null;
  registryNumber: string | null;
  registryNumberPending: string | null;
  registryModerationSubmittedAt: Date | null;
  registryDetails: string | null;
  selfAssessmentPassed: boolean | null;
  moderationNotes: string | null;
  moderatedById: string | null;
  moderatedAt: Date | null;
  pendingEditStatus?: PropertyStatus | null;
  media?: Array<{
    id: string;
    propertyId: string | null;
    roomId: string | null;
    type: MediaType;
    url: string;
    mimeType: string;
    fileSize: number;
    originalName: string | null;
    sortOrder: number;
    createdAt: Date;
  }>;
  rooms?: Array<{ id: string; prices?: Array<{ id: string }> }>;
  status: PropertyStatus;
  createdAt: Date;
  updatedAt: Date;
  amenities?: Array<{ amenityId: string; amenity: { id: string; name: string; category: string } }>;
  customAmenities?: Array<{ name: string }>;
}): SerializedProperty {
  // Keep payload frontend-friendly and deterministic in one place.
  const effectiveClassificationApplicable = property.classificationApplicable;

  const baseForProgress: PropertyDraftFields = {
    ...property,
    classificationApplicable: effectiveClassificationApplicable,
  };

  const progress = getPropertyProgress(baseForProgress);

  const amenities = property.amenities?.map((item) => item.amenity) ?? [];
  const amenityIds = amenities.map((item) => item.id);
  const customAmenities = property.customAmenities?.map((item) => item.name) ?? [];
  const media = property.media?.map(serializeMedia).sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  const mediaStats = {
    imageCount: media.filter((item) => item.type === MediaType.IMAGE).length,
    videoCount: media.filter((item) => item.type === MediaType.VIDEO).length,
  };
  const activeRoomsCount = property.rooms?.length ?? 0;

  return {
    id: property.id,
    ownerId: property.ownerId,
    type: property.type,
    typeLabel: property.type ? (propertyTypeById[property.type]?.name ?? property.type) : null,
    locationId: property.locationId,
    locationName: property.locationId
      ? (crimeaLocationById[property.locationId]?.name ?? property.locationName)
      : property.locationName,
    name: property.name,
    address: property.address,
    seaDistance: property.seaDistance,
    latitude: property.latitude === null ? null : Number(property.latitude),
    longitude: property.longitude === null ? null : Number(property.longitude),
    phone: property.phone,
    websiteUrl: property.websiteUrl,
    contactEmail: property.contactEmail,
    contactPersonName: property.contactPersonName,
    contactPersonRole: property.contactPersonRole,
    listingChannels: property.listingChannels,
    whatsappUrl: property.whatsappUrl,
    telegramUrl: property.telegramUrl,
    vkUrl: property.vkUrl,
    maxUrl: property.maxUrl,
    okUrl: property.okUrl,
    receiveRequests: property.receiveRequests,
    showEmail: property.showEmail,
    description: property.description,
    faqItems: Array.isArray(property.faqItems) ? (property.faqItems as FaqItem[]) : [],
    checkInFrom: property.checkInFrom,
    checkOutUntil: property.checkOutUntil,
    childrenAllowed: property.childrenAllowed,
    childrenMinAge: property.childrenMinAge,
    petsPolicy: property.petsPolicy,
    smokingPolicy: property.smokingPolicy,
    quietHoursEnabled: property.quietHoursEnabled,
    quietHoursFrom: property.quietHoursFrom,
    quietHoursTo: property.quietHoursTo,
    parkingInfo: property.parkingInfo,
    mealOptions: property.mealOptions,
    prepaymentPolicy: property.prepaymentPolicy,
    classificationApplicable: effectiveClassificationApplicable,
    starRating: property.starRating,
    registryNumber: property.registryNumber,
    registryNumberPending: property.registryNumberPending,
    registryModerationPending: Boolean(property.registryNumberPending?.trim()),
    registryModerationSubmittedAt: property.registryModerationSubmittedAt
      ? property.registryModerationSubmittedAt.toISOString()
      : null,
    registryDetails: property.registryDetails,
    selfAssessmentPassed: property.selfAssessmentPassed,
    moderationNotes: property.moderationNotes,
    moderatedById: property.moderatedById,
    moderatedAt: property.moderatedAt ? property.moderatedAt.toISOString() : null,
    pendingEditStatus: property.pendingEditStatus ?? null,
    amenityIds,
    amenities,
    customAmenities,
    media,
    mediaStats,
    activeRoomsCount,
    status: property.status,
    statusLabel: getPropertyWorkflowStatusLabel(
      property.status,
      property.moderationNotes,
      property.pendingEditStatus ?? null,
    ),
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
    progress,
  };
}

export function isCoordinateInCrimea(latitude: number, longitude: number): boolean {
  // Simple geofence to reject clearly wrong coordinates in step 3.
  const bounds = {
    minLat: 44.2,
    maxLat: 46.3,
    minLng: 32.4,
    maxLng: 36.8,
  };

  return (
    latitude >= bounds.minLat &&
    latitude <= bounds.maxLat &&
    longitude >= bounds.minLng &&
    longitude <= bounds.maxLng
  );
}

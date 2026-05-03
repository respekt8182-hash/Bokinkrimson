import {
  ExcursionAvailabilityMode,
  ExcursionOfferType,
  ExcursionStatus,
  Prisma,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import {
  findNearestMajorExcursionLocation,
  getExcursionLocationByIdOrSlug,
} from "@/lib/excursion-directory";
import { getResolvedAvailabilityMode } from "@/lib/excursion-offers";
import {
  collectExcursionPresentationPhotoUrls,
  collectExcursionProgramPhotoUrls,
  deleteExcursionStorageEntries,
  EXCURSION_STORAGE_CLEANUP_SELECT,
  getExcursionStatusLabel,
  markExcursionNeedsRemoderationAfterOwnerEdit,
  prepareExcursionForPublishedOwnerEdit,
  serializeExcursion,
} from "@/lib/excursions";
import {
  createRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";
import { deleteManagedUrlFromStorage } from "@/lib/storage";
import { updateExcursionSchema } from "@/lib/schemas";
import {
  collectExcursionSectionPhotoUrls,
  normalizeExcursionSectionPhotoGroups,
} from "@/types/excursions";

// Owner excursion details endpoint:
// GET    -> read own excursion
// PATCH  -> partial update + publish readiness check
// DELETE -> remove own excursion
type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateExcursionInput = z.infer<typeof updateExcursionSchema>;

const excursionPatchLimiter = createRateLimiter({
  id: "excursion-patch",
  windowMs: 5 * 60 * 1000,
  maxRequests: 20,
});

const excursionSerializationInclude = {
  mainLocation: {
    select: { name: true },
  },
  anchorLocation: {
    select: { name: true },
  },
  district: {
    select: { name: true },
  },
  category: {
    select: { name: true },
  },
  meetingLocation: {
    select: { name: true },
  },
  pickupLocations: {
    select: { locationId: true },
  },
  routeLocations: {
    select: { locationId: true, sortOrder: true },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.ExcursionInclude;

type ExcursionWithRelations = Prisma.ExcursionGetPayload<{
  include: typeof excursionSerializationInclude;
}>;

type ExcursionWithOptionalPendingEditStatus = ExcursionWithRelations & {
  pendingEditStatus?: ExcursionStatus | null;
};

function dedupeUrls(items: string[]): string[] {
  return Array.from(
    new Map(
      items
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((item) => [item.toLowerCase(), item]),
    ).values(),
  );
}

function dedupeStrings(items: string[]): string[] {
  return Array.from(
    new Map(
      items
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((item) => [item.toLowerCase(), item]),
    ).values(),
  );
}

type PublishReadinessPayload = {
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
  scheduleText: string | null;
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

function hasPositivePrice(value: Prisma.Decimal | number | null): boolean {
  if (value === null) {
    return false;
  }
  const numericValue = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(numericValue) && numericValue > 0;
}

function getMissingPublishFields(payload: PublishReadinessPayload): string[] {
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
    const hasDayDuration = Boolean(payload.durationDays && payload.durationDays >= 1);
    const hasMinuteDuration = Boolean(payload.durationMinutes && payload.durationMinutes >= 15);
    if (!hasDayDuration && !hasMinuteDuration) {
      missing.push("длительность в днях или минутах");
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
  if (!hasPositivePrice(payload.priceFrom)) {
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
        missing.push("проживание / отметка, что проживание не включено");
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

function isOwnerAllowedStatusTransition(nextStatus: ExcursionStatus): boolean {
  return nextStatus === ExcursionStatus.DRAFT || nextStatus === ExcursionStatus.PENDING_MODERATION;
}

function canSubmitPublishedEdit(status: ExcursionStatus | null): boolean {
  return (
    status === ExcursionStatus.DRAFT ||
    status === ExcursionStatus.NEEDS_FIX ||
    status === ExcursionStatus.REJECTED
  );
}

function shouldMarkPublishedExcursionAsEdited(data: UpdateExcursionInput): boolean {
  return (
    data.offerType !== undefined ||
    data.subtypeLabel !== undefined ||
    data.title !== undefined ||
    data.locationId !== undefined ||
    data.locationName !== undefined ||
    data.mainLocationId !== undefined ||
    data.anchorLocationId !== undefined ||
    data.districtId !== undefined ||
    data.categoryId !== undefined ||
    data.tags !== undefined ||
    data.address !== undefined ||
    data.latitude !== undefined ||
    data.longitude !== undefined ||
    data.startPoint !== undefined ||
    data.meetingPointText !== undefined ||
    data.meetingLocationId !== undefined ||
    data.pickupAvailable !== undefined ||
    data.pickupLocationIds !== undefined ||
    data.routeLocations !== undefined ||
    data.description !== undefined ||
    data.shortDescription !== undefined ||
    data.fullDescription !== undefined ||
    data.routeDescription !== undefined ||
    data.highlights !== undefined ||
    data.durationMinutes !== undefined ||
    data.durationDays !== undefined ||
    data.durationNights !== undefined ||
    data.itineraryDays !== undefined ||
    data.finishPoint !== undefined ||
    data.scheduleText !== undefined ||
    data.scheduleMode !== undefined ||
    data.availabilityMode !== undefined ||
    data.availabilityNote !== undefined ||
    data.format !== undefined ||
    data.groupSizeMin !== undefined ||
    data.groupSizeMax !== undefined ||
    data.languageCodes !== undefined ||
    data.ageLimit !== undefined ||
    data.isKidFriendly !== undefined ||
    data.difficulty !== undefined ||
    data.priceType !== undefined ||
    data.priceFrom !== undefined ||
    data.priceTo !== undefined ||
    data.currency !== undefined ||
    data.includedText !== undefined ||
    data.notIncludedText !== undefined ||
    data.includedItems !== undefined ||
    data.excludedItems !== undefined ||
    data.cancellationPolicy !== undefined ||
    data.cancellationPolicyType !== undefined ||
    data.transferDetails !== undefined ||
    data.physicalRequirements !== undefined ||
    data.whatToBring !== undefined ||
    data.meetingPointLat !== undefined ||
    data.meetingPointLng !== undefined ||
    data.minBookingNoticeHours !== undefined ||
    data.priceUnitLabel !== undefined ||
    data.accommodationProvided !== undefined ||
    data.accommodationType !== undefined ||
    data.accommodationNights !== undefined ||
    data.accommodationFormat !== undefined ||
    data.mealPlan !== undefined ||
    data.mealDetails !== undefined ||
    data.accommodationComment !== undefined ||
    data.accommodationStars !== undefined ||
    data.roomTypes !== undefined ||
    data.singleSupplementAvailable !== undefined ||
    data.singleSupplementPrice !== undefined ||
    data.tourKind !== undefined ||
    data.transportModes !== undefined ||
    data.departureMode !== undefined ||
    data.arrivalInfo !== undefined ||
    data.departureInfo !== undefined ||
    data.documentsRequired !== undefined ||
    data.insuranceIncluded !== undefined ||
    data.insuranceComment !== undefined ||
    data.equipmentProvided !== undefined ||
    data.safetyInfo !== undefined ||
    data.routeConditions !== undefined ||
    data.hasGuideLicense !== undefined ||
    data.timeline !== undefined ||
    data.extraOptions !== undefined ||
    data.pricingTiers !== undefined ||
    data.faqItems !== undefined ||
    data.contactFirstName !== undefined ||
    data.contactLastName !== undefined ||
    data.contactPhone !== undefined ||
    data.contactPhone2 !== undefined ||
    data.contactEmail !== undefined ||
    data.websiteUrl !== undefined ||
    data.whatsappUrl !== undefined ||
    data.telegramUrl !== undefined ||
    data.vkUrl !== undefined ||
    data.maxUrl !== undefined ||
    data.okUrl !== undefined ||
    data.photoUrls !== undefined ||
    data.sectionPhotoGroups !== undefined ||
    data.videoUrls !== undefined
  );
}

async function getAccessibleExcursion(
  excursionId: string,
  editor: NonNullable<Awaited<ReturnType<typeof getEditorSession>>>,
): Promise<ExcursionWithRelations | null> {
  const item = await db.excursion.findUnique({
    where: { id: excursionId },
    include: excursionSerializationInclude,
  });

  if (!item || item.deletedAt || (!editor.isAdmin && item.ownerId !== editor.id)) {
    return null;
  }

  return item;
}

function getExcursionPendingEditStatus(excursion: ExcursionWithRelations): ExcursionStatus | null {
  return (excursion as ExcursionWithOptionalPendingEditStatus).pendingEditStatus ?? null;
}

export async function GET(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getAccessibleExcursion(id, editor);

  if (!existing) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  return NextResponse.json({ item: serializeExcursion(existing) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const ip = getRequestIp(request);

  try {
    const limit = await excursionPatchLimiter.limit(`${editor.id}:${ip}`);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Слишком много попыток сохранения. Повторите через ${limit.retryAfterSeconds} сек.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }
  } catch (error) {
    if (
      error instanceof RateLimitConfigurationError ||
      error instanceof RateLimitBackendUnavailableError
    ) {
      return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 503 });
    }

    throw error;
  }

  const { id } = await context.params;
  const existing = await getAccessibleExcursion(id, editor);

  if (!existing) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateExcursionSchema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const pathLabel =
      firstIssue && firstIssue.path.length > 0 ? `${firstIssue.path.join(".")}: ` : "";

    return NextResponse.json(
      {
        error: `${pathLabel}${firstIssue?.message ?? "Проверьте корректность данных экскурсии"}`,
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (
    data.sectionPhotoGroups !== undefined &&
    !(await areDatabaseColumnsAvailable("Excursion", ["sectionPhotoGroups"]))
  ) {
    return NextResponse.json(
      {
        error:
          "Фото разделов временно недоступны: примените свежие Prisma-миграции на VPS и повторите загрузку.",
      },
      { status: 503 },
    );
  }

  const nextPhotoUrls = data.photoUrls ? dedupeUrls(data.photoUrls) : existing.photoUrls;
  const nextSectionPhotoGroups =
    data.sectionPhotoGroups !== undefined
      ? normalizeExcursionSectionPhotoGroups(data.sectionPhotoGroups)
      : normalizeExcursionSectionPhotoGroups(
          existing.sectionPhotoGroups as
            | Partial<Record<string, string[] | null | undefined>>
            | null
            | undefined,
        );
  const nextVideoUrls = data.videoUrls ? dedupeUrls(data.videoUrls) : existing.videoUrls;
  const nextStatus = data.status ?? existing.status;
  const isPublishedOwnerEdit = existing.status === ExcursionStatus.PUBLISHED && !editor.isAdmin;
  const hasPublishedContentEdit = shouldMarkPublishedExcursionAsEdited(data);
  const existingPendingEditStatus = getExcursionPendingEditStatus(existing);
  const effectivePendingEditStatus =
    existingPendingEditStatus ??
    (isPublishedOwnerEdit && hasPublishedContentEdit ? ExcursionStatus.DRAFT : null);

  if (data.status !== undefined && !editor.isAdmin && !isOwnerAllowedStatusTransition(nextStatus)) {
    return NextResponse.json(
      {
        error:
          "Организатор не может напрямую менять экскурсию на этот статус. Используйте отправку на модерацию.",
      },
      { status: 400 },
    );
  }

  if (isPublishedOwnerEdit && data.status === ExcursionStatus.PENDING_MODERATION) {
    if (!effectivePendingEditStatus) {
      return NextResponse.json(
        { error: "Сначала внесите изменения в опубликованную экскурсию" },
        { status: 400 },
      );
    }

    if (!canSubmitPublishedEdit(effectivePendingEditStatus)) {
      return NextResponse.json(
        {
          error: `Нельзя отправить изменения на модерацию в текущем статусе: ${getExcursionStatusLabel(
            existing.status,
            effectivePendingEditStatus,
            existing.moderationNotes,
          )}`,
        },
        { status: 400 },
      );
    }
  }

  if (
    isPublishedOwnerEdit &&
    (hasPublishedContentEdit ||
      data.status === ExcursionStatus.PENDING_MODERATION ||
      data.status === ExcursionStatus.DRAFT)
  ) {
    await prepareExcursionForPublishedOwnerEdit(db, existing.id);
  }

  const nextLatitude = data.latitude === undefined ? existing.latitude : data.latitude;
  const nextLongitude = data.longitude === undefined ? existing.longitude : data.longitude;

  const explicitMainLocation =
    data.mainLocationId === undefined
      ? existing.mainLocationId
      : data.mainLocationId === null
        ? null
        : data.mainLocationId;
  const explicitAnchorLocation =
    data.anchorLocationId === undefined
      ? existing.anchorLocationId
      : data.anchorLocationId === null
        ? null
        : data.anchorLocationId;
  const explicitMeetingLocation =
    data.meetingLocationId === undefined
      ? existing.meetingLocationId
      : data.meetingLocationId === null
        ? null
        : data.meetingLocationId;

  const [resolvedMainLocation, resolvedAnchorFromPayload, resolvedMeetingLocation] =
    await Promise.all([
      explicitMainLocation
        ? getExcursionLocationByIdOrSlug(explicitMainLocation)
        : Promise.resolve(null),
      explicitAnchorLocation
        ? getExcursionLocationByIdOrSlug(explicitAnchorLocation)
        : Promise.resolve(null),
      explicitMeetingLocation
        ? getExcursionLocationByIdOrSlug(explicitMeetingLocation)
        : Promise.resolve(null),
    ]);

  if (explicitMainLocation && !resolvedMainLocation) {
    return NextResponse.json(
      { error: "Не удалось найти основную локацию экскурсии" },
      { status: 400 },
    );
  }

  if (explicitAnchorLocation && !resolvedAnchorFromPayload) {
    return NextResponse.json(
      { error: "Не удалось найти якорный город экскурсии" },
      { status: 400 },
    );
  }

  if (explicitMeetingLocation && !resolvedMeetingLocation) {
    return NextResponse.json({ error: "Не удалось найти локацию точки встречи" }, { status: 400 });
  }

  const nextMainLocationId =
    explicitMainLocation === null ? null : resolvedMainLocation ? resolvedMainLocation.id : null;
  const nextMeetingLocationId =
    explicitMeetingLocation === null
      ? null
      : resolvedMeetingLocation
        ? resolvedMeetingLocation.id
        : null;

  const isAnchorExplicitlyCleared = data.anchorLocationId === null;
  const resolvedAnchorLocation =
    resolvedAnchorFromPayload ??
    (data.anchorLocationId === undefined
      ? await getExcursionLocationByIdOrSlug(existing.anchorLocationId)
      : null);

  let inferredAnchor = resolvedAnchorLocation;
  if (
    !inferredAnchor &&
    !isAnchorExplicitlyCleared &&
    nextLatitude !== null &&
    nextLongitude !== null
  ) {
    inferredAnchor = await findNearestMajorExcursionLocation({
      latitude: Number(nextLatitude),
      longitude: Number(nextLongitude),
      radiusKm: 35,
    });
  }

  const nextAnchorLocation = inferredAnchor;
  const nextMainLocation = resolvedMainLocation;

  const requestedDistrictId = data.districtId === undefined ? existing.districtId : data.districtId;
  let nextDistrictId = requestedDistrictId;

  if (requestedDistrictId) {
    const district = await db.excursionDistrict.findFirst({
      where: {
        OR: [{ id: requestedDistrictId }, { slug: requestedDistrictId }],
      },
      select: { id: true },
    });
    if (!district) {
      return NextResponse.json({ error: "Выбранный округ не найден" }, { status: 400 });
    }
    nextDistrictId = district.id;
  } else if (requestedDistrictId === null) {
    nextDistrictId = null;
  } else {
    nextDistrictId =
      nextMainLocation?.districtId ?? nextAnchorLocation?.districtId ?? existing.districtId ?? null;
  }

  const requestedCategoryId = data.categoryId === undefined ? existing.categoryId : data.categoryId;
  let nextCategoryId = requestedCategoryId;
  if (requestedCategoryId) {
    const category = await db.excursionCategory.findFirst({
      where: {
        OR: [{ id: requestedCategoryId }, { slug: requestedCategoryId }],
      },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Выбранная категория не найдена" }, { status: 400 });
    }
    nextCategoryId = category.id;
  } else if (requestedCategoryId === null) {
    nextCategoryId = null;
  }

  const resolvedLegacyLocation = data.locationId
    ? await getExcursionLocationByIdOrSlug(data.locationId)
    : null;

  const nextLocationId =
    data.locationId ??
    (nextAnchorLocation ? nextAnchorLocation.slug : (existing.locationId ?? null));

  const nextLocationName =
    data.locationName ??
    resolvedLegacyLocation?.name ??
    (nextAnchorLocation ? nextAnchorLocation.name : (existing.locationName ?? null));

  const nextOfferType = data.offerType ?? existing.offerType;
  const nextAvailabilityMode = getResolvedAvailabilityMode(
    data.availabilityMode ?? existing.availabilityMode,
    data.scheduleMode ?? existing.scheduleMode,
  );
  const nextTimeline = data.timeline ?? (existing.timeline as Prisma.JsonValue as Prisma.JsonArray);
  const nextItineraryDays =
    data.itineraryDays ?? (existing.itineraryDays as Prisma.JsonValue as Prisma.JsonArray);
  const existingManagedUrls = new Set([
    ...existing.photoUrls,
    ...collectExcursionSectionPhotoUrls(
      existing.sectionPhotoGroups as Partial<Record<string, string[] | null | undefined>>,
    ),
    ...existing.videoUrls,
    ...collectExcursionProgramPhotoUrls({
      itineraryDays: existing.itineraryDays,
      timeline: existing.timeline,
    }),
  ]);
  const nextManagedUrls = new Set([
    ...nextPhotoUrls,
    ...collectExcursionSectionPhotoUrls(nextSectionPhotoGroups),
    ...nextVideoUrls,
    ...collectExcursionProgramPhotoUrls({
      itineraryDays: nextItineraryDays,
      timeline: nextTimeline,
    }),
  ]);
  const removedManagedUrls = [...existingManagedUrls].filter((url) => !nextManagedUrls.has(url));
  const nextRouteLocationsLength = data.routeLocations
    ? data.routeLocations.length
    : existing.routeLocations.length;

  const [existingSessionsCount, existingScheduleRulesCount] = await Promise.all([
    db.excursionSession.count({ where: { excursionId: existing.id } }),
    db.excursionScheduleRule.count({ where: { excursionId: existing.id } }),
  ]);

  const hasSessions = existingSessionsCount > 0;
  const hasRegularSchedule =
    Boolean(
      (data.scheduleText === undefined ? existing.scheduleText : data.scheduleText)?.trim(),
    ) || existingScheduleRulesCount > 0;

  const nextState = {
    offerType: nextOfferType,
    title: data.title ?? existing.title,
    locationId: nextLocationId,
    categoryId: nextCategoryId ?? null,
    description: data.description === undefined ? existing.description : data.description,
    routeDescription:
      data.routeDescription === undefined ? existing.routeDescription : data.routeDescription,
    durationMinutes:
      data.durationMinutes === undefined ? existing.durationMinutes : data.durationMinutes,
    durationDays: data.durationDays === undefined ? existing.durationDays : data.durationDays,
    durationNights:
      data.durationNights === undefined ? existing.durationNights : data.durationNights,
    timelineLength: Array.isArray(nextTimeline) ? nextTimeline.length : 0,
    itineraryDaysLength: Array.isArray(nextItineraryDays) ? nextItineraryDays.length : 0,
    routeLocationsLength: nextRouteLocationsLength,
    startPoint: data.startPoint === undefined ? existing.startPoint : data.startPoint,
    scheduleText: data.scheduleText === undefined ? existing.scheduleText : data.scheduleText,
    availabilityMode: nextAvailabilityMode,
    availabilityNote:
      data.availabilityNote === undefined ? existing.availabilityNote : data.availabilityNote,
    hasRegularSchedule,
    hasSessions,
    priceFrom: data.priceFrom === undefined ? existing.priceFrom : data.priceFrom,
    priceUnitLabel:
      data.priceUnitLabel === undefined ? existing.priceUnitLabel : data.priceUnitLabel,
    contactFirstName:
      data.contactFirstName === undefined ? existing.contactFirstName : data.contactFirstName,
    contactLastName:
      data.contactLastName === undefined ? existing.contactLastName : data.contactLastName,
    contactPhone: data.contactPhone === undefined ? existing.contactPhone : data.contactPhone,
    contactPhone2: data.contactPhone2 === undefined ? existing.contactPhone2 : data.contactPhone2,
    accommodationProvided:
      data.accommodationProvided === undefined
        ? existing.accommodationProvided
        : data.accommodationProvided,
    accommodationType:
      data.accommodationType === undefined ? existing.accommodationType : data.accommodationType,
    photoUrls: collectExcursionPresentationPhotoUrls({
      photoUrls: nextPhotoUrls,
      sectionPhotoGroups: nextSectionPhotoGroups,
      itineraryDays: nextItineraryDays,
      timeline: nextTimeline,
    }),
  };

  const missingPublishFields =
    data.status === ExcursionStatus.PENDING_MODERATION ? getMissingPublishFields(nextState) : [];

  if (data.status === ExcursionStatus.PENDING_MODERATION && missingPublishFields.length > 0) {
    return NextResponse.json(
      {
        error: `Для отправки на модерацию заполните обязательные поля. Не заполнено: ${missingPublishFields.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const nextPickupLocationIds = data.pickupLocationIds
    ? dedupeStrings(data.pickupLocationIds)
    : null;
  if (nextPickupLocationIds && nextPickupLocationIds.length > 0) {
    const pickupCount = await db.excursionLocation.count({
      where: { id: { in: nextPickupLocationIds } },
    });
    if (pickupCount !== nextPickupLocationIds.length) {
      return NextResponse.json(
        { error: "Некоторые локации трансфера не найдены в справочнике" },
        { status: 400 },
      );
    }
  }

  const nextRouteLocations = data.routeLocations
    ? data.routeLocations
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((item) => ({
          locationId: item.locationId,
          sortOrder: item.sortOrder,
        }))
    : null;

  if (nextRouteLocations && nextRouteLocations.length > 0) {
    const uniqueRouteLocationIds = dedupeStrings(nextRouteLocations.map((item) => item.locationId));
    const routeCount = await db.excursionLocation.count({
      where: { id: { in: uniqueRouteLocationIds } },
    });
    if (routeCount !== uniqueRouteLocationIds.length) {
      return NextResponse.json({ error: "Некоторые точки маршрута не найдены" }, { status: 400 });
    }
  }

  const submitPublishedEdit =
    isPublishedOwnerEdit && data.status === ExcursionStatus.PENDING_MODERATION;
  const resetPublishedEditToDraft =
    isPublishedOwnerEdit &&
    data.status === ExcursionStatus.DRAFT &&
    existingPendingEditStatus !== null;

  const updateData: Prisma.ExcursionUpdateInput = {
    ...(data.offerType !== undefined ? { offerType: data.offerType } : {}),
    ...(data.subtypeLabel !== undefined ? { subtypeLabel: data.subtypeLabel } : {}),
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(nextLocationId !== undefined ? { locationId: nextLocationId } : {}),
    ...(nextLocationName !== undefined ? { locationName: nextLocationName } : {}),
    ...(nextMainLocationId !== undefined ? { mainLocationId: nextMainLocationId } : {}),
    ...(nextAnchorLocation ? { anchorLocationId: nextAnchorLocation.id } : {}),
    ...(data.anchorLocationId === null ? { anchorLocationId: null } : {}),
    ...(nextDistrictId !== undefined ? { districtId: nextDistrictId } : {}),
    ...(nextCategoryId !== undefined ? { categoryId: nextCategoryId } : {}),
    ...(data.address !== undefined ? { address: data.address } : {}),
    ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
    ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
    ...(data.startPoint !== undefined ? { startPoint: data.startPoint } : {}),
    ...(data.meetingPointText !== undefined ? { meetingPointText: data.meetingPointText } : {}),
    ...(nextMeetingLocationId !== undefined ? { meetingLocationId: nextMeetingLocationId } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.shortDescription !== undefined ? { shortDescription: data.shortDescription } : {}),
    ...(data.fullDescription !== undefined ? { fullDescription: data.fullDescription } : {}),
    ...(data.routeDescription !== undefined ? { routeDescription: data.routeDescription } : {}),
    ...(data.highlights !== undefined ? { highlights: data.highlights } : {}),
    ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
    ...(data.durationDays !== undefined ? { durationDays: data.durationDays } : {}),
    ...(data.durationNights !== undefined ? { durationNights: data.durationNights } : {}),
    ...(data.itineraryDays !== undefined ? { itineraryDays: data.itineraryDays } : {}),
    ...(data.finishPoint !== undefined ? { finishPoint: data.finishPoint } : {}),
    ...(data.scheduleText !== undefined ? { scheduleText: data.scheduleText } : {}),
    ...(data.scheduleMode !== undefined ? { scheduleMode: data.scheduleMode } : {}),
    ...(data.availabilityMode !== undefined ? { availabilityMode: data.availabilityMode } : {}),
    ...(data.availabilityNote !== undefined ? { availabilityNote: data.availabilityNote } : {}),
    ...(data.format !== undefined ? { format: data.format } : {}),
    ...(data.groupSizeMin !== undefined ? { groupSizeMin: data.groupSizeMin } : {}),
    ...(data.groupSizeMax !== undefined ? { groupSizeMax: data.groupSizeMax } : {}),
    ...(data.languageCodes !== undefined
      ? { languageCodes: dedupeStrings(data.languageCodes) }
      : {}),
    ...(data.ageLimit !== undefined ? { ageLimit: data.ageLimit } : {}),
    ...(data.isKidFriendly !== undefined ? { isKidFriendly: data.isKidFriendly } : {}),
    ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
    ...(data.priceType !== undefined ? { priceType: data.priceType } : {}),
    ...(data.priceFrom !== undefined ? { priceFrom: data.priceFrom } : {}),
    ...(data.priceTo !== undefined ? { priceTo: data.priceTo } : {}),
    ...(data.currency !== undefined ? { currency: data.currency } : {}),
    ...(data.includedText !== undefined ? { includedText: data.includedText } : {}),
    ...(data.notIncludedText !== undefined ? { notIncludedText: data.notIncludedText } : {}),
    ...(data.includedItems !== undefined ? { includedItems: data.includedItems } : {}),
    ...(data.excludedItems !== undefined ? { excludedItems: data.excludedItems } : {}),
    ...(data.cancellationPolicy !== undefined
      ? { cancellationPolicy: data.cancellationPolicy }
      : {}),
    ...(data.cancellationPolicyType !== undefined
      ? { cancellationPolicyType: data.cancellationPolicyType }
      : {}),
    ...(data.transferDetails !== undefined ? { transferDetails: data.transferDetails } : {}),
    ...(data.physicalRequirements !== undefined
      ? { physicalRequirements: data.physicalRequirements }
      : {}),
    ...(data.whatToBring !== undefined ? { whatToBring: data.whatToBring } : {}),
    ...(data.meetingPointLat !== undefined ? { meetingPointLat: data.meetingPointLat } : {}),
    ...(data.meetingPointLng !== undefined ? { meetingPointLng: data.meetingPointLng } : {}),
    ...(data.minBookingNoticeHours !== undefined
      ? { minBookingNoticeHours: data.minBookingNoticeHours }
      : {}),
    ...(data.priceUnitLabel !== undefined ? { priceUnitLabel: data.priceUnitLabel } : {}),
    ...(data.accommodationProvided !== undefined
      ? { accommodationProvided: data.accommodationProvided }
      : {}),
    ...(data.accommodationType !== undefined ? { accommodationType: data.accommodationType } : {}),
    ...(data.accommodationNights !== undefined
      ? { accommodationNights: data.accommodationNights }
      : {}),
    ...(data.accommodationFormat !== undefined
      ? { accommodationFormat: data.accommodationFormat }
      : {}),
    ...(data.mealPlan !== undefined ? { mealPlan: data.mealPlan } : {}),
    ...(data.mealDetails !== undefined ? { mealDetails: data.mealDetails } : {}),
    ...(data.accommodationComment !== undefined
      ? { accommodationComment: data.accommodationComment }
      : {}),
    ...(data.accommodationStars !== undefined
      ? { accommodationStars: data.accommodationStars }
      : {}),
    ...(data.roomTypes !== undefined ? { roomTypes: data.roomTypes } : {}),
    ...(data.singleSupplementAvailable !== undefined
      ? { singleSupplementAvailable: data.singleSupplementAvailable }
      : {}),
    ...(data.singleSupplementPrice !== undefined
      ? { singleSupplementPrice: data.singleSupplementPrice }
      : {}),
    ...(data.tourKind !== undefined ? { tourKind: data.tourKind } : {}),
    ...(data.transportModes !== undefined ? { transportModes: data.transportModes } : {}),
    ...(data.departureMode !== undefined ? { departureMode: data.departureMode } : {}),
    ...(data.arrivalInfo !== undefined ? { arrivalInfo: data.arrivalInfo } : {}),
    ...(data.departureInfo !== undefined ? { departureInfo: data.departureInfo } : {}),
    ...(data.documentsRequired !== undefined ? { documentsRequired: data.documentsRequired } : {}),
    ...(data.insuranceIncluded !== undefined ? { insuranceIncluded: data.insuranceIncluded } : {}),
    ...(data.insuranceComment !== undefined ? { insuranceComment: data.insuranceComment } : {}),
    ...(data.equipmentProvided !== undefined ? { equipmentProvided: data.equipmentProvided } : {}),
    ...(data.safetyInfo !== undefined ? { safetyInfo: data.safetyInfo } : {}),
    ...(data.routeConditions !== undefined ? { routeConditions: data.routeConditions } : {}),
    ...(data.hasGuideLicense !== undefined ? { hasGuideLicense: data.hasGuideLicense } : {}),
    ...(data.timeline !== undefined ? { timeline: data.timeline } : {}),
    ...(data.extraOptions !== undefined ? { extraOptions: data.extraOptions } : {}),
    ...(data.pricingTiers !== undefined ? { pricingTiers: data.pricingTiers } : {}),
    ...(data.faqItems !== undefined ? { faqItems: data.faqItems } : {}),
    ...(data.pickupAvailable !== undefined ? { pickupAvailable: data.pickupAvailable } : {}),
    ...(data.tags !== undefined ? { tags: dedupeStrings(data.tags) } : {}),
    ...(data.instantConfirmation !== undefined
      ? { instantConfirmation: data.instantConfirmation }
      : {}),
    ...(data.contactFirstName !== undefined ? { contactFirstName: data.contactFirstName } : {}),
    ...(data.contactLastName !== undefined ? { contactLastName: data.contactLastName } : {}),
    ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
    ...(data.contactPhone2 !== undefined ? { contactPhone2: data.contactPhone2 } : {}),
    ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail } : {}),
    ...(data.websiteUrl !== undefined ? { websiteUrl: data.websiteUrl } : {}),
    ...(data.whatsappUrl !== undefined ? { whatsappUrl: data.whatsappUrl } : {}),
    ...(data.telegramUrl !== undefined ? { telegramUrl: data.telegramUrl } : {}),
    ...(data.vkUrl !== undefined ? { vkUrl: data.vkUrl } : {}),
    ...(data.maxUrl !== undefined ? { maxUrl: data.maxUrl } : {}),
    ...(data.okUrl !== undefined ? { okUrl: data.okUrl } : {}),
    ...(data.photoUrls !== undefined ? { photoUrls: nextPhotoUrls } : {}),
    ...(data.sectionPhotoGroups !== undefined
      ? { sectionPhotoGroups: nextSectionPhotoGroups as Prisma.InputJsonValue }
      : {}),
    ...(data.videoUrls !== undefined ? { videoUrls: nextVideoUrls } : {}),
    ...(!isPublishedOwnerEdit && data.status !== undefined ? { status: nextStatus } : {}),
    ...(submitPublishedEdit ? { pendingEditStatus: ExcursionStatus.PENDING_MODERATION } : {}),
    ...(resetPublishedEditToDraft ? { pendingEditStatus: ExcursionStatus.DRAFT } : {}),
    ...(data.status === ExcursionStatus.PENDING_MODERATION || resetPublishedEditToDraft
      ? {
          moderationNotes: null,
          moderatedById: null,
          moderatedAt: null,
        }
      : {}),
  };

  let updated: ExcursionWithRelations;
  try {
    updated = await db.$transaction(async (tx) => {
      await tx.excursion.update({
        where: { id: existing.id },
        data: updateData,
      });

      if (nextPickupLocationIds !== null) {
        await tx.excursionPickupLocation.deleteMany({
          where: { excursionId: existing.id },
        });

        if (nextPickupLocationIds.length > 0) {
          await tx.excursionPickupLocation.createMany({
            data: nextPickupLocationIds.map((locationId) => ({
              excursionId: existing.id,
              locationId,
            })),
          });
        }
      }

      if (nextRouteLocations !== null) {
        await tx.excursionRouteLocation.deleteMany({
          where: { excursionId: existing.id },
        });

        if (nextRouteLocations.length > 0) {
          await tx.excursionRouteLocation.createMany({
            data: nextRouteLocations.map((item) => ({
              excursionId: existing.id,
              locationId: item.locationId,
              sortOrder: item.sortOrder,
            })),
          });
        }
      }

      const row = await tx.excursion.findUnique({
        where: { id: existing.id },
        include: excursionSerializationInclude,
      });

      if (!row) {
        throw new Error("EXCURSION_NOT_FOUND_AFTER_UPDATE");
      }

      return row;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Ссылка на справочник локаций или категорий некорректна. Выберите значения из подсказок и сохраните снова.",
        },
        { status: 400 },
      );
    }
    throw error;
  }

  const shouldMarkOwnerUpdated =
    isPublishedOwnerEdit && hasPublishedContentEdit && !submitPublishedEdit;

  if (shouldMarkOwnerUpdated) {
    await markExcursionNeedsRemoderationAfterOwnerEdit(db, existing.id);
  }

  if (removedManagedUrls.length > 0) {
    await Promise.all(
      removedManagedUrls.map((url) => deleteManagedUrlFromStorage(url).catch(() => null)),
    );
  }

  const normalizedUpdated = shouldMarkOwnerUpdated
    ? await getAccessibleExcursion(existing.id, editor)
    : updated;

  if (!normalizedUpdated) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  return NextResponse.json({ item: serializeExcursion(normalizedUpdated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await db.excursion.findUnique({ where: { id } });

  if (!existing || (!editor.isAdmin && existing.ownerId !== editor.id)) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  const storageEntry = await db.excursion.findUnique({
    where: { id: existing.id },
    select: EXCURSION_STORAGE_CLEANUP_SELECT,
  });

  await db.excursion.delete({
    where: { id: existing.id },
  });

  if (storageEntry) {
    await deleteExcursionStorageEntries([storageEntry]);
  }

  return NextResponse.json({ ok: true });
}

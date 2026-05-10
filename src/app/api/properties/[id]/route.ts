import { PetsPolicy, Prisma, PropertyStatus, SmokingPolicy } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { crimeaLocationById, isClassificationApplicableByType } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import { purgeExpiredDeletedProperties } from "@/lib/admin-entity-lifecycle";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import { resolveOrCreatePropertyLocation } from "@/lib/location-directory";
import {
  PROPERTY_OWNER_DELETE_RETENTION_DAYS,
  getOwnerPropertyDeletionExpiresAt,
} from "@/lib/property-owner-delete";
import {
  deletePropertyStorageEntries,
  getPropertyProgress,
  PROPERTY_STORAGE_CLEANUP_SELECT,
  preparePropertyForPublishedOwnerEdit,
  purgeExpiredPropertyDraftsForOwner,
  getRecommendedWizardStep,
  isCoordinateInCrimea,
  markPropertyNeedsRemoderationAfterOwnerEdit,
  serializeProperty,
} from "@/lib/properties";
import { updatePropertyStepSchema } from "@/lib/schemas";

// Owner property route:
// - GET: return draft + recommended wizard step
// - PATCH: apply one wizard step (1-7)
// - DELETE: soft-delete published objects, hard-delete drafts
type RouteContext = {
  params: Promise<{ id: string }>;
};

type DeletePropertyPayload = {
  acknowledged?: boolean;
};

type PropertyStepPayload = z.infer<typeof updatePropertyStepSchema>;

// Shared include shape keeps GET/PATCH responses consistent for progress calculation.
const propertyInclude = Prisma.validator<Prisma.PropertyInclude>()({
  media: {
    where: { roomId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
  rooms: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      prices: {
        select: { id: true },
      },
    },
  },
  amenities: {
    include: {
      amenity: true,
    },
  },
  customAmenities: true,
});

function runtimeSupportsAllowedPolicies(): boolean {
  return (
    Object.prototype.hasOwnProperty.call(PetsPolicy, "ALLOWED") &&
    Object.prototype.hasOwnProperty.call(SmokingPolicy, "ALLOWED")
  );
}

function normalizePropertyFaqItemsForCompare(value: unknown): Array<{ q: string; a: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as { q?: unknown; a?: unknown };
      const q = typeof candidate.q === "string" ? candidate.q.trim() : "";
      const a = typeof candidate.a === "string" ? candidate.a.trim() : "";

      return q && a ? { q, a } : null;
    })
    .filter((item): item is { q: string; a: string } => item !== null);
}

function isPublishedPropertyEditModerated(
  stepPayload: PropertyStepPayload,
  existing: { description: string | null; faqItems: Prisma.JsonValue },
): boolean {
  switch (stepPayload.step) {
    case 1:
    case 2:
    case 3:
      return true;
    case 5: {
      const data = stepPayload.data;
      const nextDescription = data.description ?? null;
      const currentDescription = existing.description ?? null;

      if (nextDescription !== currentDescription) {
        return true;
      }

      if (data.faqItems !== undefined) {
        return (
          JSON.stringify(normalizePropertyFaqItemsForCompare(data.faqItems)) !==
          JSON.stringify(normalizePropertyFaqItemsForCompare(existing.faqItems))
        );
      }

      return false;
    }
    default:
      return false;
  }
}

// Fetch one property draft by id. Access is owner-only.
export async function GET(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();
  if (editor?.kind === "owner") {
    await purgeExpiredPropertyDraftsForOwner(db, editor.id);
  }

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;

  const property = await db.property.findUnique({
    where: { id },
    include: propertyInclude,
  });

  if (
    !property ||
    property.ownerDeletedAt ||
    (!editor.isAdmin && property.ownerId !== editor.id)
  ) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const item = serializeProperty(property);

  return NextResponse.json({
    item,
    recommendedStep: getRecommendedWizardStep(item.progress),
  });
}

// Partial update endpoint for wizard steps 1-7 (step 8 media has dedicated routes).
export async function PATCH(request: Request, context: RouteContext) {
  const editor = await getEditorSession();
  if (editor?.kind === "owner") {
    await purgeExpiredPropertyDraftsForOwner(db, editor.id);
  }

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await db.property.findUnique({ where: { id } });

  if (
    !existing ||
    existing.ownerDeletedAt ||
    (!editor.isAdmin && existing.ownerId !== editor.id)
  ) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updatePropertyStepSchema.safeParse(payload);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const pathLabel =
      firstIssue && firstIssue.path.length > 0 ? `${firstIssue.path.join(".")}: ` : "";

    return NextResponse.json(
      {
        error: `${pathLabel}${firstIssue?.message ?? "Проверьте корректность данных шага"}`,
      },
      { status: 400 },
    );
  }

  const shouldTrackPublishedOwnerEdit =
    existing.status === PropertyStatus.PUBLISHED &&
    !editor.isAdmin &&
    isPublishedPropertyEditModerated(parsed.data, existing);

  if (shouldTrackPublishedOwnerEdit) {
    await preparePropertyForPublishedOwnerEdit(db, id);
  }

  const updated = await (async () => {
    const stepPayload = parsed.data;

    // Switch keeps per-step narrowing strict and prevents accidental field mixing.
    switch (stepPayload.step) {
      case 1: {
        const data = stepPayload.data;
        const classificationApplicable = isClassificationApplicableByType(data.type);

        return db.property.update({
          where: { id },
          data: {
            type: data.type,
            name: data.name,
            classificationApplicable,
            ...(classificationApplicable
              ? {}
                : {
                  starRating: null,
                  registryNumber: null,
                  registryNumberPending: null,
                  registryModerationSubmittedAt: null,
                  registryDetails: null,
                  selfAssessmentPassed: null,
                }),
          },
          include: propertyInclude,
        });
      }
      case 2: {
        const data = stepPayload.data;
        const officialLocationName = crimeaLocationById[data.locationId]?.name ?? data.locationName;

        return db.property.update({
          where: { id },
          data: {
            locationId: data.locationId,
            locationName: officialLocationName,
          },
          include: propertyInclude,
        });
      }
      case 3: {
        const data = stepPayload.data;
        const normalizedSeaDistance = data.seaDistance?.trim() ? data.seaDistance.trim() : null;

        if (!isCoordinateInCrimea(data.latitude, data.longitude)) {
          throw new Error("OUTSIDE_CRIMEA");
        }

        return db.$transaction(async (tx) => {
          const resolvedLocation = await resolveOrCreatePropertyLocation({
            tx,
            locationId: data.locationId,
            locationName: data.locationName,
            sourcePropertyId: id,
          });

          const updated = await tx.property.update({
            where: { id },
            data: {
              locationId: resolvedLocation.locationId,
              locationName: resolvedLocation.locationName,
              address: data.address,
              latitude: data.latitude,
              longitude: data.longitude,
            },
            include: propertyInclude,
          });

          // Compatibility rollout:
          // some environments may still use an old Prisma client while DB migration is in progress.
          // Persist seaDistance via raw SQL and ignore failures when column is unavailable.
          try {
            await tx.$executeRaw`
              UPDATE "Property"
              SET "seaDistance" = ${normalizedSeaDistance}
              WHERE "id" = ${id}
            `;
          } catch {
            // noop: field remains unset until migration + client regeneration are applied.
          }

          const refreshed = await tx.property.findUnique({
            where: { id },
            include: propertyInclude,
          });

          return refreshed ?? updated;
        });
      }
      case 4: {
        const data = stepPayload.data;

        return db.property.update({
          where: { id },
          data: {
            phone: data.phone.trim(),
            phoneName: data.phoneName?.trim() ? data.phoneName.trim() : null,
            phone2: data.phone2?.trim() ? data.phone2.trim() : null,
            phone2Name: data.phone2Name?.trim() ? data.phone2Name.trim() : null,
            phone3: data.phone3?.trim() ? data.phone3.trim() : null,
            phone3Name: data.phone3Name?.trim() ? data.phone3Name.trim() : null,
            websiteUrl: data.websiteUrl?.trim() ? data.websiteUrl.trim() : null,
            contactEmail: data.contactEmail?.trim() ? data.contactEmail.trim().toLowerCase() : null,
            contactPersonName: data.contactPersonName?.trim()
              ? data.contactPersonName.trim()
              : null,
            contactPersonRole: data.contactPersonRole?.trim() ? data.contactPersonRole.trim() : null,
            listingChannels: data.listingChannels?.trim() ? data.listingChannels.trim() : null,
            whatsappUrl: data.whatsappUrl?.trim() ? data.whatsappUrl.trim() : null,
            telegramUrl: data.telegramUrl?.trim() ? data.telegramUrl.trim() : null,
            vkUrl: data.vkUrl?.trim() ? data.vkUrl.trim() : null,
            maxUrl: data.maxUrl?.trim() ? data.maxUrl.trim() : null,
            okUrl: data.okUrl?.trim() ? data.okUrl.trim() : null,
            receiveRequests: data.receiveRequests,
          },
          include: propertyInclude,
        });
      }
      case 5: {
        const data = stepPayload.data;
        const amenityIds = Array.from(new Set(data.amenityIds.map((item) => item.trim())));
        const normalizedFaqItems =
          data.faqItems?.map((item) => ({
            q: item.q.trim(),
            a: item.a.trim(),
          })).filter((item) => item.q.length > 0 && item.a.length > 0) ?? undefined;

        const amenities = await db.amenity.findMany({
          where: {
            id: { in: amenityIds },
            isActive: true,
          },
        });

        if (amenities.length !== amenityIds.length) {
          throw new Error("AMENITY_NOT_FOUND");
        }

        const customAmenities = Array.from(
          new Map(
            data.customAmenities
              .map((item) => item.trim())
              .filter((item) => item.length > 0)
              .map((item) => [item.toLowerCase(), item]),
          ).values(),
        );

        // Step 5 writes multiple tables; keep changes atomic.
        const txResult = await db.$transaction(async (tx) => {
          await tx.property.update({
            where: { id },
            data: {
              description: data.description,
              ...(normalizedFaqItems !== undefined ? { faqItems: normalizedFaqItems } : {}),
            },
          });

          await tx.propertyAmenity.deleteMany({ where: { propertyId: id } });

          if (amenityIds.length > 0) {
            await tx.propertyAmenity.createMany({
              data: amenityIds.map((amenityId) => ({
                propertyId: id,
                amenityId,
              })),
            });
          }

          await tx.propertyCustomAmenity.deleteMany({ where: { propertyId: id } });

          if (customAmenities.length > 0) {
            await tx.propertyCustomAmenity.createMany({
              data: customAmenities.map((name) => ({
                propertyId: id,
                name,
              })),
            });
          }

          return tx.property.findUnique({
            where: { id },
            include: propertyInclude,
          });
        });

        if (!txResult) {
          throw new Error("NOT_FOUND_AFTER_UPDATE");
        }

        return txResult;
      }
      case 6: {
        const data = stepPayload.data;
        const supportsAllowed = runtimeSupportsAllowedPolicies();
        if (
          !supportsAllowed &&
          (data.petsPolicy === "ALLOWED" || data.smokingPolicy === "ALLOWED")
        ) {
          return "POLICY_CLIENT_OUTDATED" as const;
        }

        return db.property.update({
          where: { id },
          data: {
            checkInFrom: data.checkInFrom,
            checkOutUntil: data.checkOutUntil,
            childrenAllowed: data.childrenAllowed,
            childrenMinAge: data.childrenAllowed ? data.childrenMinAge : null,
            petsPolicy: data.petsPolicy,
            smokingPolicy: data.smokingPolicy,
            quietHoursEnabled: data.quietHoursEnabled,
            quietHoursFrom: data.quietHoursEnabled ? data.quietHoursFrom : null,
            quietHoursTo: data.quietHoursEnabled ? data.quietHoursTo : null,
            parkingInfo: data.parkingInfo?.trim() || null,
            mealOptions: data.mealOptions?.trim() || null,
            prepaymentPolicy: data.prepaymentPolicy?.trim() || null,
          },
          include: propertyInclude,
        });
      }
      case 7: {
        const data = stepPayload.data;
        if (!data.classificationApplicable) {
          return db.property.update({
            where: { id },
            data: {
              classificationApplicable: false,
              starRating: null,
              registryNumber: null,
              registryNumberPending: null,
              registryModerationSubmittedAt: null,
              registryDetails: null,
              selfAssessmentPassed: null,
            },
            include: propertyInclude,
          });
        }

        const normalizedRegistryNumber = data.registryNumber?.trim()
          ? data.registryNumber.trim()
          : null;
        if (!normalizedRegistryNumber || normalizedRegistryNumber.length < 3) {
          return "REGISTRY_REQUIRED" as const;
        }

        const normalizedApprovedRegistryNumber = existing.registryNumber?.trim()
          ? existing.registryNumber.trim()
          : null;
        const shouldSendToRegistryModeration = normalizedApprovedRegistryNumber !== normalizedRegistryNumber;

        return db.property.update({
          where: { id },
          data: {
            classificationApplicable: true,
            starRating: data.starRating,
            // Keep publicly visible number unchanged until admin approves registry update.
            registryNumberPending: shouldSendToRegistryModeration ? normalizedRegistryNumber : null,
            registryModerationSubmittedAt: shouldSendToRegistryModeration ? new Date() : null,
            registryDetails: null,
            selfAssessmentPassed: data.selfAssessmentPassed,
          },
          include: propertyInclude,
        });
      }
      default: {
        throw new Error("UNSUPPORTED_STEP");
      }
    }
  })().catch((error: unknown) => {
    if (error instanceof Error && error.message === "OUTSIDE_CRIMEA") {
      return null;
    }

    if (error instanceof Error && error.message === "LOCATION_NAME_REQUIRED") {
      return "LOCATION_NAME_REQUIRED" as const;
    }

    if (error instanceof Error && error.message === "AMENITY_NOT_FOUND") {
      return "AMENITY_NOT_FOUND" as const;
    }

    if (error === "REGISTRY_REQUIRED") {
      return "REGISTRY_REQUIRED" as const;
    }

    if (
      error instanceof Error &&
      /invalid input value for enum "(PetsPolicy|SmokingPolicy)"/i.test(error.message)
    ) {
      return "POLICY_ENUM_MIGRATION_REQUIRED" as const;
    }

    if (
      error instanceof Error &&
      /Invalid value for argument `?(petsPolicy|smokingPolicy)`?/i.test(error.message)
    ) {
      return "POLICY_CLIENT_OUTDATED" as const;
    }

    return "UNEXPECTED_ERROR" as const;
  });

  if (updated === null) {
    return NextResponse.json(
      { error: "Координаты должны находиться в пределах Крыма" },
      { status: 400 },
    );
  }

  if (updated === "LOCATION_NAME_REQUIRED") {
    return NextResponse.json({ error: "Укажите населенный пункт Крыма" }, { status: 400 });
  }

  if (updated === "AMENITY_NOT_FOUND") {
    return NextResponse.json({ error: "Часть услуг не найдена в справочнике" }, { status: 400 });
  }

  if (updated === "REGISTRY_REQUIRED") {
    return NextResponse.json({ error: "Укажите корректный номер записи в реестре КСР" }, { status: 400 });
  }

  if (updated === "POLICY_ENUM_MIGRATION_REQUIRED") {
    return NextResponse.json(
      {
        error:
          "База данных не обновлена для новых значений политик. Выполните миграции Prisma и перезапустите сервер.",
      },
      { status: 400 },
    );
  }

  if (updated === "POLICY_CLIENT_OUTDATED") {
    return NextResponse.json(
      {
        error:
          "Сервер использует устаревший Prisma Client. Перезапустите dev-сервер и выполните prisma generate.",
      },
      { status: 400 },
    );
  }

  if (updated === "UNEXPECTED_ERROR") {
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера. Проверьте настройки БД и перезапустите сервер." },
      { status: 500 },
    );
  }

  const shouldMarkAsOwnerUpdated =
    shouldTrackPublishedOwnerEdit;

  if (shouldMarkAsOwnerUpdated) {
    await markPropertyNeedsRemoderationAfterOwnerEdit(db, id);
  }

  const normalizedUpdated = shouldMarkAsOwnerUpdated
    ? await db.property.findUnique({
        where: { id },
        include: propertyInclude,
      })
    : updated;

  if (!normalizedUpdated) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const item = serializeProperty(normalizedUpdated);
  const progress = getPropertyProgress(normalizedUpdated);

  // Response always returns normalized object + progress for UI re-render.
  return NextResponse.json({
    item,
    progress,
    recommendedStep: getRecommendedWizardStep(progress),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSession();
  if (session) {
    await purgeExpiredPropertyDraftsForOwner(db, session.id);
  }

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let payload: DeletePropertyPayload | null = null;

  try {
    payload = (await request.json()) as DeletePropertyPayload;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!payload?.acknowledged) {
    return NextResponse.json(
      {
        error:
          "Подтвердите удаление: нужно явно согласиться с полным удалением объекта и условиями возврата",
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const now = new Date();

  await purgeExpiredDeletedProperties(db, now);

  const existing = await db.property.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      status: true,
      ownerDeletedAt: true,
      ownerDeletionExpiresAt: true,
    },
  });

  if (!existing || existing.ownerId !== session.id) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  if (existing.ownerDeletedAt) {
    return NextResponse.json(
      {
        error:
          "Объект уже удален из кабинета. Для восстановления опубликованного объекта обратитесь к администрации сайта",
      },
      { status: 409 },
    );
  }

  if (existing.status === PropertyStatus.PUBLISHED) {
    // Published objects are recoverable for a limited period.
    const restoreUntil = getOwnerPropertyDeletionExpiresAt(now);

    await db.property.update({
      where: { id: existing.id },
      data: {
        ownerDeletedAt: now,
        ownerDeletionExpiresAt: restoreUntil,
      },
    });

    return NextResponse.json({
      mode: "soft",
      restoreUntil: restoreUntil.toISOString(),
      message: `Объект удален из вашего кабинета. Если удаление произошло ошибочно, обратитесь к администрации сайта для восстановления в течение ${PROPERTY_OWNER_DELETE_RETENTION_DAYS} дней`,
    });
  }

  const storageEntry = await db.property.findUnique({
    where: { id: existing.id },
    select: PROPERTY_STORAGE_CLEANUP_SELECT,
  });

  await db.property.delete({
    where: { id: existing.id },
  });

  if (storageEntry) {
    await deletePropertyStorageEntries([storageEntry]);
  }

  // Draft/non-published objects are removed permanently.
  return NextResponse.json({
    mode: "hard",
    message: "Объект полностью удален без возможности восстановления",
  });
}

import { ExcursionStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getAdminSoftDeleteExpiresAt,
  isSoftDeleteWindowActive,
  purgeExpiredDeletedExcursions,
} from "@/lib/admin-entity-lifecycle";
import {
  EXCURSION_SOFT_DELETE_COLUMNS,
  EXCURSION_VISIBILITY_CONTROL_COLUMNS,
} from "@/lib/admin-schema-compat";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import {
  deleteExcursionStorageEntries,
  EXCURSION_STORAGE_CLEANUP_SELECT,
} from "@/lib/excursions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ALLOWED_STRING_FIELDS = [
  "title",
  "description",
  "shortDescription",
  "fullDescription",
  "address",
  "startPoint",
  "finishPoint",
  "locationName",
  "mainLocationId",
  "categoryId",
  "districtId",
  "format",
  "difficulty",
  "priceType",
  "contactFirstName",
  "contactLastName",
  "contactPhone",
  "contactPhoneName",
  "contactPhone2",
  "contactPhone2Name",
  "contactPhone3",
  "contactPhone3Name",
  "contactEmail",
  "moderationNotes",
  "offerType",
] as const;

const ALLOWED_NUMBER_FIELDS = [
  "durationMinutes",
  "durationDays",
  "durationNights",
  "groupSizeMin",
  "groupSizeMax",
  "priceFrom",
  "priceTo",
] as const;

const ALLOWED_BOOL_FIELDS = ["isKidFriendly", "isPublishedVisible"] as const;

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  await purgeExpiredDeletedExcursions(db, new Date());

  const { id } = await context.params;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (
    "isPublishedVisible" in payload &&
    !(await areDatabaseColumnsAvailable("Excursion", EXCURSION_VISIBILITY_CONTROL_COLUMNS))
  ) {
    return NextResponse.json(
      {
        error:
          "Управление видимостью опубликованной программы временно недоступно: база данных еще не обновлена до последней миграции.",
      },
      { status: 503 },
    );
  }

  const data: Record<string, unknown> = {};

  for (const field of ALLOWED_STRING_FIELDS) {
    if (field in payload) {
      data[field] =
        payload[field] === null || payload[field] === "" ? null : String(payload[field]);
    }
  }

  for (const field of ALLOWED_NUMBER_FIELDS) {
    if (field in payload) {
      if (payload[field] === null) {
        data[field] = null;
      } else {
        const num = Number(payload[field]);
        data[field] = Number.isFinite(num) ? num : null;
      }
    }
  }

  for (const field of ALLOWED_BOOL_FIELDS) {
    if (field in payload) {
      data[field] = payload[field] === null ? null : Boolean(payload[field]);
    }
  }

  if ("status" in payload) {
    const validStatuses = Object.values(ExcursionStatus);
    if (validStatuses.includes(payload.status as ExcursionStatus)) {
      data.status = payload.status;
    }
  }

  if ("ownerId" in payload && typeof payload.ownerId === "string") {
    const user = await db.user.findUnique({
      where: { id: payload.ownerId },
      select: { id: true },
    });
    if (user) {
      data.ownerId = payload.ownerId;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  const existing = await db.excursion.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  const updated = await db.$transaction(async (tx) => {
    const item = await tx.excursion.update({
      where: { id },
      data: data as Prisma.ExcursionUpdateInput,
      select: {
        id: true,
        title: true,
        status: true,
        isPublishedVisible: true,
        deletedAt: true,
        deletionExpiresAt: true,
        updatedAt: true,
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: "admin_edit",
        targetType: "excursion",
        targetId: id,
        details: { fields: Object.keys(data) },
      },
    });

    return item;
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      isPublishedVisible: updated.isPublishedVisible,
      deletedAt: updated.deletedAt?.toISOString() ?? null,
      deletionExpiresAt: updated.deletionExpiresAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!(await areDatabaseColumnsAvailable("Excursion", EXCURSION_SOFT_DELETE_COLUMNS))) {
    return NextResponse.json(
      {
        error:
          "Удаление опубликованных экскурсий временно недоступно: база данных еще не обновлена до последней миграции.",
      },
      { status: 503 },
    );
  }

  const now = new Date();

  await purgeExpiredDeletedExcursions(db, now);

  const existing = await db.excursion.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      isPublishedVisible: true,
      deletedAt: true,
      deletionExpiresAt: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  if (existing.deletedAt && isSoftDeleteWindowActive(existing.deletionExpiresAt, now)) {
    return NextResponse.json(
      { error: "Программа уже ожидает удаления. Используйте отмену удаления." },
      { status: 409 },
    );
  }

  if (existing.status === ExcursionStatus.PUBLISHED) {
    const deletionExpiresAt = getAdminSoftDeleteExpiresAt(now);

    await db.$transaction(async (tx) => {
      await tx.excursion.update({
        where: { id },
        data: {
          isPublishedVisible: false,
          deletedAt: now,
          deletionExpiresAt,
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: "admin_schedule_delete",
          targetType: "excursion",
          targetId: id,
          details: {
            title: existing.title,
            deletionExpiresAt: deletionExpiresAt.toISOString(),
          },
        },
      });
    });

    return NextResponse.json({
      ok: true,
      mode: "soft",
      restoreUntil: deletionExpiresAt.toISOString(),
      item: {
        id: existing.id,
        status: existing.status,
        isPublishedVisible: false,
        deletedAt: now.toISOString(),
        deletionExpiresAt: deletionExpiresAt.toISOString(),
      },
    });
  }

  const storageEntry = await db.excursion.findUnique({
    where: { id },
    select: EXCURSION_STORAGE_CLEANUP_SELECT,
  });

  await db.$transaction(async (tx) => {
    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: "admin_delete",
        targetType: "excursion",
        targetId: id,
        details: { title: existing.title },
      },
    });
    await tx.excursion.delete({ where: { id } });
  });

  if (storageEntry) {
    await deleteExcursionStorageEntries([storageEntry]);
  }

  return NextResponse.json({ ok: true, mode: "hard" });
}

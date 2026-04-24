// API route handler for /api/admin/properties/[id].
// GET: full property details for admin
// PATCH: update any property fields from admin editor
// DELETE: schedule published delete or hard-delete draft
import { Prisma, PropertyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getAdminSoftDeleteExpiresAt,
  isSoftDeleteWindowActive,
  purgeExpiredDeletedProperties,
} from "@/lib/admin-entity-lifecycle";
import { PROPERTY_PUBLICATION_CONTROL_COLUMNS } from "@/lib/admin-schema-compat";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { serializePayment } from "@/lib/payments";
import {
  deletePropertyStorageEntries,
  PROPERTY_STORAGE_CLEANUP_SELECT,
  serializeProperty,
} from "@/lib/properties";
import { serializeReview } from "@/lib/reviews";
import { roomInclude, serializeRoom } from "@/lib/rooms";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const adminPropertyInclude = Prisma.validator<Prisma.PropertyInclude>()({
  owner: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
    },
  },
  media: {
    where: { roomId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
  rooms: {
    where: { isActive: true },
    orderBy: [{ updatedAt: "desc" }],
    include: roomInclude,
  },
  amenities: {
    include: { amenity: true },
  },
  customAmenities: true,
  payments: {
    orderBy: [{ createdAt: "desc" }],
    take: 10,
    include: {
      property: {
        select: { name: true },
      },
    },
  },
  reviews: {
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
});

export async function GET(_request: Request, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  await purgeExpiredDeletedProperties(db, new Date());

  const { id } = await context.params;

  const property = await db.property.findUnique({
    where: { id },
    include: adminPropertyInclude,
  });

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      ...serializeProperty(property),
      owner: {
        id: property.owner.id,
        firstName: property.owner.firstName,
        lastName: property.owner.lastName,
        email: property.owner.email,
        role: property.owner.role,
        createdAt: property.owner.createdAt.toISOString(),
      },
      rooms: property.rooms.map(serializeRoom),
      payments: property.payments.map(serializePayment),
      reviews: property.reviews.map(serializeReview),
    },
  });
}

// Allowlisted fields that admin can update.
const ALLOWED_STRING_FIELDS = [
  "name", "type", "address", "description", "phone", "contactEmail",
  "contactPersonName", "websiteUrl", "whatsappUrl", "telegramUrl",
  "checkInFrom", "checkOutUntil", "parkingInfo", "mealOptions",
  "seaDistance", "moderationNotes", "locationId", "locationName",
  "petsPolicy", "smokingPolicy",
] as const;

const ALLOWED_BOOL_FIELDS = ["childrenAllowed", "isPublishedVisible"] as const;
const ALLOWED_NUMBER_FIELDS = ["latitude", "longitude"] as const;

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (
    "isPublishedVisible" in payload &&
    !(await areDatabaseColumnsAvailable("Property", PROPERTY_PUBLICATION_CONTROL_COLUMNS))
  ) {
    return NextResponse.json(
      {
        error:
          "Управление видимостью опубликованного объекта временно недоступно: база данных еще не обновлена до последней миграции.",
      },
      { status: 503 },
    );
  }

  // Legacy action support
  if (payload.action === "clear_moderation_comment") {
    const existing = await db.property.findUnique({ where: { id }, select: { id: true, moderationNotes: true } });
    if (!existing) return NextResponse.json({ error: "Объект не найден" }, { status: 404 });

    const updated = await db.$transaction(async (tx) => {
      const item = await tx.property.update({
        where: { id },
        data: { moderationNotes: null },
        select: { id: true, moderationNotes: true, updatedAt: true },
      });
      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: "clear_comment",
          targetType: "property",
          targetId: existing.id,
          details: { previousComment: existing.moderationNotes, nextComment: null },
        },
      });
      return item;
    });

    return NextResponse.json({ item: { id: updated.id, moderationNotes: updated.moderationNotes, updatedAt: updated.updatedAt.toISOString() } });
  }

  // Full field update
  const data: Record<string, unknown> = {};

  for (const field of ALLOWED_STRING_FIELDS) {
    if (field in payload) {
      data[field] = payload[field] === null || payload[field] === "" ? null : String(payload[field]);
    }
  }

  for (const field of ALLOWED_BOOL_FIELDS) {
    if (field in payload) {
      data[field] = payload[field] === null ? null : Boolean(payload[field]);
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

  if ("status" in payload) {
    const validStatuses = Object.values(PropertyStatus);
    if (validStatuses.includes(payload.status as PropertyStatus)) {
      data.status = payload.status;
    }
  }

  if ("ownerId" in payload && typeof payload.ownerId === "string") {
    const user = await db.user.findUnique({ where: { id: payload.ownerId }, select: { id: true } });
    if (user) {
      data.ownerId = payload.ownerId;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  const existing = await db.property.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const updated = await db.$transaction(async (tx) => {
    const item = await tx.property.update({
      where: { id },
      data: data as Prisma.PropertyUpdateInput,
      select: { id: true, name: true, status: true, isPublishedVisible: true, updatedAt: true },
    });

    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: "admin_edit",
        targetType: "property",
        targetId: id,
        details: { fields: Object.keys(data) },
      },
    });

    return item;
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      name: updated.name,
      status: updated.status,
      isPublishedVisible: updated.isPublishedVisible,
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
  const now = new Date();

  await purgeExpiredDeletedProperties(db, now);

  const existing = await db.property.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      isPublishedVisible: true,
      ownerDeletedAt: true,
      ownerDeletionExpiresAt: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  if (existing.ownerDeletedAt && isSoftDeleteWindowActive(existing.ownerDeletionExpiresAt, now)) {
    return NextResponse.json(
      { error: "Объект уже ожидает удаления. Используйте отмену удаления." },
      { status: 409 },
    );
  }

  if (existing.status === PropertyStatus.PUBLISHED) {
    const deletionExpiresAt = getAdminSoftDeleteExpiresAt(now);

    await db.$transaction(async (tx) => {
      await tx.property.update({
        where: { id },
        data: {
          isPublishedVisible: false,
          ownerDeletedAt: now,
          ownerDeletionExpiresAt: deletionExpiresAt,
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: "admin_schedule_delete",
          targetType: "property",
          targetId: id,
          details: {
            name: existing.name,
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
        ownerDeletedAt: now.toISOString(),
        ownerDeletionExpiresAt: deletionExpiresAt.toISOString(),
      },
    });
  }

  const storageEntry = await db.property.findUnique({
    where: { id },
    select: PROPERTY_STORAGE_CLEANUP_SELECT,
  });

  await db.$transaction(async (tx) => {
    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: "admin_delete",
        targetType: "property",
        targetId: id,
        details: { name: existing.name },
      },
    });
    await tx.property.delete({ where: { id } });
  });

  if (storageEntry) {
    await deletePropertyStorageEntries([storageEntry]);
  }

  return NextResponse.json({ ok: true, mode: "hard" });
}

// API route handler for /api/admin/properties/[id]/moderation.
import { CustomLocationStatus, PropertyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { isBuiltInLocationId } from "@/lib/location-directory";
import { refreshPublishedPropertySnapshot } from "@/lib/property-public-snapshot";
import {
  getPropertyWorkflowStatus,
  getPropertyWorkflowStatusLabel,
} from "@/lib/properties";
import { moderatePropertySchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function resolveModerationAction(action: "approve" | "reject"): PropertyStatus {
  switch (action) {
    case "approve":
      return PropertyStatus.PUBLISHED;
    case "reject":
      return PropertyStatus.REJECTED;
    default:
      return PropertyStatus.REJECTED;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;

  const existing = await db.property.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      pendingEditStatus: true,
      moderationNotes: true,
      locationId: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = moderatePropertySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте корректность действия модерации и комментария" },
      { status: 400 },
    );
  }

  const action = parsed.data.action;
  const targetStatus = resolveModerationAction(action);
  const comment = parsed.data.comment?.trim() || "";
  const currentStatus = getPropertyWorkflowStatus(existing.status, existing.pendingEditStatus);
  const isPublishedEdit =
    existing.status === PropertyStatus.PUBLISHED && existing.pendingEditStatus !== null;

  const canModerateToPublished =
    currentStatus === PropertyStatus.PENDING_MODERATION ||
    currentStatus === PropertyStatus.REJECTED ||
    (isPublishedEdit && currentStatus === PropertyStatus.DRAFT);
  const canModerateToReject = currentStatus === PropertyStatus.PENDING_MODERATION;

  if (targetStatus === PropertyStatus.PUBLISHED && !canModerateToPublished) {
    return NextResponse.json(
      {
        error: `Нельзя опубликовать объект в текущем статусе: ${getPropertyWorkflowStatusLabel(existing.status, existing.moderationNotes, existing.pendingEditStatus)}`,
      },
      { status: 400 },
    );
  }

  if (targetStatus === PropertyStatus.REJECTED && !canModerateToReject) {
    return NextResponse.json(
      {
        error: `Нельзя выполнить действие для текущего статуса: ${getPropertyWorkflowStatusLabel(existing.status, existing.moderationNotes, existing.pendingEditStatus)}`,
      },
      { status: 400 },
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const now = new Date();

    const property = await tx.property.update({
      where: { id: existing.id },
      data: isPublishedEdit
        ? targetStatus === PropertyStatus.PUBLISHED
          ? {
              pendingEditStatus: null,
              moderationNotes: comment || null,
              moderatedById: admin.id,
              moderatedAt: now,
            }
          : {
              pendingEditStatus: PropertyStatus.REJECTED,
              moderationNotes: comment,
              moderatedById: admin.id,
              moderatedAt: now,
            }
        : {
            status: targetStatus,
            moderationNotes:
              targetStatus === PropertyStatus.PUBLISHED
                ? comment || null
                : comment,
            moderatedById: admin.id,
            moderatedAt: now,
          },
      select: {
        id: true,
        status: true,
        pendingEditStatus: true,
        moderationNotes: true,
        moderatedById: true,
        moderatedAt: true,
        updatedAt: true,
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action,
        targetType: "property",
        targetId: existing.id,
        details: {
          previousStatus: currentStatus,
          previousPrimaryStatus: existing.status,
          previousPendingEditStatus: existing.pendingEditStatus,
          nextStatus: getPropertyWorkflowStatus(property.status, property.pendingEditStatus),
          nextPrimaryStatus: property.status,
          nextPendingEditStatus: property.pendingEditStatus,
          isPublishedEdit,
          comment: comment || null,
        },
      },
    });

    if (targetStatus === PropertyStatus.PUBLISHED) {
      await refreshPublishedPropertySnapshot(tx, existing.id);
    }

    if (targetStatus === PropertyStatus.PUBLISHED && existing.locationId) {
      if (!isBuiltInLocationId(existing.locationId)) {
        await tx.customLocation.updateMany({
          where: {
            slug: existing.locationId,
            status: { in: [CustomLocationStatus.PENDING, CustomLocationStatus.REJECTED] },
          },
          data: {
            status: CustomLocationStatus.APPROVED,
            approvedById: admin.id,
            approvedAt: now,
          },
        });
      }
    }

    return property;
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      status: updated.status,
      pendingEditStatus: updated.pendingEditStatus,
      statusLabel: getPropertyWorkflowStatusLabel(
        updated.status,
        updated.moderationNotes,
        updated.pendingEditStatus,
      ),
      moderationNotes: updated.moderationNotes,
      moderatedById: updated.moderatedById,
      moderatedAt: updated.moderatedAt ? updated.moderatedAt.toISOString() : null,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

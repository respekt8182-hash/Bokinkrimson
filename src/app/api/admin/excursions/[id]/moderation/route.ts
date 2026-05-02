// API route handler for /api/admin/excursions/[id]/moderation.
import { ExcursionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { refreshPublishedExcursionSnapshot } from "@/lib/excursion-public-snapshot";
import {
  canAdminApproveExcursionModeration,
  canAdminRequestExcursionChanges,
  getExcursionStatusLabel,
  getExcursionWorkflowStatus,
} from "@/lib/excursions";
import { moderateExcursionSchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function resolveModerationAction(action: "approve" | "needs_fix" | "reject"): ExcursionStatus {
  switch (action) {
    case "approve":
      return ExcursionStatus.PUBLISHED;
    case "needs_fix":
      return ExcursionStatus.NEEDS_FIX;
    case "reject":
      return ExcursionStatus.REJECTED;
    default:
      return ExcursionStatus.NEEDS_FIX;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;

  const existing = await db.excursion.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      pendingEditStatus: true,
      moderationNotes: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = moderateExcursionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте корректность действия модерации и комментария" },
      { status: 400 },
    );
  }

  const action = parsed.data.action;
  const targetStatus = resolveModerationAction(action);
  const comment = parsed.data.comment?.trim() || "";
  const currentStatus = getExcursionWorkflowStatus(
    existing.status,
    existing.pendingEditStatus,
  );
  const isPublishedEdit =
    existing.status === ExcursionStatus.PUBLISHED && existing.pendingEditStatus !== null;
  const canModerateToPublished = canAdminApproveExcursionModeration(
    existing.status,
    existing.pendingEditStatus,
  );
  const canModerateToNeedsFixOrReject = canAdminRequestExcursionChanges(
    existing.status,
    existing.pendingEditStatus,
  );

  if (targetStatus === ExcursionStatus.PUBLISHED && !canModerateToPublished) {
    return NextResponse.json(
      {
        error: `Нельзя опубликовать экскурсию в текущем статусе: ${getExcursionStatusLabel(
          existing.status,
          existing.pendingEditStatus,
          existing.moderationNotes,
        )}`,
      },
      { status: 400 },
    );
  }

  if (
    (targetStatus === ExcursionStatus.NEEDS_FIX || targetStatus === ExcursionStatus.REJECTED) &&
    !canModerateToNeedsFixOrReject
  ) {
    return NextResponse.json(
      {
        error: `Нельзя выполнить действие для текущего статуса: ${getExcursionStatusLabel(
          existing.status,
          existing.pendingEditStatus,
          existing.moderationNotes,
        )}`,
      },
      { status: 400 },
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const excursion = await tx.excursion.update({
      where: { id: existing.id },
      data: isPublishedEdit
        ? targetStatus === ExcursionStatus.PUBLISHED
          ? {
              pendingEditStatus: null,
              moderationNotes: comment || null,
              moderatedById: admin.id,
              moderatedAt: new Date(),
            }
          : {
              pendingEditStatus: targetStatus,
              moderationNotes: comment,
              moderatedById: admin.id,
              moderatedAt: new Date(),
            }
        : {
            status: targetStatus,
            moderationNotes:
              targetStatus === ExcursionStatus.PUBLISHED ? comment || null : comment,
            moderatedById: admin.id,
            moderatedAt: new Date(),
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
        targetType: "excursion",
        targetId: existing.id,
        details: {
          previousStatus: currentStatus,
          previousPrimaryStatus: existing.status,
          previousPendingEditStatus: existing.pendingEditStatus,
          nextStatus: getExcursionWorkflowStatus(
            excursion.status,
            excursion.pendingEditStatus,
          ),
          nextPrimaryStatus: excursion.status,
          nextPendingEditStatus: excursion.pendingEditStatus,
          isPublishedEdit,
          comment: comment || null,
        },
      },
    });

    if (targetStatus === ExcursionStatus.PUBLISHED) {
      await refreshPublishedExcursionSnapshot(tx, existing.id);
    }

    return excursion;
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      status: updated.status,
      pendingEditStatus: updated.pendingEditStatus,
      statusLabel: getExcursionStatusLabel(
        updated.status,
        updated.pendingEditStatus,
        updated.moderationNotes,
      ),
      moderationNotes: updated.moderationNotes,
      moderatedById: updated.moderatedById,
      moderatedAt: updated.moderatedAt ? updated.moderatedAt.toISOString() : null,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

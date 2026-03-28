// API route handler for /api/admin/excursions/[id]/moderation.
import { ExcursionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { getExcursionStatusLabel } from "@/lib/excursions";
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

  const canModerateToPublished =
    existing.status === ExcursionStatus.PENDING_MODERATION ||
    existing.status === ExcursionStatus.NEEDS_FIX ||
    existing.status === ExcursionStatus.REJECTED;
  const canModerateToNeedsFixOrReject =
    existing.status === ExcursionStatus.PENDING_MODERATION ||
    existing.status === ExcursionStatus.NEEDS_FIX;

  if (targetStatus === ExcursionStatus.PUBLISHED && !canModerateToPublished) {
    return NextResponse.json(
      {
        error: `Нельзя опубликовать экскурсию в текущем статусе: ${getExcursionStatusLabel(existing.status)}`,
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
        error: `Нельзя выполнить действие для текущего статуса: ${getExcursionStatusLabel(existing.status)}`,
      },
      { status: 400 },
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const excursion = await tx.excursion.update({
      where: { id: existing.id },
      data: {
        status: targetStatus,
        moderationNotes: targetStatus === ExcursionStatus.PUBLISHED ? comment || null : comment,
        moderatedById: admin.id,
        moderatedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
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
          previousStatus: existing.status,
          nextStatus: targetStatus,
          comment: comment || null,
        },
      },
    });

    return excursion;
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      status: updated.status,
      statusLabel: getExcursionStatusLabel(updated.status),
      moderationNotes: updated.moderationNotes,
      moderatedById: updated.moderatedById,
      moderatedAt: updated.moderatedAt ? updated.moderatedAt.toISOString() : null,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

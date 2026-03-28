// API route handler for /api/admin/reviews/[id].
import { Prisma, ReviewEntityType, ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { refreshEntityReviewStats, serializeReview } from "@/lib/reviews";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const moderateReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

async function refreshSummaryForReview(
  tx: Prisma.TransactionClient,
  review: { entityType: ReviewEntityType; propertyId: string | null; excursionId: string | null },
) {
  return review.entityType === ReviewEntityType.PROPERTY && review.propertyId
    ? refreshEntityReviewStats(tx, {
        entityType: ReviewEntityType.PROPERTY,
        propertyId: review.propertyId,
      })
    : review.entityType === ReviewEntityType.EXCURSION && review.excursionId
      ? refreshEntityReviewStats(tx, {
          entityType: ReviewEntityType.EXCURSION,
          excursionId: review.excursionId,
        })
      : { avgRating: 0, reviewsCount: 0 };
}

async function moderateReviewByAction(input: {
  id: string;
  adminId: string;
  action: "approve" | "reject";
}) {
  const existing = await db.review.findUnique({
    where: { id: input.id },
    include: {
      user: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (!existing) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Отзыв не найден" }, { status: 404 }),
    };
  }

  const targetStatus = input.action === "approve" ? ReviewStatus.ACTIVE : ReviewStatus.DELETED;
  if (existing.status === targetStatus) {
    return {
      ok: true as const,
      response: NextResponse.json({
        item: serializeReview(existing),
        alreadyInTargetStatus: true,
      }),
    };
  }

  const result = await db.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: existing.id },
      data: {
        status: targetStatus,
        deletedAt: targetStatus === ReviewStatus.DELETED ? new Date() : null,
      },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    const summary = await refreshSummaryForReview(tx, existing);

    await tx.adminActionLog.create({
      data: {
        adminUserId: input.adminId,
        action: input.action === "approve" ? "approve_review" : "reject_review",
        targetType: "review",
        targetId: existing.id,
        details: {
          propertyId: existing.propertyId,
          excursionId: existing.excursionId,
          entityType: existing.entityType,
          userId: existing.userId,
          rating: Number(existing.rating),
          previousStatus: existing.status,
          nextStatus: targetStatus,
        },
      },
    });

    return {
      item: serializeReview(updated),
      summary,
    };
  });

  return {
    ok: true as const,
    response: NextResponse.json(result),
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = moderateReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректное действие модерации" }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await moderateReviewByAction({
    id,
    adminId: admin.id,
    action: parsed.data.action,
  });

  return result.response;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await moderateReviewByAction({
    id,
    adminId: admin.id,
    action: "reject",
  });

  return result.response;
}

import { ReviewEntityType, ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { db, type DbTransactionClient } from "@/lib/db";
import {
  ExternalReviewModerationUserError,
  isExternalReviewNotFoundError,
  updateExternalReviewModeration,
} from "@/lib/external-review-moderation";
import { tryModerateFallbackExternalReview } from "@/lib/external-reviews";
import { refreshEntityReviewStats, serializeReview } from "@/lib/reviews";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const moderateReviewSchema = z.object({
  action: z.enum(["approve", "reject", "duplicate", "delete", "edit"]),
  rating: z.number().min(0).max(5).optional(),
  text: z.string().trim().min(10).max(2000).optional(),
  authorName: z.string().trim().max(80).optional(),
  guestCity: z.string().trim().max(80).optional().or(z.literal("")),
  reviewedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

function parseReviewDate(value?: string | null): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function refreshSummaryForReview(
  tx: DbTransactionClient,
  review: {
    entityType: ReviewEntityType;
    propertyId: string | null;
    excursionId: string | null;
    transferId: string | null;
  },
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
      : review.entityType === ReviewEntityType.TRANSFER && review.transferId
        ? refreshEntityReviewStats(tx, {
            entityType: ReviewEntityType.TRANSFER,
            transferId: review.transferId,
          })
      : { avgRating: 0, reviewsCount: 0 };
}

async function moderateReviewByAction(input: {
  id: string;
  adminId: string;
  action: "approve" | "reject";
  rating?: number | null;
  text?: string | null;
  authorName?: string | null;
  guestCity?: string | null;
  reviewedAt?: Date | null;
}) {
  const existing = await db.review.findUnique({
    where: { id: input.id },
    include: {
      user: {
        select: { firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });

  if (!existing) {
    try {
      const importedResult = await updateExternalReviewModeration({
        id: input.id,
        actorId: input.adminId,
        actorRole: "admin",
        action: input.action,
        rating: input.rating,
        text: input.text,
        authorName: input.authorName,
        guestCity: input.guestCity,
        reviewedAt: input.reviewedAt,
      });

      return {
        ok: true as const,
        response: NextResponse.json(importedResult),
      };
    } catch (error) {
      if (error instanceof ExternalReviewModerationUserError && !isExternalReviewNotFoundError(error)) {
        return {
          ok: false as const,
          response: NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.status },
          ),
        };
      }
    }

    const fallbackResult = await tryModerateFallbackExternalReview(input);
    if (fallbackResult) {
      return {
        ok: true as const,
        response: NextResponse.json(fallbackResult),
      };
    }

    return {
      ok: false as const,
      response: NextResponse.json({ error: "Отзыв не найден" }, { status: 404 }),
    };
  }

  if (existing.isImported) {
    try {
      const result = await updateExternalReviewModeration({
        id: existing.id,
        actorId: input.adminId,
        actorRole: "admin",
        action: input.action,
        rating: input.rating,
        text: input.text,
        authorName: input.authorName,
        guestCity: input.guestCity,
        reviewedAt: input.reviewedAt,
      });

      return {
        ok: true as const,
        response: NextResponse.json(result),
      };
    } catch (error) {
      if (error instanceof ExternalReviewModerationUserError) {
        return {
          ok: false as const,
          response: NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.status },
          ),
        };
      }

      throw error;
    }
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
        ...(existing.isImported
          ? {
              verifiedAt: targetStatus === ReviewStatus.ACTIVE ? new Date() : null,
              verifiedByAdminId: targetStatus === ReviewStatus.ACTIVE ? input.adminId : null,
            }
          : {}),
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, avatarUrl: true },
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
          transferId: existing.transferId,
          entityType: existing.entityType,
          userId: existing.userId,
          isImported: existing.isImported,
          externalSourceUrl: existing.externalSourceUrl,
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
  if (parsed.data.action === "duplicate" || parsed.data.action === "delete" || parsed.data.action === "edit") {
    try {
      const result = await updateExternalReviewModeration({
        id,
        actorId: admin.id,
        actorRole: "admin",
        action: parsed.data.action,
        rating: parsed.data.rating,
        text: parsed.data.text,
        authorName: parsed.data.authorName,
        guestCity: parsed.data.guestCity,
        reviewedAt: parseReviewDate(parsed.data.reviewedAt),
      });

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof ExternalReviewModerationUserError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }

      return NextResponse.json({ error: "Не удалось изменить отзыв" }, { status: 500 });
    }
  }

  const result = await moderateReviewByAction({
    id,
    adminId: admin.id,
    action: parsed.data.action,
    rating: parsed.data.rating,
    text: parsed.data.text,
    authorName: parsed.data.authorName,
    guestCity: parsed.data.guestCity,
    reviewedAt: parseReviewDate(parsed.data.reviewedAt),
  });

  return result.response;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const importedResult = await updateExternalReviewModeration({
      id,
      actorId: admin.id,
      actorRole: "admin",
      action: "delete",
    });

    return NextResponse.json(importedResult);
  } catch (error) {
    if (error instanceof ExternalReviewModerationUserError && !isExternalReviewNotFoundError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
  }

  const result = await moderateReviewByAction({
    id,
    adminId: admin.id,
    action: "reject",
  });

  return result.response;
}

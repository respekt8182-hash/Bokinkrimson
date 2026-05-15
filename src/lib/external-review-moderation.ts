import { Prisma, ReviewEntityType, ReviewStatus } from "@prisma/client";
import { db, isDatabaseTableAvailable, type DbTransactionClient } from "@/lib/db";
import {
  type ExternalReviewEntityType,
  getReviewEntityType,
  readExternalReviewSourceName,
} from "@/lib/external-reviews";
import { normalizePlainText } from "@/lib/plain-text";
import {
  normalizeReviewGuestCity,
  refreshEntityReviewStats,
  serializeReview,
  type SerializedReview,
} from "@/lib/reviews";

const FALLBACK_EXTERNAL_REVIEW_TABLE = "ExternalReviewFallback";
const EXTERNAL_REVIEW_NOT_FOUND = "EXTERNAL_REVIEW_NOT_FOUND";
const OWNER_REVIEW_MODERATION_FORBIDDEN = "OWNER_REVIEW_MODERATION_FORBIDDEN";

type ExternalReviewModerationAction = "approve" | "reject" | "duplicate" | "delete" | "edit";

type FallbackExternalReviewRow = {
  id: string;
  entityType: ExternalReviewEntityType;
  entityId: string;
  status: ReviewStatus;
  authorName: string;
  rating: Prisma.Decimal | number;
  text: string;
  sourceUrl: string | null;
  sourceName: string | null;
  guestCity: string | null;
  reviewedAt: Date | null;
  likesCount: number;
  dislikesCount: number;
  importedByOwnerId: string | null;
  verifiedAt: Date | null;
  verifiedByAdminId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

function assertOwnerCanUpdateExternalReview(input: {
  actorRole: "owner" | "admin";
  action: ExternalReviewModerationAction;
  status: ReviewStatus;
}) {
  if (input.actorRole !== "owner") {
    return;
  }

  if (input.action === "approve" || input.action === "reject" || input.action === "duplicate") {
    throw new ExternalReviewModerationUserError(
      "Отзывы публикует, отклоняет и помечает дублями только администратор.",
      {
        status: 403,
        code: OWNER_REVIEW_MODERATION_FORBIDDEN,
      },
    );
  }

  if (input.status !== ReviewStatus.PENDING) {
    throw new ExternalReviewModerationUserError(
      "Проверенные отзывы может изменять только администратор.",
      {
        status: 403,
        code: OWNER_REVIEW_MODERATION_FORBIDDEN,
      },
    );
  }
}

export class ExternalReviewModerationUserError extends Error {
  status: number;
  code: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = "ExternalReviewModerationUserError";
    this.status = options?.status ?? 400;
    this.code = options?.code ?? "EXTERNAL_REVIEW_MODERATION_ERROR";
  }
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
  if (review.entityType === ReviewEntityType.PROPERTY && review.propertyId) {
    return refreshEntityReviewStats(tx, {
      entityType: ReviewEntityType.PROPERTY,
      propertyId: review.propertyId,
    });
  }

  if (review.entityType === ReviewEntityType.EXCURSION && review.excursionId) {
    return refreshEntityReviewStats(tx, {
      entityType: ReviewEntityType.EXCURSION,
      excursionId: review.excursionId,
    });
  }

  if (review.entityType === ReviewEntityType.TRANSFER && review.transferId) {
    return refreshEntityReviewStats(tx, {
      entityType: ReviewEntityType.TRANSFER,
      transferId: review.transferId,
    });
  }

  return { avgRating: 0, reviewsCount: 0 };
}

async function findExternalReviewForActor(input: {
  id: string;
  actorId: string;
  actorRole: "owner" | "admin";
}) {
  return db.review.findFirst({
    where: {
      id: input.id,
      isImported: true,
      ...(input.actorRole === "owner"
        ? {
            OR: [
              { property: { ownerId: input.actorId, ownerDeletedAt: null } },
              { excursion: { ownerId: input.actorId } },
              { transfer: { ownerId: input.actorId } },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  });
}

async function findFallbackExternalReviewById(
  id: string,
): Promise<FallbackExternalReviewRow | null> {
  if (!(await isDatabaseTableAvailable(FALLBACK_EXTERNAL_REVIEW_TABLE))) {
    return null;
  }

  const rows = await db.$queryRaw<FallbackExternalReviewRow[]>(Prisma.sql`
    SELECT
      "id",
      "entityType",
      "entityId",
      "status",
      "authorName",
      "rating",
      "text",
      "sourceUrl",
      "sourceName",
      "guestCity",
      "reviewedAt",
      "likesCount",
      "dislikesCount",
      "importedByOwnerId",
      "verifiedAt",
      "verifiedByAdminId",
      "createdAt",
      "updatedAt",
      "deletedAt"
    FROM "ExternalReviewFallback"
    WHERE "id" = ${id}
    LIMIT 1
  `);

  return rows[0] ?? null;
}

function serializeFallbackExternalReview(row: FallbackExternalReviewRow): SerializedReview {
  return serializeReview({
    id: row.id,
    entityType: getReviewEntityType(row.entityType),
    propertyId: row.entityType === "property" ? row.entityId : null,
    excursionId: row.entityType === "excursion" ? row.entityId : null,
    transferId: row.entityType === "transfer" ? row.entityId : null,
    userId: null,
    rating: row.rating,
    text: row.text,
    isImported: true,
    importedAuthorName: row.authorName,
    externalSourceUrl: row.sourceUrl,
    externalSourceName: row.sourceName,
    guestCity: row.guestCity,
    reviewedAt: row.reviewedAt,
    likesCount: row.likesCount,
    dislikesCount: row.dislikesCount,
    currentUserReaction: null,
    verifiedAt: row.verifiedAt,
    ownerReply: null,
    ownerRepliedAt: null,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  });
}

async function canActorManageFallbackReview(input: {
  review: FallbackExternalReviewRow;
  actorId: string;
  actorRole: "owner" | "admin";
}): Promise<boolean> {
  if (input.actorRole === "admin") {
    return true;
  }

  if (input.review.entityType === "property") {
    const property = await db.property.findFirst({
      where: {
        id: input.review.entityId,
        ownerId: input.actorId,
        ownerDeletedAt: null,
      },
      select: { id: true },
    });
    return Boolean(property);
  }

  if (input.review.entityType === "transfer") {
    const transfer = await db.transfer.findFirst({
      where: {
        id: input.review.entityId,
        ownerId: input.actorId,
      },
      select: { id: true },
    });
    return Boolean(transfer);
  }

  const excursion = await db.excursion.findFirst({
    where: {
      id: input.review.entityId,
      ownerId: input.actorId,
    },
    select: { id: true },
  });
  return Boolean(excursion);
}

async function updateFallbackExternalReview(input: {
  id: string;
  actorId: string;
  actorRole: "owner" | "admin";
  action: "approve" | "reject" | "duplicate" | "delete" | "edit";
  rating?: number | null;
  text?: string | null;
  authorName?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  guestCity?: string | null;
  reviewedAt?: Date | null;
}): Promise<{ item: SerializedReview | null; summary: null } | null> {
  const existing = await findFallbackExternalReviewById(input.id);
  if (!existing) {
    return null;
  }

  if (
    !(await canActorManageFallbackReview({
      review: existing,
      actorId: input.actorId,
      actorRole: input.actorRole,
    }))
  ) {
    throw new ExternalReviewModerationUserError("Отзыв не найден.", {
      status: 404,
      code: EXTERNAL_REVIEW_NOT_FOUND,
    });
  }

  assertOwnerCanUpdateExternalReview({
    actorRole: input.actorRole,
    action: input.action,
    status: existing.status,
  });

  if (input.action === "delete") {
    await db.$transaction([
      db.$executeRaw(Prisma.sql`
        DELETE FROM "ExternalReviewFallbackReaction"
        WHERE "reviewId" = ${existing.id}
      `),
      db.$executeRaw(Prisma.sql`
        DELETE FROM "ExternalReviewFallback"
        WHERE "id" = ${existing.id}
      `),
    ]);

    return { item: null, summary: null };
  }

  const text = input.text === undefined ? existing.text : normalizePlainText(input.text ?? "");
  if ((input.action === "approve" || input.action === "edit") && text.length < 10) {
    throw new ExternalReviewModerationUserError(
      "Текст отзыва должен содержать минимум 10 символов.",
      { code: "REVIEW_TEXT_TOO_SHORT" },
    );
  }

  const nextRating = input.rating ?? Number(existing.rating);
  if (input.action === "approve" && (!Number.isFinite(nextRating) || nextRating < 0.5)) {
    throw new ExternalReviewModerationUserError(
      "Перед публикацией выберите рейтинг по системе сайта.",
      { code: "SITE_RATING_REQUIRED" },
    );
  }

  const status =
    input.action === "approve"
      ? ReviewStatus.ACTIVE
      : input.action === "duplicate"
        ? ReviewStatus.DUPLICATE
        : input.action === "reject"
          ? ReviewStatus.DELETED
          : existing.status;
  const now = new Date();
  const authorName =
    input.authorName === undefined
      ? existing.authorName
      : normalizePlainText(input.authorName ?? "") || existing.authorName;
  const sourceUrl =
    input.sourceUrl === undefined
      ? existing.sourceUrl
      : normalizePlainText(input.sourceUrl ?? "") || null;
  const sourceName =
    input.sourceName === undefined && input.sourceUrl === undefined
      ? existing.sourceName
      : readExternalReviewSourceName(sourceUrl, input.sourceName);
  const guestCity =
    input.guestCity === undefined ? existing.guestCity : normalizeReviewGuestCity(input.guestCity);
  const reviewedAt = input.reviewedAt === undefined ? existing.reviewedAt : input.reviewedAt;

  const rows = await db.$queryRaw<FallbackExternalReviewRow[]>(Prisma.sql`
    UPDATE "ExternalReviewFallback"
    SET
      "status" = ${status},
      "rating" = ${
        input.rating === undefined
          ? new Prisma.Decimal(Number(existing.rating))
          : new Prisma.Decimal(nextRating)
      },
      "text" = ${text},
      "authorName" = ${authorName},
      "sourceUrl" = ${sourceUrl},
      "sourceName" = ${sourceName},
      "guestCity" = ${guestCity},
      "reviewedAt" = ${reviewedAt},
      "deletedAt" = ${
        status === ReviewStatus.DELETED || status === ReviewStatus.DUPLICATE ? now : null
      },
      "verifiedAt" = ${input.action === "approve" ? now : existing.verifiedAt},
      "verifiedByAdminId" = ${
        status === ReviewStatus.ACTIVE && input.actorRole === "admin"
          ? input.actorId
          : existing.verifiedByAdminId
      },
      "updatedAt" = ${now}
    WHERE "id" = ${existing.id}
    RETURNING
      "id",
      "entityType",
      "entityId",
      "status",
      "authorName",
      "rating",
      "text",
      "sourceUrl",
      "sourceName",
      "guestCity",
      "reviewedAt",
      "likesCount",
      "dislikesCount",
      "importedByOwnerId",
      "verifiedAt",
      "verifiedByAdminId",
      "createdAt",
      "updatedAt",
      "deletedAt"
  `);

  return {
    item: rows[0] ? serializeFallbackExternalReview(rows[0]) : null,
    summary: null,
  };
}

export async function updateExternalReviewModeration(input: {
  id: string;
  actorId: string;
  actorRole: "owner" | "admin";
  action: ExternalReviewModerationAction;
  rating?: number | null;
  text?: string | null;
  authorName?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  guestCity?: string | null;
  reviewedAt?: Date | null;
}) {
  const existing = await findExternalReviewForActor({
    id: input.id,
    actorId: input.actorId,
    actorRole: input.actorRole,
  });

  if (!existing) {
    const fallbackResult = await updateFallbackExternalReview(input);
    if (fallbackResult) {
      return fallbackResult;
    }

    throw new ExternalReviewModerationUserError("Отзыв не найден.", {
      status: 404,
      code: EXTERNAL_REVIEW_NOT_FOUND,
    });
  }

  assertOwnerCanUpdateExternalReview({
    actorRole: input.actorRole,
    action: input.action,
    status: existing.status,
  });

  if (input.action === "delete") {
    const result = await db.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: existing.id } });
      const summary =
        existing.status === ReviewStatus.ACTIVE
          ? await refreshSummaryForReview(tx, existing)
          : null;
      return { summary };
    });

    return { item: null, summary: result.summary };
  }

  const text = input.text === undefined ? existing.text : normalizePlainText(input.text ?? "");
  if ((input.action === "approve" || input.action === "edit") && text.length < 10) {
    throw new ExternalReviewModerationUserError(
      "Текст отзыва должен содержать минимум 10 символов.",
      { code: "REVIEW_TEXT_TOO_SHORT" },
    );
  }

  const nextRating = input.rating ?? Number(existing.rating);
  if (input.action === "approve" && (!Number.isFinite(nextRating) || nextRating < 0.5)) {
    throw new ExternalReviewModerationUserError(
      "Перед публикацией выберите рейтинг по системе сайта.",
      { code: "SITE_RATING_REQUIRED" },
    );
  }

  const status =
    input.action === "approve"
      ? ReviewStatus.ACTIVE
      : input.action === "duplicate"
        ? ReviewStatus.DUPLICATE
        : input.action === "reject"
          ? ReviewStatus.DELETED
          : existing.status;

  if (status === ReviewStatus.ACTIVE && (!Number.isFinite(nextRating) || nextRating < 0.5)) {
    throw new ExternalReviewModerationUserError(
      "Перед публикацией выберите рейтинг по системе сайта.",
      { code: "SITE_RATING_REQUIRED" },
    );
  }

  const sourceUrl =
    input.sourceUrl === undefined
      ? existing.externalSourceUrl
      : normalizePlainText(input.sourceUrl ?? "") || null;
  const sourceName =
    input.sourceName === undefined && input.sourceUrl === undefined
      ? existing.externalSourceName
      : readExternalReviewSourceName(sourceUrl, input.sourceName);

  return db.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: existing.id },
      data: {
        status,
        rating: input.rating === undefined ? Number(existing.rating) : nextRating,
        text,
        importedAuthorName:
          input.authorName === undefined
            ? existing.importedAuthorName
            : normalizePlainText(input.authorName ?? "") || existing.importedAuthorName,
        externalSourceUrl: sourceUrl,
        externalSourceName: sourceName,
        guestCity:
          input.guestCity === undefined
            ? existing.guestCity
            : normalizeReviewGuestCity(input.guestCity),
        reviewedAt: input.reviewedAt === undefined ? existing.reviewedAt : input.reviewedAt,
        deletedAt:
          status === ReviewStatus.DELETED || status === ReviewStatus.DUPLICATE
            ? new Date()
            : input.action === "approve"
              ? null
              : existing.deletedAt,
        verifiedAt: input.action === "approve" ? new Date() : existing.verifiedAt,
        verifiedByAdminId:
          status === ReviewStatus.ACTIVE && input.actorRole === "admin"
            ? input.actorId
            : existing.verifiedByAdminId,
      },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    const summary =
      existing.status === ReviewStatus.ACTIVE || updated.status === ReviewStatus.ACTIVE
        ? await refreshSummaryForReview(tx, updated)
        : null;

    if (input.actorRole === "admin") {
      await tx.adminActionLog.create({
        data: {
          adminUserId: input.actorId,
          action:
            input.action === "approve"
              ? "approve_review"
              : input.action === "duplicate"
                ? "mark_review_duplicate"
                : input.action === "edit"
                  ? "edit_review"
                  : "reject_review",
          targetType: "review",
          targetId: existing.id,
          details: {
            isImported: true,
            externalSourceUrl: existing.externalSourceUrl,
            previousStatus: existing.status,
            nextStatus: status,
          },
        },
      });
    }

    return {
      item: serializeReview(updated),
      summary,
    };
  });
}

export function isExternalReviewNotFoundError(error: unknown): boolean {
  return (
    error instanceof ExternalReviewModerationUserError && error.code === EXTERNAL_REVIEW_NOT_FOUND
  );
}

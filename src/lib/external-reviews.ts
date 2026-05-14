import { randomUUID } from "node:crypto";
import { Prisma, ReviewEntityType, ReviewReactionValue, ReviewStatus } from "@prisma/client";
import {
  areDatabaseColumnsAvailable,
  db,
  isDatabaseTableAvailable,
  type DbTransactionClient,
} from "@/lib/db";
import { normalizePlainText } from "@/lib/plain-text";
import { logDatabaseFallbackOnce } from "@/lib/prisma-errors";
import {
  normalizeReviewGuestCity,
  parseReviewDateInput,
  refreshEntityReviewStats,
  serializeReview,
  type SerializedReview,
} from "@/lib/reviews";
import { hasTransferReviewSupport } from "@/lib/transfer-review-support";

export type ExternalReviewEntityType = "property" | "excursion" | "transfer";

export type ImportedReviewModerationItem = SerializedReview & {
  target: {
    href: string;
    title: string;
    subtitle: string;
    ownerName: string | null;
  } | null;
};

export const externalReviewEntityTypes = ["property", "excursion", "transfer"] as const;

const EXTERNAL_REVIEW_COLUMNS = [
  "isImported",
  "importedAuthorName",
  "externalSourceUrl",
  "externalSourceName",
  "importedByOwnerId",
  "verifiedAt",
  "verifiedByAdminId",
] as const;

const FALLBACK_EXTERNAL_REVIEW_TABLE = "ExternalReviewFallback";
const MAX_IMPORTED_REVIEW_SCAN = 1000;

type ExternalReviewStorageMode = "database" | "fallback" | "unavailable";

type ExternalReviewFallbackRow = {
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
  currentUserReaction?: ReviewReactionValue | null;
  importedByOwnerId: string | null;
  verifiedAt: Date | null;
  verifiedByAdminId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type ExternalReviewFallbackSummaryRow = {
  avgRating: Prisma.Decimal | number | null;
  reviewsCount: bigint | number;
};

type ExternalReviewFallbackReactionRow = {
  value: ReviewReactionValue;
};

let fallbackTableReadyPromise: Promise<boolean> | null = null;

export function parseExternalReviewEntityType(
  value: string | null,
): ExternalReviewEntityType | null {
  return value === "property" || value === "excursion" || value === "transfer" ? value : null;
}

export function getExternalReviewEntityLabel(entityType: ExternalReviewEntityType): string {
  if (entityType === "property") return "объекта";
  if (entityType === "transfer") return "трансфера";
  return "программы";
}

export function getReviewEntityType(entityType: ExternalReviewEntityType): ReviewEntityType {
  if (entityType === "property") return ReviewEntityType.PROPERTY;
  if (entityType === "transfer") return ReviewEntityType.TRANSFER;
  return ReviewEntityType.EXCURSION;
}

function getEntityIdFromSerializedReview(review: SerializedReview): string | null {
  if (review.entityType === ReviewEntityType.PROPERTY) {
    return review.propertyId;
  }
  if (review.entityType === ReviewEntityType.TRANSFER) {
    return review.transferId;
  }
  return review.excursionId;
}

async function ensureFallbackExternalReviewTable(): Promise<boolean> {
  if (!fallbackTableReadyPromise) {
    fallbackTableReadyPromise = (async () => {
      try {
        await db.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${FALLBACK_EXTERNAL_REVIEW_TABLE}" (
            "id" TEXT PRIMARY KEY,
            "entityType" TEXT NOT NULL,
            "entityId" TEXT NOT NULL,
            "status" TEXT NOT NULL,
            "authorName" TEXT NOT NULL,
            "rating" DECIMAL(3,1) NOT NULL,
            "text" TEXT NOT NULL,
            "sourceUrl" TEXT,
            "sourceName" TEXT,
            "guestCity" TEXT,
            "reviewedAt" DATE,
            "likesCount" INTEGER NOT NULL DEFAULT 0,
            "dislikesCount" INTEGER NOT NULL DEFAULT 0,
            "importedByOwnerId" TEXT,
            "verifiedAt" TIMESTAMP(3),
            "verifiedByAdminId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deletedAt" TIMESTAMP(3),
            CONSTRAINT "${FALLBACK_EXTERNAL_REVIEW_TABLE}_status_check"
              CHECK ("status" IN ('PENDING', 'ACTIVE', 'DELETED', 'DUPLICATE', 'FAILED')),
            CONSTRAINT "${FALLBACK_EXTERNAL_REVIEW_TABLE}_entityType_check"
              CHECK ("entityType" IN ('property', 'excursion', 'transfer'))
          )
        `);
        await db.$executeRawUnsafe(`
          ALTER TABLE "${FALLBACK_EXTERNAL_REVIEW_TABLE}"
          ADD COLUMN IF NOT EXISTS "guestCity" TEXT
        `);
        await db.$executeRawUnsafe(`
          ALTER TABLE "${FALLBACK_EXTERNAL_REVIEW_TABLE}"
          ADD COLUMN IF NOT EXISTS "reviewedAt" DATE
        `);
        await db.$executeRawUnsafe(`
          ALTER TABLE "${FALLBACK_EXTERNAL_REVIEW_TABLE}"
          ADD COLUMN IF NOT EXISTS "likesCount" INTEGER NOT NULL DEFAULT 0
        `);
        await db.$executeRawUnsafe(`
          ALTER TABLE "${FALLBACK_EXTERNAL_REVIEW_TABLE}"
          ADD COLUMN IF NOT EXISTS "dislikesCount" INTEGER NOT NULL DEFAULT 0
        `);
        await db.$executeRawUnsafe(`
          ALTER TABLE "${FALLBACK_EXTERNAL_REVIEW_TABLE}"
          DROP CONSTRAINT IF EXISTS "${FALLBACK_EXTERNAL_REVIEW_TABLE}_status_check"
        `);
        await db.$executeRawUnsafe(`
          ALTER TABLE "${FALLBACK_EXTERNAL_REVIEW_TABLE}"
          ADD CONSTRAINT "${FALLBACK_EXTERNAL_REVIEW_TABLE}_status_check"
          CHECK ("status" IN ('PENDING', 'ACTIVE', 'DELETED', 'DUPLICATE', 'FAILED'))
        `);
        await db.$executeRawUnsafe(`
          ALTER TABLE "${FALLBACK_EXTERNAL_REVIEW_TABLE}"
          ALTER COLUMN "sourceUrl" DROP NOT NULL
        `);
        await db.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${FALLBACK_EXTERNAL_REVIEW_TABLE}Reaction" (
            "reviewId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "value" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "${FALLBACK_EXTERNAL_REVIEW_TABLE}Reaction_pkey" PRIMARY KEY ("reviewId", "userId"),
            CONSTRAINT "${FALLBACK_EXTERNAL_REVIEW_TABLE}Reaction_value_check"
              CHECK ("value" IN ('LIKE', 'DISLIKE'))
          )
        `);
        await db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${FALLBACK_EXTERNAL_REVIEW_TABLE}Reaction_user_createdAt_idx"
          ON "${FALLBACK_EXTERNAL_REVIEW_TABLE}Reaction"("userId", "createdAt" DESC)
        `);
        await db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${FALLBACK_EXTERNAL_REVIEW_TABLE}Reaction_review_value_idx"
          ON "${FALLBACK_EXTERNAL_REVIEW_TABLE}Reaction"("reviewId", "value")
        `);
        await db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${FALLBACK_EXTERNAL_REVIEW_TABLE}_entity_status_createdAt_idx"
          ON "${FALLBACK_EXTERNAL_REVIEW_TABLE}"("entityType", "entityId", "status", "createdAt" DESC)
        `);
        await db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${FALLBACK_EXTERNAL_REVIEW_TABLE}_status_createdAt_idx"
          ON "${FALLBACK_EXTERNAL_REVIEW_TABLE}"("status", "createdAt" DESC)
        `);
        logDatabaseFallbackOnce(
          "external-review-fallback-table",
          "External reviews are using a fallback table because the main Review schema is behind. Apply the latest Prisma migrations when DB owner access is available.",
        );
        return true;
      } catch {
        const alreadyCreated = await isDatabaseTableAvailable(FALLBACK_EXTERNAL_REVIEW_TABLE);
        if (alreadyCreated) {
          return true;
        }

        fallbackTableReadyPromise = null;
        return false;
      }
    })();
  }

  return fallbackTableReadyPromise;
}

async function resolveExternalReviewStorageMode(
  entityType: ExternalReviewEntityType,
): Promise<ExternalReviewStorageMode> {
  const hasImportedColumns = await areDatabaseColumnsAvailable("Review", EXTERNAL_REVIEW_COLUMNS);
  if (hasImportedColumns) {
    if (entityType !== "transfer" || (await hasTransferReviewSupport())) {
      return "database";
    }
  }

  return (await ensureFallbackExternalReviewTable()) ? "fallback" : "unavailable";
}

export async function hasExternalReviewSupport(
  entityType: ExternalReviewEntityType,
): Promise<boolean> {
  return (await resolveExternalReviewStorageMode(entityType)) !== "unavailable";
}

export function readExternalReviewSourceName(
  sourceUrl?: string | null,
  sourceName?: string | null,
): string | null {
  const trimmedName = sourceName?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  if (!sourceUrl) {
    return null;
  }

  try {
    return new URL(sourceUrl).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

export async function findExternalReviewEntity(input: {
  entityType: ExternalReviewEntityType;
  entityId: string;
  ownerId?: string | null;
}): Promise<{ id: string; ownerId: string; title: string | null } | null> {
  if (input.entityType === "property") {
    const property = await db.property.findFirst({
      where: {
        id: input.entityId,
        ...(input.ownerId ? { ownerId: input.ownerId, ownerDeletedAt: null } : {}),
      },
      select: {
        id: true,
        ownerId: true,
        name: true,
      },
    });

    return property
      ? {
          id: property.id,
          ownerId: property.ownerId,
          title: property.name,
        }
      : null;
  }

  if (input.entityType === "transfer") {
    const transfer = await db.transfer.findFirst({
      where: {
        id: input.entityId,
        ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      },
      select: {
        id: true,
        ownerId: true,
        title: true,
      },
    });

    return transfer
      ? {
          id: transfer.id,
          ownerId: transfer.ownerId,
          title: transfer.title,
        }
      : null;
  }

  const excursion = await db.excursion.findFirst({
    where: {
      id: input.entityId,
      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
    },
    select: {
      id: true,
      ownerId: true,
      title: true,
    },
  });

  return excursion
    ? {
        id: excursion.id,
        ownerId: excursion.ownerId,
        title: excursion.title,
      }
    : null;
}

function buildExternalReviewWhere(input: {
  entityType: ExternalReviewEntityType;
  entityId: string;
}) {
  return {
    entityType: getReviewEntityType(input.entityType),
    isImported: true,
    ...(input.entityType === "property" ? { propertyId: input.entityId } : {}),
    ...(input.entityType === "excursion" ? { excursionId: input.entityId } : {}),
    ...(input.entityType === "transfer" ? { transferId: input.entityId } : {}),
  };
}

function serializeFallbackExternalReview(row: ExternalReviewFallbackRow): SerializedReview {
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
    currentUserReaction: row.currentUserReaction ?? null,
    verifiedAt: row.verifiedAt,
    ownerReply: null,
    ownerRepliedAt: null,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  });
}

async function listFallbackExternalReviewRows(input: {
  entityType?: ExternalReviewEntityType;
  entityId?: string;
  status?: ReviewStatus | "ALL";
  take?: number;
  currentUserId?: string | null;
}): Promise<ExternalReviewFallbackRow[]> {
  if (!(await ensureFallbackExternalReviewTable())) {
    return [];
  }

  const whereParts: Prisma.Sql[] = [];
  if (input.entityType) {
    whereParts.push(Prisma.sql`"entityType" = ${input.entityType}`);
  }
  if (input.entityId) {
    whereParts.push(Prisma.sql`"entityId" = ${input.entityId}`);
  }
  if (input.status && input.status !== "ALL") {
    whereParts.push(Prisma.sql`"status" = ${input.status}`);
  }

  const whereClause =
    whereParts.length > 0 ? Prisma.sql`WHERE ${Prisma.join(whereParts, " AND ")}` : Prisma.empty;
  const limitClause =
    typeof input.take === "number" && input.take > 0
      ? Prisma.sql`LIMIT ${Math.max(1, Math.floor(input.take))}`
      : Prisma.empty;

  return db.$queryRaw<ExternalReviewFallbackRow[]>(Prisma.sql`
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
      ${
        input.currentUserId
          ? Prisma.sql`(
              SELECT "value"
              FROM "ExternalReviewFallbackReaction"
              WHERE "reviewId" = "ExternalReviewFallback"."id"
                AND "userId" = ${input.currentUserId}
              LIMIT 1
            )`
          : Prisma.sql`NULL`
      } AS "currentUserReaction",
      "importedByOwnerId",
      "verifiedAt",
      "verifiedByAdminId",
      "createdAt",
      "updatedAt",
      "deletedAt"
    FROM "ExternalReviewFallback"
    ${whereClause}
    ORDER BY "createdAt" DESC
    ${limitClause}
  `);
}

async function getFallbackExternalReviewSummary(input: {
  entityType: ExternalReviewEntityType;
  entityId: string;
  status?: ReviewStatus | "ALL";
  queryClient?: Pick<DbTransactionClient, "$queryRaw"> | typeof db;
}): Promise<{ avgRating: number; reviewsCount: number }> {
  if (!(await ensureFallbackExternalReviewTable())) {
    return { avgRating: 0, reviewsCount: 0 };
  }

  const whereParts = [
    Prisma.sql`"entityType" = ${input.entityType}`,
    Prisma.sql`"entityId" = ${input.entityId}`,
  ];

  if (input.status && input.status !== "ALL") {
    whereParts.push(Prisma.sql`"status" = ${input.status}`);
  }

  const queryClient = input.queryClient ?? db;
  const rows = await queryClient.$queryRaw<ExternalReviewFallbackSummaryRow[]>(Prisma.sql`
    SELECT
      AVG("rating") AS "avgRating",
      COUNT(*) AS "reviewsCount"
    FROM "ExternalReviewFallback"
    WHERE ${Prisma.join(whereParts, " AND ")}
  `);
  const row = rows[0];

  return {
    avgRating: Number(row?.avgRating ?? 0),
    reviewsCount: Number(row?.reviewsCount ?? 0),
  };
}

function combineReviewSummaries(input: {
  baseAvgRating: number;
  baseReviewsCount: number;
  importedAvgRating: number;
  importedReviewsCount: number;
}): { avgRating: number; reviewsCount: number } {
  const reviewsCount = input.baseReviewsCount + input.importedReviewsCount;
  if (reviewsCount <= 0) {
    return { avgRating: 0, reviewsCount: 0 };
  }

  const weightedRatingTotal =
    input.baseAvgRating * input.baseReviewsCount +
    input.importedAvgRating * input.importedReviewsCount;

  return {
    avgRating: weightedRatingTotal / reviewsCount,
    reviewsCount,
  };
}

function hashReviewOrderKey(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function orderReviewsForPublicDisplay(
  reviews: SerializedReview[],
  seed: string,
): SerializedReview[] {
  return [...reviews].sort((left, right) => {
    const leftHash = hashReviewOrderKey(`${seed}:${left.id}`);
    const rightHash = hashReviewOrderKey(`${seed}:${right.id}`);

    if (leftHash !== rightHash) {
      return leftHash - rightHash;
    }

    return (
      Date.parse(right.reviewedAt ?? right.createdAt) -
      Date.parse(left.reviewedAt ?? left.createdAt)
    );
  });
}

async function getBaseEntityReviewSummary(
  input: {
    entityType: ExternalReviewEntityType;
    entityId: string;
  },
  queryClient: DbTransactionClient | typeof db = db,
): Promise<{ avgRating: number; reviewsCount: number }> {
  if (input.entityType === "property") {
    const property = await queryClient.property.findUnique({
      where: { id: input.entityId },
      select: { avgRating: true, reviewsCount: true },
    });
    return {
      avgRating: Number(property?.avgRating ?? 0),
      reviewsCount: property?.reviewsCount ?? 0,
    };
  }

  if (input.entityType === "transfer") {
    const transfer = await queryClient.transfer.findUnique({
      where: { id: input.entityId },
      select: { avgRating: true, reviewsCount: true },
    });
    return {
      avgRating: Number(transfer?.avgRating ?? 0),
      reviewsCount: transfer?.reviewsCount ?? 0,
    };
  }

  const excursion = await queryClient.excursion.findUnique({
    where: { id: input.entityId },
    select: { avgRating: true, reviewsCount: true },
  });
  return {
    avgRating: Number(excursion?.avgRating ?? 0),
    reviewsCount: excursion?.reviewsCount ?? 0,
  };
}

export async function getExternalReviewSummaryWithFallback(input: {
  entityType: ExternalReviewEntityType;
  entityId: string;
  avgRating: number;
  reviewsCount: number;
}): Promise<{ avgRating: number; reviewsCount: number }> {
  if ((await resolveExternalReviewStorageMode(input.entityType)) !== "fallback") {
    return {
      avgRating: input.avgRating,
      reviewsCount: input.reviewsCount,
    };
  }

  const importedSummary = await getFallbackExternalReviewSummary({
    entityType: input.entityType,
    entityId: input.entityId,
    status: ReviewStatus.ACTIVE,
  });

  return combineReviewSummaries({
    baseAvgRating: input.avgRating,
    baseReviewsCount: input.reviewsCount,
    importedAvgRating: importedSummary.avgRating,
    importedReviewsCount: importedSummary.reviewsCount,
  });
}

export async function getMergedExternalReviewList(input: {
  entityType: ExternalReviewEntityType;
  entityId: string;
  databaseItems: SerializedReview[];
  databaseTotal?: number;
  currentUserId?: string | null;
  offset?: number;
  limit?: number;
}): Promise<{ items: SerializedReview[]; total: number }> {
  const offset = Math.max(0, input.offset ?? 0);
  const limit = Math.max(1, input.limit ?? Math.max(1, input.databaseItems.length));
  const databaseTotal = Math.max(input.databaseTotal ?? 0, input.databaseItems.length);

  if ((await resolveExternalReviewStorageMode(input.entityType)) !== "fallback") {
    const orderedItems = orderReviewsForPublicDisplay(
      input.databaseItems,
      `${input.entityType}:${input.entityId}`,
    );

    return {
      items: orderedItems.slice(offset, offset + limit),
      total: databaseTotal,
    };
  }

  const importedItems = (
    await listFallbackExternalReviewRows({
      entityType: input.entityType,
      entityId: input.entityId,
      status: ReviewStatus.ACTIVE,
      currentUserId: input.currentUserId,
    })
  ).map(serializeFallbackExternalReview);

  const merged = orderReviewsForPublicDisplay(
    [...input.databaseItems, ...importedItems],
    `${input.entityType}:${input.entityId}`,
  );

  return {
    items: merged.slice(offset, offset + limit),
    total: databaseTotal + importedItems.length,
  };
}

export async function listExternalReviews(input: {
  entityType: ExternalReviewEntityType;
  entityId: string;
  take?: number;
}): Promise<SerializedReview[]> {
  const mode = await resolveExternalReviewStorageMode(input.entityType);

  if (mode === "database") {
    const items = await db.review.findMany({
      where: buildExternalReviewWhere(input),
      orderBy: [{ createdAt: "desc" }],
      take: input.take ?? 100,
      include: {
        user: {
          select: { firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    return items.map(serializeReview);
  }

  if (mode === "fallback") {
    return (
      await listFallbackExternalReviewRows({
        entityType: input.entityType,
        entityId: input.entityId,
        take: input.take ?? 100,
      })
    ).map(serializeFallbackExternalReview);
  }

  return [];
}

async function refreshReviewSummaryForEntity(
  tx: DbTransactionClient,
  input: {
    entityType: ExternalReviewEntityType;
    entityId: string;
  },
) {
  if (input.entityType === "property") {
    return refreshEntityReviewStats(tx, {
      entityType: ReviewEntityType.PROPERTY,
      propertyId: input.entityId,
    });
  }

  if (input.entityType === "transfer") {
    return refreshEntityReviewStats(tx, {
      entityType: ReviewEntityType.TRANSFER,
      transferId: input.entityId,
    });
  }

  return refreshEntityReviewStats(tx, {
    entityType: ReviewEntityType.EXCURSION,
    excursionId: input.entityId,
  });
}

export async function createExternalReview(input: {
  entityType: ExternalReviewEntityType;
  entityId: string;
  actorId: string;
  actorRole: "owner" | "admin";
  status?: ReviewStatus;
  authorName: string;
  rating: number;
  text: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  guestCity?: string | null;
  reviewedAt?: string | null;
}): Promise<{
  item: SerializedReview;
  summary: { avgRating: number; reviewsCount: number } | null;
}> {
  const now = new Date();
  const status =
    input.status ?? (input.actorRole === "admin" ? ReviewStatus.ACTIVE : ReviewStatus.PENDING);
  const mode = await resolveExternalReviewStorageMode(input.entityType);
  const sourceUrl = input.sourceUrl?.trim() || null;
  const sourceName = readExternalReviewSourceName(sourceUrl, input.sourceName);
  const guestCity = normalizeReviewGuestCity(input.guestCity);
  const reviewedAt = parseReviewDateInput(input.reviewedAt);

  if (mode === "database") {
    return db.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          entityType: getReviewEntityType(input.entityType),
          ...(input.entityType === "property" ? { propertyId: input.entityId } : {}),
          ...(input.entityType === "excursion" ? { excursionId: input.entityId } : {}),
          ...(input.entityType === "transfer" ? { transferId: input.entityId } : {}),
          userId: null,
          rating: input.rating,
          text: normalizePlainText(input.text),
          status,
          isImported: true,
          importedAuthorName: input.authorName.trim(),
          externalSourceUrl: sourceUrl,
          externalSourceName: sourceName,
          guestCity,
          reviewedAt,
          importedByOwnerId: input.actorRole === "owner" ? input.actorId : null,
          verifiedAt: status === ReviewStatus.ACTIVE ? now : null,
          verifiedByAdminId: status === ReviewStatus.ACTIVE ? input.actorId : null,
        },
        include: {
          user: {
            select: { firstName: true, lastName: true, avatarUrl: true },
          },
        },
      });

      const summary =
        status === ReviewStatus.ACTIVE
          ? await refreshReviewSummaryForEntity(tx, {
              entityType: input.entityType,
              entityId: input.entityId,
            })
          : null;

      return {
        item: serializeReview(created),
        summary,
      };
    });
  }

  if (mode === "fallback") {
    if (!(await ensureFallbackExternalReviewTable())) {
      throw new Error("External review fallback storage is unavailable");
    }

    const rows = await db.$queryRaw<ExternalReviewFallbackRow[]>(Prisma.sql`
      INSERT INTO "ExternalReviewFallback" (
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
      )
      VALUES (
        ${`ext_${randomUUID()}`},
        ${input.entityType},
        ${input.entityId},
        ${status},
        ${input.authorName.trim()},
        ${new Prisma.Decimal(input.rating)},
        ${normalizePlainText(input.text)},
        ${sourceUrl},
        ${sourceName},
        ${guestCity},
        ${reviewedAt},
        ${0},
        ${0},
        ${input.actorRole === "owner" ? input.actorId : null},
        ${status === ReviewStatus.ACTIVE ? now : null},
        ${status === ReviewStatus.ACTIVE ? input.actorId : null},
        ${now},
        ${now},
        ${null}
      )
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
        NULL AS "currentUserReaction",
        "importedByOwnerId",
        "verifiedAt",
        "verifiedByAdminId",
        "createdAt",
        "updatedAt",
        "deletedAt"
    `);
    const created = rows[0];

    const baseSummary = await getBaseEntityReviewSummary({
      entityType: input.entityType,
      entityId: input.entityId,
    });
    const summary =
      status === ReviewStatus.ACTIVE
        ? await getExternalReviewSummaryWithFallback({
            entityType: input.entityType,
            entityId: input.entityId,
            avgRating: baseSummary.avgRating,
            reviewsCount: baseSummary.reviewsCount,
          })
        : null;

    return {
      item: serializeFallbackExternalReview(created),
      summary,
    };
  }

  throw new Error("External review storage is unavailable");
}

async function attachModerationTargets(
  items: SerializedReview[],
): Promise<ImportedReviewModerationItem[]> {
  const propertyIds = new Set<string>();
  const excursionIds = new Set<string>();
  const transferIds = new Set<string>();

  for (const review of items) {
    const entityId = getEntityIdFromSerializedReview(review);
    if (!entityId) {
      continue;
    }

    if (review.entityType === ReviewEntityType.PROPERTY) {
      propertyIds.add(entityId);
    } else if (review.entityType === ReviewEntityType.TRANSFER) {
      transferIds.add(entityId);
    } else {
      excursionIds.add(entityId);
    }
  }

  const [properties, excursions, transfers] = await Promise.all([
    propertyIds.size > 0
      ? db.property.findMany({
          where: { id: { in: [...propertyIds] } },
          select: {
            id: true,
            name: true,
            locationName: true,
            owner: {
              select: {
                firstName: true,
              },
            },
          },
        })
      : [],
    excursionIds.size > 0
      ? db.excursion.findMany({
          where: { id: { in: [...excursionIds] } },
          select: {
            id: true,
            title: true,
            locationName: true,
            owner: {
              select: {
                firstName: true,
              },
            },
          },
        })
      : [],
    transferIds.size > 0
      ? db.transfer.findMany({
          where: { id: { in: [...transferIds] } },
          select: {
            id: true,
            title: true,
            locationName: true,
            owner: {
              select: {
                firstName: true,
              },
            },
          },
        })
      : [],
  ]);

  const propertyById = new Map(
    properties.map((item) => [
      item.id,
      {
        href: `/admin/objects/${item.id}/external-reviews`,
        title: item.name?.trim() || "Объект без названия",
        subtitle: item.locationName ?? "Локация не указана",
        ownerName: item.owner.firstName,
      },
    ]),
  );
  const excursionById = new Map(
    excursions.map((item) => [
      item.id,
      {
        href: `/admin/excursions/${item.id}/external-reviews`,
        title: item.title?.trim() || "Программа без названия",
        subtitle: item.locationName ?? "Локация не указана",
        ownerName: item.owner.firstName,
      },
    ]),
  );
  const transferById = new Map(
    transfers.map((item) => [
      item.id,
      {
        href: `/admin/transfers/${item.id}/external-reviews`,
        title: item.title?.trim() || "Трансфер без названия",
        subtitle: item.locationName ?? "Локация не указана",
        ownerName: item.owner.firstName,
      },
    ]),
  );

  return items.map((review) => {
    const entityId = getEntityIdFromSerializedReview(review);
    const target =
      entityId && review.entityType === ReviewEntityType.PROPERTY
        ? (propertyById.get(entityId) ?? null)
        : entityId && review.entityType === ReviewEntityType.TRANSFER
          ? (transferById.get(entityId) ?? null)
          : entityId
            ? (excursionById.get(entityId) ?? null)
            : null;

    return {
      ...review,
      target,
    };
  });
}

export async function listImportedReviewsForAdmin(options?: {
  status?: ReviewStatus | "ALL";
  take?: number;
}): Promise<{
  items: ImportedReviewModerationItem[];
  countByStatus: Map<ReviewStatus, number>;
  totalCount: number;
}> {
  const take = Math.max(options?.take ?? 200, 50);
  const requestedStatus = options?.status ?? "ALL";
  const scanLimit = Math.max(take, MAX_IMPORTED_REVIEW_SCAN);
  const modes = new Map<ExternalReviewEntityType, ExternalReviewStorageMode>(
    await Promise.all(
      externalReviewEntityTypes.map(
        async (entityType) =>
          [entityType, await resolveExternalReviewStorageMode(entityType)] as const,
      ),
    ),
  );

  const [dbImportedItems, fallbackImportedItems] = await Promise.all([
    [...modes.values()].includes("database")
      ? db.review.findMany({
          where: {
            isImported: true,
          },
          orderBy: [{ createdAt: "desc" }],
          take: scanLimit,
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true },
            },
          },
        })
      : Promise.resolve([]),
    Promise.all(
      externalReviewEntityTypes
        .filter((entityType) => modes.get(entityType) === "fallback")
        .map((entityType) =>
          listFallbackExternalReviewRows({
            entityType,
            take: scanLimit,
          }),
        ),
    ).then((rows) => rows.flat()),
  ]);

  const allImportedReviews = [
    ...dbImportedItems.map(serializeReview),
    ...fallbackImportedItems.map(serializeFallbackExternalReview),
  ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  const countByStatus = new Map<ReviewStatus, number>([
    [ReviewStatus.PENDING, 0],
    [ReviewStatus.ACTIVE, 0],
    [ReviewStatus.DELETED, 0],
    [ReviewStatus.DUPLICATE, 0],
    [ReviewStatus.FAILED, 0],
  ]);

  for (const review of allImportedReviews) {
    countByStatus.set(review.status, (countByStatus.get(review.status) ?? 0) + 1);
  }

  const filteredItems =
    requestedStatus === "ALL"
      ? allImportedReviews
      : allImportedReviews.filter((review) => review.status === requestedStatus);

  const items = await attachModerationTargets(filteredItems.slice(0, take));

  return {
    items,
    countByStatus,
    totalCount: allImportedReviews.length,
  };
}

async function findFallbackExternalReviewById(
  id: string,
): Promise<ExternalReviewFallbackRow | null> {
  if (!(await ensureFallbackExternalReviewTable())) {
    return null;
  }

  const rows = await db.$queryRaw<ExternalReviewFallbackRow[]>(Prisma.sql`
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
      NULL AS "currentUserReaction",
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

export async function tryUpdateFallbackExternalReviewReaction(input: {
  id: string;
  userId: string;
  value: ReviewReactionValue | null;
}): Promise<
  | {
      ok: true;
      item: SerializedReview;
    }
  | {
      ok: false;
      status: number;
      error: string;
    }
  | null
> {
  const existing = await findFallbackExternalReviewById(input.id);
  if (!existing) {
    return null;
  }

  if (existing.status !== ReviewStatus.ACTIVE || existing.deletedAt) {
    return {
      ok: false,
      status: 400,
      error: "Реакция доступна только для опубликованных отзывов",
    };
  }

  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const existingReactionRows = await tx.$queryRaw<ExternalReviewFallbackReactionRow[]>(
      Prisma.sql`
        SELECT "value"
        FROM "ExternalReviewFallbackReaction"
        WHERE "reviewId" = ${existing.id}
          AND "userId" = ${input.userId}
        LIMIT 1
      `,
    );
    const existingReaction = existingReactionRows[0]?.value ?? null;

    if (existingReaction && input.value === null) {
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "ExternalReviewFallbackReaction"
        WHERE "reviewId" = ${existing.id}
          AND "userId" = ${input.userId}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "ExternalReviewFallback"
        SET
          "likesCount" = CASE
            WHEN ${existingReaction} = ${ReviewReactionValue.LIKE}
            THEN GREATEST(0, "likesCount" - 1)
            ELSE "likesCount"
          END,
          "dislikesCount" = CASE
            WHEN ${existingReaction} = ${ReviewReactionValue.DISLIKE}
            THEN GREATEST(0, "dislikesCount" - 1)
            ELSE "dislikesCount"
          END,
          "updatedAt" = ${now}
        WHERE "id" = ${existing.id}
      `);
    } else if (!existingReaction && input.value) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "ExternalReviewFallbackReaction" (
          "reviewId",
          "userId",
          "value",
          "createdAt",
          "updatedAt"
        )
        VALUES (${existing.id}, ${input.userId}, ${input.value}, ${now}, ${now})
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "ExternalReviewFallback"
        SET
          "likesCount" = CASE
            WHEN ${input.value} = ${ReviewReactionValue.LIKE}
            THEN "likesCount" + 1
            ELSE "likesCount"
          END,
          "dislikesCount" = CASE
            WHEN ${input.value} = ${ReviewReactionValue.DISLIKE}
            THEN "dislikesCount" + 1
            ELSE "dislikesCount"
          END,
          "updatedAt" = ${now}
        WHERE "id" = ${existing.id}
      `);
    } else if (existingReaction && input.value && existingReaction !== input.value) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "ExternalReviewFallbackReaction"
        SET
          "value" = ${input.value},
          "updatedAt" = ${now}
        WHERE "reviewId" = ${existing.id}
          AND "userId" = ${input.userId}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "ExternalReviewFallback"
        SET
          "likesCount" = CASE
            WHEN ${existingReaction} = ${ReviewReactionValue.LIKE}
              THEN GREATEST(0, "likesCount" - 1)
            WHEN ${input.value} = ${ReviewReactionValue.LIKE}
              THEN "likesCount" + 1
            ELSE "likesCount"
          END,
          "dislikesCount" = CASE
            WHEN ${existingReaction} = ${ReviewReactionValue.DISLIKE}
              THEN GREATEST(0, "dislikesCount" - 1)
            WHEN ${input.value} = ${ReviewReactionValue.DISLIKE}
              THEN "dislikesCount" + 1
            ELSE "dislikesCount"
          END,
          "updatedAt" = ${now}
        WHERE "id" = ${existing.id}
      `);
    }

    const rows = await tx.$queryRaw<ExternalReviewFallbackRow[]>(Prisma.sql`
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
        (
          SELECT "value"
          FROM "ExternalReviewFallbackReaction"
          WHERE "reviewId" = "ExternalReviewFallback"."id"
            AND "userId" = ${input.userId}
          LIMIT 1
        ) AS "currentUserReaction",
        "importedByOwnerId",
        "verifiedAt",
        "verifiedByAdminId",
        "createdAt",
        "updatedAt",
        "deletedAt"
      FROM "ExternalReviewFallback"
      WHERE "id" = ${existing.id}
      LIMIT 1
    `);

    return rows[0] ?? null;
  });

  if (!updated) {
    return null;
  }

  return {
    ok: true,
    item: serializeFallbackExternalReview(updated),
  };
}

export async function tryModerateFallbackExternalReview(input: {
  id: string;
  adminId: string;
  action: "approve" | "reject";
}): Promise<{
  item: SerializedReview;
  summary: { avgRating: number; reviewsCount: number };
  alreadyInTargetStatus?: boolean;
} | null> {
  const existing = await findFallbackExternalReviewById(input.id);
  if (!existing) {
    return null;
  }

  const targetStatus = input.action === "approve" ? ReviewStatus.ACTIVE : ReviewStatus.DELETED;
  if (existing.status === targetStatus) {
    const baseSummary = await getBaseEntityReviewSummary({
      entityType: existing.entityType,
      entityId: existing.entityId,
    });
    return {
      item: serializeFallbackExternalReview(existing),
      summary: await getExternalReviewSummaryWithFallback({
        entityType: existing.entityType,
        entityId: existing.entityId,
        avgRating: baseSummary.avgRating,
        reviewsCount: baseSummary.reviewsCount,
      }),
      alreadyInTargetStatus: true,
    };
  }

  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ExternalReviewFallbackRow[]>(Prisma.sql`
      UPDATE "ExternalReviewFallback"
      SET
        "status" = ${targetStatus},
        "deletedAt" = ${targetStatus === ReviewStatus.DELETED ? now : null},
        "verifiedAt" = ${targetStatus === ReviewStatus.ACTIVE ? now : null},
        "verifiedByAdminId" = ${targetStatus === ReviewStatus.ACTIVE ? input.adminId : null},
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
        NULL AS "currentUserReaction",
        "importedByOwnerId",
        "verifiedAt",
        "verifiedByAdminId",
        "createdAt",
        "updatedAt",
        "deletedAt"
    `);

    await tx.adminActionLog.create({
      data: {
        adminUserId: input.adminId,
        action: input.action === "approve" ? "approve_review" : "reject_review",
        targetType: "review",
        targetId: existing.id,
        details: {
          entityId: existing.entityId,
          entityType: existing.entityType,
          importedByOwnerId: existing.importedByOwnerId,
          isImported: true,
          externalSourceUrl: existing.sourceUrl,
          rating: Number(existing.rating),
          previousStatus: existing.status,
          nextStatus: targetStatus,
          fallbackStorage: true,
        },
      },
    });

    return rows[0] ?? null;
  });

  if (!updated) {
    return null;
  }

  const baseSummary = await getBaseEntityReviewSummary({
    entityType: updated.entityType,
    entityId: updated.entityId,
  });

  return {
    item: serializeFallbackExternalReview(updated),
    summary: await getExternalReviewSummaryWithFallback({
      entityType: updated.entityType,
      entityId: updated.entityId,
      avgRating: baseSummary.avgRating,
      reviewsCount: baseSummary.reviewsCount,
    }),
  };
}

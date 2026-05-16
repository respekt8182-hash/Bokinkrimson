import { ExcursionStatus, PropertyStatus, ReviewStatus, TransferStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  createExternalReview,
  findExternalReviewEntity,
  hasExternalReviewSupport,
  listExternalReviews,
  parseExternalReviewEntityType,
} from "@/lib/external-reviews";
import {
  getImportedReviewFingerprint,
  parseExternalReviewImportPayload,
} from "@/lib/external-review-import";
import type { SerializedReview } from "@/lib/reviews";

const TEXT = {
  badEntity:
    "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0435 entityType \u0438 entityId",
  badJson:
    "\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 JSON \u0437\u0430\u043f\u0440\u043e\u0441\u0430",
  cardNotFound:
    "\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430",
  duplicate:
    "\u0422\u0430\u043a\u043e\u0439 \u043e\u0442\u0437\u044b\u0432 \u0443\u0436\u0435 \u043f\u0440\u0438\u043a\u0440\u0435\u043f\u043b\u0451\u043d \u043a \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0435",
  importParseFailed:
    "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0437\u043e\u0431\u0440\u0430\u0442\u044c JSON \u0441 \u043e\u0442\u0437\u044b\u0432\u0430\u043c\u0438",
  noReviews:
    "\u0412 JSON \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e \u043e\u0442\u0437\u044b\u0432\u043e\u0432 \u0434\u043b\u044f \u0438\u043c\u043f\u043e\u0440\u0442\u0430",
  publishedOnly:
    "\u0418\u043c\u043f\u043e\u0440\u0442 \u043e\u0442\u0437\u044b\u0432\u043e\u0432 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u0445 \u043a\u0430\u0440\u0442\u043e\u0447\u0435\u043a.",
  schemaMissing:
    "\u0411\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445 \u0435\u0449\u0451 \u043d\u0435 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430 \u0434\u043b\u044f \u043e\u0442\u0437\u044b\u0432\u043e\u0432 \u0441 \u0434\u0440\u0443\u0433\u0438\u0445 \u0441\u0430\u0439\u0442\u043e\u0432. \u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u0435 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u044e\u044e Prisma-\u043c\u0438\u0433\u0440\u0430\u0446\u0438\u044e.",
  unauthorized:
    "\u0414\u043e\u0441\u0442\u0443\u043f \u0437\u0430\u043f\u0440\u0435\u0449\u0451\u043d",
  createFailed:
    "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043e\u0442\u0437\u044b\u0432",
};

function parseEntity(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityType = parseExternalReviewEntityType(searchParams.get("entityType"));
  const entityId = searchParams.get("entityId")?.trim() || null;

  return entityType && entityId ? { entityType, entityId } : null;
}

function parseImportStatus(value: unknown): ReviewStatus {
  return value === ReviewStatus.DELETED ? ReviewStatus.DELETED : ReviewStatus.ACTIVE;
}

async function isPublishedImportTarget(input: {
  entityType: "property" | "excursion" | "transfer";
  entityId: string;
}): Promise<boolean> {
  if (input.entityType === "property") {
    const property = await db.property.findFirst({
      where: {
        id: input.entityId,
        status: PropertyStatus.PUBLISHED,
        ownerDeletedAt: null,
      },
      select: { id: true },
    });
    return Boolean(property);
  }

  if (input.entityType === "transfer") {
    const transfer = await db.transfer.findFirst({
      where: {
        id: input.entityId,
        status: TransferStatus.PUBLISHED,
      },
      select: { id: true },
    });
    return Boolean(transfer);
  }

  const excursion = await db.excursion.findFirst({
    where: {
      id: input.entityId,
      status: ExcursionStatus.PUBLISHED,
    },
    select: { id: true },
  });
  return Boolean(excursion);
}

export async function POST(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: TEXT.unauthorized }, { status: 403 });
  }

  const entity = parseEntity(request);
  if (!entity) {
    return NextResponse.json({ error: TEXT.badEntity }, { status: 400 });
  }

  const target = await findExternalReviewEntity(entity);
  if (!target) {
    return NextResponse.json({ error: TEXT.cardNotFound }, { status: 404 });
  }

  if (!(await isPublishedImportTarget(entity))) {
    return NextResponse.json({ error: TEXT.publishedOnly }, { status: 409 });
  }

  if (!(await hasExternalReviewSupport(entity.entityType))) {
    return NextResponse.json(
      {
        error: TEXT.schemaMissing,
        code: "EXTERNAL_REVIEW_SCHEMA_MISSING",
      },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: TEXT.badJson }, { status: 400 });
  }

  let parsedImport;
  try {
    parsedImport = parseExternalReviewImportPayload(payload);
  } catch {
    return NextResponse.json({ error: TEXT.importParseFailed }, { status: 400 });
  }

  if (parsedImport.items.length === 0) {
    return NextResponse.json(
      {
        error: TEXT.noReviews,
        skipped: parsedImport.skipped,
        warnings: parsedImport.warnings,
      },
      { status: 400 },
    );
  }

  const status = parseImportStatus(
    typeof payload === "object" && payload !== null
      ? (payload as { status?: unknown }).status
      : null,
  );
  const existingFingerprints = new Set(
    (await listExternalReviews(entity)).map((review) => getImportedReviewFingerprint(review)),
  );
  const createdItems: SerializedReview[] = [];
  const skipped = [...parsedImport.skipped];
  const failed: Array<{ index: number; reason: string }> = [];

  for (const [index, review] of parsedImport.items.entries()) {
    const fingerprint = getImportedReviewFingerprint(review);
    if (existingFingerprints.has(fingerprint)) {
      skipped.push({ index, reason: TEXT.duplicate });
      continue;
    }

    try {
      const result = await createExternalReview({
        ...entity,
        actorId: admin.id,
        actorRole: "admin",
        status,
        authorName: review.authorName,
        rating: review.rating,
        text: review.text,
        sourceUrl: review.sourceUrl,
        sourceName: review.sourceName,
        guestCity: review.guestCity,
        reviewedAt: review.reviewedAt,
        reviewCategory: review.reviewCategory,
        reviewHighlight: review.reviewHighlight,
        reviewCategoryMatches: review.reviewCategoryMatches,
      });

      existingFingerprints.add(fingerprint);
      createdItems.push(result.item);
    } catch (error) {
      failed.push({
        index,
        reason: error instanceof Error ? error.message : TEXT.createFailed,
      });
    }
  }

  await db.adminActionLog.create({
    data: {
      adminUserId: admin.id,
      action: "import_external_reviews",
      targetType: entity.entityType,
      targetId: entity.entityId,
      details: {
        status,
        importedCount: createdItems.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
      },
    },
  });

  return NextResponse.json(
    {
      importedCount: createdItems.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      items: createdItems,
      skipped,
      failed,
      warnings: parsedImport.warnings,
    },
    { status: 201 },
  );
}

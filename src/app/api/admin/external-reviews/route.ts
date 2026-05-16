import { ExcursionStatus, PropertyStatus, TransferStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  createExternalReview,
  deleteExternalReviewsForEntity,
  findExternalReviewEntity,
  hasExternalReviewSupport,
  listExternalReviews,
  parseExternalReviewEntityType,
} from "@/lib/external-reviews";
import { manualExternalReviewSchema } from "@/lib/schemas";

const TEXT = {
  badEntity:
    "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0435 entityType \u0438 entityId",
  badJson: "\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 JSON",
  cardNotFound:
    "\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430",
  invalidReview:
    "\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u043e\u0442\u0437\u044b\u0432\u0430",
  publishedOnly:
    "\u0414\u043e\u0431\u0430\u0432\u043b\u044f\u0442\u044c \u043e\u0442\u0437\u044b\u0432\u044b \u043c\u043e\u0436\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e \u043a \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u043c \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0430\u043c.",
  schemaMissing:
    "\u0411\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445 \u0435\u0449\u0451 \u043d\u0435 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430 \u0434\u043b\u044f \u043e\u0442\u0437\u044b\u0432\u043e\u0432 \u0441 \u0434\u0440\u0443\u0433\u0438\u0445 \u0441\u0430\u0439\u0442\u043e\u0432. \u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u0435 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u044e\u044e Prisma-\u043c\u0438\u0433\u0440\u0430\u0446\u0438\u044e.",
  unauthorized:
    "\u0414\u043e\u0441\u0442\u0443\u043f \u0437\u0430\u043f\u0440\u0435\u0449\u0451\u043d",
};

function parseEntity(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityType = parseExternalReviewEntityType(searchParams.get("entityType"));
  const entityId = searchParams.get("entityId")?.trim() || null;

  return entityType && entityId ? { entityType, entityId } : null;
}

async function isPublishedExternalReviewTarget(input: {
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

export async function GET(request: Request) {
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

  const schemaAvailable = await hasExternalReviewSupport(entity.entityType);
  if (!schemaAvailable) {
    return NextResponse.json({
      items: [],
      schemaAvailable: false,
    });
  }

  return NextResponse.json({
    items: await listExternalReviews(entity),
    schemaAvailable: true,
  });
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

  if (!(await isPublishedExternalReviewTarget(entity))) {
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

  const parsed = manualExternalReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: TEXT.invalidReview }, { status: 400 });
  }

  const result = await createExternalReview({
    ...entity,
    actorId: admin.id,
    actorRole: "admin",
    authorName: parsed.data.authorName,
    rating: parsed.data.rating,
    text: parsed.data.text,
    sourceUrl: parsed.data.sourceUrl,
    sourceName: parsed.data.sourceName,
    guestCity: parsed.data.guestCity,
    reviewedAt: parsed.data.reviewedAt,
    reviewCategory: parsed.data.reviewCategory,
    reviewHighlight: parsed.data.reviewHighlight,
  });

  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: Request) {
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

  if (!(await hasExternalReviewSupport(entity.entityType))) {
    return NextResponse.json(
      {
        error: TEXT.schemaMissing,
        code: "EXTERNAL_REVIEW_SCHEMA_MISSING",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    await deleteExternalReviewsForEntity({
      ...entity,
      adminId: admin.id,
    }),
  );
}

import { ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  createExternalReview,
  findExternalReviewEntity,
  getExternalReviewEntityLabel,
  hasExternalReviewSupport,
  listExternalReviews,
  parseExternalReviewEntityType,
} from "@/lib/external-reviews";
import { manualExternalReviewSchema } from "@/lib/schemas";

function parseEntity(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityType = parseExternalReviewEntityType(searchParams.get("entityType"));
  const entityId = searchParams.get("entityId")?.trim() || null;

  return entityType && entityId ? { entityType, entityId } : null;
}

export async function GET(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const entity = parseEntity(request);
  if (!entity) {
    return NextResponse.json(
      { error: "Укажите корректные entityType и entityId" },
      { status: 400 },
    );
  }

  const target = await findExternalReviewEntity(entity);
  if (!target) {
    return NextResponse.json(
      { error: `${getExternalReviewEntityLabel(entity.entityType)} не найден` },
      { status: 404 },
    );
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
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const entity = parseEntity(request);
  if (!entity) {
    return NextResponse.json(
      { error: "Укажите корректные entityType и entityId" },
      { status: 400 },
    );
  }

  const target = await findExternalReviewEntity(entity);
  if (!target) {
    return NextResponse.json(
      { error: `${getExternalReviewEntityLabel(entity.entityType)} не найден` },
      { status: 404 },
    );
  }

  if (!(await hasExternalReviewSupport(entity.entityType))) {
    return NextResponse.json(
      {
        error:
          "База данных ещё не обновлена для отзывов с других сайтов. Примените последнюю Prisma-миграцию.",
        code: "EXTERNAL_REVIEW_SCHEMA_MISSING",
      },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = manualExternalReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте данные отзыва" }, { status: 400 });
  }

  const result = await createExternalReview({
    ...entity,
    actorId: admin.id,
    actorRole: "admin",
    status: ReviewStatus.PENDING,
    authorName: parsed.data.authorName,
    rating: parsed.data.rating,
    text: parsed.data.text,
    sourceUrl: parsed.data.sourceUrl,
    sourceName: parsed.data.sourceName,
    guestCity: parsed.data.guestCity,
    reviewedAt: parsed.data.reviewedAt,
  });

  return NextResponse.json(result, { status: 201 });
}

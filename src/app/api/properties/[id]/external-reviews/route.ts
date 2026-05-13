import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createExternalReview,
  findExternalReviewEntity,
  hasExternalReviewSupport,
  listExternalReviews,
} from "@/lib/external-reviews";
import { importExternalReviewSchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await findExternalReviewEntity({
    entityType: "property",
    entityId: id,
    ownerId: session.id,
  });

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  if (!(await hasExternalReviewSupport("property"))) {
    return NextResponse.json({ items: [], schemaAvailable: false });
  }

  return NextResponse.json({
    items: await listExternalReviews({ entityType: "property", entityId: property.id }),
    schemaAvailable: true,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await findExternalReviewEntity({
    entityType: "property",
    entityId: id,
    ownerId: session.id,
  });

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  if (!(await hasExternalReviewSupport("property"))) {
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

  const parsed = importExternalReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте данные отзыва" }, { status: 400 });
  }

  const result = await createExternalReview({
    entityType: "property",
    entityId: property.id,
    actorId: session.id,
    actorRole: "owner",
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

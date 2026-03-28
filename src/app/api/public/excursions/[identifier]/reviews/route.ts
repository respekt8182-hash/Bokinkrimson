// API route handler for /api/public/excursions/[identifier]/reviews.
import { ExcursionStatus, ReviewEntityType, ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reviewRateLimit } from "@/lib/constants";
import { db } from "@/lib/db";
import { extractPropertyId } from "@/lib/public-properties";
import { serializeReview } from "@/lib/reviews";
import { createReviewSchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ identifier: string }>;
};

function parsePagination(request: Request): { offset: number; limit: number } {
  const { searchParams } = new URL(request.url);
  const rawOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "9", 10);

  return {
    offset: Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0,
    limit:
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 12)
        : 9,
  };
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  const { identifier } = await context.params;
  const { offset, limit } = parsePagination(request);
  const excursionId = extractPropertyId(identifier);

  const excursion = await db.excursion.findFirst({
    where: {
      id: excursionId,
      status: ExcursionStatus.PUBLISHED,
    },
    select: {
      id: true,
      ownerId: true,
      avgRating: true,
      reviewsCount: true,
    },
  });

  if (!excursion) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  const items = await db.review.findMany({
    where: {
      entityType: ReviewEntityType.EXCURSION,
      excursionId: excursion.id,
      status: ReviewStatus.ACTIVE,
    },
    orderBy: [{ createdAt: "desc" }],
    skip: offset,
    take: limit,
    include: {
      user: {
        select: { firstName: true, lastName: true, avatarUrl: true },
      },
      ...(session
        ? {
            reactions: {
              where: { userId: session.id },
              select: { value: true },
              take: 1,
            },
          }
        : {}),
    },
  });

  const nextOffset = offset + items.length;

  return NextResponse.json({
    summary: {
      avgRating: Number(excursion.avgRating),
      reviewsCount: excursion.reviewsCount,
    },
    items: items.map(serializeReview),
    pagination: {
      offset,
      limit,
      nextOffset,
      hasMore: nextOffset < excursion.reviewsCount,
      total: excursion.reviewsCount,
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      {
        error: "Чтобы оставить отзыв, войдите или зарегистрируйтесь",
        code: "AUTH_REQUIRED",
      },
      { status: 401 },
    );
  }

  const { identifier } = await context.params;
  const excursionId = extractPropertyId(identifier);

  const excursion = await db.excursion.findFirst({
    where: {
      id: excursionId,
      status: ExcursionStatus.PUBLISHED,
    },
    select: {
      id: true,
      ownerId: true,
      avgRating: true,
      reviewsCount: true,
    },
  });

  if (!excursion) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  if (excursion.ownerId === session.id) {
    return NextResponse.json(
      {
        error: "Нельзя оставить отзыв на собственную экскурсию. Вы можете отвечать на отзывы гостей.",
        code: "OWNER_SELF_REVIEW_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const nextDayStart = new Date(dayStart);
  nextDayStart.setDate(nextDayStart.getDate() + 1);

  const reviewsToday = await db.review.count({
    where: {
      userId: session.id,
      createdAt: {
        gte: dayStart,
        lt: nextDayStart,
      },
    },
  });

  if (reviewsToday >= reviewRateLimit.maxReviewsPerUser) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((nextDayStart.getTime() - Date.now()) / 1000),
    );

    return NextResponse.json(
      {
        error: `Лимит отзывов: не более ${reviewRateLimit.maxReviewsPerUser} в сутки на пользователя`,
        code: "RATE_LIMIT_REACHED",
        nextAllowedAt: nextDayStart.toISOString(),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность оценки и текста отзыва" }, { status: 400 });
  }

  const data = parsed.data;

  const created = await db.review.create({
    data: {
      entityType: ReviewEntityType.EXCURSION,
      excursionId: excursion.id,
      userId: session.id,
      rating: data.rating,
      text: data.text,
      status: ReviewStatus.PENDING,
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json(
    {
      item: serializeReview(created),
      summary: {
        avgRating: Number(excursion.avgRating),
        reviewsCount: excursion.reviewsCount,
      },
      moderationStatus: ReviewStatus.PENDING,
      message: "Отзыв отправлен на модерацию",
    },
    { status: 201 },
  );
}

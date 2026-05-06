import { Prisma, ReviewEntityType, ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reviewRateLimit } from "@/lib/constants";
import { db } from "@/lib/db";
import { normalizePlainText } from "@/lib/plain-text";
import { extractPropertyId } from "@/lib/public-properties";
import { buildPublishedTransferVisibilityWhere } from "@/lib/public-visibility";
import { serializeReview } from "@/lib/reviews";
import { createReviewSchema } from "@/lib/schemas";
import { hasTransferReviewSupport } from "@/lib/transfer-review-support";

type RouteContext = {
  params: Promise<{ identifier: string }>;
};

function parsePagination(request: Request): { offset: number; limit: number } {
  const { searchParams } = new URL(request.url);
  const rawOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "9", 10);

  return {
    offset: Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0,
    limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 12) : 9,
  };
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  const { identifier } = await context.params;
  const { offset, limit } = parsePagination(request);
  const transferId = extractPropertyId(identifier);

  const transfer = await db.transfer.findFirst({
    where: {
      id: transferId,
      ...buildPublishedTransferVisibilityWhere(),
    },
    select: {
      id: true,
      ownerId: true,
      avgRating: true,
      reviewsCount: true,
    },
  });

  if (!transfer) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }

  if (!(await hasTransferReviewSupport())) {
    return NextResponse.json({
      summary: {
        avgRating: Number(transfer.avgRating),
        reviewsCount: transfer.reviewsCount,
      },
      items: [],
      pagination: {
        offset,
        limit,
        nextOffset: offset,
        hasMore: false,
        total: transfer.reviewsCount,
      },
    });
  }

  const items = await db.review.findMany({
    where: {
      entityType: ReviewEntityType.TRANSFER,
      transferId: transfer.id,
      status: ReviewStatus.ACTIVE,
    },
    orderBy: [{ createdAt: "desc" }],
    skip: offset,
    take: limit,
    include: {
      user: {
        select: { firstName: true, avatarUrl: true },
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
      avgRating: Number(transfer.avgRating),
      reviewsCount: transfer.reviewsCount,
    },
    items: items.map(serializeReview),
    pagination: {
      offset,
      limit,
      nextOffset,
      hasMore: nextOffset < transfer.reviewsCount,
      total: transfer.reviewsCount,
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      {
        error: "Sign in to leave a review",
        code: "AUTH_REQUIRED",
      },
      { status: 401 },
    );
  }

  const { identifier } = await context.params;
  const transferId = extractPropertyId(identifier);

  const transfer = await db.transfer.findFirst({
    where: {
      id: transferId,
      ...buildPublishedTransferVisibilityWhere(),
    },
    select: {
      id: true,
      ownerId: true,
      avgRating: true,
      reviewsCount: true,
    },
  });

  if (!transfer) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }

  if (!(await hasTransferReviewSupport())) {
    return NextResponse.json(
      {
        error:
          "Отзывы для трансферов станут доступны после обновления схемы базы данных администратором.",
        code: "TRANSFER_REVIEW_SCHEMA_MISSING",
      },
      { status: 503 },
    );
  }

  if (transfer.ownerId === session.id) {
    return NextResponse.json(
      {
        error: "You cannot leave a review for your own transfer",
        code: "OWNER_SELF_REVIEW_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  const existingReview = await db.review.findFirst({
    where: {
      userId: session.id,
      transferId: transfer.id,
    },
    select: { id: true },
  });

  if (existingReview) {
    return NextResponse.json({ error: "You have already reviewed this transfer" }, { status: 409 });
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
    const retryAfterSeconds = Math.max(1, Math.ceil((nextDayStart.getTime() - Date.now()) / 1000));

    return NextResponse.json(
      {
        error: `Daily review limit reached: no more than ${reviewRateLimit.maxReviewsPerUser} reviews per day`,
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the rating and review text" }, { status: 400 });
  }

  try {
    const created = await db.review.create({
      data: {
        entityType: ReviewEntityType.TRANSFER,
        transferId: transfer.id,
        userId: session.id,
        rating: parsed.data.rating,
        text: normalizePlainText(parsed.data.text),
        status: ReviewStatus.PENDING,
      },
      include: {
        user: {
          select: { firstName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(
      {
        item: serializeReview(created),
        summary: {
          avgRating: Number(transfer.avgRating),
          reviewsCount: transfer.reviewsCount,
        },
        moderationStatus: ReviewStatus.PENDING,
        message: "Review submitted for moderation",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "You have already reviewed this transfer" }, { status: 409 });
    }

    throw error;
  }
}

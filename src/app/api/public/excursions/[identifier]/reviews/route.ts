import { Prisma, ReviewEntityType, ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reviewRateLimit } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  getExternalReviewSummaryWithFallback,
  getMergedExternalReviewList,
} from "@/lib/external-reviews";
import { normalizePlainText } from "@/lib/plain-text";
import { extractPropertyId } from "@/lib/public-properties";
import { buildPublishedExcursionVisibilityWhere } from "@/lib/public-visibility";
import {
  normalizeReviewGuestCity,
  parseReviewDateInput,
  PUBLIC_REVIEWS_PAGE_SIZE,
  serializeReview,
} from "@/lib/reviews";
import { createReviewSchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ identifier: string }>;
};

function parsePagination(request: Request): { offset: number; limit: number } {
  const { searchParams } = new URL(request.url);
  const rawOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = Number.parseInt(
    searchParams.get("limit") ?? String(PUBLIC_REVIEWS_PAGE_SIZE),
    10,
  );

  return {
    offset: Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0,
    limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 10) : PUBLIC_REVIEWS_PAGE_SIZE,
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
      ...buildPublishedExcursionVisibilityWhere(),
    },
    select: {
      id: true,
      ownerId: true,
      avgRating: true,
      reviewsCount: true,
    },
  });

  if (!excursion) {
    return NextResponse.json({ error: "Excursion not found" }, { status: 404 });
  }

  const databaseItems = await db.review.findMany({
    where: {
      entityType: ReviewEntityType.EXCURSION,
      excursionId: excursion.id,
      status: ReviewStatus.ACTIVE,
      rating: { gte: 0.5 },
    },
    orderBy: [{ createdAt: "desc" }],
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

  const summary = await getExternalReviewSummaryWithFallback({
    entityType: "excursion",
    entityId: excursion.id,
    avgRating: Number(excursion.avgRating),
    reviewsCount: excursion.reviewsCount,
  });
  const merged = await getMergedExternalReviewList({
    entityType: "excursion",
    entityId: excursion.id,
    databaseItems: databaseItems.map(serializeReview),
    databaseTotal: excursion.reviewsCount,
    currentUserId: session?.id ?? null,
    offset,
    limit,
  });
  const nextOffset = offset + merged.items.length;

  return NextResponse.json({
    summary,
    items: merged.items,
    pagination: {
      offset,
      limit,
      nextOffset,
      hasMore: nextOffset < merged.total,
      total: merged.total,
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
  const excursionId = extractPropertyId(identifier);

  const excursion = await db.excursion.findFirst({
    where: {
      id: excursionId,
      ...buildPublishedExcursionVisibilityWhere(),
    },
    select: {
      id: true,
      ownerId: true,
      avgRating: true,
      reviewsCount: true,
    },
  });

  if (!excursion) {
    return NextResponse.json({ error: "Excursion not found" }, { status: 404 });
  }

  if (excursion.ownerId === session.id) {
    return NextResponse.json(
      {
        error: "You cannot leave a review for your own excursion",
        code: "OWNER_SELF_REVIEW_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  const existingReview = await db.review.findFirst({
    where: {
      userId: session.id,
      excursionId: excursion.id,
    },
    select: { id: true },
  });

  if (existingReview) {
    return NextResponse.json({ error: "You have already reviewed this excursion" }, { status: 409 });
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
        entityType: ReviewEntityType.EXCURSION,
        excursionId: excursion.id,
        userId: session.id,
        rating: parsed.data.rating,
        text: normalizePlainText(parsed.data.text),
        guestCity: normalizeReviewGuestCity(parsed.data.guestCity),
        reviewedAt: parseReviewDateInput(parsed.data.reviewedAt),
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
        summary: await getExternalReviewSummaryWithFallback({
          entityType: "excursion",
          entityId: excursion.id,
          avgRating: Number(excursion.avgRating),
          reviewsCount: excursion.reviewsCount,
        }),
        moderationStatus: ReviewStatus.PENDING,
        message: "Review submitted for moderation",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "You have already reviewed this excursion" }, { status: 409 });
    }

    throw error;
  }
}

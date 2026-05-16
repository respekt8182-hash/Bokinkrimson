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
import {
  buildPublicReviewMeta,
  filterAndSortPublicReviews,
  parsePublicReviewSort,
  PUBLIC_REVIEW_SCAN_LIMIT,
  slicePublicReviews,
} from "@/lib/public-review-list";
import { extractPropertyId } from "@/lib/public-properties";
import { buildPublishedPropertyVisibilityWhere } from "@/lib/public-visibility";
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

function parseReviewView(request: Request): { category: string | null; sort: ReturnType<typeof parsePublicReviewSort> } {
  const { searchParams } = new URL(request.url);
  return {
    category: searchParams.get("category"),
    sort: parsePublicReviewSort(searchParams.get("sort")),
  };
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  const { identifier } = await context.params;
  const { offset, limit } = parsePagination(request);
  const view = parseReviewView(request);
  const propertyId = extractPropertyId(identifier);

  const property = await db.property.findFirst({
    where: {
      id: propertyId,
      ...buildPublishedPropertyVisibilityWhere(),
    },
    select: {
      id: true,
      ownerId: true,
      avgRating: true,
      reviewsCount: true,
    },
  });

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const databaseItems = await db.review.findMany({
    where: {
      entityType: ReviewEntityType.PROPERTY,
      propertyId: property.id,
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
    entityType: "property",
    entityId: property.id,
    avgRating: Number(property.avgRating),
    reviewsCount: property.reviewsCount,
  });
  const merged = await getMergedExternalReviewList({
    entityType: "property",
    entityId: property.id,
    databaseItems: databaseItems.map(serializeReview),
    databaseTotal: property.reviewsCount,
    currentUserId: session?.id ?? null,
    offset: 0,
    limit: PUBLIC_REVIEW_SCAN_LIMIT,
  });
  const filtered = filterAndSortPublicReviews({
    reviews: merged.items,
    category: view.category,
    sort: view.sort,
  });
  const page = slicePublicReviews({ reviews: filtered, offset, limit });

  return NextResponse.json({
    summary: { ...summary, ...buildPublicReviewMeta(merged.items) },
    items: page.items,
    pagination: page.pagination,
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
  const propertyId = extractPropertyId(identifier);

  const property = await db.property.findFirst({
    where: {
      id: propertyId,
      ...buildPublishedPropertyVisibilityWhere(),
    },
    select: {
      id: true,
      ownerId: true,
      avgRating: true,
      reviewsCount: true,
    },
  });

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  if (property.ownerId === session.id) {
    return NextResponse.json(
      {
        error: "You cannot leave a review for your own property",
        code: "OWNER_SELF_REVIEW_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  const existingReview = await db.review.findFirst({
    where: {
      userId: session.id,
      propertyId: property.id,
    },
    select: { id: true },
  });

  if (existingReview) {
    return NextResponse.json({ error: "You have already reviewed this property" }, { status: 409 });
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
        entityType: ReviewEntityType.PROPERTY,
        propertyId: property.id,
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
          entityType: "property",
          entityId: property.id,
          avgRating: Number(property.avgRating),
          reviewsCount: property.reviewsCount,
        }),
        moderationStatus: ReviewStatus.PENDING,
        message: "Review submitted for moderation",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "You have already reviewed this property" }, { status: 409 });
    }

    throw error;
  }
}

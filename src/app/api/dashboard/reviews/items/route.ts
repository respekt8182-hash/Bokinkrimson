// API route handler for GET /api/dashboard/reviews/items
// Returns paginated reviews for an entity owned by the current user.
import { ReviewEntityType, ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeReview } from "@/lib/reviews";
import { hasTransferReviewSupport } from "@/lib/transfer-review-support";

function parsePagination(request: Request): { offset: number; limit: number } {
  const { searchParams } = new URL(request.url);
  const rawOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "5", 10);

  return {
    offset: Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0,
    limit:
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 5,
  };
}

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (!entityId || (entityType !== "property" && entityType !== "excursion" && entityType !== "transfer")) {
    return NextResponse.json(
      { error: "Укажите корректные entityType и entityId" },
      { status: 400 },
    );
  }

  const { offset, limit } = parsePagination(request);

  if (entityType === "property") {
    const property = await db.property.findFirst({
      where: { id: entityId, ownerId: session.id, ownerDeletedAt: null },
      select: { id: true, reviewsCount: true },
    });

    if (!property) {
      return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
    }

    const items = await db.review.findMany({
      where: {
        entityType: ReviewEntityType.PROPERTY,
        propertyId: property.id,
        status: ReviewStatus.ACTIVE,
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    const nextOffset = offset + items.length;

    return NextResponse.json({
      items: items.map(serializeReview),
      pagination: {
        offset,
        limit,
        nextOffset,
        hasMore: nextOffset < property.reviewsCount,
        total: property.reviewsCount,
      },
    });
  }

  if (entityType === "transfer") {
    if (!(await hasTransferReviewSupport())) {
      return NextResponse.json({
        items: [],
        pagination: {
          offset,
          limit,
          nextOffset: offset,
          hasMore: false,
          total: 0,
        },
      });
    }

    const transfer = await db.transfer.findFirst({
      where: { id: entityId, ownerId: session.id },
      select: { id: true, reviewsCount: true },
    });

    if (!transfer) {
      return NextResponse.json({ error: "Трансфер не найден" }, { status: 404 });
    }

    const items = await db.review.findMany({
      where: {
        entityType: ReviewEntityType.TRANSFER,
        transferId: transfer.id,
        status: ReviewStatus.ACTIVE,
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    const nextOffset = offset + items.length;

    return NextResponse.json({
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

  // excursion
  const excursion = await db.excursion.findFirst({
    where: { id: entityId, ownerId: session.id },
    select: { id: true, reviewsCount: true },
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
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    include: {
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  const nextOffset = offset + items.length;

  return NextResponse.json({
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

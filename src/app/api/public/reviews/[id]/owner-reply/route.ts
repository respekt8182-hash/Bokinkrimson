// API route handler for /api/public/reviews/[id]/owner-reply.
import { ReviewEntityType, ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePlainText } from "@/lib/plain-text";
import { serializeReview } from "@/lib/reviews";
import { hasTransferReviewSupport } from "@/lib/transfer-review-support";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ownerReplySchema = z.object({
  text: z
    .string()
    .trim()
    .min(2, "Ответ должен содержать минимум 2 символа")
    .max(2000, "Ответ не должен превышать 2000 символов"),
});

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      {
        error: "Чтобы ответить на отзыв, войдите в аккаунт",
        code: "AUTH_REQUIRED",
      },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = ownerReplySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте текст ответа" }, { status: 400 });
  }

  const transferReviewsSupported = await hasTransferReviewSupport();

  const review = await db.review.findUnique({
    where: { id },
    include: {
      user: {
        select: { firstName: true, avatarUrl: true },
      },
      property: {
        select: { ownerId: true },
      },
      excursion: {
        select: { ownerId: true },
      },
      ...(transferReviewsSupported
        ? {
            transfer: {
              select: { ownerId: true },
            },
          }
        : {}),
    },
  });

  if (!review) {
    return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
  }

  if (review.status !== ReviewStatus.ACTIVE) {
    return NextResponse.json(
      { error: "Ответ можно оставить только на опубликованный отзыв" },
      { status: 400 },
    );
  }

  const transferOwnerId =
    "transfer" in review && review.transfer ? review.transfer.ownerId ?? null : null;

  const ownerId =
    review.entityType === ReviewEntityType.PROPERTY
      ? review.property?.ownerId ?? null
      : review.entityType === ReviewEntityType.EXCURSION
        ? review.excursion?.ownerId ?? null
        : transferOwnerId;

  if (!ownerId || ownerId !== session.id) {
    return NextResponse.json({ error: "Недостаточно прав для ответа на отзыв" }, { status: 403 });
  }

  if (review.userId === session.id) {
    return NextResponse.json({ error: "Нельзя отвечать на собственный отзыв" }, { status: 400 });
  }

  const updated = await db.review.update({
    where: { id: review.id },
    data: {
      ownerReply: normalizePlainText(parsed.data.text),
      ownerRepliedAt: new Date(),
    },
    include: {
      user: {
        select: { firstName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({ item: serializeReview(updated) });
}

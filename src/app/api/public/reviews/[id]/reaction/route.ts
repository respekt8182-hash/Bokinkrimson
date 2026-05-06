// API route handler for /api/public/reviews/[id]/reaction.
import { ReviewReactionValue, ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeReview } from "@/lib/reviews";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const reviewReactionSchema = z.object({
  value: z.nativeEnum(ReviewReactionValue).nullable(),
});

export async function PUT(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      {
        error: "Чтобы оценивать отзывы, войдите в аккаунт",
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

  const parsed = reviewReactionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте значение реакции" }, { status: 400 });
  }

  const review = await db.review.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          firstName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!review) {
    return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
  }

  if (review.status !== ReviewStatus.ACTIVE || review.deletedAt) {
    return NextResponse.json({ error: "Реакция доступна только для опубликованных отзывов" }, { status: 400 });
  }

  if (review.userId === session.id) {
    return NextResponse.json({ error: "Нельзя оценивать собственный отзыв" }, { status: 400 });
  }

  const nextValue = parsed.data.value;

  await db.$transaction(async (tx) => {
    const existingReaction = await tx.reviewReaction.findUnique({
      where: {
        reviewId_userId: {
          reviewId: review.id,
          userId: session.id,
        },
      },
      select: {
        value: true,
      },
    });

    if (!existingReaction && nextValue === null) {
      return;
    }

    if (existingReaction && nextValue === null) {
      await tx.reviewReaction.delete({
        where: {
          reviewId_userId: {
            reviewId: review.id,
            userId: session.id,
          },
        },
      });

      await tx.review.update({
        where: { id: review.id },
        data:
          existingReaction.value === ReviewReactionValue.LIKE
            ? { likesCount: { decrement: 1 } }
            : { dislikesCount: { decrement: 1 } },
      });

      return;
    }

    if (!existingReaction && nextValue) {
      await tx.reviewReaction.create({
        data: {
          reviewId: review.id,
          userId: session.id,
          value: nextValue,
        },
      });

      await tx.review.update({
        where: { id: review.id },
        data:
          nextValue === ReviewReactionValue.LIKE
            ? { likesCount: { increment: 1 } }
            : { dislikesCount: { increment: 1 } },
      });

      return;
    }

    if (!existingReaction || !nextValue || existingReaction.value === nextValue) {
      return;
    }

    await tx.reviewReaction.update({
      where: {
        reviewId_userId: {
          reviewId: review.id,
          userId: session.id,
        },
      },
      data: {
        value: nextValue,
      },
    });

    await tx.review.update({
      where: { id: review.id },
      data:
        existingReaction.value === ReviewReactionValue.LIKE
          ? {
              likesCount: { decrement: 1 },
              dislikesCount: { increment: 1 },
            }
          : {
              likesCount: { increment: 1 },
              dislikesCount: { decrement: 1 },
            },
    });
  });

  const updated = await db.review.findUnique({
    where: { id: review.id },
    include: {
      user: {
        select: {
          firstName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!updated) {
    return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
  }

  return NextResponse.json({
    item: serializeReview({
      ...updated,
      currentUserReaction: nextValue,
    }),
  });
}

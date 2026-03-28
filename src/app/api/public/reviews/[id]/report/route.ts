// API route handler for POST /api/public/reviews/[id]/report
import { ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createReviewReportSchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Требуется авторизация", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  const review = await db.review.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      userId: true,
    },
  });

  if (!review || review.status !== ReviewStatus.ACTIVE) {
    return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
  }

  if (review.userId === session.id) {
    return NextResponse.json(
      { error: "Нельзя пожаловаться на собственный отзыв" },
      { status: 400 },
    );
  }

  const existing = await db.reviewReport.findUnique({
    where: { reviewId_reporterId: { reviewId: id, reporterId: session.id } },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Вы уже отправляли жалобу на этот отзыв", code: "ALREADY_REPORTED" },
      { status: 409 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createReviewReportSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность данных жалобы" }, { status: 400 });
  }

  await db.reviewReport.create({
    data: {
      reviewId: id,
      reporterId: session.id,
      reason: parsed.data.reason,
      comment: parsed.data.comment || null,
    },
  });

  return NextResponse.json({ ok: true, message: "Жалоба отправлена на рассмотрение" }, { status: 201 });
}

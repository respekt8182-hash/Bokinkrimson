import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  ExternalReviewModerationUserError,
  updateExternalReviewModeration,
} from "@/lib/external-review-moderation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const importedReviewActionSchema = z.object({
  action: z.enum(["approve", "reject", "duplicate", "delete", "edit"]),
  rating: z.number().min(0).max(5).optional(),
  text: z.string().trim().min(10).max(2000).optional(),
  authorName: z.string().trim().max(80).optional(),
  sourceUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine((value) => {
      if (!value) {
        return true;
      }

      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "Ссылка должна начинаться с http:// или https://"),
  sourceName: z.string().trim().max(80).optional().or(z.literal("")),
  guestCity: z.string().trim().max(80).optional().or(z.literal("")),
  reviewedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  reviewCategory: z.string().trim().max(40).optional().or(z.literal("")),
  reviewHighlight: z.string().trim().max(160).optional().or(z.literal("")),
});

function parseReviewDate(value?: string | null): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = importedReviewActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте данные отзыва" }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const result = await updateExternalReviewModeration({
      id,
      actorId: session.id,
      actorRole: "owner",
      action: parsed.data.action,
      rating: parsed.data.rating,
      text: parsed.data.text,
      authorName: parsed.data.authorName,
      sourceUrl: parsed.data.sourceUrl,
      sourceName: parsed.data.sourceName,
      guestCity: parsed.data.guestCity,
      reviewedAt: parseReviewDate(parsed.data.reviewedAt),
      reviewCategory: parsed.data.reviewCategory,
      reviewHighlight: parsed.data.reviewHighlight,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ExternalReviewModerationUserError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json({ error: "Не удалось изменить отзыв" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const result = await updateExternalReviewModeration({
      id,
      actorId: session.id,
      actorRole: "owner",
      action: "delete",
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ExternalReviewModerationUserError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json({ error: "Не удалось удалить отзыв" }, { status: 500 });
  }
}

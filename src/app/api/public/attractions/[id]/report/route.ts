// API route handler for POST /api/public/attractions/[id]/report
import { AttractionReportReason, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildPublicAttractionPath } from "@/lib/public-marketplace";
import { createAttractionReportSchema } from "@/lib/schemas";
import { getStaticAttractionById } from "@/lib/static-attractions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getMoscowDateStart(now = new Date()): Date {
  const shifted = new Date(now.getTime() + MOSCOW_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function formatDateForClient(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Moscow",
  }).format(date);
}

function getCooldownDays(recentReportsCount: number): number {
  if (recentReportsCount >= 5) {
    return 14;
  }

  if (recentReportsCount >= 3) {
    return 7;
  }

  if (recentReportsCount >= 2) {
    return 3;
  }

  return 1;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Сообщить об ошибке могут только авторизованные пользователи.", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const attraction = await getStaticAttractionById(id);

  if (!attraction || attraction.status !== "PUBLISHED" || !attraction.isPublishedVisible) {
    return NextResponse.json({ error: "Достопримечательность не найдена" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createAttractionReportSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Выберите тип ошибки в карточке" }, { status: 400 });
  }

  const today = getMoscowDateStart();
  const recentSince = addDays(today, -30);
  const [latestReport, recentReportsCount] = await Promise.all([
    db.attractionReport.findFirst({
      where: {
        attractionId: attraction.id,
        reporterId: session.id,
      },
      orderBy: { reportDate: "desc" },
      select: {
        reportDate: true,
        cooldownDays: true,
      },
    }),
    db.attractionReport.count({
      where: {
        attractionId: attraction.id,
        reporterId: session.id,
        reportDate: {
          gte: recentSince,
        },
      },
    }),
  ]);

  if (latestReport) {
    const allowedAt = addDays(latestReport.reportDate, Math.max(1, latestReport.cooldownDays));
    if (today.getTime() < allowedAt.getTime()) {
      return NextResponse.json(
        {
          error: `Вы уже отправляли сообщение по этой карточке. Следующая отправка будет доступна ${formatDateForClient(allowedAt)}.`,
          code: "COOLDOWN_ACTIVE",
          retryAfterDate: allowedAt.toISOString(),
        },
        { status: 429 },
      );
    }
  }

  const cooldownDays = getCooldownDays(recentReportsCount + 1);

  try {
    await db.attractionReport.create({
      data: {
        attractionId: attraction.id,
        attractionTitle: attraction.title,
        attractionPath: buildPublicAttractionPath(attraction),
        reporterId: session.id,
        reason: parsed.data.reason as AttractionReportReason,
        reportDate: today,
        cooldownDays,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        {
          error: "Вы уже отправляли сообщение по этой карточке сегодня.",
          code: "ALREADY_REPORTED_TODAY",
        },
        { status: 409 },
      );
    }

    throw error;
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Спасибо, мы передали сообщение администратору.",
    },
    { status: 201 },
  );
}

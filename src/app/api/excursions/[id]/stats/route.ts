// GET /api/excursions/[id]/stats — owner-only endpoint to fetch view statistics.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeUtcDate(date: Date) {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

function buildDailyViews(
  logs: { date: Date; count: number }[],
  fromDate: Date,
  days = 30,
) {
  const logMap = new Map(
    logs.map((l) => [l.date.toISOString().split("T")[0], l.count]),
  );
  const today = normalizeUtcDate(new Date());
  const rangeStart = new Date(today);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));
  const startDate = normalizeUtcDate(fromDate > rangeStart ? fromDate : rangeStart);
  const result: { date: string; count: number }[] = [];

  if (startDate > today) {
    return [{ date: today.toISOString().split("T")[0], count: 0 }];
  }

  for (const d = new Date(startDate); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    result.push({ date: dateStr, count: logMap.get(dateStr) ?? 0 });
  }
  return result;
}

export async function GET(_: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { id } = await context.params;

  const excursion = await db.excursion.findFirst({
    where: { id, ownerId: session.id },
    select: {
      id: true,
      profileViews: true,
      status: true,
      createdAt: true,
      moderatedAt: true,
    },
  });
  if (!excursion) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  const logs = await db.viewLog.findMany({
    where: { entityType: "excursion", entityId: id, date: { gte: thirtyDaysAgo } },
    orderBy: { date: "asc" },
    select: { date: true, count: true },
  });

  const publishedAt =
    excursion.status === "PUBLISHED"
      ? (excursion.moderatedAt ?? excursion.createdAt)
      : excursion.createdAt;

  const dailyViews = buildDailyViews(logs, publishedAt);
  const weeklyTotal = dailyViews.slice(-7).reduce((s, d) => s + d.count, 0);
  const monthlyTotal = dailyViews.reduce((s, d) => s + d.count, 0);

  return NextResponse.json({
    totalViews: excursion.profileViews,
    dailyViews,
    weeklyTotal,
    monthlyTotal,
  });
}

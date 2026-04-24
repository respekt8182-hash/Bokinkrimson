// POST /api/excursions/[id]/view — public endpoint to track excursion page views.
// Called client-side on excursion detail page mount; no auth required.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildPublishedExcursionVisibilityWhere } from "@/lib/public-visibility";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id?.trim()) {
    return NextResponse.json({ error: "Не указана экскурсия" }, { status: 400 });
  }

  const excursionId = id.trim();

  const updated = await db.excursion.updateMany({
    where: { id: excursionId, ...buildPublishedExcursionVisibilityWhere() },
    data: { profileViews: { increment: 1 } },
  });

  if (updated.count > 0) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await db.viewLog.upsert({
      where: {
        entityType_entityId_date: {
          entityType: "excursion",
          entityId: excursionId,
          date: today,
        },
      },
      create: { entityType: "excursion", entityId: excursionId, date: today, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true });
}

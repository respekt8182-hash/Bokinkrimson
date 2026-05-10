// POST /api/excursions/[id]/view — public endpoint to track excursion page views.
// Called client-side on excursion detail page mount; no auth required.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordListingViewEvent } from "@/lib/listing-analytics-service";
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

  const excursion = await db.excursion.findFirst({
    where: { id: excursionId, ...buildPublishedExcursionVisibilityWhere() },
    select: { ownerId: true },
  });

  if (excursion) {
    await db.excursion.update({
      where: { id: excursionId },
      data: { profileViews: { increment: 1 } },
      select: { id: true },
    });

    await recordListingViewEvent({
      entityType: "excursion",
      entityId: excursionId,
      ownerId: excursion.ownerId,
    });
  }

  return NextResponse.json({ ok: true });
}

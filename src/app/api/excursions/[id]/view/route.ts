// POST /api/excursions/[id]/view — public endpoint to track excursion page views.
// Called client-side on excursion detail page mount; no auth required.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordListingViewEvent } from "@/lib/listing-analytics-service";
import {
  buildListingAnalyticsVisitorKey,
  getListingAnalyticsSource,
  normalizeAnalyticsVisitorId,
  resolveListingAnalyticsActor,
} from "@/lib/listing-analytics-request";
import { buildPublishedExcursionVisibilityWhere } from "@/lib/public-visibility";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id?.trim()) {
    return NextResponse.json({ error: "Не указана экскурсия" }, { status: 400 });
  }

  const excursionId = id.trim();

  const excursion = await db.excursion.findFirst({
    where: { id: excursionId, ...buildPublishedExcursionVisibilityWhere() },
    select: { ownerId: true, publicId: true },
  });

  if (excursion) {
    const body = (await request.json().catch(() => null)) as { visitorId?: unknown } | null;
    const actor = await resolveListingAnalyticsActor(excursion.ownerId);
    const visitorId = normalizeAnalyticsVisitorId(body?.visitorId);

    const result = await recordListingViewEvent({
      entityType: "excursion",
      entityId: excursionId,
      entityPublicId: excursion.publicId ?? null,
      ownerId: excursion.ownerId,
      actorRole: actor.role,
      userId: actor.userId,
      visitorKey: buildListingAnalyticsVisitorKey({ request, actor, visitorId }),
      source: getListingAnalyticsSource(request),
    });

    if (result.countedForOwner) {
      await db.excursion.update({
        where: { id: excursionId },
        data: { profileViews: { increment: 1 } },
        select: { id: true },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

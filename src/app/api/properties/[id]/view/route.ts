// POST /api/properties/[id]/view — public endpoint to track property page views.
// Called client-side on property detail page mount; no auth required.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordListingViewEvent } from "@/lib/listing-analytics-service";
import {
  buildListingAnalyticsVisitorKey,
  getListingAnalyticsSource,
  normalizeAnalyticsVisitorId,
  resolveListingAnalyticsActor,
} from "@/lib/listing-analytics-request";
import { buildPublishedPropertyVisibilityWhere } from "@/lib/public-visibility";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id?.trim()) {
    return NextResponse.json({ error: "Не указан объект" }, { status: 400 });
  }

  const propertyId = id.trim();

  const property = await db.property.findFirst({
    where: {
      id: propertyId,
      ...buildPublishedPropertyVisibilityWhere(),
    },
    select: { ownerId: true, publicId: true },
  });

  if (property) {
    const body = (await request.json().catch(() => null)) as { visitorId?: unknown } | null;
    const actor = await resolveListingAnalyticsActor(property.ownerId);
    const visitorId = normalizeAnalyticsVisitorId(body?.visitorId);

    const result = await recordListingViewEvent({
      entityType: "property",
      entityId: propertyId,
      entityPublicId: property.publicId ?? null,
      ownerId: property.ownerId,
      actorRole: actor.role,
      userId: actor.userId,
      visitorKey: buildListingAnalyticsVisitorKey({ request, actor, visitorId }),
      source: getListingAnalyticsSource(request),
    });

    if (result.countedForOwner) {
      await db.property.update({
        where: { id: propertyId },
        data: { profileViews: { increment: 1 } },
        select: { id: true },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

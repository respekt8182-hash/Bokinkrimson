// POST /api/transfers/[id]/view - public endpoint to track transfer page views.
// Called client-side on transfer detail page mount; no auth required.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordListingViewEvent } from "@/lib/listing-analytics-service";
import {
  buildListingAnalyticsVisitorKey,
  getListingAnalyticsSource,
  normalizeAnalyticsVisitorId,
  resolveListingAnalyticsActor,
} from "@/lib/listing-analytics-request";
import { buildPublishedTransferVisibilityWhere } from "@/lib/public-visibility";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id?.trim()) {
    return NextResponse.json({ error: "Не указан трансфер" }, { status: 400 });
  }

  const transferId = id.trim();

  const transfer = await db.transfer.findFirst({
    where: {
      id: transferId,
      ...buildPublishedTransferVisibilityWhere(),
    },
    select: { ownerId: true, publicId: true },
  });

  if (transfer) {
    const body = (await request.json().catch(() => null)) as { visitorId?: unknown } | null;
    const actor = await resolveListingAnalyticsActor(transfer.ownerId);
    const visitorId = normalizeAnalyticsVisitorId(body?.visitorId);

    const result = await recordListingViewEvent({
      entityType: "transfer",
      entityId: transferId,
      entityPublicId: transfer.publicId ?? null,
      ownerId: transfer.ownerId,
      actorRole: actor.role,
      userId: actor.userId,
      visitorKey: buildListingAnalyticsVisitorKey({ request, actor, visitorId }),
      source: getListingAnalyticsSource(request),
    });

    if (result.countedForOwner) {
      await db.transfer.update({
        where: { id: transferId },
        data: { profileViews: { increment: 1 } },
        select: { id: true },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

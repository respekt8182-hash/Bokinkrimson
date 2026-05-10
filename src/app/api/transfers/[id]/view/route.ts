// POST /api/transfers/[id]/view - public endpoint to track transfer page views.
// Called client-side on transfer detail page mount; no auth required.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordListingViewEvent } from "@/lib/listing-analytics-service";
import { buildPublishedTransferVisibilityWhere } from "@/lib/public-visibility";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: RouteContext) {
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
    select: { ownerId: true },
  });

  if (transfer) {
    await db.transfer.update({
      where: { id: transferId },
      data: { profileViews: { increment: 1 } },
      select: { id: true },
    });

    await recordListingViewEvent({
      entityType: "transfer",
      entityId: transferId,
      ownerId: transfer.ownerId,
    });
  }

  return NextResponse.json({ ok: true });
}

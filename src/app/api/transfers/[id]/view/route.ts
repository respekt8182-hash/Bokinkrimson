// POST /api/transfers/[id]/view - public endpoint to track transfer page views.
// Called client-side on transfer detail page mount; no auth required.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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

  const updated = await db.transfer.updateMany({
    where: {
      id: transferId,
      ...buildPublishedTransferVisibilityWhere(),
    },
    data: { profileViews: { increment: 1 } },
  });

  if (updated.count > 0) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await db.viewLog.upsert({
      where: {
        entityType_entityId_date: {
          entityType: "transfer",
          entityId: transferId,
          date: today,
        },
      },
      create: { entityType: "transfer", entityId: transferId, date: today, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true });
}

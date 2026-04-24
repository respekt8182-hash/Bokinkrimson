// POST /api/properties/[id]/view — public endpoint to track property page views.
// Called client-side on property detail page mount; no auth required.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildPublishedPropertyVisibilityWhere } from "@/lib/public-visibility";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id?.trim()) {
    return NextResponse.json({ error: "Не указан объект" }, { status: 400 });
  }

  const propertyId = id.trim();

  const updated = await db.property.updateMany({
    where: {
      id: propertyId,
      ...buildPublishedPropertyVisibilityWhere(),
    },
    data: { profileViews: { increment: 1 } },
  });

  if (updated.count > 0) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await db.viewLog.upsert({
      where: {
        entityType_entityId_date: {
          entityType: "property",
          entityId: propertyId,
          date: today,
        },
      },
      create: { entityType: "property", entityId: propertyId, date: today, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true });
}

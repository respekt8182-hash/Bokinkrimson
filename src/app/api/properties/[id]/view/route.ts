// POST /api/properties/[id]/view — public endpoint to track property page views.
// Called client-side on property detail page mount; no auth required.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordListingViewEvent } from "@/lib/listing-analytics-service";
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

  const property = await db.property.findFirst({
    where: {
      id: propertyId,
      ...buildPublishedPropertyVisibilityWhere(),
    },
    select: { ownerId: true },
  });

  if (property) {
    await db.property.update({
      where: { id: propertyId },
      data: { profileViews: { increment: 1 } },
      select: { id: true },
    });

    await recordListingViewEvent({
      entityType: "property",
      entityId: propertyId,
      ownerId: property.ownerId,
    });
  }

  return NextResponse.json({ ok: true });
}

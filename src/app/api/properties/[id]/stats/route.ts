// GET /api/properties/[id]/stats — owner-only endpoint to fetch view statistics.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getListingStatsData } from "@/lib/listing-statistics";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { id } = await context.params;

  const property = await db.property.findFirst({
    where: { id, ownerId: session.id, ownerDeletedAt: null },
    select: {
      id: true,
      profileViews: true,
      status: true,
      createdAt: true,
      moderatedAt: true,
    },
  });
  if (!property) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const publishedAt =
    property.status === "PUBLISHED"
      ? (property.moderatedAt ?? property.createdAt)
      : property.createdAt;

  return NextResponse.json(
    await getListingStatsData({
      entityType: "property",
      entityId: id,
      totalViews: property.profileViews,
      fromDate: publishedAt,
    }),
  );
}

// GET /api/transfers/[id]/stats - owner-only endpoint to fetch view statistics.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getListingStatsData } from "@/lib/listing-statistics";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await context.params;

  const transfer = await db.transfer.findFirst({
    where: { id, ownerId: session.id },
    select: {
      id: true,
      profileViews: true,
      status: true,
      createdAt: true,
      publishedAt: true,
    },
  });

  if (!transfer) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const publishedAt =
    transfer.status === "PUBLISHED"
      ? (transfer.publishedAt ?? transfer.createdAt)
      : transfer.createdAt;

  return NextResponse.json(
    await getListingStatsData({
      entityType: "transfer",
      entityId: id,
      totalViews: transfer.profileViews,
      fromDate: publishedAt,
    }),
  );
}

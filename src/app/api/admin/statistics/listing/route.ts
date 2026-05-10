import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { normalizeListingEntityType, type ListingEntityType } from "@/lib/listing-analytics";
import { getListingStatsData } from "@/lib/listing-statistics";

type StatsTarget = {
  totalViews: number;
  fromDate: Date;
};

async function getStatsTarget(
  entityType: ListingEntityType,
  entityId: string,
): Promise<StatsTarget | null> {
  if (entityType === "property") {
    const property = await db.property.findUnique({
      where: { id: entityId },
      select: {
        profileViews: true,
        status: true,
        createdAt: true,
        moderatedAt: true,
      },
    });

    if (!property) {
      return null;
    }

    return {
      totalViews: property.profileViews,
      fromDate:
        property.status === "PUBLISHED"
          ? (property.moderatedAt ?? property.createdAt)
          : property.createdAt,
    };
  }

  if (entityType === "excursion") {
    const excursion = await db.excursion.findUnique({
      where: { id: entityId },
      select: {
        profileViews: true,
        status: true,
        createdAt: true,
        moderatedAt: true,
      },
    });

    if (!excursion) {
      return null;
    }

    return {
      totalViews: excursion.profileViews,
      fromDate:
        excursion.status === "PUBLISHED"
          ? (excursion.moderatedAt ?? excursion.createdAt)
          : excursion.createdAt,
    };
  }

  const transfer = await db.transfer.findUnique({
    where: { id: entityId },
    select: {
      profileViews: true,
      status: true,
      createdAt: true,
      publishedAt: true,
    },
  });

  if (!transfer) {
    return null;
  }

  return {
    totalViews: transfer.profileViews,
    fromDate:
      transfer.status === "PUBLISHED" ? (transfer.publishedAt ?? transfer.createdAt) : transfer.createdAt,
  };
}

export async function GET(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const url = new URL(request.url);
  const entityType = normalizeListingEntityType(url.searchParams.get("entityType"));
  const entityId = url.searchParams.get("id")?.trim() ?? "";

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "Некорректная карточка" }, { status: 400 });
  }

  const target = await getStatsTarget(entityType, entityId);

  if (!target) {
    return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });
  }

  const stats = await getListingStatsData({
    entityType,
    entityId,
    totalViews: target.totalViews,
    fromDate: target.fromDate,
  });

  return NextResponse.json(stats);
}

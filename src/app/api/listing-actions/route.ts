import { NextResponse } from "next/server";
import { db, isDatabaseTableAvailable } from "@/lib/db";
import {
  normalizeListingActionType,
  normalizeListingEntityType,
  type ListingEntityType,
} from "@/lib/listing-analytics";
import {
  buildPublishedExcursionVisibilityWhere,
  buildPublishedPropertyVisibilityWhere,
  buildPublishedTransferVisibilityWhere,
} from "@/lib/public-visibility";

async function isPublicListingAvailable(entityType: ListingEntityType, entityId: string) {
  if (entityType === "property") {
    return (
      (await db.property.count({
        where: {
          id: entityId,
          ...buildPublishedPropertyVisibilityWhere(),
        },
      })) > 0
    );
  }

  if (entityType === "excursion") {
    return (
      (await db.excursion.count({
        where: {
          id: entityId,
          ...buildPublishedExcursionVisibilityWhere(),
        },
      })) > 0
    );
  }

  return (
    (await db.transfer.count({
      where: {
        id: entityId,
        ...buildPublishedTransferVisibilityWhere(),
      },
    })) > 0
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    entityType?: unknown;
    entityId?: unknown;
    actionType?: unknown;
  } | null;

  const entityType = normalizeListingEntityType(body?.entityType);
  const actionType = normalizeListingActionType(body?.actionType);
  const entityId = typeof body?.entityId === "string" ? body.entityId.trim() : "";

  if (!entityType || !entityId || !actionType) {
    return NextResponse.json({ error: "Некорректная метрика" }, { status: 400 });
  }

  if (!(await isPublicListingAvailable(entityType, entityId))) {
    return NextResponse.json({ ok: true });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (!(await isDatabaseTableAvailable("EngagementLog"))) {
    return NextResponse.json({ ok: true });
  }

  try {
    await db.engagementLog.upsert({
      where: {
        entityType_entityId_actionType_date: {
          entityType,
          entityId,
          actionType,
          date: today,
        },
      },
      create: {
        entityType,
        entityId,
        actionType,
        date: today,
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
    });
  } catch {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  normalizeListingActionType,
  normalizeListingEntityType,
  type ListingEntityType,
} from "@/lib/listing-analytics";
import { recordListingActionEvent } from "@/lib/listing-analytics-service";
import {
  buildPublishedExcursionVisibilityWhere,
  buildPublishedPropertyVisibilityWhere,
  buildPublishedTransferVisibilityWhere,
} from "@/lib/public-visibility";

async function getPublicListingOwnerId(
  entityType: ListingEntityType,
  entityId: string,
): Promise<string | null> {
  if (entityType === "property") {
    const property = await db.property.findFirst({
      where: {
        id: entityId,
        ...buildPublishedPropertyVisibilityWhere(),
      },
      select: { ownerId: true },
    });

    return property?.ownerId ?? null;
  }

  if (entityType === "excursion") {
    const excursion = await db.excursion.findFirst({
      where: {
        id: entityId,
        ...buildPublishedExcursionVisibilityWhere(),
      },
      select: { ownerId: true },
    });

    return excursion?.ownerId ?? null;
  }

  const transfer = await db.transfer.findFirst({
    where: {
      id: entityId,
      ...buildPublishedTransferVisibilityWhere(),
    },
    select: { ownerId: true },
  });

  return transfer?.ownerId ?? null;
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

  const ownerId = await getPublicListingOwnerId(entityType, entityId);

  if (!ownerId) {
    return NextResponse.json({ ok: true });
  }

  try {
    await recordListingActionEvent({
      entityType,
      entityId,
      actionType,
      ownerId,
    });
  } catch {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

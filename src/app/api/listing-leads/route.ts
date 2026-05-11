import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeListingEntityType, type ListingEntityType } from "@/lib/listing-analytics";
import { createListingLead } from "@/lib/listing-analytics-service";
import {
  buildListingAnalyticsVisitorKey,
  getListingAnalyticsSource,
  normalizeAnalyticsVisitorId,
  resolveListingAnalyticsActor,
} from "@/lib/listing-analytics-request";
import {
  buildPublishedExcursionVisibilityWhere,
  buildPublishedPropertyVisibilityWhere,
  buildPublishedTransferVisibilityWhere,
} from "@/lib/public-visibility";

async function getPublicListing(
  entityType: ListingEntityType,
  entityId: string,
): Promise<{ ownerId: string; publicId: number | null } | null> {
  if (entityType === "property") {
    const property = await db.property.findFirst({
      where: {
        id: entityId,
        ...buildPublishedPropertyVisibilityWhere(),
      },
      select: { ownerId: true, publicId: true },
    });

    return property ? { ownerId: property.ownerId, publicId: property.publicId ?? null } : null;
  }

  if (entityType === "excursion") {
    const excursion = await db.excursion.findFirst({
      where: {
        id: entityId,
        ...buildPublishedExcursionVisibilityWhere(),
      },
      select: { ownerId: true, publicId: true },
    });

    return excursion ? { ownerId: excursion.ownerId, publicId: excursion.publicId ?? null } : null;
  }

  const transfer = await db.transfer.findFirst({
    where: {
      id: entityId,
      ...buildPublishedTransferVisibilityWhere(),
    },
    select: { ownerId: true, publicId: true },
  });

  return transfer ? { ownerId: transfer.ownerId, publicId: transfer.publicId ?? null } : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    entityType?: unknown;
    entityId?: unknown;
    visitorId?: unknown;
  } | null;

  const entityType = normalizeListingEntityType(body?.entityType);
  const entityId = typeof body?.entityId === "string" ? body.entityId.trim() : "";

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "Некорректная карточка" }, { status: 400 });
  }

  const listing = await getPublicListing(entityType, entityId);
  if (!listing) {
    return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });
  }

  const actor = await resolveListingAnalyticsActor(listing.ownerId);
  const visitorId = normalizeAnalyticsVisitorId(body?.visitorId);
  const lead = await createListingLead({
    entityType,
    entityId,
    entityPublicId: listing.publicId,
    ownerId: listing.ownerId,
    actorRole: actor.role,
    userId: actor.userId,
    visitorKey: buildListingAnalyticsVisitorKey({ request, actor, visitorId }),
    source: getListingAnalyticsSource(request),
  }).catch((error) => {
    console.error("[listing-leads/create]", entityType, entityId, error);
    return null;
  });

  if (!lead) {
    return NextResponse.json({ error: "Не удалось создать номер обращения" }, { status: 503 });
  }

  return NextResponse.json({
    leadNumber: lead.leadNumber,
    entityPublicId: lead.entityPublicId,
    createdAt: lead.createdAt,
  });
}

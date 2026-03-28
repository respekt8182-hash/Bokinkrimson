// Owner payment quote endpoint: computes tariff preview and readiness snapshot without creating a payment.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTariffQuote } from "@/lib/payments";
import { getPropertyProgress } from "@/lib/properties";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;

  const property = await db.property.findUnique({
    where: { id },
    include: {
      media: {
        where: { roomId: null },
        select: { id: true, type: true, url: true, sortOrder: true },
      },
      rooms: {
        where: { isActive: true },
        select: {
          id: true,
          prices: {
            select: { id: true },
          },
        },
      },
      amenities: {
        include: { amenity: true },
      },
      customAmenities: {
        select: { name: true },
      },
    },
  });

  if (!property || property.ownerId !== session.id || property.ownerDeletedAt) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const progress = getPropertyProgress(property);
  const roomCount = property.rooms.length;
  const quote =
    roomCount > 0
      ? getTariffQuote({
          roomCount,
          propertyType: property.type,
        })
      : null;

  return NextResponse.json({
    quote,
    readiness: {
      ready: progress.lastCompletedStep >= 10 && roomCount > 0,
      progressStep: progress.lastCompletedStep,
      roomCount,
    },
  });
}
import { PropertyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

function readPropertyIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

// Favorite properties API:
// - GET returns current user's favorite property ids
// - POST adds one property to favorites
export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const propertyIds = readPropertyIds(searchParams.get("propertyIds"));

  const rows = await db.favoriteProperty.findMany({
    where: {
      userId: session.id,
      ...(propertyIds.length > 0 ? { propertyId: { in: propertyIds } } : {}),
    },
    select: {
      propertyId: true,
    },
  });

  return NextResponse.json({ ids: rows.map((item) => item.propertyId) });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { propertyId?: unknown } | null;
  const propertyId = typeof body?.propertyId === "string" ? body.propertyId.trim() : "";

  if (!propertyId) {
    return NextResponse.json({ error: "Укажите объект для избранного" }, { status: 400 });
  }

  const property = await db.property.findFirst({
    where: {
      id: propertyId,
      status: PropertyStatus.PUBLISHED,
      ownerDeletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!property) {
    return NextResponse.json({ error: "Объект не найден или не опубликован" }, { status: 404 });
  }

  const existing = await db.favoriteProperty.findUnique({
    where: { userId_propertyId: { userId: session.id, propertyId } },
    select: { userId: true },
  });

  if (!existing) {
    await db.$transaction([
      db.favoriteProperty.create({ data: { userId: session.id, propertyId } }),
      db.property.update({
        where: { id: propertyId },
        data: { favoritesCount: { increment: 1 } },
      }),
    ]);
  }

  return NextResponse.json({ ok: true, isFavorite: true });
}

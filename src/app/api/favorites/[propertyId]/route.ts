// API route handler for /api/favorites/[propertyId].
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ propertyId: string }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { propertyId } = await context.params;

  if (!propertyId?.trim()) {
    return NextResponse.json({ error: "Не указан объект" }, { status: 400 });
  }

  const deleted = await db.favoriteProperty.deleteMany({
    where: {
      userId: session.id,
      propertyId: propertyId.trim(),
    },
  });

  if (deleted.count > 0) {
    await db.$executeRaw`UPDATE "Property" SET "favoritesCount" = GREATEST(0, "favoritesCount" - 1) WHERE id = ${propertyId.trim()}`;
  }

  return NextResponse.json({ ok: true, isFavorite: false });
}

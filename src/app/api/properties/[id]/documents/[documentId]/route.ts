// Property document endpoint: owner-only delete for a single uploaded object document.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteFromStorage } from "@/lib/storage";

type RouteContext = {
  params: Promise<{
    id: string;
    documentId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, documentId } = await context.params;
  const document = await db.propertyDocument.findUnique({
    where: { id: documentId },
    include: {
      property: {
        select: {
          id: true,
          ownerId: true,
          ownerDeletedAt: true,
        },
      },
    },
  });

  if (
    !document ||
    document.propertyId !== id ||
    document.property.ownerId !== session.id ||
    document.property.ownerDeletedAt
  ) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }

  await db.propertyDocument.delete({
    where: {
      id: document.id,
    },
  });

  await deleteFromStorage(document.storageKey).catch(() => null);

  return NextResponse.json({ ok: true });
}

// API route handler for /api/media/[mediaId].
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import { normalizePropertyMediaSortOrder, normalizeRoomMediaSortOrder } from "@/lib/media";
import { markPropertyNeedsRemoderationAfterOwnerEdit } from "@/lib/properties";
import { deleteFromStorage } from "@/lib/storage";

type RouteContext = {
  params: Promise<{ mediaId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { mediaId } = await context.params;

  const media = await db.media.findUnique({
    where: { id: mediaId },
    include: {
      property: {
        select: {
          id: true,
          ownerId: true,
        },
      },
      room: {
        select: {
          id: true,
          propertyId: true,
          property: {
            select: {
              ownerId: true,
            },
          },
        },
      },
    },
  });

  const isPropertyOwner = Boolean(
    media?.property && (editor.isAdmin || media.property.ownerId === editor.id),
  );
  const isRoomOwner = Boolean(
    media?.room && (editor.isAdmin || media.room.property.ownerId === editor.id),
  );

  if (!media || (!isPropertyOwner && !isRoomOwner)) {
    return NextResponse.json({ error: "Медиа не найдено" }, { status: 404 });
  }

  await db.media.delete({
    where: { id: media.id },
  });

  if (media.room) {
    await normalizeRoomMediaSortOrder(db, media.room.id);
  } else if (media.property) {
    await normalizePropertyMediaSortOrder(db, media.property.id);
  }

  const propertyIdForStatusUpdate = media.property?.id ?? media.room?.propertyId ?? null;
  if (propertyIdForStatusUpdate) {
    await markPropertyNeedsRemoderationAfterOwnerEdit(db, propertyIdForStatusUpdate);
  }

  await deleteFromStorage(media.storageKey).catch(() => null);

  return NextResponse.json({ ok: true });
}

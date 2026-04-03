// Room media endpoint: list and upload room-level photos/videos with limits and image conversion.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import {
  detectMediaTypeFromUpload,
  getMediaLimit,
  serializeMedia,
  validateMediaFile,
} from "@/lib/media";
import {
  convertImageUploadToWebp,
  isSupportedPhotoUpload,
  sanitizeUploadedFileName,
} from "@/lib/image-convert";
import {
  getMediaLimitExceededError,
  getUnsupportedAccommodationPhotoFormatError,
} from "@/lib/photo-upload";
import {
  markPropertyNeedsRemoderationAfterOwnerEdit,
  preparePropertyForPublishedOwnerEdit,
} from "@/lib/properties";
import { uploadToStorage } from "@/lib/storage";

type RouteContext = {
  params: Promise<{ id: string; roomId: string }>;
};

async function getAccessibleRoom(
  propertyId: string,
  roomId: string,
  editor: Awaited<ReturnType<typeof getEditorSession>>,
) {
  return db.room.findFirst({
    where: {
      id: roomId,
      propertyId,
      isActive: true,
      property: editor?.isAdmin
        ? {
            ownerDeletedAt: null,
          }
        : {
            ownerId: editor?.id,
            ownerDeletedAt: null,
          },
    },
    select: { id: true, propertyId: true },
  });
}

async function listRoomMedia(roomId: string) {
  const items = await db.media.findMany({
    where: { roomId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return items.map(serializeMedia);
}

export async function GET(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId } = await context.params;
  const room = await getAccessibleRoom(id, roomId, editor);

  if (!room) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  return NextResponse.json({ items: await listRoomMedia(room.id) });
}

export async function POST(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id, roomId } = await context.params;
  const room = await getAccessibleRoom(id, roomId, editor);

  if (!room) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  const originalName = file.name || "file";
  const mediaType = detectMediaTypeFromUpload(file.type, originalName);

  if (!mediaType) {
    return NextResponse.json(
      { error: "Поддерживаются только изображения и видео" },
      { status: 400 },
    );
  }

  if (
    mediaType === "IMAGE" &&
    !isSupportedPhotoUpload({ mimeType: file.type, fileName: originalName })
  ) {
    return NextResponse.json(
      { error: getUnsupportedAccommodationPhotoFormatError() },
      { status: 400 },
    );
  }

  const sizeError = validateMediaFile({
    mediaType,
    size: file.size,
    mimeType: file.type,
    fileName: originalName,
  });

  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 400 });
  }

  await preparePropertyForPublishedOwnerEdit(db, room.propertyId);

  const existingCount = await db.media.count({
    where: {
      roomId: room.id,
      type: mediaType,
    },
  });

  const limit = getMediaLimit("room", mediaType);
  if (existingCount >= limit) {
    return NextResponse.json(
      {
        error: getMediaLimitExceededError({
          owner: "room",
          mediaType,
          limit,
        }),
      },
      { status: 400 },
    );
  }

  const rawBytes = Buffer.from(await file.arrayBuffer());
  if (
    mediaType === "IMAGE" &&
    !isSupportedPhotoUpload({ mimeType: file.type, fileName: originalName, bytes: rawBytes })
  ) {
    return NextResponse.json(
      { error: getUnsupportedAccommodationPhotoFormatError() },
      { status: 400 },
    );
  }

  const sanitizedName = sanitizeUploadedFileName(originalName);
  let uploadPayload: {
    bytes: Buffer;
    mimeType: string;
    fileName: string;
    converted: boolean;
  };

  if (mediaType === "IMAGE") {
    try {
      uploadPayload = await convertImageUploadToWebp({
        bytes: rawBytes,
        mimeType: file.type,
        fileName: sanitizedName,
      });
    } catch {
      return NextResponse.json(
        { error: "Не удалось обработать фото. Попробуйте другое изображение." },
        { status: 400 },
      );
    }
  } else {
    uploadPayload = {
      bytes: rawBytes,
      mimeType: file.type || "application/octet-stream",
      fileName: sanitizedName,
      converted: false,
    };
  }

  const storageKey = `properties/${room.propertyId}/rooms/${room.id}/${Date.now()}-${crypto.randomUUID()}-${uploadPayload.fileName}`;
  const uploaded = await uploadToStorage({
    key: storageKey,
    body: uploadPayload.bytes,
    contentType: uploadPayload.mimeType,
  });

  const maxSort =
    (
      await db.media.aggregate({
        where: {
          roomId: room.id,
        },
        _max: { sortOrder: true },
      })
    )._max.sortOrder ?? 0;

  await db.media.create({
    data: {
      propertyId: room.propertyId,
      roomId: room.id,
      type: mediaType,
      url: uploaded.url,
      storageKey,
      mimeType: uploadPayload.mimeType,
      fileSize: uploadPayload.bytes.byteLength,
      originalName,
      sortOrder: maxSort + 1,
    },
  });

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, room.propertyId);

  return NextResponse.json({ items: await listRoomMedia(room.id) }, { status: 201 });
}

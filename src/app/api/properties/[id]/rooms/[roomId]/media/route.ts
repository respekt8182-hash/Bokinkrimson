// Room media endpoint: list and upload room-level photos/videos with limits and image conversion.
import { MediaType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import {
  convertImageUploadToWebp,
  replaceFileExtension,
} from "@/lib/image-convert";
import {
  accommodationVideoUploadSizeLimitBytes,
  detectMediaType,
  getMediaLimit,
  serializeMedia,
  validateMediaFile,
} from "@/lib/media";
import { getMediaLimitExceededError } from "@/lib/photo-upload";
import {
  markPropertyNeedsRemoderationAfterOwnerEdit,
  preparePropertyForPublishedOwnerEdit,
} from "@/lib/properties";
import { deleteFromStorage, uploadToStorage } from "@/lib/storage";
import { validateUploadFile } from "@/lib/upload-validation";

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

function getUploadErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Failed to upload file";
  }

  if (error.message === "FILE_EMPTY") {
    return "File is empty";
  }

  if (error.message === "FILE_TOO_LARGE") {
    return "File exceeds the allowed size";
  }

  if (error.message === "UNSUPPORTED_FILE_TYPE") {
    return "Only safe image and video files are allowed";
  }

  return "Failed to upload file";
}

export async function GET(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id, roomId } = await context.params;
  const room = await getAccessibleRoom(id, roomId, editor);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ items: await listRoomMedia(room.id) });
}

export async function POST(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id, roomId } = await context.params;
  const room = await getAccessibleRoom(id, roomId, editor);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File was not provided" }, { status: 400 });
  }

  let validated;

  try {
    validated = await validateUploadFile({
      file,
      allowedKinds: ["image", "video"],
      maxSizeBytes: accommodationVideoUploadSizeLimitBytes,
    });
  } catch (error) {
    return NextResponse.json({ error: getUploadErrorMessage(error) }, { status: 400 });
  }

  const mediaType = detectMediaType(validated.detectedMimeType);
  if (!mediaType) {
    return NextResponse.json(
      { error: "Only safe image and video files are allowed" },
      { status: 400 },
    );
  }

  const sizeError = validateMediaFile({
    mediaType,
    size: validated.size,
    mimeType: validated.detectedMimeType,
    fileName: validated.sanitizedFileName,
  });

  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 400 });
  }

  await preparePropertyForPublishedOwnerEdit(db, room.propertyId);

  const rawBytes = Buffer.from(await file.arrayBuffer());
  let uploadPayload: {
    bytes: Buffer;
    mimeType: string;
    fileName: string;
  };

  if (mediaType === MediaType.IMAGE) {
    try {
      uploadPayload = await convertImageUploadToWebp({
        bytes: rawBytes,
        mimeType: validated.detectedMimeType,
        fileName: validated.sanitizedFileName,
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to process the image. Please try a different file." },
        { status: 400 },
      );
    }
  } else {
    uploadPayload = {
      bytes: rawBytes,
      mimeType: validated.detectedMimeType,
      fileName: replaceFileExtension(validated.sanitizedFileName, validated.detectedExtension),
    };
  }

  const storageKey = `properties/${room.propertyId}/rooms/${room.id}/${Date.now()}-${crypto.randomUUID()}-${uploadPayload.fileName}`;
  const uploaded = await uploadToStorage({
    key: storageKey,
    body: uploadPayload.bytes,
    contentType: uploadPayload.mimeType,
    visibility: "public",
    contentDisposition: "inline",
    cacheControl: "public, max-age=31536000, immutable",
  });

  try {
    await db.$transaction(
      async (tx) => {
        const existingCount = await tx.media.count({
          where: {
            roomId: room.id,
            type: mediaType,
          },
        });

        const limit = getMediaLimit("room", mediaType);
        if (existingCount >= limit) {
          throw new Error("MEDIA_LIMIT_EXCEEDED");
        }

        const maxSort =
          (
            await tx.media.aggregate({
              where: {
                roomId: room.id,
              },
              _max: { sortOrder: true },
            })
          )._max.sortOrder ?? 0;

        await tx.media.create({
          data: {
            propertyId: room.propertyId,
            roomId: room.id,
            type: mediaType,
            url: uploaded.url ?? "",
            storageKey,
            mimeType: uploadPayload.mimeType,
            fileSize: uploadPayload.bytes.byteLength,
            originalName: uploadPayload.fileName,
            sortOrder: maxSort + 1,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    await deleteFromStorage(storageKey).catch(() => null);

    if (error instanceof Error && error.message === "MEDIA_LIMIT_EXCEEDED") {
      return NextResponse.json(
        {
          error: getMediaLimitExceededError({
            owner: "room",
            mediaType,
            limit: getMediaLimit("room", mediaType),
          }),
        },
        { status: 400 },
      );
    }

    throw error;
  }

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, room.propertyId);

  return NextResponse.json({ items: await listRoomMedia(room.id) }, { status: 201 });
}

// Property media endpoint: list and upload object-level photos/videos with limits and image conversion.
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
  params: Promise<{ id: string }>;
};

async function ensurePropertyAccess(
  propertyId: string,
  editor: Awaited<ReturnType<typeof getEditorSession>>,
) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, ownerId: true, ownerDeletedAt: true },
  });

  if (!property || property.ownerDeletedAt) {
    return null;
  }

  if (!editor?.isAdmin && property.ownerId !== editor?.id) {
    return null;
  }

  return property;
}

async function listPropertyMedia(propertyId: string) {
  const items = await db.media.findMany({
    where: {
      propertyId,
      roomId: null,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return items.map(serializeMedia);
}

export async function GET(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await ensurePropertyAccess(id, editor);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  return NextResponse.json({ items: await listPropertyMedia(property.id) });
}

export async function POST(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await ensurePropertyAccess(id, editor);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
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

  await preparePropertyForPublishedOwnerEdit(db, property.id);

  const existingCount = await db.media.count({
    where: {
      propertyId: property.id,
      roomId: null,
      type: mediaType,
    },
  });

  const limit = getMediaLimit("property", mediaType);
  if (existingCount >= limit) {
    return NextResponse.json(
      {
        error: getMediaLimitExceededError({
          owner: "property",
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

  const storageKey = `properties/${property.id}/${Date.now()}-${crypto.randomUUID()}-${uploadPayload.fileName}`;
  const uploaded = await uploadToStorage({
    key: storageKey,
    body: uploadPayload.bytes,
    contentType: uploadPayload.mimeType,
  });

  const maxSort =
    (
      await db.media.aggregate({
        where: {
          propertyId: property.id,
          roomId: null,
        },
        _max: { sortOrder: true },
      })
    )._max.sortOrder ?? 0;

  await db.media.create({
    data: {
      propertyId: property.id,
      roomId: null,
      type: mediaType,
      url: uploaded.url,
      storageKey,
      mimeType: uploadPayload.mimeType,
      fileSize: uploadPayload.bytes.byteLength,
      originalName,
      sortOrder: maxSort + 1,
    },
  });

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, property.id);

  return NextResponse.json({ items: await listPropertyMedia(property.id) }, { status: 201 });
}

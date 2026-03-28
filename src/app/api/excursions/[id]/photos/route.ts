// API route handler for /api/excursions/[id]/photos.
import { NextResponse } from "next/server";
import { imageSizeLimitBytes } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeExcursion } from "@/lib/excursions";
import {
  convertImageUploadToWebp,
  isSupportedPhotoUpload,
  sanitizeUploadedFileName,
  shouldEnforceJpegPngSizeLimit,
} from "@/lib/image-convert";
import { uploadToStorage } from "@/lib/storage";

const excursionPhotoLimit = 6;

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function ensureOwner(excursionId: string, userId: string) {
  const excursion = await db.excursion.findUnique({
    where: { id: excursionId },
    select: { id: true, ownerId: true, photoUrls: true },
  });

  if (!excursion || excursion.ownerId !== userId) {
    return null;
  }

  return excursion;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const excursion = await ensureOwner(id, session.id);

  if (!excursion) {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }

  if (excursion.photoUrls.length >= excursionPhotoLimit) {
    return NextResponse.json(
      { error: `Максимум ${excursionPhotoLimit} фото для экскурсии` },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  const originalName = file.name || "file";

  if (!isSupportedPhotoUpload({ mimeType: file.type, fileName: originalName })) {
    return NextResponse.json(
      { error: "Формат не поддерживается. Загрузите JPG, PNG или HEIC." },
      { status: 400 },
    );
  }

  if (
    shouldEnforceJpegPngSizeLimit({ mimeType: file.type, fileName: originalName }) &&
    file.size > imageSizeLimitBytes
  ) {
    return NextResponse.json(
      { error: "Фотография превышает допустимый размер. Зайдите на сайт для сжатия фотографий, сожмите файл и загрузите его сюда повторно" },
      { status: 400 },
    );
  }

  const rawBytes = Buffer.from(await file.arrayBuffer());
  if (!isSupportedPhotoUpload({ mimeType: file.type, fileName: originalName, bytes: rawBytes })) {
    return NextResponse.json(
      { error: "Формат не поддерживается. Загрузите JPG, PNG или HEIC." },
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

  const storageKey = `excursions/${excursion.id}/photos/${Date.now()}-${crypto.randomUUID()}-${uploadPayload.fileName}`;
  const uploaded = await uploadToStorage({
    key: storageKey,
    body: uploadPayload.bytes,
    contentType: uploadPayload.mimeType,
  });

  const updated = await db.excursion.update({
    where: { id: excursion.id },
    data: {
      photoUrls: {
        push: uploaded.url,
      },
    },
  });

  return NextResponse.json({ item: serializeExcursion(updated) }, { status: 201 });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import { convertImageUploadToWebp, replaceFileExtension } from "@/lib/image-convert";
import {
  accommodationPhotoUploadSizeLimitBytes,
  getAccommodationPhotoUploadSizeError,
  getAccommodationPhotoUploadSizeLimitBytes,
} from "@/lib/photo-upload";
import {
  createRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";
import { uploadToStorage } from "@/lib/storage";
import { validateUploadFile } from "@/lib/upload-validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const transferPhotoUploadLimiter = createRateLimiter({
  id: "transfer-photo-upload",
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
});

function getUploadErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Не удалось загрузить фото транспорта.";
  }

  if (error.message === "FILE_EMPTY") {
    return "Файл пустой.";
  }

  if (error.message === "FILE_TOO_LARGE") {
    return getAccommodationPhotoUploadSizeError();
  }

  if (error.message === "UNSUPPORTED_FILE_TYPE") {
    return "Загрузите изображение в безопасном формате.";
  }

  return "Не удалось загрузить фото транспорта.";
}

export async function POST(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  const ip = getRequestIp(request);

  try {
    const limit = await transferPhotoUploadLimiter.limit(`${editor.id}:${ip}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Слишком много попыток загрузки. Повторите через ${limit.retryAfterSeconds} сек.` },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }
  } catch (error) {
    if (
      error instanceof RateLimitConfigurationError ||
      error instanceof RateLimitBackendUnavailableError
    ) {
      return NextResponse.json({ error: "Сервис временно недоступен." }, { status: 503 });
    }

    throw error;
  }

  const { id } = await context.params;
  const transfer = await db.transfer.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
  });

  if (!transfer || (!editor.isAdmin && transfer.ownerId !== editor.id)) {
    return NextResponse.json({ error: "Карточка трансфера не найдена." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан." }, { status: 400 });
  }

  let validated;

  try {
    validated = await validateUploadFile({
      file,
      allowedKinds: ["image"],
      maxSizeBytes: accommodationPhotoUploadSizeLimitBytes,
    });
  } catch (error) {
    return NextResponse.json({ error: getUploadErrorMessage(error) }, { status: 400 });
  }

  if (
    validated.size >
    getAccommodationPhotoUploadSizeLimitBytes({
      mimeType: validated.detectedMimeType,
      fileName: validated.sanitizedFileName,
    })
  ) {
    return NextResponse.json({ error: getAccommodationPhotoUploadSizeError() }, { status: 400 });
  }

  let uploadPayload: {
    bytes: Buffer;
    mimeType: string;
    fileName: string;
  };

  try {
    uploadPayload = await convertImageUploadToWebp({
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: validated.detectedMimeType,
      fileName: replaceFileExtension(validated.sanitizedFileName, validated.detectedExtension),
    });
  } catch {
    return NextResponse.json(
      { error: "Не удалось обработать изображение. Попробуйте другой файл." },
      { status: 400 },
    );
  }

  const storageKey = `transfers/${transfer.id}/photos/${Date.now()}-${crypto.randomUUID()}-${uploadPayload.fileName}`;
  const uploaded = await uploadToStorage({
    key: storageKey,
    body: uploadPayload.bytes,
    contentType: uploadPayload.mimeType,
    visibility: "public",
    contentDisposition: "inline",
    cacheControl: "public, max-age=31536000, immutable",
  });

  if (!uploaded.url) {
    return NextResponse.json({ error: "Не удалось сохранить фото." }, { status: 500 });
  }

  return NextResponse.json({ url: uploaded.url }, { status: 201 });
}

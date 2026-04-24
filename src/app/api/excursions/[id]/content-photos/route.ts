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
import {
  deleteFromStorage,
  deleteManagedUrlFromStorage,
  getStorageKeyFromPublicUrl,
  uploadToStorage,
} from "@/lib/storage";
import { validateUploadFile } from "@/lib/upload-validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const excursionContentPhotoUploadLimiter = createRateLimiter({
  id: "excursion-content-photo-upload",
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
});

async function ensureOwner(excursionId: string) {
  return db.excursion.findUnique({
    where: { id: excursionId },
    select: { id: true, ownerId: true },
  });
}

function getUploadErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Failed to upload photo";
  }

  if (error.message === "FILE_EMPTY") {
    return "File is empty";
  }

  if (error.message === "FILE_TOO_LARGE") {
    return getAccommodationPhotoUploadSizeError();
  }

  if (error.message === "UNSUPPORTED_FILE_TYPE") {
    return "Only safe image files are allowed";
  }

  return "Failed to upload photo";
}

export async function POST(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const ip = getRequestIp(request);

  try {
    const limit = await excursionContentPhotoUploadLimiter.limit(`${editor.id}:${ip}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many upload attempts. Retry in ${limit.retryAfterSeconds} seconds.` },
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
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    throw error;
  }

  const { id } = await context.params;
  const excursion = await ensureOwner(id);

  if (!excursion || (!editor.isAdmin && excursion.ownerId !== editor.id)) {
    return NextResponse.json({ error: "Excursion not found" }, { status: 404 });
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
      { error: "Failed to process the image. Please try a different file." },
      { status: 400 },
    );
  }

  const storageKey = `excursions/${excursion.id}/content-photos/${Date.now()}-${crypto.randomUUID()}-${uploadPayload.fileName}`;
  const uploaded = await uploadToStorage({
    key: storageKey,
    body: uploadPayload.bytes,
    contentType: uploadPayload.mimeType,
    visibility: "public",
    contentDisposition: "inline",
    cacheControl: "public, max-age=31536000, immutable",
  });

  if (!uploaded.url) {
    await deleteFromStorage(storageKey).catch(() => null);
    return NextResponse.json({ error: "Failed to upload photo" }, { status: 500 });
  }

  return NextResponse.json({ url: uploaded.url }, { status: 201 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await context.params;
  const excursion = await ensureOwner(id);

  if (!excursion || (!editor.isAdmin && excursion.ownerId !== editor.id)) {
    return NextResponse.json({ error: "Excursion not found" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url =
    payload && typeof payload === "object" && "url" in payload && typeof payload.url === "string"
      ? payload.url.trim()
      : "";

  if (!url) {
    return NextResponse.json({ error: "Photo URL is required" }, { status: 400 });
  }

  const storageKey = getStorageKeyFromPublicUrl(url);
  const allowedPrefix = `excursions/${excursion.id}/content-photos/`;

  if (!storageKey || !storageKey.startsWith(allowedPrefix)) {
    return NextResponse.json({ error: "Photo does not belong to this excursion" }, { status: 400 });
  }

  await deleteManagedUrlFromStorage(url).catch(() => null);

  return NextResponse.json({ ok: true });
}

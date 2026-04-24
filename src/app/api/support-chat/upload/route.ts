// Support chat image upload.
import sharp from "sharp";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";
import { uploadToStorage } from "@/lib/storage";
import { MAX_IMAGE_SIZE } from "@/lib/support-chat";
import { validateUploadFile } from "@/lib/upload-validation";

const supportChatUploadLimiter = createRateLimiter({
  id: "support-chat-upload",
  windowMs: 60_000,
  maxRequests: 10,
});

function getUploadErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Failed to upload image";
  }

  if (error.message === "FILE_EMPTY") {
    return "File is empty";
  }

  if (error.message === "FILE_TOO_LARGE") {
    return "Maximum file size is 3 MB";
  }

  if (error.message === "UNSUPPORTED_FILE_TYPE") {
    return "Only safe image files are allowed";
  }

  return "Failed to upload image";
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const ip = getRequestIp(req);

  try {
    const limit = await supportChatUploadLimiter.limit(`${session.id}:${ip}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Retry in ${limit.retryAfterSeconds} seconds.` },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }
  } catch (error) {
    if (error instanceof RateLimitConfigurationError || error instanceof RateLimitBackendUnavailableError) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    throw error;
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File was not provided" }, { status: 400 });
  }

  try {
    await validateUploadFile({
      file,
      allowedKinds: ["image"],
      maxSizeBytes: MAX_IMAGE_SIZE,
    });
  } catch (error) {
    return NextResponse.json({ error: getUploadErrorMessage(error) }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const timestamp = Date.now();
  const baseName = `support-chat/${session.id}/${timestamp}`;

  const [originalBuf, mediumBuf, thumbBuf] = await Promise.all([
    sharp(buffer)
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer(),
    sharp(buffer)
      .resize(600, 600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
    sharp(buffer)
      .resize(200, 200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer(),
  ]);

  const [original, medium, thumbnail] = await Promise.all([
    uploadToStorage({
      key: `${baseName}-original.webp`,
      body: originalBuf,
      contentType: "image/webp",
      visibility: "public",
      contentDisposition: "inline",
      cacheControl: "public, max-age=31536000, immutable",
    }),
    uploadToStorage({
      key: `${baseName}-medium.webp`,
      body: mediumBuf,
      contentType: "image/webp",
      visibility: "public",
      contentDisposition: "inline",
      cacheControl: "public, max-age=31536000, immutable",
    }),
    uploadToStorage({
      key: `${baseName}-thumb.webp`,
      body: thumbBuf,
      contentType: "image/webp",
      visibility: "public",
      contentDisposition: "inline",
      cacheControl: "public, max-age=31536000, immutable",
    }),
  ]);

  return NextResponse.json({
    originalUrl: original.url,
    mediumUrl: medium.url,
    thumbnailUrl: thumbnail.url,
  });
}

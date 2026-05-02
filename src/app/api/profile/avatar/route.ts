// API route handler for /api/profile/avatar.
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageSizeLimitBytes } from "@/lib/constants";
import { convertImageUploadToWebp } from "@/lib/image-convert";
import {
  createRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";
import { deleteFromStorage, uploadToStorage } from "@/lib/storage";
import { validateUploadFile } from "@/lib/upload-validation";

function buildAvatarStorageKey(userId: string): string {
  return `users/${userId}/avatar/${Date.now()}-${randomUUID()}.webp`;
}

const avatarUploadLimiter = createRateLimiter({
  id: "profile-avatar-upload",
  windowMs: 15 * 60 * 1000,
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
    return "Photo exceeds the allowed size";
  }

  if (error.message === "UNSUPPORTED_FILE_TYPE") {
    return "Only PNG, JPEG, WEBP, HEIC, and HEIF images are allowed";
  }

  return "Failed to upload image";
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const ip = getRequestIp(request);

  try {
    const limit = await avatarUploadLimiter.limit(`${session.id}:${ip}`);
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
      maxSizeBytes: imageSizeLimitBytes,
    });
  } catch (error) {
    return NextResponse.json({ error: getUploadErrorMessage(error) }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      avatarStorageKey: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let uploadPayload: {
    bytes: Buffer;
    mimeType: string;
  };

  try {
    uploadPayload = await convertImageUploadToWebp({
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: validated.detectedMimeType,
      fileName: validated.sanitizedFileName,
    });
  } catch {
    return NextResponse.json({ error: "Failed to process image" }, { status: 400 });
  }

  const key = buildAvatarStorageKey(user.id);
  const upload = await uploadToStorage({
    key,
    body: uploadPayload.bytes,
    contentType: uploadPayload.mimeType,
    visibility: "public",
    contentDisposition: "inline",
    cacheControl: "public, max-age=31536000, immutable",
  }).catch(() => null);

  if (!upload) {
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      avatarUrl: upload.url,
      avatarStorageKey: key,
    },
    select: {
      id: true,
      avatarUrl: true,
      updatedAt: true,
    },
  });

  if (user.avatarStorageKey) {
    await deleteFromStorage(user.avatarStorageKey).catch(() => null);
  }

  return NextResponse.json({
    item: {
      id: updated.id,
      avatarUrl: updated.avatarUrl,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      avatarStorageKey: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      avatarUrl: null,
      avatarStorageKey: null,
    },
    select: { id: true },
  });

  if (user.avatarStorageKey) {
    await deleteFromStorage(user.avatarStorageKey).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}

// Property media endpoint: list and upload object-level photos/videos with limits and image conversion.
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

const propertyMediaUploadLimiter = createRateLimiter({
  id: "property-media-upload",
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
});

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

  const { id } = await context.params;
  const property = await ensurePropertyAccess(id, editor);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json({ items: await listPropertyMedia(property.id) });
}

export async function POST(request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const ip = getRequestIp(request);

  try {
    const limit = await propertyMediaUploadLimiter.limit(`${editor.id}:${ip}`);
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
    if (error instanceof RateLimitConfigurationError || error instanceof RateLimitBackendUnavailableError) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    throw error;
  }

  const { id } = await context.params;
  const property = await ensurePropertyAccess(id, editor);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
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

  await preparePropertyForPublishedOwnerEdit(db, property.id);

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

  const storageKey = `properties/${property.id}/${Date.now()}-${crypto.randomUUID()}-${uploadPayload.fileName}`;
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
            propertyId: property.id,
            roomId: null,
            type: mediaType,
          },
        });

        const limit = getMediaLimit("property", mediaType);
        if (existingCount >= limit) {
          throw new Error("MEDIA_LIMIT_EXCEEDED");
        }

        const maxSort =
          (
            await tx.media.aggregate({
              where: {
                propertyId: property.id,
                roomId: null,
              },
              _max: { sortOrder: true },
            })
          )._max.sortOrder ?? 0;

        await tx.media.create({
          data: {
            propertyId: property.id,
            roomId: null,
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
    if (error instanceof Error && error.message === "MEDIA_LIMIT_EXCEEDED") {
      return NextResponse.json(
        {
          error: getMediaLimitExceededError({
            owner: "property",
            mediaType,
            limit: getMediaLimit("property", mediaType),
          }),
        },
        { status: 400 },
      );
    }

    throw error;
  }

  await markPropertyNeedsRemoderationAfterOwnerEdit(db, property.id);

  return NextResponse.json({ items: await listPropertyMedia(property.id) }, { status: 201 });
}

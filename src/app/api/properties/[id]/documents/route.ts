// Property documents endpoint: list and upload owner documents linked to an object card.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { replaceFileExtension } from "@/lib/image-convert";
import {
  buildPropertyDocumentDownloadUrl,
  propertyDocumentMaxItems,
  propertyDocumentSizeLimitBytes,
  serializePropertyDocument,
} from "@/lib/property-documents";
import {
  createRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";
import { uploadToStorage } from "@/lib/storage";
import {
  sanitizeStoredFileName,
  validateUploadFile,
} from "@/lib/upload-validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const documentUploadLimiter = createRateLimiter({
  id: "property-document-upload",
  windowMs: 15 * 60 * 1000,
  maxRequests: 12,
});

async function ensureOwner(propertyId: string, userId: string) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      ownerId: true,
      ownerDeletedAt: true,
    },
  });

  if (!property || property.ownerId !== userId || property.ownerDeletedAt) {
    return null;
  }

  return property;
}

async function listPropertyDocuments(propertyId: string) {
  const items = await db.propertyDocument.findMany({
    where: { propertyId },
    orderBy: [{ createdAt: "desc" }],
  });

  return items.map(serializePropertyDocument);
}

function getUploadErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Failed to upload document";
  }

  if (error.message === "FILE_EMPTY") {
    return "Document file is empty";
  }

  if (error.message === "FILE_TOO_LARGE") {
    return "Document size must not exceed 20 MB";
  }

  if (error.message === "UNSUPPORTED_FILE_TYPE") {
    return "Only PDF files and safe image files are allowed";
  }

  return "Failed to upload document";
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await ensureOwner(id, session.id);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json({ items: await listPropertyDocuments(property.id) });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const ip = getRequestIp(request);

  try {
    const limit = await documentUploadLimiter.limit(`${session.id}:${ip}`);
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
  const property = await ensureOwner(id, session.id);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const existingCount = await db.propertyDocument.count({
    where: { propertyId: property.id },
  });

  if (existingCount >= propertyDocumentMaxItems) {
    return NextResponse.json(
      { error: `Maximum ${propertyDocumentMaxItems} documents are allowed per property` },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const type = sanitizeStoredFileName(
    (formData.get("type")?.toString().trim() || "DOCUMENT").slice(0, 40),
    "DOCUMENT",
    40,
  );
  const titleValue = formData.get("title")?.toString().trim() || "";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Document file was not provided" }, { status: 400 });
  }

  let validated;

  try {
    validated = await validateUploadFile({
      file,
      allowedKinds: ["document", "image"],
      maxSizeBytes: propertyDocumentSizeLimitBytes,
    });
  } catch (error) {
    return NextResponse.json({ error: getUploadErrorMessage(error) }, { status: 400 });
  }

  const documentId = crypto.randomUUID();
  const normalizedFileName = replaceFileExtension(
    validated.sanitizedFileName,
    validated.detectedExtension,
  );
  const normalizedTitle = sanitizeStoredFileName(
    titleValue.length > 0 ? titleValue : normalizedFileName,
    "Document",
    160,
  );
  const storageKey = `properties/${property.id}/documents/${documentId}/${crypto.randomUUID()}.${validated.detectedExtension}`;

  await uploadToStorage({
    key: storageKey,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: validated.detectedMimeType,
    visibility: "private",
    contentDisposition: "attachment",
    cacheControl: "private, no-store",
  });

  await db.propertyDocument.create({
    data: {
      id: documentId,
      propertyId: property.id,
      type,
      title: normalizedTitle,
      fileName: normalizedFileName.slice(0, 255),
      mimeType: validated.detectedMimeType.slice(0, 120),
      fileSize: validated.size,
      url: buildPropertyDocumentDownloadUrl(property.id, documentId),
      storageKey,
    },
  });

  return NextResponse.json({ items: await listPropertyDocuments(property.id) }, { status: 201 });
}

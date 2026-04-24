// Admin chat managers CRUD.
import sharp from "sharp";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import {
  deleteFromStorage,
  getStorageKeyFromPublicUrl,
  uploadToStorage,
} from "@/lib/storage";
import { validateUploadFile } from "@/lib/upload-validation";

const adminChatManagersUnavailableMessage =
  "Chat managers are temporarily unavailable because the database is not reachable.";

function logAdminChatManagersFallback(contextId: string, message: string): void {
  logDatabaseFallbackOnce(contextId, `Admin chat managers API: ${message}`);
}

function adminChatManagersUnavailableResponse(status = 503): NextResponse {
  return NextResponse.json({ error: adminChatManagersUnavailableMessage }, { status });
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!(await isConfiguredDatabaseReachable())) {
    logAdminChatManagersFallback(
      "admin-chat-managers-list",
      "database is unavailable, returning empty manager list.",
    );
    return NextResponse.json({ managers: [] });
  }

  try {
    const managers = await db.chatManager.findMany({
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ managers });
  } catch (error) {
    if (!isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logAdminChatManagersFallback(
      "admin-chat-managers-list",
      "database is unavailable or credentials are invalid, returning empty manager list.",
    );
    return NextResponse.json({ managers: [] });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = (formData.get("name") as string | null)?.trim();
  if (!name || name.length > 100) {
    return NextResponse.json(
      { error: "Name is required and must be between 1 and 100 characters" },
      { status: 400 },
    );
  }

  if (!(await isConfiguredDatabaseReachable())) {
    logAdminChatManagersFallback(
      "admin-chat-managers-create",
      "database is unavailable, returning 503 for manager creation.",
    );
    return adminChatManagersUnavailableResponse();
  }

  try {
    let photoUrl: string | null = null;
    const photo = formData.get("photo");

    if (photo instanceof File && photo.size > 0) {
      try {
        await validateUploadFile({
          file: photo,
          allowedKinds: ["image"],
          maxSizeBytes: 10 * 1024 * 1024,
        });
      } catch {
        return NextResponse.json(
          { error: "Only safe image files up to 10 MB are allowed" },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await photo.arrayBuffer());
      const thumbBuf = await sharp(buffer)
        .resize(200, 200, { fit: "cover" })
        .webp({ quality: 80 })
        .toBuffer();

      const key = `chat-managers/${Date.now()}-${crypto.randomUUID()}.webp`;
      const result = await uploadToStorage({
        key,
        body: thumbBuf,
        contentType: "image/webp",
        visibility: "public",
        contentDisposition: "inline",
        cacheControl: "public, max-age=31536000, immutable",
      });
      photoUrl = result.url;
    }

    const manager = await db.chatManager.create({
      data: { name, photoUrl },
    });

    return NextResponse.json({ manager }, { status: 201 });
  } catch (error) {
    if (!isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logAdminChatManagersFallback(
      "admin-chat-managers-create",
      "database is unavailable or credentials are invalid, returning 503 for manager creation.",
    );
    return adminChatManagersUnavailableResponse();
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id, name, isActive } = body as {
    id: string;
    name?: string;
    isActive?: boolean;
  };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (!(await isConfiguredDatabaseReachable())) {
    logAdminChatManagersFallback(
      "admin-chat-managers-update",
      "database is unavailable, returning 503 for manager update.",
    );
    return adminChatManagersUnavailableResponse();
  }

  try {
    const existing = await db.chatManager.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Manager not found" }, { status: 404 });
    }

    if (isActive === true) {
      await db.chatManager.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }

    const manager = await db.chatManager.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim().slice(0, 100) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json({ manager });
  } catch (error) {
    if (!isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logAdminChatManagersFallback(
      "admin-chat-managers-update",
      "database is unavailable or credentials are invalid, returning 503 for manager update.",
    );
    return adminChatManagersUnavailableResponse();
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (!(await isConfiguredDatabaseReachable())) {
    logAdminChatManagersFallback(
      "admin-chat-managers-delete",
      "database is unavailable, returning 503 for manager deletion.",
    );
    return adminChatManagersUnavailableResponse();
  }

  try {
    const manager = await db.chatManager.findUnique({ where: { id } });
    if (manager?.photoUrl) {
      const key = getStorageKeyFromPublicUrl(manager.photoUrl);
      if (key) {
        await deleteFromStorage(key).catch(() => null);
      }
    }

    await db.chatManager.delete({ where: { id } }).catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (!isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logAdminChatManagersFallback(
      "admin-chat-managers-delete",
      "database is unavailable or credentials are invalid, returning 503 for manager deletion.",
    );
    return adminChatManagersUnavailableResponse();
  }
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { imageSizeLimitBytes } from "@/lib/constants";
import { convertImageUploadToWebp } from "@/lib/image-convert";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCookieOptions,
} from "@/lib/admin-session-token";
import { db } from "@/lib/db";
import { deleteFromStorage, uploadToStorage } from "@/lib/storage";
import { validateUploadFile } from "@/lib/upload-validation";

function buildAvatarStorageKey(adminId: string): string {
  return `admins/${adminId}/avatar/${Date.now()}-${randomUUID()}.webp`;
}

function getUploadErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Не удалось загрузить изображение";
  }

  if (error.message === "FILE_EMPTY") {
    return "Файл пустой";
  }

  if (error.message === "FILE_TOO_LARGE") {
    return "Фото превышает допустимый размер";
  }

  if (error.message === "UNSUPPORTED_FILE_TYPE") {
    return "Поддерживаются только PNG, JPEG, WEBP, HEIC и HEIF";
  }

  return "Не удалось загрузить изображение";
}

export async function POST(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  if (admin.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "У главного администратора нет редактируемого аватара." },
      { status: 409 },
    );
  }

  if (admin.authProvider !== "database" || !admin.adminAccountId) {
    return NextResponse.json(
      { error: "Аватар env-admin не хранится в базе. Создайте DB-админа для профиля." },
      { status: 409 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
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

  const account = await db.adminAccount.findUnique({
    where: { id: admin.adminAccountId },
    select: {
      id: true,
      login: true,
      displayName: true,
      avatarStorageKey: true,
      role: true,
      sessionVersion: true,
      mustChangePassword: true,
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Администратор не найден" }, { status: 404 });
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
    return NextResponse.json({ error: "Не удалось обработать изображение" }, { status: 400 });
  }

  const key = buildAvatarStorageKey(account.id);
  const uploaded = await uploadToStorage({
    key,
    body: uploadPayload.bytes,
    contentType: uploadPayload.mimeType,
    visibility: "public",
    contentDisposition: "inline",
    cacheControl: "public, max-age=31536000, immutable",
  }).catch(() => null);

  if (!uploaded?.url) {
    return NextResponse.json({ error: "Не удалось загрузить изображение" }, { status: 500 });
  }

  const updated = await db.adminAccount.update({
    where: { id: account.id },
    data: {
      avatarUrl: uploaded.url,
      avatarStorageKey: key,
    },
    select: {
      id: true,
      login: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      sessionVersion: true,
      mustChangePassword: true,
    },
  });

  if (account.avatarStorageKey) {
    await deleteFromStorage(account.avatarStorageKey).catch(() => null);
  }

  const response = NextResponse.json({
    item: {
      id: updated.id,
      avatarUrl: updated.avatarUrl,
    },
  });
  const token = await createAdminSessionToken({
    login: updated.login,
    sessionVersion: updated.sessionVersion,
    authProvider: "database",
    adminAccountId: updated.id,
    displayName: updated.displayName,
    avatarUrl: updated.avatarUrl,
    role: updated.role,
    mustChangePassword: updated.mustChangePassword,
  });
  response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions());
  return response;
}

export async function DELETE() {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  if (admin.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "У главного администратора нет редактируемого аватара." },
      { status: 409 },
    );
  }

  if (admin.authProvider !== "database" || !admin.adminAccountId) {
    return NextResponse.json({ error: "Env-admin не имеет DB-аватара." }, { status: 409 });
  }

  const account = await db.adminAccount.findUnique({
    where: { id: admin.adminAccountId },
    select: {
      id: true,
      login: true,
      displayName: true,
      avatarStorageKey: true,
      role: true,
      sessionVersion: true,
      mustChangePassword: true,
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Администратор не найден" }, { status: 404 });
  }

  const updated = await db.adminAccount.update({
    where: { id: account.id },
    data: {
      avatarUrl: null,
      avatarStorageKey: null,
    },
    select: {
      id: true,
      login: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      sessionVersion: true,
      mustChangePassword: true,
    },
  });

  if (account.avatarStorageKey) {
    await deleteFromStorage(account.avatarStorageKey).catch(() => null);
  }

  const response = NextResponse.json({ ok: true });
  const token = await createAdminSessionToken({
    login: updated.login,
    sessionVersion: updated.sessionVersion,
    authProvider: "database",
    adminAccountId: updated.id,
    displayName: updated.displayName,
    avatarUrl: updated.avatarUrl,
    role: updated.role,
    mustChangePassword: updated.mustChangePassword,
  });
  response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions());
  return response;
}

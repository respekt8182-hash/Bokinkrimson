// API route handler for /api/profile/avatar.
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { imageSizeLimitBytes } from "@/lib/constants";
import { db } from "@/lib/db";
import { convertImageUploadToWebp, sanitizeUploadedFileName } from "@/lib/image-convert";
import { deleteFromStorage, uploadToStorage } from "@/lib/storage";

function buildAvatarStorageKey(userId: string): string {
  return `users/${userId}/avatar/${Date.now()}-${randomUUID()}.webp`;
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (file.size > imageSizeLimitBytes) {
    return NextResponse.json({ error: "Фотография превышает допустимый размер. Зайдите на сайт для сжатия фотографий, сожмите файл и загрузите его сюда повторно" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      avatarStorageKey: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const originalName = file.name || "avatar";
  const sanitizedName = sanitizeUploadedFileName(originalName, "avatar");
  let uploadPayload: {
    bytes: Buffer;
    mimeType: string;
    fileName: string;
    converted: boolean;
  };
  try {
    uploadPayload = await convertImageUploadToWebp({
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      fileName: sanitizedName,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNSUPPORTED_IMAGE_FORMAT") {
      return NextResponse.json(
        { error: "Поддерживаются PNG, JPEG, WEBP и HEIC" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Не удалось обработать изображение" }, { status: 400 });
  }
  const key = buildAvatarStorageKey(user.id);
  const upload = await uploadToStorage({
    key,
    body: uploadPayload.bytes,
    contentType: uploadPayload.mimeType,
  }).catch(() => null);

  if (!upload) {
    return NextResponse.json({ error: "Не удалось загрузить изображение" }, { status: 500 });
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
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      avatarStorageKey: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
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

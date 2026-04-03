// Admin chat managers CRUD.
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { uploadToStorage, deleteFromStorage } from "@/lib/storage";
import sharp from "sharp";

// ─── GET ────────────────────────────────────────────────────────

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const managers = await db.chatManager.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ managers });
}

// ─── POST ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Невалидный запрос" }, { status: 400 });
  }

  const name = (formData.get("name") as string | null)?.trim();
  if (!name || name.length > 100) {
    return NextResponse.json({ error: "Имя обязательно (1-100 символов)" }, { status: 400 });
  }

  let photoUrl: string | null = null;
  const photo = formData.get("photo") as File | null;

  if (photo && photo.size > 0) {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(photo.type)) {
      return NextResponse.json({ error: "Поддерживаются только JPEG, PNG и WebP" }, { status: 400 });
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const thumbBuf = await sharp(buffer)
      .resize(200, 200, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();

    const key = `chat-managers/${Date.now()}.webp`;
    const result = await uploadToStorage({ key, body: thumbBuf, contentType: "image/webp" });
    photoUrl = result.url;
  }

  const manager = await db.chatManager.create({
    data: { name, photoUrl },
  });

  return NextResponse.json({ manager }, { status: 201 });
}

// ─── PATCH ──────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Невалидный запрос" }, { status: 400 });
  }

  const { id, name, isActive } = body as {
    id: string;
    name?: string;
    isActive?: boolean;
  };

  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  const existing = await db.chatManager.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Менеджер не найден" }, { status: 404 });
  }

  // If activating, deactivate others
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
}

// ─── DELETE ─────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  const manager = await db.chatManager.findUnique({ where: { id } });
  if (manager?.photoUrl) {
    // Extract storage key from URL
    const key = manager.photoUrl.replace(/^\/uploads\//, "");
    await deleteFromStorage(key).catch(() => null);
  }

  await db.chatManager.delete({ where: { id } }).catch(() => null);

  return NextResponse.json({ ok: true });
}

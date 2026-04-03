// Support chat image upload.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadToStorage } from "@/lib/storage";
import { MAX_IMAGE_SIZE } from "@/lib/support-chat";
import sharp from "sharp";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, maxReqs: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= maxReqs;
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  if (!rateLimit(`chat-upload:${session.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Невалидный запрос" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Файл не предоставлен" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Поддерживаются только JPEG, PNG и WebP" }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Максимальный размер файла — 3 МБ" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const timestamp = Date.now();
  const baseName = `support-chat/${session.id}/${timestamp}`;

  // Generate sizes
  const [originalBuf, mediumBuf, thumbBuf] = await Promise.all([
    sharp(buffer).resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
    sharp(buffer).resize(600, 600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    sharp(buffer).resize(200, 200, { fit: "inside", withoutEnlargement: true }).webp({ quality: 70 }).toBuffer(),
  ]);

  const [original, medium, thumbnail] = await Promise.all([
    uploadToStorage({ key: `${baseName}-original.webp`, body: originalBuf, contentType: "image/webp" }),
    uploadToStorage({ key: `${baseName}-medium.webp`, body: mediumBuf, contentType: "image/webp" }),
    uploadToStorage({ key: `${baseName}-thumb.webp`, body: thumbBuf, contentType: "image/webp" }),
  ]);

  return NextResponse.json({
    originalUrl: original.url,
    mediumUrl: medium.url,
    thumbnailUrl: thumbnail.url,
  });
}

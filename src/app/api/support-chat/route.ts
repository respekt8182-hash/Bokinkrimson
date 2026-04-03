// Client-facing support chat API.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checkMessageCooldown,
  cleanupOldMessages,
  getActiveManager,
  getSocialLinks,
  getSupportChatSettings,
  getSupportChatTemplates,
  MAX_MESSAGE_LENGTH,
} from "@/lib/support-chat";

// ─── Simple in-memory rate limiter ──────────────────────────────

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

// ─── GET ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rateKey = `chat-get:${session?.id ?? ip}`;

  if (!rateLimit(rateKey, 30, 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  await cleanupOldMessages();

  const [settings, manager, templates, social] = await Promise.all([
    getSupportChatSettings(),
    getActiveManager(),
    getSupportChatTemplates(),
    getSocialLinks(),
  ]);

  let messages: { id: string; senderType: string; senderName: string | null; text: string; imageUrl: string | null; createdAt: Date }[] = [];
  let chatConsentGiven = false;

  if (session) {
    const chat = await db.supportChat.findUnique({
      where: { userId: session.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200,
        },
      },
    });
    messages = chat?.messages ?? [];

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { chatConsentGiven: true },
    });
    chatConsentGiven = user?.chatConsentGiven ?? false;
  }

  return NextResponse.json({
    enabled: settings.enabled,
    manager: manager ? { name: manager.name, photoUrl: manager.photoUrl } : null,
    templates,
    social,
    messages,
    chatConsentGiven,
  });
}

// ─── POST ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const rateKey = `chat-post:${session.id}`;
  if (!rateLimit(rateKey, 20, 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const settings = await getSupportChatSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "Чат поддержки отключён" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Невалидный запрос" }, { status: 400 });
  }

  const { text, imageUrl, grantConsent } = body as {
    text?: string;
    imageUrl?: string;
    grantConsent?: boolean;
  };

  // Handle consent
  if (grantConsent) {
    await db.user.update({
      where: { id: session.id },
      data: { chatConsentGiven: true },
    });
  }

  // Check consent
  if (!grantConsent) {
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { chatConsentGiven: true },
    });
    if (!user?.chatConsentGiven) {
      return NextResponse.json(
        { error: "Необходимо согласие на обработку данных" },
        { status: 403 },
      );
    }
  }

  // Validate text
  const trimmedText = (text ?? "").trim();
  if (!trimmedText && !imageUrl) {
    return NextResponse.json({ error: "Сообщение не может быть пустым" }, { status: 400 });
  }
  if (trimmedText.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Текст не может быть длиннее ${MAX_MESSAGE_LENGTH} символов` },
      { status: 400 },
    );
  }

  // Upsert chat
  const chat = await db.supportChat.upsert({
    where: { userId: session.id },
    update: {},
    create: { userId: session.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { senderType: true, createdAt: true },
      },
    },
  });

  // Antispam check
  const cooldown = checkMessageCooldown(chat.messages);
  if (!cooldown.allowed) {
    const retryAfterSec = Math.ceil(cooldown.retryAfterMs / 1000);
    return NextResponse.json(
      {
        error: "Подождите ответа оператора перед отправкой новых сообщений",
        retryAfterSec,
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const message = await db.supportMessage.create({
    data: {
      chatId: chat.id,
      senderType: "user",
      senderName: `${session.firstName} ${session.lastName}`.trim(),
      text: trimmedText,
      imageUrl: imageUrl ?? null,
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}

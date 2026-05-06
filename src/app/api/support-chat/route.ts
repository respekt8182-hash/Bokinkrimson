// Client-facing support chat API.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createRateLimiter,
  RateLimitBackendUnavailableError,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";
import { isManagedPublicUrl } from "@/lib/storage";
import {
  checkMessageCooldown,
  cleanupOldMessages,
  getSupportChatSettings,
  getSupportChatWidgetShellData,
  MAX_MESSAGE_LENGTH,
} from "@/lib/support-chat";

const supportChatGetLimiter = createRateLimiter({
  id: "support-chat-get",
  windowMs: 60_000,
  maxRequests: 30,
});

const supportChatMessageLimiter = createRateLimiter({
  id: "support-chat-message",
  windowMs: 60_000,
  maxRequests: 5,
});

const supportChatMessageSchema = z
  .object({
    text: z.string().max(MAX_MESSAGE_LENGTH).optional(),
    imageUrl: z
      .string()
      .trim()
      .max(500, `Ссылка на изображение не должна превышать 500 символов`)
      .refine((value) => isManagedPublicUrl(value), "Допустимы только изображения из хранилища проекта")
      .optional(),
    grantConsent: z.boolean().optional(),
  })
  .strict();

function buildSupportChatRateLimitKey(request: Request, userId?: string | null): string {
  const ip = getRequestIp(request);
  return userId ? `${userId}:${ip}` : ip;
}

async function enforceRateLimit(
  limiter: ReturnType<typeof createRateLimiter>,
  key: string,
  message: string,
): Promise<NextResponse | null> {
  try {
    const limit = await limiter.limit(key);
    if (limit.allowed) {
      return null;
    }

    return NextResponse.json(
      { error: message, retryAfterSec: limit.retryAfterSeconds },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
        },
      },
    );
  } catch (error) {
    if (error instanceof RateLimitConfigurationError || error instanceof RateLimitBackendUnavailableError) {
      return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 503 });
    }

    throw error;
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const rateLimitResponse = await enforceRateLimit(
    supportChatGetLimiter,
    buildSupportChatRateLimitKey(req, session?.id ?? null),
    "Слишком много запросов",
  );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  await cleanupOldMessages();

  const shellData = await getSupportChatWidgetShellData();

  let messages: Array<{
    id: string;
    senderType: string;
    senderName: string | null;
    text: string;
    imageUrl: string | null;
    createdAt: Date;
  }> = [];
  let chatConsentGiven = false;

  if (session && shellData.enabled) {
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
    enabled: shellData.enabled,
    manager: shellData.manager,
    templates: shellData.templates,
    social: shellData.social,
    messages,
    chatConsentGiven,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const rateLimitResponse = await enforceRateLimit(
    supportChatMessageLimiter,
    buildSupportChatRateLimitKey(req, session.id),
    "Слишком много сообщений. Попробуйте позже",
  );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const settings = await getSupportChatSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "Чат поддержки отключён" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Невалидный запрос" }, { status: 400 });
  }

  const parsed = supportChatMessageSchema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Проверьте корректность сообщения" },
      { status: 400 },
    );
  }

  const trimmedText = parsed.data.text?.trim() ?? "";
  const imageUrl = parsed.data.imageUrl?.trim() || null;
  const grantConsent = parsed.data.grantConsent === true;

  if (grantConsent) {
    await db.user.update({
      where: { id: session.id },
      data: { chatConsentGiven: true },
    });
  }

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

  if (!trimmedText && !imageUrl) {
    return NextResponse.json({ error: "Сообщение не может быть пустым" }, { status: 400 });
  }

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
      senderName: session.firstName.trim(),
      text: trimmedText,
      imageUrl,
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}

// Admin support chat API.
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  isConfiguredDatabaseReachable,
  isDatabaseFallbackEligibleError,
  logDatabaseFallbackOnce,
} from "@/lib/prisma-errors";
import {
  saveSupportChatTemplates,
  setSupportChatEnabled,
  MAX_TEMPLATES,
} from "@/lib/support-chat";

const adminSupportChatUnavailableMessage =
  "Чат поддержки временно недоступен. Подключение к базе данных отсутствует.";

function logAdminSupportChatFallback(contextId: string, message: string): void {
  logDatabaseFallbackOnce(contextId, `Admin support chat API: ${message}`);
}

function adminSupportChatUnavailableResponse(status = 503): NextResponse {
  return NextResponse.json({ error: adminSupportChatUnavailableMessage }, { status });
}

// в”Ђв”Ђв”Ђ GET в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");

  if (!(await isConfiguredDatabaseReachable())) {
    if (chatId) {
      logAdminSupportChatFallback(
        "admin-support-chat-detail",
        "database is unavailable, returning 503 for chat detail.",
      );
      return adminSupportChatUnavailableResponse();
    }

    logAdminSupportChatFallback(
      "admin-support-chat-list",
      "database is unavailable, returning empty chat list.",
    );
    return NextResponse.json({ chats: [], waitingCount: 0 });
  }

  try {
    if (chatId) {
      const chat = await db.supportChat.findUnique({
        where: { id: chatId },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true },
          },
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!chat) {
        return NextResponse.json({ error: "Чат не найден" }, { status: 404 });
      }
      return NextResponse.json({ chat });
    }

    // List all chats with preview
    const chats = await db.supportChat.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    // Count chats waiting for moderator response
    const waitingCount = chats.filter(
      (c) => c.messages.length > 0 && c.messages[0].senderType === "user",
    ).length;

    return NextResponse.json({
      chats: chats.map((c) => ({
        id: c.id,
        user: c.user,
        lastMessage: c.messages[0] ?? null,
        updatedAt: c.updatedAt,
      })),
      waitingCount,
    });
  } catch (error) {
    if (!isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    if (chatId) {
      logAdminSupportChatFallback(
        "admin-support-chat-detail",
        "database is unavailable or credentials are invalid, returning 503 for chat detail.",
      );
      return adminSupportChatUnavailableResponse();
    }

    logAdminSupportChatFallback(
      "admin-support-chat-list",
      "database is unavailable or credentials are invalid, returning empty chat list.",
    );
    return NextResponse.json({ chats: [], waitingCount: 0 });
  }
}

// в”Ђв”Ђв”Ђ POST (admin sends message as moderator) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Невалидный запрос" }, { status: 400 });
  }

  const { chatId, text, imageUrl, managerId } = body as {
    chatId: string;
    text?: string;
    imageUrl?: string;
    managerId?: string;
  };

  if (!chatId) {
    return NextResponse.json({ error: "chatId обязателен" }, { status: 400 });
  }

  const trimmedText = (text ?? "").trim();
  if (!trimmedText && !imageUrl) {
    return NextResponse.json({ error: "Сообщение не может быть пустым" }, { status: 400 });
  }

  if (!(await isConfiguredDatabaseReachable())) {
    logAdminSupportChatFallback(
      "admin-support-chat-send",
      "database is unavailable, returning 503 for moderator reply.",
    );
    return adminSupportChatUnavailableResponse();
  }

  try {
    const chat = await db.supportChat.findUnique({ where: { id: chatId } });
    if (!chat) {
      return NextResponse.json({ error: "Чат не найден" }, { status: 404 });
    }

    // If managerId provided, set as active
    let senderName = "Модератор";
    if (managerId) {
      const manager = await db.chatManager.findUnique({ where: { id: managerId } });
      if (manager) {
        senderName = manager.name;
        if (!manager.isActive) {
          await db.$transaction([
            db.chatManager.updateMany({ where: { isActive: true }, data: { isActive: false } }),
            db.chatManager.update({ where: { id: managerId }, data: { isActive: true } }),
          ]);
        }
      }
    }

    const message = await db.supportMessage.create({
      data: {
        chatId,
        senderType: "moderator",
        senderName,
        text: trimmedText,
        imageUrl: imageUrl ?? null,
      },
    });

    // Touch chat updatedAt
    await db.supportChat.update({ where: { id: chatId }, data: {} });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (!isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logAdminSupportChatFallback(
      "admin-support-chat-send",
      "database is unavailable or credentials are invalid, returning 503 for moderator reply.",
    );
    return adminSupportChatUnavailableResponse();
  }
}

// в”Ђв”Ђв”Ђ PATCH (update settings) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export async function PATCH(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Невалидный запрос" }, { status: 400 });
  }

  const { enabled, templates } = body as {
    enabled?: boolean;
    templates?: string[];
  };

  if (!(await isConfiguredDatabaseReachable())) {
    logAdminSupportChatFallback(
      "admin-support-chat-settings",
      "database is unavailable, returning 503 for settings update.",
    );
    return adminSupportChatUnavailableResponse();
  }

  try {
    if (typeof enabled === "boolean") {
      await setSupportChatEnabled(enabled);
    }

    if (Array.isArray(templates)) {
      const cleaned = templates
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, MAX_TEMPLATES);
      await saveSupportChatTemplates(cleaned);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (!isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logAdminSupportChatFallback(
      "admin-support-chat-settings",
      "database is unavailable or credentials are invalid, returning 503 for settings update.",
    );
    return adminSupportChatUnavailableResponse();
  }
}

// в”Ђв”Ђв”Ђ DELETE (delete chat) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return NextResponse.json({ error: "chatId обязателен" }, { status: 400 });
  }

  if (!(await isConfiguredDatabaseReachable())) {
    logAdminSupportChatFallback(
      "admin-support-chat-delete",
      "database is unavailable, returning 503 for chat deletion.",
    );
    return adminSupportChatUnavailableResponse();
  }

  try {
    await db.supportChat.delete({ where: { id: chatId } }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (!isDatabaseFallbackEligibleError(error)) {
      throw error;
    }

    logAdminSupportChatFallback(
      "admin-support-chat-delete",
      "database is unavailable or credentials are invalid, returning 503 for chat deletion.",
    );
    return adminSupportChatUnavailableResponse();
  }
}

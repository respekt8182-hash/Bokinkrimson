// Admin support chat API.
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  saveSupportChatTemplates,
  setSupportChatEnabled,
  MAX_TEMPLATES,
} from "@/lib/support-chat";

// ─── GET ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");

  if (chatId) {
    const chat = await db.supportChat.findUnique({
      where: { id: chatId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true } },
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
      user: { select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true } },
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
}

// ─── POST (admin sends message as moderator) ────────────────────

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
}

// ─── PATCH (update settings) ────────────────────────────────────

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
}

// ─── DELETE (delete chat) ───────────────────────────────────────

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

  await db.supportChat.delete({ where: { id: chatId } }).catch(() => null);

  return NextResponse.json({ ok: true });
}

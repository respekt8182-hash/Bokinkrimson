// API route handler for /api/profile.
import { NextResponse } from "next/server";
import {
  comparePasswords,
  createSessionToken,
  getSessionCookieOptions,
  getSession,
  hashPassword,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { changePasswordSchema, updateProfileSchema } from "@/lib/schemas";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность данных профиля" }, { status: 400 });
  }

  const email = parsed.data.email?.trim().toLowerCase() || null;

  const updated = await db.user.update({
    where: { id: session.id },
    data: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      email,
      phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : undefined,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const token = await createSessionToken({
    id: updated.id,
    phone: updated.phone,
    firstName: updated.firstName,
    lastName: updated.lastName,
    role: updated.role,
  });

  const response = NextResponse.json({
    item: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}

export async function PUT(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность пароля" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const isCurrentPasswordValid = await comparePasswords(
    parsed.data.currentPassword,
    user.passwordHash,
  );
  if (!isCurrentPasswordValid) {
    return NextResponse.json({ error: "Текущий пароль указан неверно" }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({
    where: { id: session.id },
    data: { passwordHash },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}

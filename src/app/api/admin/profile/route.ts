import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { adminRoleLabels, normalizeAdminRole } from "@/lib/admin-rbac";
import { comparePasswords, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCookieOptions,
} from "@/lib/admin-session-token";
import { isDatabaseSchemaMissingError } from "@/lib/prisma-errors";

function serializeEnvProfile(admin: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>) {
  const role = normalizeAdminRole(admin.role);

  return {
    id: admin.id,
    login: admin.login,
    email: null,
    displayName: admin.displayName,
    avatarUrl: admin.avatarUrl,
    role,
    roleLabel: adminRoleLabels[role],
    status: "ACTIVE",
    authProvider: "env",
    createdAt: null,
    updatedAt: null,
    lastLoginAt: null,
    mustChangePassword: false,
    editable: false,
  };
}

function serializeDbProfile(account: {
  id: string;
  login: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  mustChangePassword: boolean;
}) {
  const role = normalizeAdminRole(account.role);

  return {
    id: account.id,
    login: account.login,
    email: account.email,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    role,
    roleLabel: adminRoleLabels[role],
    status: account.status,
    authProvider: "database",
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
    mustChangePassword: account.mustChangePassword,
    editable: role !== "SUPER_ADMIN",
  };
}

async function loadCurrentDbAdmin(adminAccountId: string) {
  return db.adminAccount.findUnique({
    where: { id: adminAccountId },
    select: {
      id: true,
      login: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      status: true,
      sessionVersion: true,
      passwordHash: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      mustChangePassword: true,
    },
  });
}

export async function GET() {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  if (admin.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Главный администратор управляется настройками проекта и не редактирует профиль." },
      { status: 409 },
    );
  }

  if (admin.authProvider !== "database" || !admin.adminAccountId) {
    return NextResponse.json({ item: serializeEnvProfile(admin) });
  }

  const account = await loadCurrentDbAdmin(admin.adminAccountId).catch((error) => {
    if (isDatabaseSchemaMissingError(error)) {
      return null;
    }

    throw error;
  });

  if (!account || account.status !== "ACTIVE") {
    return NextResponse.json({ error: "Администратор не найден" }, { status: 404 });
  }

  return NextResponse.json({ item: serializeDbProfile(account) });
}

export async function PATCH(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  if (admin.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Пароль главного администратора меняется в настройках проекта." },
      { status: 409 },
    );
  }

  if (admin.authProvider !== "database" || !admin.adminAccountId) {
    return NextResponse.json(
      {
        error:
          "Env-admin редактируется через переменные окружения. Создайте DB-админа для профиля.",
      },
      { status: 409 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() || null : null;

  if (displayName.length < 2) {
    return NextResponse.json({ error: "Укажите имя администратора." }, { status: 400 });
  }

  const account = await db.adminAccount
    .update({
      where: { id: admin.adminAccountId },
      data: {
        displayName,
        email,
      },
      select: {
        id: true,
        login: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
        sessionVersion: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        mustChangePassword: true,
      },
    })
    .catch(() => null);

  if (!account) {
    return NextResponse.json(
      { error: "Не удалось сохранить профиль. Проверьте уникальность email." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({
    item: serializeDbProfile(account),
    message: "Профиль сохранён.",
  });
  const token = await createAdminSessionToken({
    login: account.login,
    sessionVersion: account.sessionVersion,
    authProvider: "database",
    adminAccountId: account.id,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    role: normalizeAdminRole(account.role),
    mustChangePassword: account.mustChangePassword,
  });
  response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions());
  return response;
}

export async function PUT(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  if (admin.authProvider !== "database" || !admin.adminAccountId) {
    return NextResponse.json(
      { error: "Пароль env-admin меняется через ADMIN_PASSWORD_HASH." },
      { status: 409 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const currentPassword =
    typeof payload.currentPassword === "string" ? payload.currentPassword : "";
  const newPassword = typeof payload.newPassword === "string" ? payload.newPassword : "";

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Новый пароль должен быть не короче 8 символов." },
      { status: 400 },
    );
  }

  const account = await loadCurrentDbAdmin(admin.adminAccountId);

  if (!account || account.status !== "ACTIVE") {
    return NextResponse.json({ error: "Администратор не найден" }, { status: 404 });
  }

  if (!(await comparePasswords(currentPassword, account.passwordHash))) {
    return NextResponse.json({ error: "Текущий пароль указан неверно." }, { status: 400 });
  }

  const updated = await db.adminAccount.update({
    where: { id: account.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      sessionVersion: {
        increment: 1,
      },
    },
    select: {
      id: true,
      login: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      status: true,
      sessionVersion: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      mustChangePassword: true,
    },
  });

  const response = NextResponse.json({
    item: serializeDbProfile(updated),
    message: "Пароль изменён.",
  });
  const token = await createAdminSessionToken({
    login: updated.login,
    sessionVersion: updated.sessionVersion,
    authProvider: "database",
    adminAccountId: updated.id,
    displayName: updated.displayName,
    avatarUrl: updated.avatarUrl,
    role: normalizeAdminRole(updated.role),
    mustChangePassword: updated.mustChangePassword,
  });
  response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions());
  return response;
}

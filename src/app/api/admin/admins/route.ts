import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  adminRoleLabels,
  canManageAdminRole,
  hasAdminPermission,
  normalizeAdminRole,
  type AdminRoleValue,
} from "@/lib/admin-rbac";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDatabaseSchemaMissingError } from "@/lib/prisma-errors";
import { getAdminLoginValue } from "@/lib/security-config";

function getEnvAdminItem() {
  return {
    id: "env-admin",
    login: getAdminLoginValue(),
    email: null,
    displayName: "Главный администратор",
    avatarUrl: null,
    role: "SUPER_ADMIN" as AdminRoleValue,
    roleLabel: adminRoleLabels.SUPER_ADMIN,
    status: "ACTIVE",
    authProvider: "env",
    createdAt: null,
    updatedAt: null,
    lastLoginAt: null,
    mustChangePassword: false,
    immutable: true,
  };
}

function serializeAdminAccount(account: {
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
    immutable: false,
  };
}

function generateTemporaryPassword(): string {
  return `Adm-${randomBytes(9).toString("base64url")}-7x`;
}

function parseText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET() {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  if (!hasAdminPermission(admin.role, "admins:manage")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const accounts = await db.adminAccount
    .findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        login: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        mustChangePassword: true,
      },
    })
    .catch((error) => {
      if (isDatabaseSchemaMissingError(error)) {
        return null;
      }

      throw error;
    });

  if (!accounts) {
    return NextResponse.json({
      schemaReady: false,
      items: [getEnvAdminItem()],
      roles: adminRoleLabels,
      message: "Таблица администраторов еще не применена. Выполните prisma migrate deploy.",
    });
  }

  return NextResponse.json({
    schemaReady: true,
    items: [getEnvAdminItem(), ...accounts.map(serializeAdminAccount)],
    roles: adminRoleLabels,
  });
}

export async function POST(request: Request) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  if (!hasAdminPermission(admin.role, "admins:manage")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const login = parseText(payload.login, 80);
  const displayName = parseText(payload.displayName, 120);
  const email = parseText(payload.email, 160) || null;
  const role = normalizeAdminRole(payload.role);
  const requestedPassword = parseText(payload.password, 160);
  const temporaryPassword = requestedPassword || generateTemporaryPassword();

  if (login.length < 3) {
    return NextResponse.json({ error: "Логин должен быть не короче 3 символов." }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9_.@-]+$/.test(login)) {
    return NextResponse.json(
      { error: "Логин может содержать латиницу, цифры, точку, дефис, подчёркивание и @." },
      { status: 400 },
    );
  }

  if (displayName.length < 2) {
    return NextResponse.json({ error: "Укажите имя администратора." }, { status: 400 });
  }

  if (temporaryPassword.length < 8) {
    return NextResponse.json(
      { error: "Пароль должен быть не короче 8 символов." },
      { status: 400 },
    );
  }

  if (role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Главный администратор уже существует и создаётся только из кода." },
      { status: 400 },
    );
  }

  if (!canManageAdminRole(admin.role, role)) {
    return NextResponse.json({ error: "Нельзя назначить эту роль." }, { status: 403 });
  }

  try {
    const account = await db.adminAccount.create({
      data: {
        login,
        email,
        displayName,
        role,
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: !requestedPassword,
        createdById: admin.id,
      },
      select: {
        id: true,
        login: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        mustChangePassword: true,
      },
    });

    return NextResponse.json(
      {
        item: serializeAdminAccount(account),
        temporaryPassword: requestedPassword ? null : temporaryPassword,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isDatabaseSchemaMissingError(error)) {
      return NextResponse.json(
        { error: "Таблица администраторов еще не применена. Выполните prisma migrate deploy." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Не удалось создать администратора. Проверьте уникальность логина и email." },
      { status: 400 },
    );
  }
}

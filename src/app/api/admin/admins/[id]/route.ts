import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  adminRoleLabels,
  canManageAdminRole,
  hasAdminPermission,
  normalizeAdminRole,
} from "@/lib/admin-rbac";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDatabaseSchemaMissingError } from "@/lib/prisma-errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  if (!hasAdminPermission(admin.role, "admins:manage")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await context.params;
  if (id === "env-admin") {
    return NextResponse.json(
      { error: "Env-admin управляется через переменные окружения." },
      { status: 400 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const target = await db.adminAccount
    .findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        status: true,
      },
    })
    .catch((error) => {
      if (isDatabaseSchemaMissingError(error)) {
        return null;
      }

      throw error;
    });

  if (!target) {
    return NextResponse.json({ error: "Администратор не найден" }, { status: 404 });
  }

  const nextRole =
    "role" in payload ? normalizeAdminRole(payload.role) : normalizeAdminRole(target.role);
  const nextStatus =
    payload.status === "DISABLED" || payload.status === "ACTIVE" ? payload.status : target.status;
  const password = parseText(payload.password, 160);
  const displayName = parseText(payload.displayName, 120);
  const email = "email" in payload ? parseText(payload.email, 160) || null : undefined;
  const isSelf = admin.adminAccountId === id;
  const disablesTarget = target.status === "ACTIVE" && nextStatus === "DISABLED";
  const changesSuperRole =
    normalizeAdminRole(target.role) === "SUPER_ADMIN" && nextRole !== "SUPER_ADMIN";

  if (
    !canManageAdminRole(admin.role, normalizeAdminRole(target.role)) ||
    !canManageAdminRole(admin.role, nextRole)
  ) {
    return NextResponse.json(
      { error: "Недостаточно прав для изменения этой роли." },
      { status: 403 },
    );
  }

  if (isSelf && (disablesTarget || changesSuperRole)) {
    return NextResponse.json(
      { error: "Нельзя отключить или понизить собственную учетную запись." },
      { status: 400 },
    );
  }

  if ((disablesTarget || changesSuperRole) && normalizeAdminRole(target.role) === "SUPER_ADMIN") {
    const activeSuperAdmins = await db.adminAccount.count({
      where: {
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });

    if (activeSuperAdmins <= 1) {
      return NextResponse.json(
        { error: "Нельзя отключить или понизить последнего SUPER_ADMIN." },
        { status: 409 },
      );
    }
  }

  if ("displayName" in payload && displayName.length < 2) {
    return NextResponse.json({ error: "Укажите имя администратора." }, { status: 400 });
  }

  if (password && password.length < 8) {
    return NextResponse.json(
      { error: "Пароль должен быть не короче 8 символов." },
      { status: 400 },
    );
  }

  const shouldInvalidateSessions =
    disablesTarget ||
    changesSuperRole ||
    nextRole !== normalizeAdminRole(target.role) ||
    Boolean(password);

  const account = await db.adminAccount
    .update({
      where: { id },
      data: {
        ...("displayName" in payload ? { displayName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...("role" in payload ? { role: nextRole } : {}),
        ...("status" in payload
          ? nextStatus === "DISABLED"
            ? {
                status: "DISABLED" as const,
                disabledAt: new Date(),
                disabledById: admin.id,
              }
            : {
                status: "ACTIVE" as const,
                disabledAt: null,
                disabledById: null,
              }
          : {}),
        ...(password
          ? {
              passwordHash: await hashPassword(password),
              mustChangePassword: true,
            }
          : {}),
        ...(shouldInvalidateSessions
          ? {
              sessionVersion: {
                increment: 1,
              },
            }
          : {}),
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
    })
    .catch(() => null);

  if (!account) {
    return NextResponse.json(
      { error: "Не удалось сохранить администратора. Проверьте уникальность email." },
      { status: 400 },
    );
  }

  return NextResponse.json({ item: serializeAdminAccount(account) });
}

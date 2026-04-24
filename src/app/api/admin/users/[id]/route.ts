import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getAdminSoftDeleteExpiresAt,
  isSoftDeleteWindowActive,
  purgeExpiredDeletedUsers,
} from "@/lib/admin-entity-lifecycle";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";

const USER_SOFT_DELETE_COLUMNS = ["deletedAt", "deletionExpiresAt"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const now = new Date();
  await purgeExpiredDeletedUsers(db, now);
  const { id } = await context.params;

  if (!(await areDatabaseColumnsAvailable("User", USER_SOFT_DELETE_COLUMNS))) {
    return NextResponse.json(
      {
        error:
          "Мягкое удаление пользователей временно недоступно: база данных еще не обновлена до последней миграции.",
      },
      { status: 503 },
    );
  }

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      role: true,
      deletedAt: true,
      deletionExpiresAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  if (user.role !== "USER") {
    return NextResponse.json(
      { error: "Удаление доступно только для пользовательских аккаунтов" },
      { status: 400 },
    );
  }

  if (user.deletedAt && isSoftDeleteWindowActive(user.deletionExpiresAt, now)) {
    return NextResponse.json(
      { error: "Профиль уже ожидает удаления. Используйте отмену удаления." },
      { status: 409 },
    );
  }

  const deletionExpiresAt = getAdminSoftDeleteExpiresAt(now);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        deletedAt: now,
        deletionExpiresAt,
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: "admin_schedule_delete",
        targetType: "user",
        targetId: user.id,
        details: {
          phone: user.phone,
          email: user.email,
          deletionExpiresAt: deletionExpiresAt.toISOString(),
        },
      },
    });
  });

  return NextResponse.json({
    ok: true,
    mode: "soft",
    restoreUntil: deletionExpiresAt.toISOString(),
    item: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      deletedAt: now.toISOString(),
      deletionExpiresAt: deletionExpiresAt.toISOString(),
    },
  });
}

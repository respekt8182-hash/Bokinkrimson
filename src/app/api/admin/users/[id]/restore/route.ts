import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getAdminSession } from "@/lib/admin-auth";
import { isSoftDeleteWindowActive } from "@/lib/admin-entity-lifecycle";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";

const USER_SOFT_DELETE_COLUMNS = ["deletedAt", "deletionExpiresAt"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const now = new Date();
  const { id } = await context.params;

  if (!(await areDatabaseColumnsAvailable("User", USER_SOFT_DELETE_COLUMNS))) {
    return NextResponse.json(
      {
        error:
          "Восстановление пользователей временно недоступно: база данных еще не обновлена до последней миграции.",
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
      { error: "Отмена удаления доступна только для пользовательских аккаунтов" },
      { status: 400 },
    );
  }

  if (!user.deletedAt) {
    return NextResponse.json(
      { error: "Профиль не находится в очереди на удаление" },
      { status: 400 },
    );
  }

  if (!isSoftDeleteWindowActive(user.deletionExpiresAt, now)) {
    return NextResponse.json(
      { error: "Срок отмены удаления уже истёк" },
      { status: 410 },
    );
  }

  const previousDeletedAt = user.deletedAt;

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        deletedAt: null,
        deletionExpiresAt: null,
      },
    });

    await writeAdminAuditLog(tx, {
      adminUserId: admin.id,
      action: "restore_user",
      targetType: "user",
      targetId: user.id,
      details: {
        previousDeletedAt: previousDeletedAt.toISOString(),
        previousDeletionExpiresAt: user.deletionExpiresAt?.toISOString() ?? null,
        outcome: "restored",
      },
    });
  });

  return NextResponse.json({
    ok: true,
    item: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      restoredAt: now.toISOString(),
    },
  });
}

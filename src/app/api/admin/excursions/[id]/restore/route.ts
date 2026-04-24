import { ExcursionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { EXCURSION_SOFT_DELETE_COLUMNS } from "@/lib/admin-schema-compat";
import { getAdminSession } from "@/lib/admin-auth";
import { isSoftDeleteWindowActive } from "@/lib/admin-entity-lifecycle";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";

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

  if (!(await areDatabaseColumnsAvailable("Excursion", EXCURSION_SOFT_DELETE_COLUMNS))) {
    return NextResponse.json(
      {
        error:
          "Восстановление экскурсии временно недоступно: база данных еще не обновлена до последней миграции.",
      },
      { status: 503 },
    );
  }

  const excursion = await db.excursion.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      deletedAt: true,
      deletionExpiresAt: true,
    },
  });

  if (!excursion) {
    return NextResponse.json({ error: "Программа не найдена" }, { status: 404 });
  }

  if (excursion.status !== ExcursionStatus.PUBLISHED) {
    return NextResponse.json(
      { error: "Отмена удаления доступна только для опубликованных программ" },
      { status: 400 },
    );
  }

  if (!excursion.deletedAt) {
    return NextResponse.json(
      { error: "Программа не находится в очереди на удаление" },
      { status: 400 },
    );
  }

  if (!isSoftDeleteWindowActive(excursion.deletionExpiresAt, now)) {
    return NextResponse.json({ error: "Срок отмены удаления уже истек" }, { status: 410 });
  }

  const previousDeletedAt = excursion.deletedAt;

  await db.$transaction(async (tx) => {
    await tx.excursion.update({
      where: { id: excursion.id },
      data: {
        isPublishedVisible: true,
        deletedAt: null,
        deletionExpiresAt: null,
      },
    });

    await writeAdminAuditLog(tx, {
      adminUserId: admin.id,
      action: "restore_excursion",
      targetType: "excursion",
      targetId: excursion.id,
      details: {
        previousDeletedAt: previousDeletedAt.toISOString(),
        previousDeletionExpiresAt: excursion.deletionExpiresAt?.toISOString() ?? null,
        outcome: "restored",
      },
    });
  });

  return NextResponse.json({
    ok: true,
    item: {
      id: excursion.id,
      title: excursion.title,
      restoredAt: now.toISOString(),
      restoredByAdminId: admin.id,
      isPublishedVisible: true,
    },
  });
}

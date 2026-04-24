// API route handler for /api/admin/properties/[id]/restore.
import { PropertyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getAdminSession } from "@/lib/admin-auth";
import { isSoftDeleteWindowActive } from "@/lib/admin-entity-lifecycle";
import { db } from "@/lib/db";

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

  const property = await db.property.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      ownerDeletedAt: true,
      ownerDeletionExpiresAt: true,
    },
  });

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  if (property.status !== PropertyStatus.PUBLISHED) {
    return NextResponse.json(
      {
        error: "Отмена удаления доступна только для опубликованных объектов",
      },
      { status: 400 },
    );
  }

  if (!property.ownerDeletedAt) {
    return NextResponse.json({ error: "Объект не находится в очереди на удаление" }, { status: 400 });
  }

  if (!isSoftDeleteWindowActive(property.ownerDeletionExpiresAt, now)) {
    return NextResponse.json(
      { error: "Срок отмены удаления уже истёк" },
      { status: 410 },
    );
  }

  const ownerDeletedAt = property.ownerDeletedAt;
  const ownerDeletionExpiresAt = property.ownerDeletionExpiresAt;

  await db.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: property.id },
      data: {
        isPublishedVisible: true,
        ownerDeletedAt: null,
        ownerDeletionExpiresAt: null,
      },
    });

    await writeAdminAuditLog(tx, {
      adminUserId: admin.id,
      action: "restore_property",
      targetType: "property",
      targetId: property.id,
      details: {
        previousOwnerDeletedAt: ownerDeletedAt.toISOString(),
        previousOwnerDeletionExpiresAt: ownerDeletionExpiresAt?.toISOString() ?? null,
        outcome: "restored",
      },
    });
  });

  return NextResponse.json({
    ok: true,
    item: {
      id: property.id,
      name: property.name,
      restoredAt: now.toISOString(),
      restoredByAdminId: admin.id,
      isPublishedVisible: true,
    },
  });
}

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ALLOWED_BOOL_FIELDS = ["isPublishedVisible"] as const;

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  for (const field of ALLOWED_BOOL_FIELDS) {
    if (field in payload) {
      data[field] = Boolean(payload[field]);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  const existing = await db.transfer.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Трансфер не найден" }, { status: 404 });
  }

  const updated = await db.$transaction(async (tx) => {
    const item = await tx.transfer.update({
      where: { id },
      data: data as Prisma.TransferUpdateInput,
      select: {
        id: true,
        title: true,
        status: true,
        isPublishedVisible: true,
        updatedAt: true,
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: "admin_edit",
        targetType: "transfer",
        targetId: id,
        details: { fields: Object.keys(data), title: existing.title },
      },
    });

    return item;
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      isPublishedVisible: updated.isPublishedVisible,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

// API route handler for /api/admin/messages/[id].
import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { id } = await context.params;

  const existing = await db.adminMessage.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
  }

  await db.adminMessage.delete({
    where: { id: existing.id },
  });

  await writeAdminAuditLog(db, {
    adminUserId: admin.id,
    action: "message_delete",
    targetType: "admin_message",
    targetId: existing.id,
    details: {
      outcome: "deleted",
    },
  });

  return NextResponse.json({ ok: true });
}

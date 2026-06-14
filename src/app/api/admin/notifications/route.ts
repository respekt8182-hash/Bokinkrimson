import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getAdminModerationSnapshot,
  type AdminModerationSnapshot,
} from "@/lib/admin-notifications";
import { canAccessAdminPath, type AdminRoleValue } from "@/lib/admin-rbac";

function toIso(value: number | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function buildNotificationPayload(snapshot: AdminModerationSnapshot, role: AdminRoleValue) {
  const generatedAt = Date.now();
  const categories = [
    {
      id: "properties",
      label: "Жильё на модерации",
      description: "Новые или изменённые карточки жилья ждут проверки.",
      href: "/admin/moderation",
      count: snapshot.properties.pendingCount,
      latestAtMs: snapshot.properties.latestPendingUpdatedAtMs,
      latestAt: toIso(snapshot.properties.latestPendingUpdatedAtMs),
      severity: "warning",
    },
    {
      id: "excursions",
      label: "Экскурсии на модерации",
      description: "Экскурсии и туры ожидают решения модератора.",
      href: "/admin/moderation/excursions",
      count: snapshot.excursions.pendingCount,
      latestAtMs: snapshot.excursions.latestPendingUpdatedAtMs,
      latestAt: toIso(snapshot.excursions.latestPendingUpdatedAtMs),
      severity: "info",
    },
    {
      id: "transfers",
      label: "Трансферы",
      description: "Карточки трансферов ожидают проверки.",
      href: "/admin/transfers?status=PENDING_MODERATION",
      count: snapshot.transfers.pendingCount,
      latestAtMs: snapshot.transfers.latestPendingUpdatedAtMs,
      latestAt: toIso(snapshot.transfers.latestPendingUpdatedAtMs),
      severity: "info",
    },
    {
      id: "messages",
      label: "Сообщения",
      description: "Владельцы оставили сообщения для администрации.",
      href: "/admin/messages",
      count: snapshot.messages.totalCount,
      latestAtMs: snapshot.messages.latestCreatedAtMs,
      latestAt: toIso(snapshot.messages.latestCreatedAtMs),
      severity: "neutral",
    },
    {
      id: "support-chat",
      label: "Чат поддержки",
      description: "Диалоги, где последним писал пользователь.",
      href: "/admin/support-chat",
      count: snapshot.supportChat.waitingCount,
      latestAtMs: snapshot.supportChat.latestCreatedAtMs,
      latestAt: toIso(snapshot.supportChat.latestCreatedAtMs),
      severity: "warning",
    },
    {
      id: "reviews",
      label: "Отзывы",
      description: "Импортированные отзывы ждут модерации.",
      href: "/admin/reviews",
      count: snapshot.reviews.pendingCount,
      latestAtMs: snapshot.reviews.latestCreatedAtMs,
      latestAt: toIso(snapshot.reviews.latestCreatedAtMs),
      severity: "info",
    },
    {
      id: "payments",
      label: "Оплаты менеджером",
      description: "Оплаты в статусе ожидания требуют подтверждения.",
      href: "/admin/payments",
      count: snapshot.managerPayments.pendingCount,
      latestAtMs: snapshot.managerPayments.latestCreatedAtMs,
      latestAt: toIso(snapshot.managerPayments.latestCreatedAtMs),
      severity: "danger",
    },
  ];

  const visibleCategories = categories.filter((category) => canAccessAdminPath(role, category.href));

  return {
    generatedAt: new Date(generatedAt).toISOString(),
    generatedAtMs: generatedAt,
    totalCount: visibleCategories.reduce((sum, category) => sum + category.count, 0),
    categories: visibleCategories,
  };
}

export async function GET() {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const snapshot = await getAdminModerationSnapshot();
  return NextResponse.json(buildNotificationPayload(snapshot, admin.role));
}

// Domain/service module for admin notifications.
import { ExcursionStatus, PropertyStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { buildPropertyWorkflowStatusWhere } from "@/lib/properties";

export type AdminModerationSnapshot = {
  properties: {
    pendingCount: number;
    latestPendingUpdatedAtMs: number | null;
  };
  excursions: {
    pendingCount: number;
    latestPendingUpdatedAtMs: number | null;
  };
  messages: {
    totalCount: number;
    latestCreatedAtMs: number | null;
  };
};

export async function getAdminModerationSnapshot(): Promise<AdminModerationSnapshot> {
  const [
    propertyPendingCount,
    latestPropertyPending,
    excursionPendingCount,
    latestExcursionPending,
    messageCount,
    latestMessage,
  ] = await Promise.all([
    db.property.count({ where: buildPropertyWorkflowStatusWhere(PropertyStatus.PENDING_MODERATION) }),
    db.property.findFirst({
      where: buildPropertyWorkflowStatusWhere(PropertyStatus.PENDING_MODERATION),
      orderBy: [{ updatedAt: "desc" }],
      select: { updatedAt: true },
    }),
    db.excursion.count({ where: { status: ExcursionStatus.PENDING_MODERATION } }),
    db.excursion.findFirst({
      where: { status: ExcursionStatus.PENDING_MODERATION },
      orderBy: [{ updatedAt: "desc" }],
      select: { updatedAt: true },
    }),
    db.adminMessage.count(),
    db.adminMessage.findFirst({
      orderBy: [{ createdAt: "desc" }],
      select: { createdAt: true },
    }),
  ]);

  return {
    properties: {
      pendingCount: propertyPendingCount,
      latestPendingUpdatedAtMs: latestPropertyPending?.updatedAt.getTime() ?? null,
    },
    excursions: {
      pendingCount: excursionPendingCount,
      latestPendingUpdatedAtMs: latestExcursionPending?.updatedAt.getTime() ?? null,
    },
    messages: {
      totalCount: messageCount,
      latestCreatedAtMs: latestMessage?.createdAt.getTime() ?? null,
    },
  };
}

// Domain/service module for admin notifications.
import { ExcursionStatus, PaymentProvider, PaymentStatus, PropertyStatus } from "@prisma/client";
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
  supportChat: {
    waitingCount: number;
  };
  managerPayments: {
    pendingCount: number;
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
    managerPaymentCount,
    latestManagerPayment,
    supportChatWaiting,
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
    db.payment.count({
      where: {
        provider: PaymentProvider.MANAGER,
        status: { in: [PaymentStatus.CREATED, PaymentStatus.PENDING] },
      },
    }),
    db.payment.findFirst({
      where: {
        provider: PaymentProvider.MANAGER,
        status: { in: [PaymentStatus.CREATED, PaymentStatus.PENDING] },
      },
      orderBy: [{ createdAt: "desc" }],
      select: { createdAt: true },
    }),
    // Count support chats where the last message is from a user (waiting for moderator)
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM support_chats sc
      WHERE EXISTS (
        SELECT 1 FROM support_messages sm
        WHERE sm.chat_id = sc.id
        AND sm.sender_type = 'user'
        AND sm.created_at = (
          SELECT MAX(sm2.created_at) FROM support_messages sm2
          WHERE sm2.chat_id = sc.id
        )
      )
    `.then((r) => Number(r[0]?.count ?? 0))
      .catch(() => 0),
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
    supportChat: {
      waitingCount: supportChatWaiting,
    },
    managerPayments: {
      pendingCount: managerPaymentCount,
      latestCreatedAtMs: latestManagerPayment?.createdAt.getTime() ?? null,
    },
  };
}

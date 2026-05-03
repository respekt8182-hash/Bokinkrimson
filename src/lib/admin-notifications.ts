// Domain/service module for admin notifications.
import {
  ExcursionStatus,
  PaymentProvider,
  PaymentStatus,
  PropertyStatus,
  TransferStatus,
} from "@prisma/client";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";
import { buildPropertyWorkflowStatusWhere } from "@/lib/properties";
import { buildTransferWorkflowStatusWhere } from "@/lib/transfers";

export type AdminModerationSnapshot = {
  properties: {
    pendingCount: number;
    latestPendingUpdatedAtMs: number | null;
  };
  excursions: {
    pendingCount: number;
    latestPendingUpdatedAtMs: number | null;
  };
  transfers: {
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

const emptyAdminModerationSnapshot: AdminModerationSnapshot = {
  properties: {
    pendingCount: 0,
    latestPendingUpdatedAtMs: null,
  },
  excursions: {
    pendingCount: 0,
    latestPendingUpdatedAtMs: null,
  },
  transfers: {
    pendingCount: 0,
    latestPendingUpdatedAtMs: null,
  },
  messages: {
    totalCount: 0,
    latestCreatedAtMs: null,
  },
  supportChat: {
    waitingCount: 0,
  },
  managerPayments: {
    pendingCount: 0,
    latestCreatedAtMs: null,
  },
};

export async function getAdminModerationSnapshot(): Promise<AdminModerationSnapshot> {
  return loadDataWithDatabaseFallback(
    {
      contextId: "admin-notifications",
      unavailableMessage:
        "Admin moderation snapshot: database is unavailable. Returning zero notification counters.",
      fallbackEligibleMessage:
        "Admin moderation snapshot: database is unavailable or credentials are invalid. Returning zero notification counters.",
    },
    async () => {
      const [
        propertyPendingCount,
        latestPropertyPending,
        excursionPendingCount,
        latestExcursionPending,
        transferPendingCount,
        latestTransferPending,
        messageCount,
        latestMessage,
        managerPaymentCount,
        latestManagerPayment,
        supportChatWaiting,
      ] = await Promise.all([
        db.property.count({
          where: buildPropertyWorkflowStatusWhere(PropertyStatus.PENDING_MODERATION),
        }),
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
        db.transfer.count({
          where: buildTransferWorkflowStatusWhere(TransferStatus.PENDING_MODERATION),
        }),
        db.transfer.findFirst({
          where: buildTransferWorkflowStatusWhere(TransferStatus.PENDING_MODERATION),
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
        `.then((r) => Number(r[0]?.count ?? 0)),
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
        transfers: {
          pendingCount: transferPendingCount,
          latestPendingUpdatedAtMs: latestTransferPending?.updatedAt.getTime() ?? null,
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
    },
    emptyAdminModerationSnapshot,
  );
}

import { db } from "@/lib/db";

const ADMIN_ACTION_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_ACTION_LOG_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

let lastAdminActionLogCleanupAt = 0;

export async function cleanupOldAdminActionLogs(now = new Date()): Promise<void> {
  const currentTime = now.getTime();

  if (currentTime - lastAdminActionLogCleanupAt < ADMIN_ACTION_LOG_CLEANUP_INTERVAL_MS) {
    return;
  }

  lastAdminActionLogCleanupAt = currentTime;
  const cutoff = new Date(currentTime - ADMIN_ACTION_LOG_RETENTION_MS);

  await db.adminActionLog
    .deleteMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
      },
    })
    .catch(() => undefined);
}

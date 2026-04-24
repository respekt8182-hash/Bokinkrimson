import type { DbClientLike, DbTransactionClient } from "@/lib/db";

type AdminAuditClient = Pick<DbClientLike | DbTransactionClient, "adminActionLog">;

type WriteAdminAuditLogInput = {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown> | null;
};

const redactedKeyPattern = /(password|token|secret|storagekey|credential)/i;

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        redactedKeyPattern.test(key) ? "[redacted]" : sanitizeAuditValue(nestedValue),
      ]),
    );
  }

  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 497)}...`;
  }

  return value;
}

export async function writeAdminAuditLog(
  client: AdminAuditClient,
  input: WriteAdminAuditLogInput,
): Promise<void> {
  await client.adminActionLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      details: input.details ? (sanitizeAuditValue(input.details) as Record<string, unknown>) : undefined,
    },
  });
}

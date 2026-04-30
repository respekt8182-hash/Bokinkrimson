import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

let transferReviewSupportPromise: Promise<boolean> | null = null;

export async function hasTransferReviewSupport(): Promise<boolean> {
  if (!transferReviewSupportPromise) {
    transferReviewSupportPromise = db
      .$queryRaw<Array<{ hasColumn: boolean; hasEnumValue: boolean }>>(Prisma.sql`
        SELECT
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'Review'
              AND column_name = 'transferId'
          ) AS "hasColumn",
          EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
              AND t.typname = 'ReviewEntityType'
              AND e.enumlabel = 'transfer'
          ) AS "hasEnumValue"
      `)
      .then((rows) => {
        const row = rows[0];
        return Boolean(row?.hasColumn && row?.hasEnumValue);
      })
      .catch(() => false);
  }

  return transferReviewSupportPromise;
}

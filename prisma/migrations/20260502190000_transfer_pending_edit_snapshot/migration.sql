ALTER TABLE "Transfer"
ADD COLUMN IF NOT EXISTS "pendingEditStatus" "TransferStatus",
ADD COLUMN IF NOT EXISTS "publishedSnapshot" JSONB;

CREATE INDEX IF NOT EXISTS "Transfer_pendingEditStatus_updatedAt_idx"
ON "Transfer"("pendingEditStatus", "updatedAt");

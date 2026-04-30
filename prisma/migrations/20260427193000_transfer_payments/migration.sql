ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "transferId" TEXT;

DO $$
BEGIN
  ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_transferId_fkey"
  FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Payment_transferId_status_createdAt_idx"
ON "Payment"("transferId", "status", "createdAt");

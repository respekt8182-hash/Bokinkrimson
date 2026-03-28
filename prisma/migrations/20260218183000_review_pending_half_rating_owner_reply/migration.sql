ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'pending';

ALTER TABLE "Review"
  ALTER COLUMN "rating" TYPE DECIMAL(2,1) USING "rating"::DECIMAL(2,1),
  ADD COLUMN "ownerReply" TEXT,
  ADD COLUMN "ownerRepliedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

ALTER TABLE "Transfer" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;

ALTER TABLE "Review" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "isImported" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "importedAuthorName" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalSourceUrl" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalSourceName" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "importedByOwnerId" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "verifiedByAdminId" TEXT;

CREATE INDEX IF NOT EXISTS "Review_isImported_status_createdAt_idx"
  ON "Review"("isImported", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Review_importedByOwnerId_createdAt_idx"
  ON "Review"("importedByOwnerId", "createdAt");

ALTER TABLE "Property"
  ADD COLUMN "ownerDeletedAt" TIMESTAMP(3),
  ADD COLUMN "ownerDeletionExpiresAt" TIMESTAMP(3);

CREATE INDEX "Property_ownerDeletedAt_ownerDeletionExpiresAt_idx"
  ON "Property"("ownerDeletedAt", "ownerDeletionExpiresAt");

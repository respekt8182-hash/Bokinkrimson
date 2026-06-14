ALTER TABLE "User"
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "phoneVerifiedByAdminId" TEXT;

CREATE INDEX "User_phoneVerifiedAt_idx" ON "User"("phoneVerifiedAt");

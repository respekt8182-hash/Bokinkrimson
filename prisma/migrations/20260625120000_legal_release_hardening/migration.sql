ALTER TABLE "Property"
  ADD COLUMN IF NOT EXISTS "registryNonApplicabilityReason" TEXT,
  ADD COLUMN IF NOT EXISTS "registryConfirmationText" TEXT,
  ADD COLUMN IF NOT EXISTS "registryConfirmationVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "registryConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registryConfirmationIp" TEXT,
  ADD COLUMN IF NOT EXISTS "registryConfirmationUserAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "registryReviewHistory" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "Property_registryConfirmedAt_idx" ON "Property"("registryConfirmedAt");

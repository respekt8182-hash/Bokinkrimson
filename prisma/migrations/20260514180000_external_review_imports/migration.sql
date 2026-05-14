ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'duplicate';
ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'failed';

DO $$
BEGIN
  CREATE TYPE "ExternalReviewPlatform" AS ENUM (
    'kudanamore',
    'yandex_travel',
    'avito',
    'tvil',
    'sutochno'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ExternalReviewImportStatus" AS ENUM (
    'ready',
    'running',
    'success',
    'partial',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalPlatform" "ExternalReviewPlatform";
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalReviewSourceId" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalReviewId" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalReviewFingerprint" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalStayPeriod" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalRating" DECIMAL(5,2);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalRatingScale" DECIMAL(5,2);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalImportedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalLastSeenAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalChangedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "externalPendingData" JSONB;

CREATE TABLE IF NOT EXISTS "ExternalReviewSource" (
  "id" TEXT NOT NULL,
  "entityType" "ReviewEntityType" NOT NULL DEFAULT 'property',
  "propertyId" TEXT,
  "excursionId" TEXT,
  "transferId" TEXT,
  "platform" "ExternalReviewPlatform" NOT NULL,
  "originalUrl" TEXT NOT NULL,
  "normalizedUrl" TEXT NOT NULL,
  "addedByUserId" TEXT,
  "addedByAdminId" TEXT,
  "lastImportAt" TIMESTAMP(3),
  "lastImportStatus" "ExternalReviewImportStatus" NOT NULL DEFAULT 'ready',
  "lastFoundCount" INTEGER NOT NULL DEFAULT 0,
  "lastNewCount" INTEGER NOT NULL DEFAULT 0,
  "lastDuplicateCount" INTEGER NOT NULL DEFAULT 0,
  "lastUpdatedCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCount" INTEGER NOT NULL DEFAULT 0,
  "lastSkippedByLimitCount" INTEGER NOT NULL DEFAULT 0,
  "lastMessage" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalReviewSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExternalReviewImportAttempt" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "entityType" "ReviewEntityType" NOT NULL,
  "propertyId" TEXT,
  "excursionId" TEXT,
  "transferId" TEXT,
  "platform" "ExternalReviewPlatform" NOT NULL,
  "originalUrl" TEXT NOT NULL,
  "normalizedUrl" TEXT NOT NULL,
  "triggeredByUserId" TEXT,
  "triggeredByAdminId" TEXT,
  "status" "ExternalReviewImportStatus" NOT NULL DEFAULT 'running',
  "foundCount" INTEGER NOT NULL DEFAULT 0,
  "newCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "skippedByLimitCount" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "technicalError" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "ExternalReviewImportAttempt_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "ExternalReviewSource"
    ADD CONSTRAINT "ExternalReviewSource_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ExternalReviewSource"
    ADD CONSTRAINT "ExternalReviewSource_excursionId_fkey"
    FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ExternalReviewSource"
    ADD CONSTRAINT "ExternalReviewSource_transferId_fkey"
    FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Review"
    ADD CONSTRAINT "Review_externalReviewSourceId_fkey"
    FOREIGN KEY ("externalReviewSourceId") REFERENCES "ExternalReviewSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ExternalReviewImportAttempt"
    ADD CONSTRAINT "ExternalReviewImportAttempt_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "ExternalReviewSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalReviewSource_propertyId_platform_normalizedUrl_key"
  ON "ExternalReviewSource"("propertyId", "platform", "normalizedUrl");
CREATE UNIQUE INDEX IF NOT EXISTS "ExternalReviewSource_excursionId_platform_normalizedUrl_key"
  ON "ExternalReviewSource"("excursionId", "platform", "normalizedUrl");
CREATE UNIQUE INDEX IF NOT EXISTS "ExternalReviewSource_transferId_platform_normalizedUrl_key"
  ON "ExternalReviewSource"("transferId", "platform", "normalizedUrl");
CREATE INDEX IF NOT EXISTS "ExternalReviewSource_entityType_platform_createdAt_idx"
  ON "ExternalReviewSource"("entityType", "platform", "createdAt");
CREATE INDEX IF NOT EXISTS "ExternalReviewSource_lastImportStatus_lastImportAt_idx"
  ON "ExternalReviewSource"("lastImportStatus", "lastImportAt");

CREATE INDEX IF NOT EXISTS "ExternalReviewImportAttempt_sourceId_startedAt_idx"
  ON "ExternalReviewImportAttempt"("sourceId", "startedAt");
CREATE INDEX IF NOT EXISTS "ExternalReviewImportAttempt_entityType_propertyId_startedAt_idx"
  ON "ExternalReviewImportAttempt"("entityType", "propertyId", "startedAt");
CREATE INDEX IF NOT EXISTS "ExternalReviewImportAttempt_entityType_excursionId_startedAt_idx"
  ON "ExternalReviewImportAttempt"("entityType", "excursionId", "startedAt");
CREATE INDEX IF NOT EXISTS "ExternalReviewImportAttempt_entityType_transferId_startedAt_idx"
  ON "ExternalReviewImportAttempt"("entityType", "transferId", "startedAt");
CREATE INDEX IF NOT EXISTS "ExternalReviewImportAttempt_platform_status_startedAt_idx"
  ON "ExternalReviewImportAttempt"("platform", "status", "startedAt");

CREATE INDEX IF NOT EXISTS "Review_externalReviewSourceId_createdAt_idx"
  ON "Review"("externalReviewSourceId", "createdAt");
CREATE INDEX IF NOT EXISTS "Review_externalPlatform_externalReviewFingerprint_idx"
  ON "Review"("externalPlatform", "externalReviewFingerprint");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_propertyId_externalPlatform_externalReviewId_key"
  ON "Review"("propertyId", "externalPlatform", "externalReviewId");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_excursionId_externalPlatform_externalReviewId_key"
  ON "Review"("excursionId", "externalPlatform", "externalReviewId");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_transferId_externalPlatform_externalReviewId_key"
  ON "Review"("transferId", "externalPlatform", "externalReviewId");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_propertyId_externalPlatform_externalReviewFingerprint_key"
  ON "Review"("propertyId", "externalPlatform", "externalReviewFingerprint");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_excursionId_externalPlatform_externalReviewFingerprint_key"
  ON "Review"("excursionId", "externalPlatform", "externalReviewFingerprint");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_transferId_externalPlatform_externalReviewFingerprint_key"
  ON "Review"("transferId", "externalPlatform", "externalReviewFingerprint");

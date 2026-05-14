ALTER TABLE "Review"
  DROP CONSTRAINT IF EXISTS "Review_externalReviewSourceId_fkey";

DROP TABLE IF EXISTS "ExternalReviewImportAttempt" CASCADE;
DROP TABLE IF EXISTS "ExternalReviewSource" CASCADE;
DROP TABLE IF EXISTS "ExternalReviewImportAttemptFallback" CASCADE;
DROP TABLE IF EXISTS "ExternalReviewSourceFallback" CASCADE;

DROP INDEX IF EXISTS "Review_externalReviewSourceId_createdAt_idx";
DROP INDEX IF EXISTS "Review_externalPlatform_externalReviewFingerprint_idx";
DROP INDEX IF EXISTS "Review_propertyId_externalPlatform_externalReviewId_key";
DROP INDEX IF EXISTS "Review_excursionId_externalPlatform_externalReviewId_key";
DROP INDEX IF EXISTS "Review_transferId_externalPlatform_externalReviewId_key";
DROP INDEX IF EXISTS "Review_propertyId_externalPlatform_externalReviewFingerprint_key";
DROP INDEX IF EXISTS "Review_excursionId_externalPlatform_externalReviewFingerprint_key";
DROP INDEX IF EXISTS "Review_transferId_externalPlatform_externalReviewFingerprint_key";

ALTER TABLE "Review"
  DROP COLUMN IF EXISTS "externalPlatform",
  DROP COLUMN IF EXISTS "externalReviewSourceId",
  DROP COLUMN IF EXISTS "externalReviewId",
  DROP COLUMN IF EXISTS "externalReviewFingerprint",
  DROP COLUMN IF EXISTS "externalStayPeriod",
  DROP COLUMN IF EXISTS "externalRating",
  DROP COLUMN IF EXISTS "externalRatingScale",
  DROP COLUMN IF EXISTS "externalImportedAt",
  DROP COLUMN IF EXISTS "externalLastSeenAt",
  DROP COLUMN IF EXISTS "externalChangedAt",
  DROP COLUMN IF EXISTS "externalPendingData";

ALTER TABLE IF EXISTS "ExternalReviewFallback"
  DROP COLUMN IF EXISTS "externalPlatform",
  DROP COLUMN IF EXISTS "externalReviewSourceId",
  DROP COLUMN IF EXISTS "externalReviewId",
  DROP COLUMN IF EXISTS "externalReviewFingerprint",
  DROP COLUMN IF EXISTS "externalStayPeriod",
  DROP COLUMN IF EXISTS "externalRating",
  DROP COLUMN IF EXISTS "externalRatingScale",
  DROP COLUMN IF EXISTS "externalImportedAt",
  DROP COLUMN IF EXISTS "externalLastSeenAt",
  DROP COLUMN IF EXISTS "externalChangedAt",
  DROP COLUMN IF EXISTS "externalPendingData";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExternalReviewImportStatus') THEN
    DROP TYPE "ExternalReviewImportStatus";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExternalReviewPlatform') THEN
    DROP TYPE "ExternalReviewPlatform";
  END IF;
END $$;

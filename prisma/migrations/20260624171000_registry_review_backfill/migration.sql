-- Backfill registry review status after the enum value has been committed.
-- This does not delete old cards and does not invent registry records.

UPDATE "Property"
SET "status" = 'requires_registry_review'
WHERE "status" = 'published'
  AND "classificationApplicable" = true
  AND (
    COALESCE("registryId", "registryNumber") IS NULL
    OR "registryUrl" IS NULL
    OR "registryStatus" <> 'active'
  );

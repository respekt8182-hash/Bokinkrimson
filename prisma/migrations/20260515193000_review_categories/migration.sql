ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS "reviewCategory" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "reviewHighlight" VARCHAR(160);

CREATE INDEX IF NOT EXISTS "Review_entityType_reviewCategory_status_createdAt_idx"
  ON "Review"("entityType", "reviewCategory", "status", "createdAt");

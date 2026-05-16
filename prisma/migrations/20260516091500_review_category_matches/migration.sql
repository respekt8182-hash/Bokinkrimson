ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS "reviewCategoryMatches" JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ExternalReviewFallback'
  ) THEN
    ALTER TABLE "ExternalReviewFallback"
      ADD COLUMN IF NOT EXISTS "reviewCategoryMatches" JSONB;
  END IF;
END $$;

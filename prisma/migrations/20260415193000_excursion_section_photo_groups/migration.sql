ALTER TABLE "public"."Excursion"
ADD COLUMN IF NOT EXISTS "sectionPhotoGroups" JSONB NOT NULL DEFAULT '{}'::JSONB;

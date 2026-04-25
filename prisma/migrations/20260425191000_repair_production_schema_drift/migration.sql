-- Repair production schema drift where migration history was applied but a few
-- schema columns were missing from the live database.

ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "chat_consent_given" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."Property"
ADD COLUMN IF NOT EXISTS "phoneName" TEXT,
ADD COLUMN IF NOT EXISTS "phone2" TEXT,
ADD COLUMN IF NOT EXISTS "phone2Name" TEXT,
ADD COLUMN IF NOT EXISTS "phone3" TEXT,
ADD COLUMN IF NOT EXISTS "phone3Name" TEXT,
ADD COLUMN IF NOT EXISTS "pendingEditStatus" "PropertyStatus",
ADD COLUMN IF NOT EXISTS "publishedSnapshot" JSONB;

ALTER TABLE "public"."Excursion"
ADD COLUMN IF NOT EXISTS "pendingEditStatus" "ExcursionStatus",
ADD COLUMN IF NOT EXISTS "publishedSnapshot" JSONB;

CREATE INDEX IF NOT EXISTS "Property_pendingEditStatus_updatedAt_idx"
ON "public"."Property"("pendingEditStatus", "updatedAt");

CREATE INDEX IF NOT EXISTS "Excursion_pendingEditStatus_updatedAt_idx"
ON "public"."Excursion"("pendingEditStatus", "updatedAt");

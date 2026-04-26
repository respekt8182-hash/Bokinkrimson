-- Repair production schema drift for admin counters and support chat tables.
-- The live database had some migrations marked as applied while several
-- columns/tables from the current Prisma schema were missing.

ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "pendingEmail" TEXT,
ADD COLUMN IF NOT EXISTS "emailChangeTokenHash" TEXT,
ADD COLUMN IF NOT EXISTS "emailChangeTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "emailChangeRequestedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletionExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "chat_consent_given" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."Property"
ADD COLUMN IF NOT EXISTS "phoneName" TEXT,
ADD COLUMN IF NOT EXISTS "phone2" TEXT,
ADD COLUMN IF NOT EXISTS "phone2Name" TEXT,
ADD COLUMN IF NOT EXISTS "phone3" TEXT,
ADD COLUMN IF NOT EXISTS "phone3Name" TEXT,
ADD COLUMN IF NOT EXISTS "pendingEditStatus" "PropertyStatus",
ADD COLUMN IF NOT EXISTS "publishedSnapshot" JSONB,
ADD COLUMN IF NOT EXISTS "isPublishedVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "ownerDeletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ownerDeletionExpiresAt" TIMESTAMP(3);

ALTER TABLE "public"."Excursion"
ADD COLUMN IF NOT EXISTS "contactPhone2" TEXT,
ADD COLUMN IF NOT EXISTS "pendingEditStatus" "ExcursionStatus",
ADD COLUMN IF NOT EXISTS "publishedSnapshot" JSONB,
ADD COLUMN IF NOT EXISTS "tourKind" TEXT,
ADD COLUMN IF NOT EXISTS "transportModes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "departureMode" TEXT,
ADD COLUMN IF NOT EXISTS "arrivalInfo" TEXT,
ADD COLUMN IF NOT EXISTS "departureInfo" TEXT,
ADD COLUMN IF NOT EXISTS "roomTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "documentsRequired" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "insuranceIncluded" BOOLEAN,
ADD COLUMN IF NOT EXISTS "insuranceComment" TEXT,
ADD COLUMN IF NOT EXISTS "equipmentProvided" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "safetyInfo" TEXT,
ADD COLUMN IF NOT EXISTS "routeConditions" TEXT,
ADD COLUMN IF NOT EXISTS "accommodationStars" TEXT,
ADD COLUMN IF NOT EXISTS "singleSupplementAvailable" BOOLEAN,
ADD COLUMN IF NOT EXISTS "singleSupplementPrice" DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS "mealDetails" TEXT,
ADD COLUMN IF NOT EXISTS "sectionPhotoGroups" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "isPublishedVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletionExpiresAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "public"."support_chats" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "support_chats_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_chats_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."support_messages" (
  "id" TEXT NOT NULL,
  "chat_id" TEXT NOT NULL,
  "sender_type" VARCHAR(20) NOT NULL,
  "sender_name" VARCHAR(100),
  "text" TEXT NOT NULL,
  "image_url" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_messages_chat_id_fkey"
    FOREIGN KEY ("chat_id") REFERENCES "public"."support_chats"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."chat_managers" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "photo_url" VARCHAR(500),
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chat_managers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."site_settings" (
  "key" VARCHAR(100) NOT NULL,
  "value" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_chats_user_id_key"
ON "public"."support_chats"("user_id");

CREATE INDEX IF NOT EXISTS "support_chats_updated_at_idx"
ON "public"."support_chats"("updated_at");

CREATE INDEX IF NOT EXISTS "support_messages_chat_id_created_at_idx"
ON "public"."support_messages"("chat_id", "created_at");

CREATE INDEX IF NOT EXISTS "chat_managers_is_active_idx"
ON "public"."chat_managers"("is_active");

CREATE INDEX IF NOT EXISTS "User_pendingEmail_idx"
ON "public"."User"("pendingEmail");

CREATE INDEX IF NOT EXISTS "User_deletedAt_deletionExpiresAt_createdAt_idx"
ON "public"."User"("deletedAt", "deletionExpiresAt", "createdAt");

CREATE INDEX IF NOT EXISTS "Property_isPublishedVisible_status_updatedAt_idx"
ON "public"."Property"("isPublishedVisible", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "Property_pendingEditStatus_updatedAt_idx"
ON "public"."Property"("pendingEditStatus", "updatedAt");

CREATE INDEX IF NOT EXISTS "Property_ownerDeletedAt_ownerDeletionExpiresAt_idx"
ON "public"."Property"("ownerDeletedAt", "ownerDeletionExpiresAt");

CREATE INDEX IF NOT EXISTS "Excursion_isPublishedVisible_status_updatedAt_idx"
ON "public"."Excursion"("isPublishedVisible", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "Excursion_pendingEditStatus_updatedAt_idx"
ON "public"."Excursion"("pendingEditStatus", "updatedAt");

CREATE INDEX IF NOT EXISTS "Excursion_deletedAt_deletionExpiresAt_idx"
ON "public"."Excursion"("deletedAt", "deletionExpiresAt");

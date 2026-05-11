-- Stable, human-readable public IDs for listing-like entities.
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "publicId" INTEGER;
ALTER TABLE "Excursion" ADD COLUMN IF NOT EXISTS "publicId" INTEGER;
ALTER TABLE "Transfer" ADD COLUMN IF NOT EXISTS "publicId" INTEGER;
ALTER TABLE "Attraction" ADD COLUMN IF NOT EXISTS "publicId" INTEGER;

CREATE SEQUENCE IF NOT EXISTS property_public_id_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS tour_public_id_seq START WITH 2001;
CREATE SEQUENCE IF NOT EXISTS excursion_public_id_seq START WITH 3001;
CREATE SEQUENCE IF NOT EXISTS transfer_public_id_seq START WITH 4001;
CREATE SEQUENCE IF NOT EXISTS attraction_public_id_seq START WITH 5001;

WITH baseline AS (
  SELECT GREATEST(COALESCE(MAX("publicId"), 1000), 1000) AS base_id
  FROM "Property"
),
ordered AS (
  SELECT "id", (SELECT base_id FROM baseline) + row_number() OVER (ORDER BY "createdAt", "id") AS public_id
  FROM "Property"
  WHERE "publicId" IS NULL
)
UPDATE "Property" target
SET "publicId" = ordered.public_id
FROM ordered
WHERE target."id" = ordered."id";

WITH baseline AS (
  SELECT GREATEST(COALESCE(MAX("publicId"), 2000), 2000) AS base_id
  FROM "Excursion"
  WHERE "offerType" = 'tour'
),
ordered AS (
  SELECT "id", (SELECT base_id FROM baseline) + row_number() OVER (ORDER BY "createdAt", "id") AS public_id
  FROM "Excursion"
  WHERE "publicId" IS NULL AND "offerType" = 'tour'
)
UPDATE "Excursion" target
SET "publicId" = ordered.public_id
FROM ordered
WHERE target."id" = ordered."id";

WITH baseline AS (
  SELECT GREATEST(COALESCE(MAX("publicId"), 3000), 3000) AS base_id
  FROM "Excursion"
  WHERE "offerType" <> 'tour'
),
ordered AS (
  SELECT "id", (SELECT base_id FROM baseline) + row_number() OVER (ORDER BY "createdAt", "id") AS public_id
  FROM "Excursion"
  WHERE "publicId" IS NULL AND "offerType" <> 'tour'
)
UPDATE "Excursion" target
SET "publicId" = ordered.public_id
FROM ordered
WHERE target."id" = ordered."id";

WITH baseline AS (
  SELECT GREATEST(COALESCE(MAX("publicId"), 4000), 4000) AS base_id
  FROM "Transfer"
),
ordered AS (
  SELECT "id", (SELECT base_id FROM baseline) + row_number() OVER (ORDER BY "createdAt", "id") AS public_id
  FROM "Transfer"
  WHERE "publicId" IS NULL
)
UPDATE "Transfer" target
SET "publicId" = ordered.public_id
FROM ordered
WHERE target."id" = ordered."id";

WITH baseline AS (
  SELECT GREATEST(COALESCE(MAX("publicId"), 5000), 5000) AS base_id
  FROM "Attraction"
),
ordered AS (
  SELECT "id", (SELECT base_id FROM baseline) + row_number() OVER (ORDER BY "createdAt", "id") AS public_id
  FROM "Attraction"
  WHERE "publicId" IS NULL
)
UPDATE "Attraction" target
SET "publicId" = ordered.public_id
FROM ordered
WHERE target."id" = ordered."id";

SELECT setval('property_public_id_seq', GREATEST((SELECT COALESCE(MAX("publicId"), 1000) FROM "Property"), 1000), true);
SELECT setval('tour_public_id_seq', GREATEST((SELECT COALESCE(MAX("publicId"), 2000) FROM "Excursion" WHERE "offerType" = 'tour'), 2000), true);
SELECT setval('excursion_public_id_seq', GREATEST((SELECT COALESCE(MAX("publicId"), 3000) FROM "Excursion" WHERE "offerType" <> 'tour'), 3000), true);
SELECT setval('transfer_public_id_seq', GREATEST((SELECT COALESCE(MAX("publicId"), 4000) FROM "Transfer"), 4000), true);
SELECT setval('attraction_public_id_seq', GREATEST((SELECT COALESCE(MAX("publicId"), 5000) FROM "Attraction"), 5000), true);

ALTER TABLE "Property" ALTER COLUMN "publicId" SET DEFAULT nextval('property_public_id_seq');
ALTER TABLE "Transfer" ALTER COLUMN "publicId" SET DEFAULT nextval('transfer_public_id_seq');
ALTER TABLE "Attraction" ALTER COLUMN "publicId" SET DEFAULT nextval('attraction_public_id_seq');

CREATE OR REPLACE FUNCTION set_excursion_public_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."publicId" IS NULL THEN
    IF NEW."offerType" = 'tour' THEN
      NEW."publicId" := nextval('tour_public_id_seq');
    ELSE
      NEW."publicId" := nextval('excursion_public_id_seq');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_excursion_public_id_before_insert ON "Excursion";
CREATE TRIGGER set_excursion_public_id_before_insert
BEFORE INSERT ON "Excursion"
FOR EACH ROW
EXECUTE FUNCTION set_excursion_public_id();

CREATE UNIQUE INDEX IF NOT EXISTS "Property_publicId_key" ON "Property"("publicId");
CREATE UNIQUE INDEX IF NOT EXISTS "Excursion_publicId_key" ON "Excursion"("publicId");
CREATE UNIQUE INDEX IF NOT EXISTS "Transfer_publicId_key" ON "Transfer"("publicId");
CREATE UNIQUE INDEX IF NOT EXISTS "Attraction_publicId_key" ON "Attraction"("publicId");

-- Lead numbers that are copied into messenger texts and linked back to analytics.
CREATE SEQUENCE IF NOT EXISTS listing_lead_sequence_seq START WITH 1;

CREATE TABLE IF NOT EXISTS "ListingLead" (
  "id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT nextval('listing_lead_sequence_seq'),
  "leadNumber" VARCHAR(20) NOT NULL,
  "entityType" VARCHAR(20) NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityPublicId" INTEGER,
  "ownerId" TEXT,
  "actorRole" VARCHAR(20) NOT NULL DEFAULT 'guest',
  "userId" TEXT,
  "visitorKey" VARCHAR(80),
  "source" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ListingLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ListingLead_sequence_key" ON "ListingLead"("sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "ListingLead_leadNumber_key" ON "ListingLead"("leadNumber");
CREATE INDEX IF NOT EXISTS "listing_lead_entity_created_idx" ON "ListingLead"("entityType", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "listing_lead_public_entity_created_idx" ON "ListingLead"("entityType", "entityPublicId", "createdAt");
CREATE INDEX IF NOT EXISTS "listing_lead_owner_created_idx" ON "ListingLead"("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "listing_lead_actor_created_idx" ON "ListingLead"("actorRole", "createdAt");

ALTER TABLE "ListingAnalyticsEvent" ADD COLUMN IF NOT EXISTS "entityPublicId" INTEGER;
ALTER TABLE "ListingAnalyticsEvent" ADD COLUMN IF NOT EXISTS "actorRole" VARCHAR(20) NOT NULL DEFAULT 'guest';
ALTER TABLE "ListingAnalyticsEvent" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "ListingAnalyticsEvent" ADD COLUMN IF NOT EXISTS "visitorKey" VARCHAR(80);
ALTER TABLE "ListingAnalyticsEvent" ADD COLUMN IF NOT EXISTS "isUnique" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ListingAnalyticsEvent" ADD COLUMN IF NOT EXISTS "channel" VARCHAR(40);
ALTER TABLE "ListingAnalyticsEvent" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
ALTER TABLE "ListingAnalyticsEvent" ADD COLUMN IF NOT EXISTS "leadNumber" VARCHAR(20);
ALTER TABLE "ListingAnalyticsEvent" ADD COLUMN IF NOT EXISTS "source" TEXT;

CREATE INDEX IF NOT EXISTS "la_event_public_entity_date_idx" ON "ListingAnalyticsEvent"("entityType", "entityPublicId", "eventDate");
CREATE INDEX IF NOT EXISTS "la_event_actor_date_idx" ON "ListingAnalyticsEvent"("actorRole", "eventDate");
CREATE INDEX IF NOT EXISTS "la_event_unique_date_idx" ON "ListingAnalyticsEvent"("isUnique", "eventDate");
CREATE INDEX IF NOT EXISTS "la_event_lead_number_idx" ON "ListingAnalyticsEvent"("leadNumber");

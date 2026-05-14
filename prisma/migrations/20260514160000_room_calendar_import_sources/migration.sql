CREATE TABLE IF NOT EXISTS "RoomCalendarImportSource" (
  "id" TEXT NOT NULL,
  "syncId" TEXT NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "importUrl" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncStatus" "CalendarSyncStatus",
  "lastSyncMessage" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RoomCalendarImportSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RoomCalendarImportSource_syncId_importUrl_key"
  ON "RoomCalendarImportSource"("syncId", "importUrl");

CREATE INDEX IF NOT EXISTS "RoomCalendarImportSource_syncId_isEnabled_idx"
  ON "RoomCalendarImportSource"("syncId", "isEnabled");

CREATE INDEX IF NOT EXISTS "RoomCalendarImportSource_syncId_createdAt_idx"
  ON "RoomCalendarImportSource"("syncId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "RoomCalendarImportSource"
    ADD CONSTRAINT "RoomCalendarImportSource_syncId_fkey"
    FOREIGN KEY ("syncId") REFERENCES "RoomCalendarSync"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "RoomCalendarImportSource" (
  "id",
  "syncId",
  "label",
  "importUrl",
  "isEnabled",
  "lastSyncedAt",
  "lastSyncStatus",
  "lastSyncMessage",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy_' || "id",
  "id",
  'Основной календарь',
  "importUrl",
  "isImportEnabled",
  "lastSyncedAt",
  "lastSyncStatus",
  "lastSyncMessage",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "RoomCalendarSync"
WHERE "importUrl" IS NOT NULL
  AND btrim("importUrl") <> ''
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "RoomOccupancy"
  ADD COLUMN IF NOT EXISTS "externalCalendarSourceId" TEXT;

UPDATE "RoomOccupancy" AS occupancy
SET "externalCalendarSourceId" = source."id"
FROM "RoomCalendarImportSource" AS source
WHERE occupancy."externalCalendarSyncId" = source."syncId"
  AND occupancy."externalCalendarSourceId" IS NULL;

DROP INDEX IF EXISTS "RoomOccupancy_externalCalendarSyncId_externalCalendarUid_key";

CREATE INDEX IF NOT EXISTS "RoomOccupancy_externalCalendarSourceId_idx"
  ON "RoomOccupancy"("externalCalendarSourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "RoomOccupancy_externalCalendarSourceId_externalCalendarUid_key"
  ON "RoomOccupancy"("externalCalendarSourceId", "externalCalendarUid");

DO $$
BEGIN
  ALTER TABLE "RoomOccupancy"
    ADD CONSTRAINT "RoomOccupancy_externalCalendarSourceId_fkey"
    FOREIGN KEY ("externalCalendarSourceId") REFERENCES "RoomCalendarImportSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

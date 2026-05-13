DO $$
BEGIN
  CREATE TYPE "CalendarSyncStatus" AS ENUM ('success', 'partial', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RoomCalendarSync" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "exportToken" VARCHAR(64) NOT NULL,
  "importUrl" TEXT,
  "isImportEnabled" BOOLEAN NOT NULL DEFAULT false,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncStatus" "CalendarSyncStatus",
  "lastSyncMessage" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RoomCalendarSync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RoomCalendarSync_roomId_key"
  ON "RoomCalendarSync"("roomId");

CREATE UNIQUE INDEX IF NOT EXISTS "RoomCalendarSync_exportToken_key"
  ON "RoomCalendarSync"("exportToken");

CREATE INDEX IF NOT EXISTS "RoomCalendarSync_roomId_idx"
  ON "RoomCalendarSync"("roomId");

DO $$
BEGIN
  ALTER TABLE "RoomCalendarSync"
    ADD CONSTRAINT "RoomCalendarSync_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "RoomOccupancy"
  ADD COLUMN IF NOT EXISTS "externalCalendarSyncId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalCalendarUid" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "RoomOccupancy_externalCalendarSyncId_idx"
  ON "RoomOccupancy"("externalCalendarSyncId");

CREATE UNIQUE INDEX IF NOT EXISTS "RoomOccupancy_externalCalendarSyncId_externalCalendarUid_key"
  ON "RoomOccupancy"("externalCalendarSyncId", "externalCalendarUid");

DO $$
BEGIN
  ALTER TABLE "RoomOccupancy"
    ADD CONSTRAINT "RoomOccupancy_externalCalendarSyncId_fkey"
    FOREIGN KEY ("externalCalendarSyncId") REFERENCES "RoomCalendarSync"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

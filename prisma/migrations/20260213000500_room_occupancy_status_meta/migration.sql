-- Add structured occupancy metadata for board editing/status.
DO $$
BEGIN
  CREATE TYPE "OccupancyStatus" AS ENUM ('confirmed', 'checked_in');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "RoomOccupancy"
  ADD COLUMN IF NOT EXISTS "status" "OccupancyStatus" NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS "tag" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "source" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "color" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "adultsCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "childrenCount" INTEGER NOT NULL DEFAULT 0;

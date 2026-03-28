-- Increase room occupancy description length from 200 to 250 characters.
ALTER TABLE "RoomOccupancy"
ALTER COLUMN "description" TYPE VARCHAR(250);

CREATE TYPE "RoomPriceType" AS ENUM ('per_room', 'per_person');

ALTER TABLE "RoomPrice"
ADD COLUMN "priceType" "RoomPriceType" NOT NULL DEFAULT 'per_room';

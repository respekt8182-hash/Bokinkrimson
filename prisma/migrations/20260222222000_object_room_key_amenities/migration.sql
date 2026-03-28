ALTER TABLE "ObjectRoomAmenitySetting"
  ADD COLUMN "isKeyAmenity" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ObjectRoomAmenitySetting_propertyId_isKeyAmenity_idx"
  ON "ObjectRoomAmenitySetting"("propertyId", "isKeyAmenity");

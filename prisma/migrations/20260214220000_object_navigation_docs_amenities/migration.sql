CREATE TABLE "ObjectRoomAmenitySetting" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "isPaid" BOOLEAN,
    "applyToAllCategories" BOOLEAN NOT NULL DEFAULT true,
    "categoryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ObjectRoomAmenitySetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyDocument" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PropertyDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ObjectRoomAmenitySetting_propertyId_featureId_key" ON "ObjectRoomAmenitySetting"("propertyId", "featureId");
CREATE INDEX "ObjectRoomAmenitySetting_propertyId_updatedAt_idx" ON "ObjectRoomAmenitySetting"("propertyId", "updatedAt");
CREATE INDEX "ObjectRoomAmenitySetting_featureId_idx" ON "ObjectRoomAmenitySetting"("featureId");
CREATE INDEX "PropertyDocument_propertyId_createdAt_idx" ON "PropertyDocument"("propertyId", "createdAt");

ALTER TABLE "ObjectRoomAmenitySetting"
    ADD CONSTRAINT "ObjectRoomAmenitySetting_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ObjectRoomAmenitySetting"
    ADD CONSTRAINT "ObjectRoomAmenitySetting_featureId_fkey"
    FOREIGN KEY ("featureId") REFERENCES "RoomFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyDocument"
    ADD CONSTRAINT "PropertyDocument_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

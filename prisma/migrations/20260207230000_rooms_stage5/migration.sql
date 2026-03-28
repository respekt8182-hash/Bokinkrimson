-- CreateEnum
CREATE TYPE "BathroomType" AS ENUM ('in_room', 'on_floor', 'outside');

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "beds" INTEGER NOT NULL,
    "extraBeds" INTEGER NOT NULL DEFAULT 0,
    "roomsCount" INTEGER NOT NULL,
    "areaSqm" DECIMAL(8,2),
    "bathroomType" "BathroomType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomFeature" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomFeatureOnRoom" (
    "roomId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomFeatureOnRoom_pkey" PRIMARY KEY ("roomId", "featureId")
);

-- CreateTable
CREATE TABLE "RoomCustomFeature" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomCustomFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_propertyId_isActive_updatedAt_idx" ON "Room"("propertyId", "isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "RoomFeature_category_name_idx" ON "RoomFeature"("category", "name");

-- CreateIndex
CREATE INDEX "RoomFeatureOnRoom_featureId_idx" ON "RoomFeatureOnRoom"("featureId");

-- CreateIndex
CREATE INDEX "RoomCustomFeature_roomId_name_idx" ON "RoomCustomFeature"("roomId", "name");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomFeatureOnRoom" ADD CONSTRAINT "RoomFeatureOnRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomFeatureOnRoom" ADD CONSTRAINT "RoomFeatureOnRoom_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "RoomFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomCustomFeature" ADD CONSTRAINT "RoomCustomFeature_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed room features
INSERT INTO "RoomFeature" ("id", "name", "category", "updatedAt") VALUES
  ('air_conditioner', 'Кондиционер', 'Климат', NOW()),
  ('heating', 'Отопление', 'Климат', NOW()),
  ('private_kitchen', 'Кухня', 'Кухня', NOW()),
  ('stove', 'Плита', 'Кухня', NOW()),
  ('cookware', 'Посуда', 'Кухня', NOW()),
  ('refrigerator', 'Холодильник', 'Кухня', NOW()),
  ('microwave', 'Микроволновка', 'Кухня', NOW()),
  ('tv', 'Телевизор', 'Техника', NOW()),
  ('wifi', 'Wi-Fi', 'Техника', NOW()),
  ('washing_machine', 'Стиральная машина', 'Техника', NOW()),
  ('balcony', 'Балкон', 'Комфорт', NOW()),
  ('wardrobe', 'Шкаф', 'Комфорт', NOW()),
  ('desk', 'Рабочий стол', 'Комфорт', NOW()),
  ('private_bathroom', 'Санузел в номере', 'Санузел', NOW());

-- CreateEnum
CREATE TYPE "PetsPolicy" AS ENUM ('forbidden', 'on_request');

-- CreateEnum
CREATE TYPE "SmokingPolicy" AS ENUM ('forbidden', 'on_request');

-- AlterTable
ALTER TABLE "Property"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "receiveRequests" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showEmail" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "checkInFrom" TEXT,
  ADD COLUMN "checkOutUntil" TEXT,
  ADD COLUMN "childrenAllowed" BOOLEAN,
  ADD COLUMN "childrenMinAge" INTEGER,
  ADD COLUMN "petsPolicy" "PetsPolicy",
  ADD COLUMN "smokingPolicy" "SmokingPolicy",
  ADD COLUMN "quietHoursEnabled" BOOLEAN,
  ADD COLUMN "quietHoursFrom" TEXT,
  ADD COLUMN "quietHoursTo" TEXT,
  ADD COLUMN "classificationApplicable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "starRating" INTEGER,
  ADD COLUMN "registryNumber" TEXT,
  ADD COLUMN "registryDetails" TEXT,
  ADD COLUMN "selfAssessmentPassed" BOOLEAN;

-- CreateTable
CREATE TABLE "Amenity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAmenity" (
    "propertyId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyAmenity_pkey" PRIMARY KEY ("propertyId","amenityId")
);

-- CreateTable
CREATE TABLE "PropertyCustomAmenity" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyCustomAmenity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Amenity_category_name_idx" ON "Amenity"("category", "name");

-- CreateIndex
CREATE INDEX "PropertyAmenity_amenityId_idx" ON "PropertyAmenity"("amenityId");

-- CreateIndex
CREATE INDEX "PropertyCustomAmenity_propertyId_name_idx" ON "PropertyCustomAmenity"("propertyId", "name");

-- AddForeignKey
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCustomAmenity" ADD CONSTRAINT "PropertyCustomAmenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed amenities
INSERT INTO "Amenity" ("id", "name", "category", "updatedAt") VALUES
  ('breakfast', 'Завтрак', 'Питание', NOW()),
  ('full_board', 'Полный пансион', 'Питание', NOW()),
  ('shared_kitchen', 'Общая кухня', 'Питание', NOW()),
  ('parking', 'Парковка', 'Инфраструктура', NOW()),
  ('pool', 'Бассейн', 'Инфраструктура', NOW()),
  ('wifi', 'Wi-Fi', 'Инфраструктура', NOW()),
  ('beach_access', 'Выход к пляжу', 'Инфраструктура', NOW()),
  ('playground', 'Детская площадка', 'Инфраструктура', NOW()),
  ('transfer', 'Трансфер', 'Транспорт', NOW()),
  ('airport_pickup', 'Встреча из аэропорта', 'Транспорт', NOW()),
  ('laundry', 'Прачечная', 'Сервис', NOW()),
  ('room_cleaning', 'Уборка номера', 'Сервис', NOW());

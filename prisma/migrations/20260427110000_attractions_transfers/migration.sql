-- CreateEnum
CREATE TYPE "AttractionStatus" AS ENUM ('draft', 'published', 'hidden');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('draft', 'pending_moderation', 'published', 'rejected');

-- AlterEnum
ALTER TYPE "ReviewEntityType" ADD VALUE IF NOT EXISTS 'transfer';

-- CreateTable
CREATE TABLE "Attraction" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "locationId" TEXT,
    "locationName" TEXT,
    "districtId" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "shortDescription" TEXT,
    "description" TEXT,
    "photoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "websiteUrl" TEXT,
    "status" "AttractionStatus" NOT NULL DEFAULT 'draft',
    "isPublishedVisible" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdByLogin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT,
    "slug" TEXT NOT NULL,
    "transferType" TEXT,
    "vehicleClass" TEXT,
    "vehicleModel" TEXT,
    "seats" INTEGER,
    "luggage" INTEGER,
    "locationId" TEXT,
    "locationName" TEXT,
    "districtId" TEXT,
    "serviceArea" TEXT,
    "routeExamples" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "priceFrom" DECIMAL(10,2),
    "priceUnitLabel" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "shortDescription" TEXT,
    "description" TEXT,
    "photoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "contactName" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "websiteUrl" TEXT,
    "whatsappUrl" TEXT,
    "telegramUrl" TEXT,
    "vkUrl" TEXT,
    "maxUrl" TEXT,
    "okUrl" TEXT,
    "receiveRequests" BOOLEAN NOT NULL DEFAULT true,
    "avgRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "moderationNotes" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'draft',
    "isPublishedVisible" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attraction_slug_key" ON "Attraction"("slug");

-- CreateIndex
CREATE INDEX "Attraction_status_isPublishedVisible_updatedAt_idx" ON "Attraction"("status", "isPublishedVisible", "updatedAt");

-- CreateIndex
CREATE INDEX "Attraction_locationId_status_updatedAt_idx" ON "Attraction"("locationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Attraction_districtId_status_updatedAt_idx" ON "Attraction"("districtId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_slug_key" ON "Transfer"("slug");

-- CreateIndex
CREATE INDEX "Transfer_ownerId_updatedAt_idx" ON "Transfer"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Transfer_status_isPublishedVisible_updatedAt_idx" ON "Transfer"("status", "isPublishedVisible", "updatedAt");

-- CreateIndex
CREATE INDEX "Transfer_locationId_status_updatedAt_idx" ON "Transfer"("locationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Transfer_districtId_status_updatedAt_idx" ON "Transfer"("districtId", "status", "updatedAt");

-- AddForeignKey
ALTER TABLE "Attraction" ADD CONSTRAINT "Attraction_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ExcursionLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attraction" ADD CONSTRAINT "Attraction_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "ExcursionDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ExcursionLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "ExcursionDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN "transferId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_transferId_key" ON "Review"("userId", "transferId");

-- CreateIndex
CREATE INDEX "Review_transferId_status_createdAt_idx" ON "Review"("transferId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

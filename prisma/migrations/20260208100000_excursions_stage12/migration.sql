-- CreateEnum
CREATE TYPE "ExcursionStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "ApplicationEntityType" AS ENUM ('property', 'excursion');

-- CreateEnum
CREATE TYPE "ReviewEntityType" AS ENUM ('property', 'excursion');

-- CreateTable
CREATE TABLE "Excursion" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT,
    "locationId" TEXT,
    "locationName" TEXT,
    "startPoint" TEXT,
    "description" TEXT,
    "routeDescription" TEXT,
    "durationMinutes" INTEGER,
    "scheduleText" TEXT,
    "priceFrom" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "receiveRequests" BOOLEAN NOT NULL DEFAULT true,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avgRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ExcursionStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Excursion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Excursion_ownerId_updatedAt_idx" ON "Excursion"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Excursion_status_updatedAt_idx" ON "Excursion"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "Excursion" ADD CONSTRAINT "Excursion_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Application"
  ADD COLUMN "entityType" "ApplicationEntityType" NOT NULL DEFAULT 'property',
  ADD COLUMN "excursionId" TEXT,
  ALTER COLUMN "propertyId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Application_entityType_status_createdAt_idx" ON "Application"("entityType", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Application_excursionId_status_createdAt_idx" ON "Application"("excursionId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Review"
  ADD COLUMN "entityType" "ReviewEntityType" NOT NULL DEFAULT 'property',
  ADD COLUMN "excursionId" TEXT,
  ALTER COLUMN "propertyId" DROP NOT NULL;

-- DropIndex
DROP INDEX "Review_userId_propertyId_createdAt_idx";

-- CreateIndex
CREATE INDEX "Review_entityType_createdAt_idx" ON "Review"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "Review_excursionId_status_createdAt_idx" ON "Review"("excursionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_userId_entityType_createdAt_idx" ON "Review"("userId", "entityType", "createdAt");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

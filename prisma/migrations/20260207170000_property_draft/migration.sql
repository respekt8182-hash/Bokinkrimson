-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('draft', 'paid', 'pending_moderation', 'published', 'needs_fix', 'rejected');

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" TEXT,
    "locationId" TEXT,
    "locationName" TEXT,
    "name" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "status" "PropertyStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_ownerId_updatedAt_idx" ON "Property"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Property_status_updatedAt_idx" ON "Property"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

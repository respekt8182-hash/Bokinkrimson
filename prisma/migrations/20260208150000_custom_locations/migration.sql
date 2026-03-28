-- CreateEnum
CREATE TYPE "CustomLocationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "CustomLocation" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "status" "CustomLocationStatus" NOT NULL DEFAULT 'pending',
    "sourcePropertyId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomLocation_slug_key" ON "CustomLocation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CustomLocation_normalizedName_key" ON "CustomLocation"("normalizedName");

-- CreateIndex
CREATE INDEX "CustomLocation_status_name_idx" ON "CustomLocation"("status", "name");

-- AddForeignKey
ALTER TABLE "CustomLocation" ADD CONSTRAINT "CustomLocation_sourcePropertyId_fkey" FOREIGN KEY ("sourcePropertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomLocation" ADD CONSTRAINT "CustomLocation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

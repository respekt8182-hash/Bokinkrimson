-- AlterTable
ALTER TABLE "Excursion"
ADD COLUMN "address" TEXT,
ADD COLUMN "latitude" DECIMAL(9, 6),
ADD COLUMN "longitude" DECIMAL(9, 6),
ADD COLUMN "websiteUrl" TEXT;
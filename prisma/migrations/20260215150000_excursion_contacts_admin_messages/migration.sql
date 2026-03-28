-- AlterTable
ALTER TABLE "Excursion"
ADD COLUMN "contactFirstName" TEXT,
ADD COLUMN "contactLastName" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "whatsappUrl" TEXT,
ADD COLUMN "telegramUrl" TEXT,
ADD COLUMN "vkUrl" TEXT,
ADD COLUMN "maxUrl" TEXT,
ADD COLUMN "okUrl" TEXT;

-- CreateEnum
CREATE TYPE "AdminMessageSourceType" AS ENUM ('object', 'excursion');

-- CreateTable
CREATE TABLE "AdminMessage" (
    "id" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "sourceType" "AdminMessageSourceType" NOT NULL,
    "propertyId" TEXT,
    "excursionId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminMessage_createdAt_idx" ON "AdminMessage"("createdAt");

-- CreateIndex
CREATE INDEX "AdminMessage_sourceType_createdAt_idx" ON "AdminMessage"("sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "AdminMessage_senderUserId_createdAt_idx" ON "AdminMessage"("senderUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminMessage_propertyId_createdAt_idx" ON "AdminMessage"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminMessage_excursionId_createdAt_idx" ON "AdminMessage"("excursionId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_excursionId_fkey" FOREIGN KEY ("excursionId") REFERENCES "Excursion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

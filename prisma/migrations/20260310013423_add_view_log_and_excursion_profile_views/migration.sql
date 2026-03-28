-- AlterTable
ALTER TABLE "public"."Excursion" ADD COLUMN     "profileViews" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."ViewLog" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ViewLog_entityType_entityId_date_idx" ON "public"."ViewLog"("entityType", "entityId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ViewLog_entityType_entityId_date_key" ON "public"."ViewLog"("entityType", "entityId", "date");

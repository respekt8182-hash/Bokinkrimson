CREATE TYPE "AttractionReportReason" AS ENUM (
  'wrong_location',
  'wrong_description',
  'wrong_photo',
  'outdated_data',
  'other'
);

CREATE TYPE "AttractionReportStatus" AS ENUM (
  'pending',
  'in_progress',
  'resolved',
  'dismissed'
);

CREATE TABLE "AttractionReport" (
  "id" TEXT NOT NULL,
  "attractionId" TEXT NOT NULL,
  "attractionTitle" TEXT NOT NULL,
  "attractionPath" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" "AttractionReportReason" NOT NULL,
  "status" "AttractionReportStatus" NOT NULL DEFAULT 'pending',
  "reportDate" DATE NOT NULL,
  "cooldownDays" INTEGER NOT NULL DEFAULT 1,
  "resolvedByLogin" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AttractionReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttractionReport_attractionId_reporterId_reportDate_key"
  ON "AttractionReport"("attractionId", "reporterId", "reportDate");

CREATE INDEX "AttractionReport_status_createdAt_idx"
  ON "AttractionReport"("status", "createdAt");

CREATE INDEX "AttractionReport_attractionId_status_createdAt_idx"
  ON "AttractionReport"("attractionId", "status", "createdAt");

CREATE INDEX "AttractionReport_reporterId_attractionId_createdAt_idx"
  ON "AttractionReport"("reporterId", "attractionId", "createdAt");

ALTER TABLE "AttractionReport"
  ADD CONSTRAINT "AttractionReport_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

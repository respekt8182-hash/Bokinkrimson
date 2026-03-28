ALTER TABLE "Property"
ADD COLUMN "pendingEditStatus" TEXT,
ADD COLUMN "publishedSnapshot" JSONB;

ALTER TABLE "Payment"
ADD COLUMN "placementValidUntil" TIMESTAMP(3);

CREATE INDEX "Property_pendingEditStatus_updatedAt_idx"
ON "Property"("pendingEditStatus", "updatedAt");

CREATE INDEX "Payment_propertyId_status_placementValidUntil_idx"
ON "Payment"("propertyId", "status", "placementValidUntil");

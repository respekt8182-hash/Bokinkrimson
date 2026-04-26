-- Repair production schema drift for manager-assisted payments.

ALTER TYPE "public"."PaymentProvider" ADD VALUE IF NOT EXISTS 'manager';

ALTER TABLE "public"."Payment"
ADD COLUMN IF NOT EXISTS "excursionId" TEXT,
ADD COLUMN IF NOT EXISTS "managerNotes" TEXT,
ADD COLUMN IF NOT EXISTS "confirmedById" TEXT;

ALTER TABLE "public"."Payment"
ALTER COLUMN "propertyId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Payment_excursionId_status_createdAt_idx"
ON "public"."Payment"("excursionId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Payment_provider_status_idx"
ON "public"."Payment"("provider", "status");

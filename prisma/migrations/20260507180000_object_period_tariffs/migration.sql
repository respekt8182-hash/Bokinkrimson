CREATE TYPE "ObjectPaymentStatus" AS ENUM ('paid', 'unpaid', 'demo', 'expired');
CREATE TYPE "ObjectTariffType" AS ENUM ('season', 'offseason', 'yearly', 'demo');

ALTER TABLE "Property"
ADD COLUMN "paymentStatus" "ObjectPaymentStatus" NOT NULL DEFAULT 'unpaid',
ADD COLUMN "tariffType" "ObjectTariffType",
ADD COLUMN "paidFrom" TIMESTAMP(3),
ADD COLUMN "paidUntil" TIMESTAMP(3),
ADD COLUMN "paidAmount" DECIMAL(10,2),
ADD COLUMN "paidAt" TIMESTAMP(3);

ALTER TABLE "Payment"
ADD COLUMN "tariffType" "ObjectTariffType",
ADD COLUMN "paidFrom" TIMESTAMP(3);

UPDATE "Payment"
SET
  "tariffType" = CASE
    WHEN "providerPayload"->>'placementMode' = 'demo'
      OR "providerPayload"->>'placementCampaignType' = 'free_placement_until_2026_06_20'
      OR (
        "providerPayload"->'placementPromo'->>'code' = 'launch-free-placement-2026'
        AND "providerPayload"->'placementPromo'->>'discountPercent' = '100'
        AND "providerPayload"->'placementPromo'->>'discountedAmountRub' = '0'
      )
      THEN 'demo'::"ObjectTariffType"
    WHEN "tariffCode" IN ('object_season', 'season') THEN 'season'::"ObjectTariffType"
    WHEN "tariffCode" IN ('object_offseason', 'offseason') THEN 'offseason'::"ObjectTariffType"
    WHEN "tariffCode" IN ('object_yearly', 'yearly') THEN 'yearly'::"ObjectTariffType"
    WHEN "propertyId" IS NOT NULL THEN 'yearly'::"ObjectTariffType"
    ELSE NULL
  END,
  "paidFrom" = COALESCE("paidAt", "createdAt")
WHERE "propertyId" IS NOT NULL;

WITH ranked_property_payments AS (
  SELECT
    p."propertyId",
    p."amount",
    p."tariffType",
    COALESCE(p."paidFrom", p."paidAt", p."createdAt") AS "resolvedPaidFrom",
    COALESCE(p."placementValidUntil", COALESCE(p."paidAt", p."createdAt") + INTERVAL '365 days') AS "resolvedPaidUntil",
    p."paidAt",
    p."providerPayload",
    ROW_NUMBER() OVER (
      PARTITION BY p."propertyId"
      ORDER BY
        COALESCE(p."placementValidUntil", COALESCE(p."paidAt", p."createdAt") + INTERVAL '365 days') DESC,
        COALESCE(p."paidAt", p."createdAt") DESC
    ) AS row_number
  FROM "Payment" p
  WHERE p."propertyId" IS NOT NULL
    AND p."status" = 'succeeded'
    AND p."provider" <> 'mock'
)
UPDATE "Property" property
SET
  "paymentStatus" = CASE
    WHEN latest."resolvedPaidUntil" <= NOW() THEN 'expired'::"ObjectPaymentStatus"
    WHEN latest."tariffType" = 'demo'
      OR latest."providerPayload"->>'placementMode' = 'demo'
      OR latest."providerPayload"->>'placementCampaignType' = 'free_placement_until_2026_06_20'
      THEN 'demo'::"ObjectPaymentStatus"
    ELSE 'paid'::"ObjectPaymentStatus"
  END,
  "tariffType" = latest."tariffType",
  "paidFrom" = latest."resolvedPaidFrom",
  "paidUntil" = latest."resolvedPaidUntil",
  "paidAmount" = latest."amount",
  "paidAt" = latest."paidAt"
FROM ranked_property_payments latest
WHERE latest.row_number = 1
  AND property."id" = latest."propertyId";

CREATE INDEX "Property_paymentStatus_paidUntil_idx" ON "Property"("paymentStatus", "paidUntil");
CREATE INDEX "Property_tariffType_paidUntil_idx" ON "Property"("tariffType", "paidUntil");
CREATE INDEX "Payment_propertyId_tariffType_placementValidUntil_idx" ON "Payment"("propertyId", "tariffType", "placementValidUntil");

-- Extend the launch free-placement program from "through June 20, 2026"
-- to the start of May 1, 2027 in Moscow time.

WITH free_demo_payments AS (
  SELECT "id"
  FROM "Payment"
  WHERE
    "status" = 'succeeded'::"PaymentStatus"
    AND "provider" <> 'mock'::"PaymentProvider"
    AND (
      "tariffType" = 'demo'::"ObjectTariffType"
      OR "providerPayload"->>'placementMode' = 'demo'
      OR "providerPayload"->>'placementCampaignType' IN (
        'free_placement_until_2026_06_20',
        'free_placement_until_2027_05_01'
      )
      OR "providerPayload"->>'placementDemoEndsAtIso' = '2026-06-21T00:00:00.000+03:00'
      OR (
        "providerPayload"->'placementPromo'->>'code' = 'launch-free-placement-2026'
        AND "providerPayload"->'placementPromo'->>'discountPercent' = '100'
        AND "providerPayload"->'placementPromo'->>'discountedAmountRub' = '0'
      )
    )
)
UPDATE "Payment"
SET
  "placementValidUntil" = TIMESTAMP '2027-04-30 21:00:00',
  "providerPayload" = CASE
    WHEN "providerPayload" IS NULL THEN NULL
    WHEN "providerPayload" ? 'placementPromo' THEN
      jsonb_set(
        jsonb_set(
          jsonb_set(
            "providerPayload",
            '{placementCampaignType}',
            to_jsonb('free_placement_until_2027_05_01'::text),
            true
          ),
          '{placementDemoEndsAtIso}',
          to_jsonb('2027-05-01T00:00:00.000+03:00'::text),
          true
        ),
        '{placementPromo,endsAtIso}',
        to_jsonb('2027-05-01T00:00:00.000+03:00'::text),
        true
      )
    ELSE
      jsonb_set(
        jsonb_set(
          "providerPayload",
          '{placementCampaignType}',
          to_jsonb('free_placement_until_2027_05_01'::text),
          true
        ),
        '{placementDemoEndsAtIso}',
        to_jsonb('2027-05-01T00:00:00.000+03:00'::text),
        true
      )
  END
WHERE "id" IN (SELECT "id" FROM free_demo_payments);

WITH latest_property_demo AS (
  SELECT DISTINCT ON ("propertyId")
    "propertyId",
    "amount",
    "paidFrom",
    "paidAt",
    "createdAt"
  FROM "Payment"
  WHERE
    "propertyId" IS NOT NULL
    AND "status" = 'succeeded'::"PaymentStatus"
    AND "provider" <> 'mock'::"PaymentProvider"
    AND (
      "tariffType" = 'demo'::"ObjectTariffType"
      OR "providerPayload"->>'placementMode' = 'demo'
      OR "providerPayload"->>'placementCampaignType' IN (
        'free_placement_until_2026_06_20',
        'free_placement_until_2027_05_01'
      )
      OR "providerPayload"->>'placementDemoEndsAtIso' IN (
        '2026-06-21T00:00:00.000+03:00',
        '2027-05-01T00:00:00.000+03:00'
      )
      OR (
        "providerPayload"->'placementPromo'->>'code' = 'launch-free-placement-2026'
        AND "providerPayload"->'placementPromo'->>'discountPercent' = '100'
        AND "providerPayload"->'placementPromo'->>'discountedAmountRub' = '0'
      )
    )
  ORDER BY "propertyId", "placementValidUntil" DESC, "paidAt" DESC, "createdAt" DESC
)
UPDATE "Property" AS property
SET
  "paymentStatus" = 'demo'::"ObjectPaymentStatus",
  "tariffType" = 'demo'::"ObjectTariffType",
  "paidUntil" = TIMESTAMP '2027-04-30 21:00:00',
  "paidFrom" = COALESCE(property."paidFrom", latest_property_demo."paidFrom", latest_property_demo."paidAt", latest_property_demo."createdAt"),
  "paidAmount" = latest_property_demo."amount",
  "paidAt" = COALESCE(property."paidAt", latest_property_demo."paidAt", latest_property_demo."createdAt")
FROM latest_property_demo
WHERE
  property."id" = latest_property_demo."propertyId"
  AND (
    property."tariffType" = 'demo'::"ObjectTariffType"
    OR property."paymentStatus" = 'demo'::"ObjectPaymentStatus"
    OR property."paidUntil" IS NULL
    OR property."paidUntil" <= TIMESTAMP '2026-06-20 21:00:00'
  );
